// /api/ping.js - API endpoint that also exports notification functions

// Default export - API handler function (required by Vercel)
export default async function handler(req, res) {
  console.log("=== PING REQUEST ===");
  console.log("Method:", req.method);

  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle EventSource connections (GET requests)
  if (req.method === "GET") {
    console.log("🔗 EventSource connection to /api/ping");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send initial connection message
    res.write(
      `data: {"status":"connected","endpoint":"ping","timestamp":${Date.now()}}\n\n`,
    );

    // Send periodic heartbeats
    const heartbeat = setInterval(() => {
      res.write(`data: {"type":"heartbeat","timestamp":${Date.now()}}\n\n`);
    }, 30000);

    // Cleanup on connection close
    req.on("close", () => {
      console.log("🔌 EventSource connection closed");
      clearInterval(heartbeat);
    });

    return;
  }

  // ADD THIS BACK: Your original POST handler for notifications
  if (req.method === "POST") {
    const { action, data } = req.body;
    const result = await notifyFridges(action, data);
    return res.json(result);
  }

  // ADD THIS: Handle unsupported methods
  return res.status(405).json({ error: "Method not allowed" });
}

// Named export - notification function for other modules to import
export async function notifyFridges(action, data) {
  // For MVP, just log the notifications
  console.log(`📱 Notification: ${action}`, {
    message: data.message,
    fridgeId: data.fridgeId,
    timestamp: new Date().toISOString(),
  });

  // Later you could add:
  // - WebSocket notifications
  // - Push notifications
  // - Email alerts
  // - etc.

  return {
    success: true,
    action: action,
    timestamp: Date.now(),
  };
}
