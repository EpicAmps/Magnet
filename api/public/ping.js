// Track connected fridge clients by fridge ID
const fridgeClients = new Map(); // fridgeId -> Set of response objects

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get fridge ID from query parameter
  const fridgeId = req.query.fridgeId;
  if (!fridgeId) {
    return res.status(400).json({ error: 'Fridge ID is required' });
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

  // Initialize fridge client set if it doesn't exist
  if (!fridgeClients.has(fridgeId)) {
    fridgeClients.set(fridgeId, new Set());
  }
  
  // Add this client to the fridge-specific set
  fridgeClients.get(fridgeId).add(res);
  
  // Send initial connection confirmation
  res.write(`data: {"type": "connected", "message": "Fridge ${fridgeId} connected to ping service"}\n\n`);

  // Clean up when client disconnects
  req.on('close', () => {
    const clientSet = fridgeClients.get(fridgeId);
    if (clientSet) {
      clientSet.delete(res);
      // Clean up empty sets
      if (clientSet.size === 0) {
        fridgeClients.delete(fridgeId);
      }
    }
    clearInterval(keepAlive);
  });

  // Don't end the response - keep the connection open
}

// Export function to notify specific fridge(s)
export function notifyFridges(eventType, data = {}) {
  const message = JSON.stringify({
    type: eventType,
    timestamp: Date.now(),
    ...data
  });

  const fridgeId = data.fridgeId;
  
  if (fridgeId && fridgeClients.has(fridgeId)) {
    // Notify only the specific fridge
    const clientSet = fridgeClients.get(fridgeId);
    clientSet.forEach(client => {
      try {
        client.write(`data: ${message}\n\n`);
      } catch (error) {
        // Remove dead clients
        clientSet.delete(client);
      }
    });
    console.log(`Notified ${clientSet.size} client(s) for fridge ${fridgeId}: ${eventType}`);
  } else {
    // Fallback: notify all fridges (for backwards compatibility)
    let totalNotified = 0;
    fridgeClients.forEach((clientSet, id) => {
      clientSet.forEach(client => {
        try {
          client.write(`data: ${message}\n\n`);
          totalNotified++;
        } catch (error) {
          clientSet.delete(client);
        }
      });
    });
    console.log(`Notified ${totalNotified} client(s) across all fridges: ${eventType}`);
  }
}
