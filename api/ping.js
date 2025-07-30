export async function notifyFridges(data) {
  // For MVP, just log it
  console.log('New note received:', data);
  
  // Later you could add webhook notifications, WebSocket updates, etc.
  return { success: true };
}
