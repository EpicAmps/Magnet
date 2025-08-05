// api/webhook.js - Clean Final Version with Malformed Checkbox Fix
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

// Initialize Firebase
let db;
try {
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
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
}

export default async function handler(req, res) {
  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log("Method:", req.method);
  console.log("Body:", req.body);

  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Webhook-Secret",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!db) {
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const body = req.body;

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

    // Extract tags
    const tags = extractTags(formattedContent);

    // Create note data with Firestore Timestamp
    const noteData = {
      content: formattedContent,
      timestamp: Timestamp.now(),
      fridgeId,
      fridgeName,
      source: "ios_shortcut",
      tags: tags,
    };

    // Save to Firestore
    const docRef = await addDoc(collection(db, "notes"), noteData);
    console.log("✅ Note saved successfully with ID:", docRef.id);

    // Cleanup old notes
    try {
      await cleanupOldNotes(fridgeId);
    } catch (cleanupError) {
      console.log("⚠️ Cleanup failed (non-critical):", cleanupError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      noteId: docRef.id,
      fridgeId,
      fridgeName,
      tags,
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
// Detect: @2pm, @tomorrow, @friday, @2025-08-15
content = content.replace(
  /(@\d{1,2}(:\d{2})?(am|pm))/gi,
  '<span class="due-time">$1</span>',
);
