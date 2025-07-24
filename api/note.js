// Simple in-memory storage for MVP - organized by fridge ID
const fridgeNotes = new Map();

export default async function handler(req, res) {
  // Enable CORS for fridge access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      // iOS Shortcut posting new note
      const { content, fridgeId } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }

      const noteData = {
        content,
        timestamp: Date.now(),
        id: `note_${Date.now()}`,
        fridgeId
      };

      // Save to fridge-specific storage
      fridgeNotes.set(fridgeId, noteData);
      
      // Ping connected fridges with this specific ID
      const { notifyFridges } = await import('./ping.js');
      notifyFridges('note_updated', { 
        message: 'New note available',
        noteId: noteData.id,
        fridgeId: fridgeId
      });
      
      return res.json({ 
        success: true, 
        message: 'Note saved successfully',
        timestamp: noteData.timestamp,
        fridgeId: fridgeId
      });
      
    } else if (req.method === 'GET') {
      // Fridge fetching latest note
      const fridgeId = req.query.fridgeId;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      const note = fridgeNotes.get(fridgeId);
      
      if (!note) {
        return res.json({ 
          content: `No notes yet for fridge ${fridgeId}! Send one from your iPhone.`,
          timestamp: Date.now(),
          id: 'default',
          fridgeId: fridgeId
        });
      }
      
      return res.json(note);
      
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
