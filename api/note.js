// api/note.js - Firebase version
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// Initialize Firebase (same config as webhook)
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
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const fridgeId = req.query.fridgeId;

  if (!fridgeId) {
    console.log("Missing fridgeId in query:", req.query);
    return res.status(400).json({ error: "fridgeId parameter is required" });
  }

  try {
    if (req.method === "GET") {
      // ... your existing GET logic ...
    } else if (req.method === "DELETE") {
      console.log("DELETE request received");
      console.log("Request body:", req.body);
      console.log("fridgeId from query:", fridgeId);

      // CRITICAL: Parse the request body properly
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {
          console.error("Failed to parse request body:", e);
          return res
            .status(400)
            .json({ error: "Invalid JSON in request body" });
        }
      }

      const { deleteAll, noteId } = body;
      console.log("Parsed delete request:", { deleteAll, noteId, fridgeId });

      if (deleteAll) {
        console.log("Deleting all notes for fridge:", fridgeId);

        // Delete all notes for this fridge
        const notesQuery = query(
          collection(db, "notes"),
          where("fridgeId", "==", fridgeId),
        );

        const snapshot = await getDocs(notesQuery);
        console.log("Found", snapshot.docs.length, "notes to delete");

        const deletePromises = snapshot.docs.map((doc) => {
          console.log("Deleting note:", doc.id);
          return deleteDoc(doc.ref);
        });

        await Promise.all(deletePromises);
        console.log("Successfully deleted all notes");

        return res.status(200).json({
          success: true,
          message: `Deleted ${snapshot.docs.length} notes`,
          deletedCount: snapshot.docs.length,
        });
      } else if (noteId) {
        console.log("Deleting individual note:", noteId);

        try {
          // Try to delete by document ID first
          await deleteDoc(doc(db, "notes", noteId));
          console.log("Successfully deleted note by ID:", noteId);

          return res.status(200).json({
            success: true,
            message: "Note deleted successfully",
            noteId: noteId,
          });
        } catch (error) {
          console.log(
            "Failed to delete by ID, trying by timestamp:",
            error.message,
          );

          // If that fails, try to find and delete by timestamp
          const notesQuery = query(
            collection(db, "notes"),
            where("fridgeId", "==", fridgeId),
            where("timestamp", "==", parseInt(noteId)),
          );

          const snapshot = await getDocs(notesQuery);

          if (snapshot.empty) {
            console.log("No note found with timestamp:", noteId);
            return res.status(404).json({ error: "Note not found" });
          }

          const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
          await Promise.all(deletePromises);

          console.log("Successfully deleted note by timestamp:", noteId);

          return res.status(200).json({
            success: true,
            message: "Note deleted successfully",
            noteId: noteId,
            method: "timestamp",
          });
        }
      } else {
        console.log("Invalid delete request - missing deleteAll or noteId");
        return res.status(400).json({
          error: "Specify deleteAll=true or provide noteId",
          received: { deleteAll, noteId },
        });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Note API error:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
}

function testDeleteAllRequest() {
  console.log("=== TESTING DELETE ALL REQUEST ===");

  const requestBody = {
    fridgeId: fridgeId,
    deleteAll: true,
  };

  console.log("Sending request:", requestBody);

  fetch(API_BASE + "/api/note", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })
    .then((response) => {
      console.log("Response status:", response.status);
      return response.text();
    })
    .then((text) => {
      console.log("Response body:", text);
    })
    .catch((error) => {
      console.error("Request failed:", error);
    });
}

window.testDeleteAllRequest = testDeleteAllRequest;

console.log("🔧 Debug functions available:");
console.log("  - debugDeleteRequest(noteIndex, noteId)");
console.log("  - testDeleteAllRequest()");
