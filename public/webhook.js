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

    // Process the email data from Pipedream
    const emailData = req.body;
    console.log('Processing email webhook:', emailData);
    
    // TODO: Add your email processing logic here
    // This should match what your old email-webhook.js was doing:
    // - Extract email content, subject, sender
    // - Save to Vercel Blob storage
    // - Trigger any real-time updates
    
    return res.status(200).json({ 
      success: true, 
      message: 'Email processed successfully',
      fridgeName: emailData.fridgeName,
      fridgeId: emailData.fridgeId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Failed to process email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
