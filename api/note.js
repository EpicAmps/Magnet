import { put, head } from '@vercel/blob';

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

      // Save to Vercel Blob with fridge-specific filename
      const blobKey = `fridge-${fridgeId}.json`;
      await put(blobKey, JSON.stringify(noteData), {
        access: 'public',
        contentType: 'application/json'
      });
      
      // Ping connected fridges with this specific ID
      const { notifyFridges } = await import('./ping.js');
      notifyFridges('note_updated', { 
        message: 'New note available',
        noteId: noteData.id,
        fridgeId: fridgeId
      });
      
      return res.json({ 
        success: true, 
        message: 'Note saved to magnet-blob successfully',
        timestamp: noteData.timestamp,
        fridgeId: fridgeId
      });
      
    } else if (req.method === 'GET') {
      // Fridge fetching latest note
      const fridgeId = req.query.fridgeId;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      try {
        // Try to fetch the note from blob storage
        const blobKey = `fridge-${fridgeId}.json`;
        const blobUrl = `${process.env.BLOB_READ_WRITE_TOKEN ? 'https://' + process.env.VERCEL_URL : window.location.origin}/api/blob/${blobKey}`;
        
        // Check if blob exists first
        try {
          await head(blobKey);
        } catch (headError) {
          // Blob doesn't exist, return default message
          return res.json({ 
            content: `No notes yet for fridge ${fridgeId}! Send one from your iPhone.`,
            timestamp: Date.now(),
            id: 'default',
            fridgeId: fridgeId
          });
        }
        
        // Fetch the blob content
        const response = await fetch(blobUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch blob: ${response.status}`);
        }
        
        const note = await response.json();
        return res.json(note);
        
      } catch (error) {
        console.error('Error fetching from blob:', error);
        // Return default if blob fetch fails
        return res.json({ 
          content: `No notes yet for fridge ${fridgeId}! Send one from your iPhone.`,
          timestamp: Date.now(),
          id: 'default',
          fridgeId: fridgeId
        });
      }
      
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
