// Track connected fridge clients
const clients = new Set();

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  // Send keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    res.write('data: {"type": "ping"}\n\n');
  }, 30000);

  // Add this client to our set
  clients.add(res);
  
  // Send initial connection confirmation
  res.write('data: {"type": "connected", "message": "Fridge connected to ping service"}\n\n');

  // Clean up when client disconnects
  req.on('close', () => {
    clients.delete(res);
    clearInterval(keepAlive);
  });

  // Don't end the response - keep the connection open
}

// Export function to notify all connected fridges
export function notifyFridges(eventType, data = {}) {
  const message = JSON.stringify({
    type: eventType,
    timestamp: Date.now(),
    ...data
  });

  clients.forEach(client => {
    try {
      client.write(`data: ${message}\n\n`);
    } catch (error) {
      // Remove dead clients
      clients.delete(client);
    }
  });
  
  console.log(`Notified ${clients.size} fridge(s): ${eventType}`);
}
