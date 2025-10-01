// api/note.js - REST Firestore variant
import {
  fetchNotesForFridge,
  deleteNotesByFridge,
  deleteNoteById,
  findNotesByTimestamp,
} from "./firestore-client.js";

export default async function handler(req, res) {
  console.log("=== NOTE API REQUEST ===");
  console.log("Method:", req.method);
  console.log("Query:", req.query);

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
      console.log("GET request for fridgeId:", fridgeId);

      const notes = await fetchNotesForFridge(fridgeId, { limit: 25 });

      console.log(
        `Retrieved ${notes.length} notes for fridge: ${fridgeId}`,
      );

      return res.status(200).json({
        notes,
        lastUpdated: Date.now(),
        fridgeId,
        total: notes.length,
      });
    } else if (req.method === "DELETE") {
      console.log("DELETE request received");
      console.log("Request body:", req.body);

      // Parse the request body properly
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
        const deletedCount = await deleteNotesByFridge(fridgeId);
        console.log("Successfully deleted", deletedCount, "notes");

        return res.status(200).json({
          success: true,
          message: `Deleted ${deletedCount} notes`,
          deletedCount,
        });
      } else if (noteId) {
        console.log("Deleting individual note:", noteId);

        try {
          await deleteNoteById(noteId);
          console.log("Successfully deleted note by ID:", noteId);

          return res.status(200).json({
            success: true,
            message: "Note deleted successfully",
            noteId: noteId,
          });
        } catch (error) {
          console.log("Delete by ID failed, trying timestamp fallback.");

          const targetTimestamp = Number(noteId);
          if (Number.isNaN(targetTimestamp)) {
            console.log("Note identifier is not a timestamp, rethrowing");
            throw error;
          }

          const matches = await findNotesByTimestamp(fridgeId, targetTimestamp);

          if (!matches.length) {
            console.log("No note found with timestamp:", noteId);
            return res.status(404).json({ error: "Note not found" });
          }

          await Promise.all(
            matches.map((note) => deleteNoteById(note.id).catch(() => {})),
          );

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

// IMPORTANT: DO NOT ADD ANY FRONTEND CODE BELOW THIS LINE
// No window.* functions, no DOM code, no frontend debug functions!
