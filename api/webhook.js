// api/webhook.js - Integrated with Time-Bound Tasks + TBT Build Support
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { marked } from "marked";

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false,
});

// Detect TBT build
const isTBTBuild =
  process.env.VERCEL_GIT_COMMIT_REF?.includes("tbt") ||
  process.env.VERCEL_URL?.includes("tbt") ||
  process.env.NODE_ENV === "development";

// Initialize Firebase (skip for TBT builds if needed)
let db;
try {
  if (!isTBTBuild) {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("✅ Firebase initialized successfully");
  } else {
    console.log("🔧 TBT Build - Skipping Firebase initialization");
  }
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
}

// TBT Build Storage (in-memory fallback)
class TBTStorage {
  constructor() {
    this.notes = new Map();
  }

  async addNote(noteData) {
    const id = Date.now().toString();
    const note = { ...noteData, id };
    this.notes.set(id, note);
    return { id };
  }

  async getNotes(fridgeId) {
    return Array.from(this.notes.values())
      .filter((note) => note.fridgeId === fridgeId)
      .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
      .slice(0, 10);
  }
}

const tbtStorage = new TBTStorage();

export default async function handler(req, res) {
  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log("Method:", req.method);
  console.log("Build:", isTBTBuild ? "TBT" : "PROD");

  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Webhook-Secret",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle GET requests for EventSource (SSE)
  if (req.method === "GET" && req.url === "/api/webhook") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    res.write(
      `data: {"status":"connected","build":"${isTBTBuild ? "TBT" : "PROD"}","timestamp":${Date.now()}}\n\n`,
    );

    const heartbeat = setInterval(() => {
      res.write(`data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`);
    }, 30000);

    req.on("close", () => clearInterval(heartbeat));
    return;
  }

  // Handle GET requests for fetching notes
  if (req.method === "GET") {
    const fridgeId = req.query.fridgeId || req.query.fridge_id;

    if (!fridgeId) {
      return res.status(400).json({ error: "fridgeId is required" });
    }

    try {
      let notes = [];

      if (isTBTBuild) {
        notes = await tbtStorage.getNotes(fridgeId);
      } else {
        if (!db) {
          return res.status(500).json({ error: "Firebase not initialized" });
        }

        const notesQuery = query(
          collection(db, "notes"),
          where("fridgeId", "==", fridgeId),
          orderBy("timestamp", "desc"),
        );

        const snapshot = await getDocs(notesQuery);
        notes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate().toISOString(),
        }));
      }

      return res.status(200).json({
        success: true,
        notes,
        count: notes.length,
        build: isTBTBuild ? "TBT" : "PROD",
      });
    } catch (error) {
      console.error("❌ Error fetching notes:", error);
      return res.status(500).json({
        error: "Failed to fetch notes",
        details: error.message,
      });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isTBTBuild && !db) {
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const body = req.body;
    console.log("Body:", body);

    // Extract fridge info
    let fridgeId, fridgeName;

    if (body.to) {
      const emailMatch = body.to.match(/incoming\.magnet\+([^@]+)@/);
      if (emailMatch) {
        fridgeName = emailMatch[1].toLowerCase();
        fridgeId = generateFridgeId(fridgeName);
      }
    }

    fridgeId = fridgeId || body.fridgeId || body.fridge_id || body.id;
    fridgeName =
      fridgeName ||
      body.fridgeName ||
      body.fridge_name ||
      body.name ||
      "unknown";
    let noteContent = body.body || body.content || body.text || "";

    if (!fridgeId) {
      return res.status(400).json({ error: "fridgeId is required" });
    }

    if (!noteContent || noteContent.trim() === "") {
      return res.status(400).json({ error: "Note content is required" });
    }

    // Process content
    let processedContent = noteContent;

    // Convert Apple Notes format checkboxes
    processedContent = processedContent
      .replace(/\t◦\t/g, "- [ ] ")
      .replace(/☐\s*/g, "- [ ] ")
      .replace(/✓\s*/g, "- [x] ")
      .replace(/✅\s*/g, "- [x] ")
      .replace(/☑\s*/g, "- [x] ");

    // === TIME-BOUND TASK PROCESSING ===
    // Parse due times: @2pm, @9:30am, @11AM
    processedContent = processedContent.replace(
      /(@\d{1,2}(:\d{2})?(am|pm|AM|PM))/g,
      '<span class="due-time" data-due-time="$1">$1</span>',
    );

    // Parse due dates: @tomorrow, @friday, @2025-08-15
    processedContent = processedContent.replace(
      /(@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2}))/gi,
      '<span class="due-date" data-due-date="$1">$1</span>',
    );

    // Parse timers: @25min, @1hr, @30s, @2.5hours
    processedContent = processedContent.replace(
      /(@\d+(\.\d+)?(min|minutes|hr|hour|hours|sec|seconds|s|m|h))/gi,
      '<span class="timer" data-timer="$1">$1</span>',
    );

    // Parse combined datetime: @tomorrow 3pm, @friday 9am
    processedContent = processedContent.replace(
      /(@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday) @?\d{1,2}(:\d{2})?(am|pm|AM|PM))/gi,
      '<span class="due-datetime" data-due-datetime="$1">$1</span>',
    );

    // Parse recurring: @daily, @weekly, @monthly
    processedContent = processedContent.replace(
      /(@(daily|weekly|monthly|yearly))/gi,
      '<span class="recurring" data-recurring="$1">$1</span>',
    );

    // Parse priority: @urgent, @high, @low
    processedContent = processedContent.replace(
      /(@(urgent|high|medium|low|critical))/gi,
      '<span class="priority priority-$2" data-priority="$1">$1</span>',
    );
    // === END TIME-BOUND PROCESSING ===

    // Convert markdown to HTML
    let formattedContent = marked(processedContent);

    // IMPROVED CHECKBOX FIX - Prevents malformed attributes
    formattedContent = formattedContent.replace(
      /(<input[^>]*?)disabled([^>]*>)/gi,
      "$1$2",
    );

    // Fix malformed checkboxes completely
    formattedContent = formattedContent.replace(
      /<input([^>]*?)>/gi,
      (match, attributes) => {
        // Remove any malformed empty attributes like =""
        let cleanAttributes = attributes.replace(/\s*=""\s*/g, " ").trim();

        // Ensure type="checkbox" is present
        if (!cleanAttributes.includes("type=")) {
          cleanAttributes = `type="checkbox" ${cleanAttributes}`;
        }

        // Clean up extra spaces
        cleanAttributes = cleanAttributes.replace(/\s+/g, " ").trim();

        return `<input ${cleanAttributes}>`;
      },
    );

    // Extract tags (including time-bound status)
    const tags = extractTags(formattedContent);
    const timeBoundStatus = determineTimeBoundStatus(formattedContent);

    // Create note data with Firestore Timestamp
    const noteData = {
      content: formattedContent,
      timestamp: isTBTBuild
        ? { seconds: Math.floor(Date.now() / 1000) }
        : Timestamp.now(),
      fridgeId,
      fridgeName,
      source: "ios_shortcut",
      tags: tags,
      timeBoundStatus,
      hasTimeElements: timeBoundStatus !== "normal",
    };

    // Save to storage
    let docRef;
    if (isTBTBuild) {
      docRef = await tbtStorage.addNote(noteData);
    } else {
      docRef = await addDoc(collection(db, "notes"), noteData);
    }

    console.log("✅ Note saved successfully with ID:", docRef.id);

    // Cleanup old notes (only for Firebase)
    if (!isTBTBuild) {
      try {
        await cleanupOldNotes(fridgeId);
      } catch (cleanupError) {
        console.log("⚠️ Cleanup failed (non-critical):", cleanupError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      noteId: docRef.id,
      fridgeId,
      fridgeName,
      tags,
      timeBoundStatus,
      hasTimeElements: timeBoundStatus !== "normal",
      build: isTBTBuild ? "TBT" : "PROD",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return res.status(500).json({
      error: "Failed to process note",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Helper functions
function generateFridgeId(fridgeName) {
  let hash = 0;
  const str = fridgeName.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "fridge_" + Math.abs(hash).toString(36);
}

function extractTags(content) {
  const tags = [];
  const tagMatches = content.match(/<p[^>]*>\s*#(dad|mom|jess)\s*<\/p>/gi);

  if (tagMatches) {
    tagMatches.forEach((match) => {
      const tagMatch = match.match(/#(dad|mom|jess)/i);
      if (tagMatch) {
        const cleanTag = tagMatch[1].toLowerCase();
        if (!tags.includes(cleanTag)) {
          tags.push(cleanTag);
        }
      }
    });
  }

  return tags;
}

function determineTimeBoundStatus(content) {
  const now = new Date();

  // Check for urgent priority
  if (
    content.includes("priority-urgent") ||
    content.includes("priority-critical")
  ) {
    return "urgent";
  }

  // Check for due times/dates
  const timeMatch = content.match(
    /data-due-time="@(\d{1,2})(:\d{2})?(am|pm|AM|PM)"/i,
  );
  const dateMatch = content.match(
    /data-due-date="@(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})"/i,
  );
  const datetimeMatch = content.match(/data-due-datetime="[^"]+"/i);

  if (timeMatch || dateMatch || datetimeMatch) {
    // Parse the actual due date/time to determine status
    const dueDateTime = parseDueDateTime(timeMatch, dateMatch, datetimeMatch);
    if (dueDateTime) {
      const timeDiff = dueDateTime - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (timeDiff < 0) return "overdue";
      if (hoursDiff < 1) return "due-soon";
      if (hoursDiff < 24) return "upcoming";
    }
    return "time-bound";
  }

  // Check for timers
  if (content.includes("data-timer=")) {
    return "timer";
  }

  // Check for recurring
  if (content.includes("data-recurring=")) {
    return "recurring";
  }

  return "normal";
}

function parseDueDateTime(timeMatch, dateMatch, datetimeMatch) {
  const now = new Date();
  let targetDate = new Date();

  // Handle combined datetime first
  if (datetimeMatch) {
    const datetimeStr = datetimeMatch[0].match(
      /data-due-datetime="([^"]+)"/,
    )[1];
    // Parse combined format like "@tomorrow 3pm"
    const parts = datetimeStr.split(" ");
    if (parts.length >= 2) {
      const datePart = parts[0];
      const timePart = parts[1].replace("@", "");

      // Parse date part
      if (datePart.includes("tomorrow")) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (datePart.includes("today")) {
        // Use current date
      }

      // Parse time part
      const timeParseMatch = timePart.match(/(\d{1,2})(:\d{2})?(am|pm)/i);
      if (timeParseMatch) {
        let hours = parseInt(timeParseMatch[1]);
        const minutes = timeParseMatch[2]
          ? parseInt(timeParseMatch[2].slice(1))
          : 0;
        const ampm = timeParseMatch[3].toLowerCase();

        if (ampm === "pm" && hours !== 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;

        targetDate.setHours(hours, minutes, 0, 0);
      }

      return targetDate;
    }
  }

  // Parse date part
  if (dateMatch) {
    const dateStr = dateMatch[1].toLowerCase();
    if (dateStr === "today") {
      targetDate = new Date();
    } else if (dateStr === "tomorrow") {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      targetDate = new Date(dateStr);
    } else {
      // Handle day names
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const targetDay = days.indexOf(dateStr);
      if (targetDay !== -1) {
        targetDate = new Date();
        const currentDay = targetDate.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        targetDate.setDate(targetDate.getDate() + (daysUntilTarget || 7));
      }
    }
  }

  // Parse time part
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2].slice(1)) : 0;
    const ampm = timeMatch[3].toLowerCase();

    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    targetDate.setHours(hours, minutes, 0, 0);
  } else if (!dateMatch) {
    // If only time specified, assume today
    targetDate.setHours(9, 0, 0, 0); // Default to 9 AM
  }

  return targetDate;
}

async function cleanupOldNotes(fridgeId) {
  const notesQuery = query(
    collection(db, "notes"),
    where("fridgeId", "==", fridgeId),
    orderBy("timestamp", "desc"),
  );

  const snapshot = await getDocs(notesQuery);
  const notes = snapshot.docs;

  if (notes.length > 10) {
    const notesToDelete = notes.slice(10);
    for (const noteDoc of notesToDelete) {
      await deleteDoc(noteDoc.ref);
    }
    console.log(`Cleaned up ${notesToDelete.length} old notes`);
  }
}
