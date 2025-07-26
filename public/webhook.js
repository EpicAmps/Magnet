// This endpoint should not require OIDC authentication
export default async function handler(req, res) {
  // Allow CORS for external webhooks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Add a simple security check (optional)
    const expectedSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
    
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    // Process the email data from Pipedream
    const emailData = req.body;
    console.log('Processing email webhook:', emailData);
    
    // Your email processing logic here
    // Save to database, create note, etc.
    
    return res.status(200).json({ 
      success: true, 
      message: 'Email processed successfully' 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Failed to process email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
