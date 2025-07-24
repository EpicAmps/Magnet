import { put, head } from '@vercel/blob';
import { parse } from 'querystring';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse SendGrid webhook data (multipart/form-data)
    const body = req.body;
    
    // Extract email data from SendGrid webhook
    const to = body.to || '';
    const from = body.from || '';
    const subject = body.subject || 'Untitled Note';
    const text = body.text || body.html || '';
    
    console.log('Received email:', { to, from, subject });
    
    // Extract fridge name from email address (e.g., kitchen@magnet-mu.vercel.app)
    const emailMatch = to.match(/^([^@]+)@/);
    if (!emailMatch) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const fridgeName = emailMatch[1].toLowerCase();
    
    // Generate fridge ID from name (consistent hashing)
    const fridgeId = generateFridgeId(fridgeName);
    
    // Create note content with email metadata
    const noteContent = formatEmailAsNote(subject, text, from);
    
    const noteData = {
      content: noteContent,
      timestamp: Date.now(),
      id: `email_${Date.now()}`,
      fridgeId,
      fridgeName,
      source: 'email',
      sender: from,
      subject
    };

    // Save to Vercel Blob
    const blobKey = `fridge-${fridgeId}.json`;
    await put(blobKey, JSON.stringify(noteData), {
      access: 'public',
      contentType: 'application/json'
    });
    
    // Notify connected fridges
    const { notifyFridges } = await import('./ping.js');
    notifyFridges('note_updated', { 
      message: `New email from ${from}`,
      noteId: noteData.id,
      fridgeId: fridgeId,
      fridgeName: fridgeName
    });
    
    console.log(`Email processed for fridge: ${fridgeName} (${fridgeId})`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Email processed successfully',
      fridgeName,
      fridgeId,
      timestamp: noteData.timestamp 
    });
    
  } catch (error) {
    console.error('Email webhook error:', error);
    return res.status(500).json({ 
      error: 'Failed to process email',
      details: error.message 
    });
  }
}

// Generate consistent fridge ID from name
function generateFridgeId(fridgeName) {
  // Simple hash function for consistent ID generation
  let hash = 0;
  for (let i = 0; i < fridgeName.length; i++) {
    const char = fridgeName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base36 and ensure it's 12 characters
  const baseId = Math.abs(hash).toString(36);
  return (baseId + '000000000000').substring(0, 12);
}

// Format email content as a nice note
function formatEmailAsNote(subject, text, from) {
  // Clean up the text content
  let cleanText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\r\n/g, '\n')   // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .trim();
  
  // If subject exists and isn't already in the text, add it as a header
  if (subject && !cleanText.toLowerCase().includes(subject.toLowerCase())) {
    cleanText = `${subject}\n\n${cleanText}`;
  }
  
  // Add sender info at the bottom if not obvious
  if (from && !cleanText.includes(from)) {
    cleanText += `\n\n— ${from}`;
  }
  
  return cleanText;
}
