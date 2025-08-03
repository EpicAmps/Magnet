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
    return res.status(400).json({ error: "fridgeId parameter is required" });
  }

  try {
    if (req.method === "GET") {
      // Get notes for fridge
      const notesQuery = query(
        collection(db, "notes"),
        where("fridgeId", "==", fridgeId),
        orderBy("timestamp", "desc"),
      );

      const snapshot = await getDocs(notesQuery);
      const notes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toMillis(), // Convert Firestore timestamp
      }));

      return res.status(200).json({
        notes,
        lastUpdated: Date.now(),
        fridgeId,
        total: notes.length,
      });
    } else if (req.method === "DELETE") {
      const { deleteAll, noteId } = req.body;

      if (deleteAll) {
        // Delete all notes for this fridge
        const notesQuery = query(
          collection(db, "notes"),
          where("fridgeId", "==", fridgeId),
        );

        const snapshot = await getDocs(notesQuery);
        const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        return res.status(200).json({
          success: true,
          message: `Deleted ${snapshot.docs.length} notes`,
        });
      } else if (noteId) {
        // Delete specific note
        await deleteDoc(doc(db, "notes", noteId));

        return res.status(200).json({
          success: true,
          message: "Note deleted successfully",
        });
      } else {
        return res
          .status(400)
          .json({ error: "Specify deleteAll=true or provide noteId" });
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
