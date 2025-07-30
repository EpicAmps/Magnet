// /api/shortcut/[id].js - Serves the actual shortcut file for download
import plist from 'plist';

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

    // You might want to validate the fridgeId exists in your database here
    // For now, we'll generate the shortcut for any valid-looking ID

    // Get fridge name from your database/storage
    // For demo purposes, using a placeholder - replace with actual lookup
    const fridgeName = await getFridgeName(fridgeId) || 'Kitchen';

    // Generate the shortcut data
    const shortcutData = generateShortcutData(fridgeName, fridgeId);
    
    // Convert to plist format (iOS shortcut format)
    const plistContent = plist.build(shortcutData);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/x-plist');
    res.setHeader('Content-Disposition', `attachment; filename="Send to Magnet - ${fridgeName}.shortcut"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the plist file
    res.status(200).send(plistContent);

  } catch (error) {
    console.error('Error serving shortcut:', error);
    res.status(500).json({ error: 'Failed to generate shortcut file' });
  }
}

// Helper function to get fridge name (implement based on your storage)
async function getFridgeName(fridgeId) {
  // TODO: Replace with actual database lookup
  // This is where you'd query your database for the fridge name
  // For now, return a default
  return 'Kitchen';
}

function generateShortcutData(fridgeName, fridgeId) {
  // Complete iOS Shortcut structure
  const shortcut = {
    WFWorkflowActions: [
      // Action 1: Get the shared content (text from share sheet)
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
        WFWorkflowActionParameters: {
          WFTextActionText: {
            Value: {
              string: "Input from Share Sheet",
              attachmentsByRange: {}
            },
            WFSerializationType: "WFTextTokenString"
          },
          WFInput: {
            Value: {
              WFActionOutput: "Input",
              WFOutputName: "Shared Input"
            },
            WFSerializationType: "WFActionOutput"
          }
        }
      },
      
      // Action 2: Get current date for timestamp
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.date",
        WFWorkflowActionParameters: {}
      },

      // Action 3: HTTP Request to send to Magnet API
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
        WFWorkflowActionParameters: {
          WFHTTPMethod: "POST",
          WFHTTPHeaders: {
            "Content-Type": "application/json"
          },
          WFHTTPBodyType: "JSON",
          WFJSONValues: {
            fridgeId: fridgeId,
            content: {
              Value: {
                WFActionOutput: "Text",
                WFOutputName: "Text"
              },
              WFSerializationType: "WFActionOutput"
            },
            sender: "iPhone",
            timestamp: {
              Value: {
                WFActionOutput: "Current Date", 
                WFOutputName: "Current Date"
              },
              WFSerializationType: "WFActionOutput"
            }
          },
          WFURL: "https://magnet-mu.vercel.app/api/note"
        }
      },

      // Action 4: Check if request was successful
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.conditional",
        WFWorkflowActionParameters: {
          WFInput: {
            Type: "Variable",
            Variable: {
              Value: {
                WFActionOutput: "Contents of URL",
                WFOutputName: "Contents of URL"
              },
              WFSerializationType: "WFActionOutput"
            }
          },
          WFCondition: 4,
          WFConditionalActionString: "success"
        }
      },

      // Action 5: Success notification
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.shownotification",
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: `✅ Sent to ${fridgeName}!`,
          WFNotificationActionBody: "Your note is now on the fridge display."
        }
      },

      // Action 6: Otherwise (error case)
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.otherwise",
        WFWorkflowActionParameters: {}
      },

      // Action 7: Error notification
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.shownotification", 
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: "❌ Send Failed",
          WFNotificationActionBody: "Could not send to fridge. Check connection."
        }
      },

      // Action 8: End conditional
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.endconditional",
        WFWorkflowActionParameters: {}
      }
    ],

    WFWorkflowClientVersion: "2605.0.5",
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 2846468607,
      WFWorkflowIconGlyphNumber: 59511
    },
    WFWorkflowImportQuestions: [],
    WFWorkflowInputContentItemClasses: [
      "WFStringContentItem",
      "WFRichTextContentItem", 
      "WFURLContentItem",
      "WFGenericFileContentItem"
    ],
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowName: "Send to Magnet",
    WFWorkflowTypes: [
      "ActionExtension",
      "ShareExtension"
    ]
  };

  return shortcut;
}
