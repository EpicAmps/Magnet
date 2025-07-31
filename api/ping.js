// /api/ping.js - Simple notification system for MVP
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
