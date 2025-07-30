// /api/shortcut/[id].js - Serves the actual shortcut file for download

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id: fridgeId } = req.query;

    if (!fridgeId) {
      return res.status(400).json({ error: 'Fridge ID is required' });
    }

    // For demo purposes, using a placeholder fridge name
    // In production, you'd look this up from your database
    const fridgeName = 'Kitchen';

    // Generate the shortcut data as a simple JSON structure
    // iOS Shortcuts can import from a simplified format
    const shortcutData = {
      "WFWorkflowActions": [
        {
          "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
          "WFWorkflowActionParameters": {
            "WFTextActionText": {
              "Value": {
                "string": "Input from Share Sheet",
                "attachmentsByRange": {}
              },
              "WFSerializationType": "WFTextTokenString"
            }
          }
        },
        {
          "WFWorkflowActionIdentifier": "is.workflow.actions.date",
          "WFWorkflowActionParameters": {}
        },
        {
          "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
          "WFWorkflowActionParameters": {
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": {
              "Content-Type": "application/json"
            },
            "WFHTTPBodyType": "JSON",
            "WFJSONValues": {
              "fridgeId": fridgeId,
              "content": {
                "Value": {
                  "WFActionOutput": "Text",
                  "WFOutputName": "Text"
                },
                "WFSerializationType": "WFActionOutput"
              },
              "sender": "iPhone",
              "timestamp": {
                "Value": {
                  "WFActionOutput": "Current Date",
                  "WFOutputName": "Current Date"
                },
                "WFSerializationType": "WFActionOutput"
              }
            },
            "WFURL": "https://magnet-mu.vercel.app/api/note"
          }
        },
        {
          "WFWorkflowActionIdentifier": "is.workflow.actions.shownotification",
          "WFWorkflowActionParameters": {
            "WFNotificationActionTitle": `✅ Sent to ${fridgeName}!`,
            "WFNotificationActionBody": "Your note is now on the fridge display."
          }
        }
      ],
      "WFWorkflowClientVersion": "2605.0.5",
      "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 2846468607,
        "WFWorkflowIconGlyphNumber": 59511
      },
      "WFWorkflowImportQuestions": [],
      "WFWorkflowInputContentItemClasses": [
        "WFStringContentItem",
        "WFRichTextContentItem",
        "WFURLContentItem",
        "WFGenericFileContentItem"
      ],
      "WFWorkflowMinimumClientVersionString": "900",
      "WFWorkflowMinimumClientVersion": 900,
      "WFWorkflowName": "Send to Magnet",
      "WFWorkflowTypes": [
        "ActionExtension",
        "ShareExtension"
      ]
    };

    // Convert to JSON string
    const jsonContent = JSON.stringify(shortcutData, null, 2);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="Send to Magnet - ${fridgeName}.shortcut"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the shortcut file
    res.status(200).send(jsonContent);

  } catch (error) {
    console.error('Error serving shortcut:', error);
    res.status(500).json({ 
      error: 'Failed to generate shortcut file',
      details: error.message 
    });
  }
}
