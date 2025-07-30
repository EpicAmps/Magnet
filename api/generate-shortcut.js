// /api/generate-shortcut.js - Dynamic Shortcut Generator for Vercel
export default async function handler(req, res) {
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

    // Encode the workflow for the URL (for debugging)
    const workflowData = encodeURIComponent(JSON.stringify(workflow));
    const shortcutName = encodeURIComponent(`Send to ${fridgeName}`);
    
    // Create the full shortcuts URL (for debugging)
    const fullShortcutUrl = `shortcuts://import-workflow/?name=${shortcutName}&workflow=${workflowData}`;
    
    // Log the massive URL length
    console.log('Full shortcut URL length:', fullShortcutUrl.length);
    console.log('First 200 chars:', fullShortcutUrl.substring(0, 200));
    
    // Create a short redirect URL instead of the massive shortcuts:// URL
    const baseUrl = req.headers.origin || `https://${req.headers.host}` || 'https://magnet-mu.vercel.app';
    const redirectUrl = `${baseUrl}/install-shortcut.html?fridgeId=${fridgeId}&name=${encodeURIComponent(fridgeName)}`;
    
    // Generate QR for the short redirect URL instead
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(redirectUrl)}`;

    // Return the QR code URL and shortcut info
    res.status(200).json({
      success: true,
      qrCode: qrCodeUrl,
      shortcutUrl: redirectUrl,  // Return the short redirect URL, not the massive one
      fridgeName: fridgeName,
      fridgeEmail: `incoming.magnet+${fridgeName}@gmail.com`,
      instructions: [
        "1. Open Camera app on your iPhone",
        "2. Point camera at the QR code below", 
        "3. Tap the notification that appears",
        "4. This will open the installation page",
        "5. Tap the button to add the shortcut",
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
