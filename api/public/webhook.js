import { put, head } from '@vercel/blob';
import { parse } from 'querystring';
import { marked } from 'marked';

// Configure marked for fridge-friendly output
marked.setOptions({
  breaks: true,        // Convert \n to <br>
  gfm: true,          // GitHub Flavored Markdown
  sanitize: false,    // Allow HTML (we trust our own emails)
});

export default async function handler(req, res) {
  // Allow CORS for external webhooks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Optional: Check webhook secret for security
    const expectedSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = req.headers['x-webhook-secret'];
    
    if (expectedSecret && providedSecret !== expectedSecret) {
      console.log('Invalid webhook secret provided');
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    // Handle both SendGrid and Pipedream webhook formats
    const body = req.body;
    
    // Extract email data - support multiple formats
    let to, from, subject, text;
    
    // Debug: Log what we're receiving
    console.log('Webhook received data:', JSON.stringify(body, null, 2));
    console.log('Body keys:', Object.keys(body));
    console.log('Has headers?', !!body.headers);
    
    // Handle Pipedream's direct format (which you're receiving)
    if (body.to && body.from && body.body) {
      // Direct Pipedream format - this matches your logs
      to = body.to;
      from = body.from;
      subject = body.subject || 'Untitled Note';
      text = body.body; // Use body.body directly
      console.log('Using direct Pipedream format');
    } else if (body.headers && body.headers.to) {
      // Pipedream Gmail headers format
      to = body.headers.to;
      from = body.headers.from;
      subject = body.headers.subject || 'Untitled Note';
      text = body.body || body.snippet || '';
    } else if (body.to && body.from) {
      // SendGrid format
      to = body.to;
      from = body.from;
      subject = body.subject || 'Untitled Note';
      text = body.text || body.html || body.body || '';
    } else if (body.envelope) {
      // Zapier format
      to = body.envelope.to;
      from = body.envelope.from;
      subject = body.subject || 'Untitled Note';
      text = body['body-plain'] || body['body-html'] || body.text || '';
    } else {
      // Generic format - try common field names
      to = body.to || body.recipient || body.email || body['To Address'];
      from = body.from || body.sender || body['From Address'];
      subject = body.subject || body.title || body['Email Subject'] || 'Untitled Note';
      
      // Try multiple sources for email content
      text = body.body ||  // Try body.body first (Pipedream uses this)
             body.text || 
             body.content || 
             body.message || 
             body['Email Content'] || 
             body.decodedContent ||  // Gmail decoded content
             body.snippet ||  // Gmail snippet
             (body.payload && body.payload.parts && body.payload.parts[0] && body.payload.parts[0].body && body.payload.parts[0].body.data) ||
             '';
             
      // If we got base64 encoded data, decode it
      if (text && typeof text === 'string' && text.match(/^[A-Za-z0-9+/=]+$/)) {
        try {
          text = Buffer.from(text, 'base64').toString('utf-8');
        } catch (e) {
          // If decode fails, use original
        }
      }
    }
    
    console.log('Extracted fields:', { 
      to, 
      from, 
      subject, 
      text: text ? `"${text.substring(0, 50)}..." (length: ${text.length})` : 'EMPTY/NULL'
    });
    
    console.log('Received email:', { to, from, subject, source: 'webhook' });
    
    // Extract fridge name from email address
    // Support formats like: incoming.magnet+kitchen@gmail.com
    let fridgeName;
    const emailMatch = to.match(/incoming\.magnet\+([^@]+)@/);
    if (emailMatch) {
      fridgeName = emailMatch[1].toLowerCase();
    } else {
      // Fallback for other formats
      const fallbackMatch = to.match(/(?:parser\+)?([^@+]+)/);
      if (fallbackMatch) {
        fridgeName = fallbackMatch[1].toLowerCase();
      } else {
        return res.status(400).json({ error: 'Could not extract fridge name from email' });
      }
    }
    
    // Generate fridge ID from name (consistent hashing)
    const fridgeId = generateFridgeId(fridgeName);
    
    // Create note content with email metadata
    let noteContent;
    
    if (!text || text.trim() === '') {
      // If no text content, use subject + fallback message
      noteContent = subject + '\n\n(Email content could not be extracted)\n\nSent from: ' + from;
    } else {
      noteContent = formatEmailAsNote(subject, text, from);
    }
    
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

    // Save to Vercel Blob (exact same format as original)
    const blobKey = `fridge-${fridgeId}.json`;
    await put(blobKey, JSON.stringify(noteData), {
      access: 'public',
      contentType: 'application/json'
    });
    
    // Debug: Log what we saved
    console.log('Saved to blob key:', blobKey);
    console.log('Saved note data:', JSON.stringify(noteData, null, 2));
    
    // Notify connected fridges (ES6 import)
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

// Generate consistent fridge ID from name (UPDATED to match setup page)
function generateFridgeId(fridgeName) {
  // Simple hash function for consistent ID generation
  let hash = 0;
  const str = fridgeName.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the new format with fridge_ prefix
  return 'fridge_' + Math.abs(hash).toString(36);
}

// Detect if content contains markdown and format accordingly
function detectMarkdown(text) {
  // Simple heuristics to detect markdown
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headers
    /^\s*[-*+]\s/m,         // Bullet lists
    /^\s*\d+\.\s/m,         // Numbered lists
    /^\s*- \[[ x]\]/m,      // Standard checkboxes
    /☐|✓|✅|☑/,            // Apple Notes checkboxes
    /\t◦\t/,               // Apple Notes bullet format
    /\*\*.*?\*\*/,          // Bold
    /\*.*?\*/,              // Italic
    /`.*?`/,                // Code
    /^\s*>/m,               // Blockquotes
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

// Format email content as a nice note with markdown support
function formatEmailAsNote(subject, text, from) {
  // Clean up the text content first
  let cleanText = text
    .replace(/\r\n/g, '\n')   // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .trim();
  
  // PRE-PROCESS: Convert Apple Notes format BEFORE markdown detection
  let processedText = cleanText
    .replace(/\t◦\t/g, '- [ ] ')    // Apple Notes bullets to unchecked boxes
    .replace(/☐\s*/g, '- [ ] ')     // Empty checkbox symbols
    .replace(/✓\s*/g, '- [x] ')     // Checked (checkmark)
    .replace(/✅\s*/g, '- [x] ')     // Checked (green check)
    .replace(/☑\s*/g, '- [x] ');    // Checked (ballot box)
  
  // Check if content looks like markdown (AFTER Apple Notes conversion)
  const isMarkdown = detectMarkdown(processedText);
  
  console.log('Content appears to be markdown:', isMarkdown);
  console.log('Original text snippet:', cleanText.substring(0, 100));
  console.log('Processed text snippet:', processedText.substring(0, 100));
  
  let formattedContent;
  
  if (isMarkdown) {
    // Process as markdown
    try {
      // Add subject as header if not already in content
      if (subject && !processedText.toLowerCase().includes(subject.toLowerCase())) {
        processedText = `# ${subject}\n\n${processedText}`;
      }
      
      // Convert markdown to HTML
      formattedContent = marked(processedText);
      
      // Add sender attribution
      if (from && !processedText.includes(from)) {
        formattedContent += `<p class="sender-attribution">— ${from}</p>`;
      }
      
      console.log('Processed as markdown, converted Apple Notes format');
      console.log('Final HTML length:', formattedContent.length);
      
    } catch (error) {
      console.error('Markdown processing error:', error);
      // Fallback to plain text processing
      formattedContent = processAsPlainText(subject, cleanText, from);
    }
  } else {
    // Process as plain text
    formattedContent = processAsPlainText(subject, cleanText, from);
  }
  
  return formattedContent;
}

// Fallback plain text processing
function processAsPlainText(subject, text, from) {
  let cleanText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
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
