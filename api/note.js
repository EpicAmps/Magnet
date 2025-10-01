import {
  loadNotes,
  deleteAllNotes,
  deleteNote,
} from "../lib/noteStore.js";

export default async function handler(req, res) {
  console.log("=== NOTE API REQUEST ===");
  console.log("Method:", req.method);
  console.log("Query:", req.query);

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
      const { notes, lastUpdated } = await loadNotes(fridgeId);

      return res.status(200).json({
        notes,
        lastUpdated,
        fridgeId,
        total: notes.length,
      });
    }

    if (req.method === "DELETE") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (error) {
          return res.status(400).json({ error: "Invalid JSON in request body" });
        }
      }

      const { deleteAll, noteId } = body || {};

      if (deleteAll) {
        const existing = await loadNotes(fridgeId);
        await deleteAllNotes(fridgeId);
        return res.status(200).json({
          success: true,
          message: "Deleted all notes",
          deletedCount: existing.notes.length,
        });
      }

      if (noteId) {
        const result = await deleteNote(fridgeId, noteId);

        if (!result.removed) {
          return res.status(404).json({ error: "Note not found" });
        }

        return res.status(200).json({
          success: true,
          message: "Note deleted successfully",
          noteId,
        });
      }

      return res.status(400).json({
        error: "Specify deleteAll=true or provide noteId",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Note API error:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
}

// IMPORTANT: DO NOT ADD ANY FRONTEND CODE BELOW THIS LINE
