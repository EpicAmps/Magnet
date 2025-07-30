// /api/shortcut-config.js
export default function handler(req, res) {
  const { fridgeId, name } = req.query;
  
  if (!fridgeId) {
    return res.status(400).json({ error: 'fridgeId required' });
  }
  
  // Return the workflow in the format iOS expects
  const workflow = {
    "WFWorkflowClientVersion": "2607.0.2",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowActions": [
      {
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
          "WFNotificationActionTitle": "Test",
          "WFNotificationActionBody": `Hello from ${name || 'fridge'}!`
        }
      }
    ]
  };
  
  res.json(workflow);
}
