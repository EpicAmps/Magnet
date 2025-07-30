// /api/send-shortcut-email.js - Email shortcut via Pipedream workflow

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, fridgeName, fridgeId } = req.body;

    if (!email || !fridgeName || !fridgeId) {
      return res.status(400).json({ error: 'Email, fridgeName, and fridgeId are required' });
    }

    console.log('📧 Sending email via Pipedream to:', email);
    console.log('🧲 Fridge details:', { fridgeName, fridgeId });

    // Call the String-generated Pipedream workflow
    const pipedreamResponse = await fetch('https://eo7jrysmazuzm9a.m.pipedream.net', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        fridgeName: fridgeName,
        fridgeId: fridgeId
      })
    });

    const result = await pipedreamResponse.text();
    console.log('📧 Pipedream response:', result);

    if (pipedreamResponse.ok) {
      console.log('✅ Email sent successfully via Pipedream');
      res.status(200).json({
        success: true,
        message: 'Shortcut email sent successfully!',
        recipient: email,
        source: 'pipedream'
      });
    } else {
      console.error('❌ Pipedream workflow failed:', pipedreamResponse.status, result);
      throw new Error(`Pipedream workflow failed: ${pipedreamResponse.status}`);
    }

  } catch (error) {
    console.error('Error sending shortcut email:', error);
    res.status(500).json({ 
      error: 'Failed to send shortcut email',
      details: error.message,
      source: 'vercel-api'
    });
  }
}
