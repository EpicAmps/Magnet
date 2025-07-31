import { put, head, list, del } from '@vercel/blob';

async function fetchExistingNotes(fridgeId) {
  try {
    // Use the same blob listing approach as your GET method
    const blobPrefix = `fridge-${fridgeId}`;
    const { blobs } = await list({ prefix: blobPrefix });
    
    if (blobs.length === 0) {
      console.log('No existing blobs found for:', fridgeId);
      return { notes: [] };
    }
    
    // Get the most recent blob
    const mostRecentBlob = blobs.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];
    
    console.log('Found existing blob:', mostRecentBlob.pathname);
    
    // Fetch the blob content
    const response = await fetch(mostRecentBlob.url);
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
    console.log('Error fetching existing notes:', error.message);
  }
  
  return { notes: [] }; // Return empty if none found
}

export default async function handler(req, res) {
  // Enable CORS for fridge access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'POST') {
      // iOS Shortcut posting new note
      const { content, fridgeId, sender } = req.body;
      console.log('=== POST REQUEST DEBUG ===');
      console.log('Received fridgeId:', fridgeId);
      
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
        fridgeId,
        fridgeName: fridgeId, // You might want to improve this
        source: 'shortcut',
        sender: sender || 'iPhone',
        subject: 'Note from iPhone'
      };
      
      // Fetch existing notes and append new one
     
      
      const existingData = await fetchExistingNotes(fridgeId);
      console.log('Existing notes found:', existingData.notes?.length || 0);
      console.log('Existing notes:', existingData);

      const allNotes = [noteData, ...existingData.notes].slice(0, 10);
      console.log('Total notes after adding new one:', allNotes.length);
      console.log('All notes:', allNotes.map(n => ({ id: n.id, timestamp: n.timestamp })));
      
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
      
      console.log(`Note added to fridge: ${fridgeId}. Total notes: ${allNotes.length}`);
      
      return res.json({ 
        success: true, 
        message: 'Note saved to magnet-blob successfully',
        timestamp: noteData.timestamp,
        fridgeId: fridgeId,
        totalNotes: allNotes.length
      });
      
    } else if (req.method === 'DELETE') {
      // Delete all notes for fridge
      const { fridgeId } = req.body;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      try {
        // Find and delete the blob for this fridge
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
        
        return res.json({ 
          success: true, 
          message: 'All notes deleted successfully',
          fridgeId: fridgeId
        });
        
      } catch (error) {
        console.error('Error deleting notes:', error);
        return res.status(500).json({ 
          error: 'Failed to delete notes',
          details: error.message 
        });
      }
      
    } else if (req.method === 'GET') {
      // Fridge fetching notes - NEW: Return multiple notes format
      const fridgeId = req.query.fridgeId;
      
      if (!fridgeId) {
        return res.status(400).json({ error: 'Fridge ID is required' });
      }
      
      try {
        // Try direct blob access first (faster)
        const blobKey = `fridge-${fridgeId}.json`;
        
        try {
          const response = await fetch(`https://blob.vercel-storage.com/${blobKey}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Successfully retrieved notes via direct access');
            
            // Return in new multiple notes format
            if (data.notes && Array.isArray(data.notes)) {
              return res.json(data); // New format - return as-is
            } else if (data.content) {
              // Old format - convert to new format
              return res.json({
                notes: [data],
                lastUpdated: data.timestamp,
                fridgeId: fridgeId,
                fridgeName: fridgeId
              });
            }
          }
        } catch (directError) {
          console.log('Direct access failed, trying blob listing:', directError.message);
        }
        
        // Fallback: Find the blob by prefix (slower but more reliable)
        const blobPrefix = `fridge-${fridgeId}`;
        console.log('Searching for blobs with prefix:', blobPrefix);
        
        const { blobs } = await list({ prefix: blobPrefix });
        console.log('Found blobs:', blobs.map(b => b.pathname));
        
        if (blobs.length === 0) {
          console.log('No blobs found with prefix:', blobPrefix);
          return res.json({ 
            notes: [],
            lastUpdated: Date.now(),
            fridgeId: fridgeId,
            fridgeName: fridgeId
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
        
        const data = await response.json();
        console.log('Successfully retrieved notes via blob listing');
        
        // Return in new multiple notes format
        if (data.notes && Array.isArray(data.notes)) {
          return res.json(data); // New format - return as-is
        } else if (data.content) {
          // Old format - convert to new format
          return res.json({
            notes: [data],
            lastUpdated: data.timestamp,
            fridgeId: fridgeId,
            fridgeName: fridgeId
          });
        }
        
        // Empty case
        return res.json({ 
          notes: [],
          lastUpdated: Date.now(),
          fridgeId: fridgeId,
          fridgeName: fridgeId
        });
        
      } catch (error) {
        console.error('Error fetching notes:', error);
        // Return empty notes array on error instead of error message
        return res.json({ 
          notes: [],
          lastUpdated: Date.now(),
          fridgeId: fridgeId,
          fridgeName: fridgeId,
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
