// /api/generate-shortcut.js - Dynamic Shortcut Generator for Vercel
import QRCode from 'qrcode';

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

    // Generate the dynamic shortcut content
    const shortcutData = generateShortcutData(fridgeName, fridgeId);
    
    // Create the shortcut file URL (we'll serve it from another endpoint)
    const shortcutUrl = `${req.headers.origin || 'https://magnet-mu.vercel.app'}/api/shortcut/${fridgeId}`;
    
    // Generate QR code for the shortcut URL
    const qrCodeDataUrl = await QRCode.toDataURL(shortcutUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#2c3e50',
        light: '#ffffff'
      }
    });

    // Return both the QR code and shortcut info
    res.status(200).json({
      success: true,
      qrCode: qrCodeDataUrl,
      shortcutUrl: shortcutUrl,
      fridgeName: fridgeName,
      fridgeEmail: `incoming.magnet+${fridgeName}@gmail.com`,
      instructions: [
        "1. Open Camera app on your iPhone",
        "2. Point camera at the QR code below", 
        "3. Tap the notification that appears",
        "4. Tap 'Get Shortcut' to install",
        "5. The shortcut will be named 'Send to Magnet'"
      ]
    });

  } catch (error) {
    console.error('Error generating shortcut:', error);
    res.status(500).json({ error: 'Failed to generate shortcut' });
  }
}

function generateShortcutData(fridgeName, fridgeId) {
  // iOS Shortcut structure in plist format
  const shortcut = {
    WFWorkflowActions: [
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.detect.text",
        WFWorkflowActionParameters: {
          WFInput: {
            Value: {
              WFActionOutput: "Input",
              WFOutputName: "Shared Input"
            },
            WFSerializationType: "WFActionOutput"
          }
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
        WFWorkflowActionParameters: {
          WFTextActionText: {
            Value: {
              string: "{{WFDetectedText}}",
              attachmentsByRange: {}
            },
            WFSerializationType: "WFTextTokenString"
          }
        }
      },
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
            sender: "iPhone Shortcut",
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
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.getcontentsofurl",
        WFWorkflowActionParameters: {}
      },
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
          WFCondition: 200,
          WFConditionalActionString: "Contains"
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.shownotification",
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: `✅ Sent to ${fridgeName} Fridge!`,
          WFNotificationActionBody: "Your note has been delivered to the fridge display."
        }
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.otherwise",
        WFWorkflowActionParameters: {}
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.shownotification",
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: "❌ Send Failed",
          WFNotificationActionBody: "Could not send note to fridge. Check your internet connection."
        }
      },
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
      "WFAppStoreAppContentItem",
      "WFArticleContentItem", 
      "WFContactContentItem",
      "WFDateContentItem",
      "WFEmailAddressContentItem",
      "WFGenericFileContentItem",
      "WFImageContentItem",
      "WFiTunesProductContentItem",
      "WFLocationContentItem",
      "WFDCMapsLinkContentItem",
      "WFAVAssetContentItem",
      "WFPDFContentItem",
      "WFPhoneNumberContentItem",
      "WFRichTextContentItem",
      "WFSafariWebPageContentItem",
      "WFStringContentItem",
      "WFURLContentItem"
    ],
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowName: "Send to Magnet",
    WFWorkflowTypes: [
      "ActionExtension"
    ]
  };

  return shortcut;
}
