import { put, head, get, list, del } from '@vercel/blob';

async function fetchExistingNotes(fridgeId) {
  try {
    const blobKey = `fridge-${fridgeId}.json`;
    const response = await fetch(`https://blob.vercel-storage.com/${blobKey}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Handle both old format (single note) and new format (multiple notes)
      if (data.notes && Array.isArray(data.notes)) {
        return data; // New format
      } else if (data.content) {
        return { notes: [data] }; // Convert old format to new
      }
    }
  } catch (error) {
    console.log('No existing notes found or error fetching:', error.message);
  }
  
  return { notes: [] }; // Return empty if none found
}

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
      // Fetch existing notes and append new one
      const existingData = await fetchExistingNotes(fridgeId);
      const allNotes = [noteData, ...existingData.notes].slice(0, 10); // Keep newest 10 notes
      
      // Save updated notes array
      const blobKey = `fridge-${fridgeId}.json`;
      await put(blobKey, JSON.stringify({ 
        notes: allNotes,
        lastUpdated: Date.now(),
        fridgeId: fridgeId,
        fridgeName: fridgeId
      }), {
        access: 'public',
        contentType: 'application/json'
      });
      
      // Ping connected fridges with this specific ID
      // const { notifyFridges } = await import('./ping.js');
      // notifyFridges('note_updated', { 
      //   message: 'New note available',
      //   noteId: noteData.id,
      //   fridgeId: fridgeId
      // });
      
      console.log(`Note added to fridge: ${fridgeId}. Total notes: ${allNotes.length}`);
      
      return res.json({ 
        success: true, 
        message: 'Note saved to magnet-blob successfully',
        timestamp: noteData.timestamp,
        fridgeId: fridgeId,
        totalNotes: allNotes.length
      });
      
    } else if (req.method === 'DELETE') {
      // Delete note for fridge
      const { fridgeId } = req.body;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      try {
        // Find and delete the most recent blob for this fridge
        const blobPrefix = `fridge-${fridgeId}`;
        console.log('Deleting blobs with prefix:', blobPrefix);
        
        // List all blobs that start with our prefix
        const { blobs } = await list({ prefix: blobPrefix });
        
        if (blobs.length === 0) {
          return res.json({ 
            success: true,
            message: 'No notes to delete' 
          });
        }
        
        // Delete all blobs for this fridge (in case there are multiple)
        for (const blob of blobs) {
          await del(blob.pathname);
          console.log('Deleted blob:', blob.pathname);
        }
        
        // Notify connected fridges
        // const { notifyFridges } = await import('./ping.js');
        // notifyFridges('note_deleted', { 
        //   message: 'Note deleted',
        //   fridgeId: fridgeId
        // });
        
        return res.json({ 
          success: true, 
          message: 'Note deleted successfully',
          fridgeId: fridgeId
        });
        
      } catch (error) {
        console.error('Error deleting note:', error);
        return res.status(500).json({ 
          error: 'Failed to delete note',
          details: error.message 
        });
      }
      
    } else if (req.method === 'GET') {
      // Fridge fetching latest note
      const fridgeId = req.query.fridgeId;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      try {
        // Find the blob by prefix since Vercel adds random suffixes
        const blobPrefix = `fridge-${fridgeId}`;
        console.log('Searching for blobs with prefix:', blobPrefix);
        
        // List all blobs that start with our prefix
        const { blobs } = await list({ prefix: blobPrefix });
        console.log('Found blobs:', blobs.map(b => b.pathname));
        
        if (blobs.length === 0) {
          console.log('No blobs found with prefix:', blobPrefix);
          return res.json({ 
            content: `No notes yet for fridge ${fridgeId}! Send one from your iPhone.`,
            timestamp: Date.now(),
            id: 'default',
            fridgeId: fridgeId
          });
        }
        
        // Get the most recent blob (in case there are multiple)
        const mostRecentBlob = blobs.sort((a, b) => 
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )[0];
        
        console.log('Using most recent blob:', mostRecentBlob.pathname);
        
        // Fetch the blob content
        const response = await fetch(mostRecentBlob.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch blob: ${response.status}`);
        }
        
        const note = await response.json();
        console.log('Successfully retrieved note:', note);
        return res.json(note);
        
      } catch (error) {
        console.error('Error fetching from blob:', error);
        // Return default if blob fetch fails
        return res.json({ 
          content: `Error loading notes for fridge ${fridgeId}. Please try again.`,
          timestamp: Date.now(),
          id: 'error',
          fridgeId: fridgeId,
          error: error.message
        });
      }
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
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
