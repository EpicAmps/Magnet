// Create this file as: api/test-simple.js

export default async function handler(req, res) {
  console.log('=== SIMPLE TEST WEBHOOK ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  console.log('Timestamp:', new Date().toISOString());
  
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    return res.status(200).json({
      success: true,
      message: "Simple test webhook working perfectly!",
      timestamp: new Date().toISOString(),
      receivedData: {
        method: req.method,
        hasBody: !!req.body,
        bodyType: typeof req.body,
        body: req.body
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  } catch (error) {
    console.error('Simple webhook error:', error);
    return res.status(500).json({
      error: 'Simple webhook failed',
      details: error.message
    });
  }
}