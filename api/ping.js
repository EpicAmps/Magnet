// /api/ping.js - API endpoint that also exports notification functions

// Default export - API handler function (required by Vercel)
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, data } = req.body;
    const result = await notifyFridges(action, data);
    return res.json(result);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}

// Named export - notification function for other modules to import
export async function notifyFridges(action, data) {
  // For MVP, just log the notifications
  console.log(`📱 Notification: ${action}`, {
    message: data.message,
    fridgeId: data.fridgeId,
    timestamp: new Date().toISOString()
  });
  
  // Later you could add:
  // - WebSocket notifications
  // - Push notifications  
  // - Email alerts
  // - etc.
  
  return { 
    success: true, 
    action: action,
    timestamp: Date.now()
  };
}
