// api/webhook.js - Firebase version
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
} from "firebase/firestore";
import { marked } from "marked";

// Configure marked for fridge-friendly output
marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false,
});

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  // Allow CORS for external webhooks
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

  try {
    const body = req.body;

    console.log("=== FULL REQUEST BODY ===");
    console.log(JSON.stringify(body, null, 2));

    // Extract fridge info from email address
    let fridgeId, fridgeName;

    if (body.to) {
      // Parse: incoming.magnet+coolio@gmail.com → fridgeName = "coolio"
      const emailMatch = body.to.match(/incoming\.magnet\+([^@]+)@/);
      if (emailMatch) {
        fridgeName = emailMatch[1].toLowerCase(); // "coolio"
        fridgeId = generateFridgeId(fridgeName); // Convert to consistent ID
      }
    }

    // Fallback to direct fields if available
    fridgeId = fridgeId || body.fridgeId || body.fridge_id || body.id;
    fridgeName =
      fridgeName ||
      body.fridgeName ||
      body.fridge_name ||
      body.name ||
      "unknown";

    let noteContent = body.body || body.content || body.text || "";

    console.log("Extracted:", { fridgeId, fridgeName, email: body.to });
    console.log("Received note:", {
      fridgeId,
      fridgeName,
      contentLength: noteContent.length,
    });

    if (!fridgeId) {
      return res.status(400).json({ error: "fridgeId is required" });
    }

    if (!noteContent || noteContent.trim() === "") {
      return res.status(400).json({ error: "Note content is required" });
    }

    // Process content - convert markdown to HTML
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

    // Fix checkboxes - remove disabled attribute
    formattedContent = formattedContent.replace(
      /(<input[^>]*?)disabled([^>]*>)/gi,
      "$1$2",
    );
    formattedContent = formattedContent.replace(
      /<input([^>]*?)>/gi,
      (match, attributes) => {
        if (!attributes.includes("type=")) {
          return `<input type="checkbox"${attributes}>`;
        }
        return match;
      },
    );

    // Generate consistent fridge ID from name
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

    // Extract tags
    const tags = extractTags(formattedContent);

    // Create note data
    const noteData = {
      content: formattedContent,
      timestamp: new Date(),
      fridgeId,
      fridgeName,
      source: "ios_shortcut",
      tags: tags,
    };

    // Save to Firestore
    const docRef = await addDoc(collection(db, "notes"), noteData);
    console.log("Note saved with ID:", docRef.id);

    // Cleanup old notes (keep newest 10)
    await cleanupOldNotes(fridgeId);

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      noteId: docRef.id,
      fridgeId,
      fridgeName,
      tags,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({
      error: "Failed to process note",
      details: error.message,
    });
  }
}

// Extract tags from content
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

// Cleanup old notes (keep newest 10 per fridge)
async function cleanupOldNotes(fridgeId) {
  try {
    const notesQuery = query(
      collection(db, "notes"),
      where("fridgeId", "==", fridgeId),
      orderBy("timestamp", "desc"),
    );

    const snapshot = await getDocs(notesQuery);
    const notes = snapshot.docs;

    // Delete notes beyond the 10 newest
    if (notes.length > 10) {
      const notesToDelete = notes.slice(10);
      for (const noteDoc of notesToDelete) {
        await deleteDoc(noteDoc.ref);
      }
      console.log(`Cleaned up ${notesToDelete.length} old notes`);
    }
  } catch (error) {
    console.log("Cleanup failed (non-critical):", error.message);
  }
}
