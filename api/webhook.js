// api/webhook.js - Clean version without frontend code
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

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  sanitize: false,
});

console.log('=== WEBHOOK STARTUP ===');
console.log('Environment check:', {
  hasApiKey: !!process.env.FIREBASE_API_KEY,
  hasAuthDomain: !!process.env.FIREBASE_AUTH_DOMAIN,
  hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
  projectId: process.env.FIREBASE_PROJECT_ID
});

// Initialize Firebase with error handling
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
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

export default async function handler(req, res) {
  console.log('=== WEBHOOK REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body type:', typeof req.body);
  console.log('Body:', req.body);
  console.log('Timestamp:', new Date().toISOString());

  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret");

  if (req.method === "OPTIONS") {
    console.log('OPTIONS request handled');
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!db) {
    console.error('❌ Firebase not initialized');
    return res.status(500).json({ error: "Firebase not initialized" });
  }

  try {
    const body = req.body;
    console.log('Processing request body:', JSON.stringify(body, null, 2));

    // Extract fridge info
    let fridgeId, fridgeName;

    if (body.to) {
      const emailMatch = body.to.match(/incoming\.magnet\+([^@]+)@/);
      if (emailMatch) {
        fridgeName = emailMatch[1].toLowerCase();
        fridgeId = generateFridgeId(fridgeName);
        console.log('✅ Extracted from email:', { fridgeName, fridgeId });
      } else {
        console.log('❌ Email format not recognized:', body.to);
      }
    }

    fridgeId = fridgeId || body.fridgeId || body.fridge_id || body.id;
    fridgeName = fridgeName || body.fridgeName || body.fridge_name || body.name || "unknown";

    let noteContent = body.body || body.content || body.text || "";

    console.log('Final extracted values:', { fridgeId, fridgeName, contentLength: noteContent.length });

    if (!fridgeId) {
      console.log('❌ No fridgeId found');
      return res.status(400).json({ error: "fridgeId is required" });
    }

    if (!noteContent || noteContent.trim() === "") {
      console.log('❌ No content found');
      return res.status(400).json({ error: "Note content is required" });
    }

    console.log('Processing content...');
    console.log('Original content:', noteContent.substring(0, 200));

    // Process content
    let processedContent = noteContent;

    // Convert Apple Notes format checkboxes
    processedContent = processedContent
      .replace(/\t◦\t/g, "- [ ] ")
      .replace(/☐\s*/g, "- [ ] ")
      .replace(/✓\s*/g, "- [x] ")
      .replace(/✅\s*/g, "- [x] ")
      .replace(/☑\s*/g, "- [x] ");

    console.log('After checkbox conversion:', processedContent.substring(0, 200));

    // Convert markdown to HTML
    let formattedContent = marked(processedContent);
    console.log('After markdown conversion:', formattedContent.substring(0, 200));

    // Fix checkboxes
    formattedContent = formattedContent.replace(/(<input[^>]*?)disabled([^>]*>)/gi, "$1$2");
    formattedContent = formattedContent.replace(/<input([^>]*?)>/gi, (match, attributes) => {
      if (!attributes.includes("type=")) {
        return `<input type="checkbox"${attributes}>`;
      }
      return match;
    });

    console.log('After checkbox fix:', formattedContent.substring(0, 200));

    // Extract tags
    const tags = extractTags(formattedContent);
    console.log('Extracted tags:', tags);

    // Create note data
    const noteData = {
      content: formattedContent,
      timestamp: new Date(),
      fridgeId,
      fridgeName,
      source: "ios_shortcut",
      tags: tags,
    };

    console.log('Saving note data:', {
      ...noteData,
      content: noteData.content.substring(0, 100) + '...'
    });

    // Save to Firestore
    const docRef = await addDoc(collection(db, "notes"), noteData);
    console.log('✅ Note saved successfully with ID:', docRef.id);

    // Cleanup old notes
    try {
      await cleanupOldNotes(fridgeId);
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.log('⚠️ Cleanup failed (non-critical):', cleanupError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Note saved successfully",
      noteId: docRef.id,
      fridgeId,
      fridgeName,
      tags,
      timestamp: new Date().toISOString(),
      debugInfo: {
        contentLength: formattedContent.length,
        processedLength: processedContent.length,
        originalLength: noteContent.length
      }
    });

  } catch (error) {
    console.error('❌ WEBHOOK ERROR:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: "Failed to process note",
      details: error.message,
      timestamp: new Date().toISOString()
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
  try {
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
  } catch (error) {
    console.log("Cleanup failed (non-critical):", error.message);
  }
}
