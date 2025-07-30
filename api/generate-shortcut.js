// /api/generate-shortcut.js - Dynamic Shortcut Generator for Vercel
export default async function handler(req, res) {

  // Add this right after creating shortcutUrl:
console.log('Shortcut URL length:', shortcutUrl.length);
console.log('First 200 chars:', shortcutUrl.substring(0, 200));
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { fridgeName, fridgeId } = req.body;
    
    if (!fridgeName || !fridgeId) {
      return res.status(400).json({ error: 'fridgeName and fridgeId are required' });
    }

    // Define the shortcut actions in the format iOS expects
    const shortcutActions = [
      {
        "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
        "WFWorkflowActionParameters": {
          "WFTextActionText": {
            "Value": {
              "string": "___EXTENSIONINPUT___",
              "attachmentsByRange": {
                "{0, 21}": {
                  "Type": "ExtensionInput"
                }
              }
            },
            "WFSerializationType": "WFTextTokenString"
          }
        }
      },
      {
        "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
        "WFWorkflowActionParameters": {
          "WFHTTPMethod": "POST",
          "WFHTTPBodyType": "JSON",
          "WFURL": "https://magnet-mu.vercel.app/api/note",
          "WFJSONValues": {
            "Value": {
              "WFDictionaryFieldValueItems": [
                {
                  "WFItemType": 0,
                  "WFKey": {
                    "Value": {
                      "string": "fridgeId"
                    },
                    "WFSerializationType": "WFTextTokenString"
                  },
                  "WFValue": {
                    "Value": {
                      "string": fridgeId
                    },
                    "WFSerializationType": "WFTextTokenString"
                  }
                },
                {
                  "WFItemType": 0,
                  "WFKey": {
                    "Value": {
                      "string": "content"
                    },
                    "WFSerializationType": "WFTextTokenString"
                  },
                  "WFValue": {
                    "Value": {
                      "string": "___EXTENSIONINPUT___",
                      "attachmentsByRange": {
                        "{0, 21}": {
                          "OutputUUID": "TEXT_OUTPUT_UUID",
                          "OutputName": "Text",
                          "Type": "ActionOutput"
                        }
                      }
                    },
                    "WFSerializationType": "WFTextTokenString"
                  }
                },
                {
                  "WFItemType": 0,
                  "WFKey": {
                    "Value": {
                      "string": "sender"
                    },
                    "WFSerializationType": "WFTextTokenString"
                  },
                  "WFValue": {
                    "Value": {
                      "string": "iPhone"
                    },
                    "WFSerializationType": "WFTextTokenString"
                  }
                }
              ]
            },
            "WFSerializationType": "WFDictionaryFieldValue"
          }
        }
      },
      {
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
          "WFNotificationActionTitle": "Success!",
          "WFNotificationActionBody": `Note saved to ${fridgeName} successfully`
        }
      }
    ];

    // Create the complete workflow object
    const workflow = {
      "WFWorkflowClientVersion": "2605.0.5",
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
      "WFWorkflowMinimumClientVersion": 900,
      "WFWorkflowOutputContentItemClasses": [],
      "WFWorkflowTypes": [
        "Watch",
        "ActionExtension"
      ],
      "WFWorkflowActions": shortcutActions
    };

    // Encode the workflow for the URL
    const workflowData = encodeURIComponent(JSON.stringify(workflow));
    const shortcutName = encodeURIComponent(`Send to ${fridgeName}`);
    
    // Create the shortcuts:// URL that opens directly in Shortcuts app
    const shortcutUrl = `shortcuts://import-workflow/?name=${shortcutName}&workflow=${workflowData}`;
    
    // Generate QR code for the shortcut URL
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shortcutUrl)}`;

    // Return the QR code URL and shortcut info
    res.status(200).json({
      success: true,
      qrCode: qrCodeUrl,
      shortcutUrl: shortcutUrl,
      fridgeName: fridgeName,
      fridgeEmail: `incoming.magnet+${fridgeName}@gmail.com`,
      instructions: [
        "1. Open Camera app on your iPhone",
        "2. Point camera at the QR code below", 
        "3. Tap the notification that appears",
        "4. This will open the Shortcuts app",
        "5. Tap 'Add Shortcut' to install",
        "6. The shortcut will appear in your share sheet as 'Send to " + fridgeName + "'"
      ]
    });

  } catch (error) {
    console.error('Error generating shortcut:', error);
    res.status(500).json({ 
      error: 'Failed to generate shortcut',
      details: error.message 
    });
  }
}
