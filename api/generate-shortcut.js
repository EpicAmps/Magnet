// /api/generate-shortcut.js - Dynamic Shortcut Generator for Vercel

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fridgeName, fridgeId } = req.body;

    if (!fridgeName || !fridgeId) {
      return res.status(400).json({ error: 'fridgeName and fridgeId are required' });
    }

    // Create the shortcut file URL (we'll serve it from another endpoint)
    const baseUrl = req.headers.origin || `https://${req.headers.host}` || 'https://magnet-mu.vercel.app';
    const shortcutUrl = `${baseUrl}/api/shortcut/${fridgeId}`;
    
    // Generate QR code using a simple canvas-based approach or external service
    // For now, using QR Server API (free service)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shortcutUrl)}`;

    // Return the QR code URL and shortcut info
    res.status(200).json({
      success: true,
      qrCode: qrCodeUrl,
      shortcutUrl: shortcutUrl,
      fridgeName: fridgeName,
      fridgeEmail: `incoming.magnet+${fridgeName}@gmail.com`,
      instructions: [
        "1. Open Camera app on your iPhone",
        "2. Point camera at the QR code below", 
        "3. Tap the notification that appears",
        "4. Tap 'Get Shortcut' to install",
        "5. The shortcut will be named 'Send to Magnet'"
      ]
    });

  } catch (error) {
    console.error('Error generating shortcut:', error);
    res.status(500).json({ 
      error: 'Failed to generate shortcut',
      details: error.message 
    });
  }
}
