import { kv } from '@vercel/kv';

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
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const noteData = {
        content,
        timestamp: Date.now(),
        id: `note_${Date.now()}`
      };

      // Save to Vercel KV
      await kv.set('latest-note', noteData);
      
      // Ping all connected fridges
      const { notifyFridges } = await import('./ping.js');
      notifyFridges('note_updated', { 
        message: 'New note available',
        noteId: noteData.id 
      });
      
      return res.json({ 
        success: true, 
        message: 'Note saved successfully',
        timestamp: noteData.timestamp 
      });
      
    } else if (req.method === 'GET') {
      // Fridge fetching latest note
      const note = await kv.get('latest-note');
      
      if (!note) {
        return res.json({ 
          content: 'No notes yet! Send one from your iPhone.',
          timestamp: Date.now(),
          id: 'default'
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
