// /api/shortcut-config.js
export default function handler(req, res) {
  const { fridgeId, name } = req.query;
  
  if (!fridgeId) {
    return res.status(400).json({ error: 'fridgeId required' });
  }
  
  // Return the workflow in the format iOS expects for import
  const workflow = {
    "WFWorkflowClientVersion": "2607.0.2",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowHasOutputFallback": false,
    "WFWorkflowHasShortcutInputVariables": false,
    "WFWorkflowIcon": {
      "WFWorkflowIconStartColor": 2071128575,
      "WFWorkflowIconGlyphNumber": 59511
    },
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": [
      "WFStringContentItem",
      "WFTextContentItem"
    ],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowTypes": [
      "ActionExtension"
    ],
    "WFWorkflowActions": [
      {
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
          "WFNotificationActionTitle": "Test Success!",
          "WFNotificationActionBody": `Connected to ${name || fridgeId}!`
        }
      }
    ]
  };
  
  // Set proper headers for shortcut import
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.status(200).json(workflow);
}
