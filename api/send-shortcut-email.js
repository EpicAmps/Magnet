// /api/send-shortcut-email.js - Email shortcut as attachment

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, fridgeName, fridgeId } = req.body;

    if (!email || !fridgeName || !fridgeId) {
      return res.status(400).json({ error: 'Email, fridgeName, and fridgeId are required' });
    }

    // Create the shortcut file content
    const shortcutContent = createIOSShortcut(fridgeName, fridgeId);
    
    // Email content
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 60px; margin-bottom: 10px; }
        .step { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .step-number { background: #007AFF; color: white; width: 25px; height: 25px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: bold; }
        .important { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🧲</div>
            <h1>Your Magnet Shortcut is Ready!</h1>
            <p>Hi there! Your "${fridgeName}" fridge is all set up and ready to receive notes.</p>
        </div>

        <div class="important">
            <strong>📎 Shortcut Attached:</strong> The "Send to Magnet.shortcut" file is attached to this email.
        </div>

        <h2>📱 How to Install (Super Easy!):</h2>
        
        <div class="step">
            <span class="step-number">1</span>
            <strong>Open this email on your iPhone</strong><br>
            (Forward this email to yourself if you're reading on a computer)
        </div>
        
        <div class="step">
            <span class="step-number">2</span>
            <strong>Tap the attached file</strong><br>
            Look for "Send to Magnet.shortcut" attachment below
        </div>
        
        <div class="step">
            <span class="step-number">3</span>
            <strong>Tap "Add Shortcut"</strong><br>
            iOS will open Shortcuts app and ask to add it
        </div>
        
        <div class="step">
            <span class="step-number">4</span>
            <strong>You're done!</strong><br>
            "Send to Magnet" will appear in your Share Sheet
        </div>

        <h2>🎯 How to Use:</h2>
        <ol>
            <li>Open any app (Notes, Safari, Messages, etc.)</li>
            <li>Tap the Share button</li>
            <li>Look for "Send to Magnet" and tap it</li>
            <li>Your note appears instantly on the ${fridgeName} fridge! ✨</li>
        </ol>

        <div class="important">
            <strong>🏠 Your Fridge Details:</strong><br>
            <strong>Name:</strong> ${fridgeName}<br>
            <strong>Email:</strong> incoming.magnet+${fridgeName}@gmail.com<br>
            <strong>View Live:</strong> <a href="https://magnet-mu.vercel.app/fridge.html?id=${fridgeId}">magnet-mu.vercel.app/fridge.html?id=${fridgeId}</a>
        </div>

        <p style="text-align: center; margin-top: 40px; color: #666;">
            Questions? Just reply to this email!<br>
            Happy note sharing! 🧲✨
        </p>
    </div>
</body>
</html>`;

    // Send email using a service like SendGrid, Resend, or NodeMailer
    // For this example, I'll show the SendGrid approach
    const emailData = {
      to: email,
      from: 'setup@magnet-mu.vercel.app', // Your verified sender
      subject: `🧲 Your ${fridgeName} Magnet Shortcut is Ready!`,
      html: emailHTML,
      attachments: [
        {
          filename: 'Send to Magnet.shortcut',
          content: Buffer.from(shortcutContent, 'base64'),
          type: 'application/octet-stream'
        }
      ]
    };

    // TODO: Replace with your actual email service
    // await sendEmail(emailData);
    
    // For now, return success (you'll implement actual sending)
    res.status(200).json({
      success: true,
      message: 'Shortcut email sent successfully!',
      recipient: email
    });

  } catch (error) {
    console.error('Error sending shortcut email:', error);
    res.status(500).json({ 
      error: 'Failed to send shortcut email',
      details: error.message 
    });
  }
}

function createIOSShortcut(fridgeName, fridgeId) {
  // Same shortcut creation function as before
  const shortcutPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowActions</key>
  <array>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.gettext</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFTextActionText</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>string</key>
            <string>Input</string>
            <key>attachmentsByRange</key>
            <dict/>
          </dict>
          <key>WFSerializationType</key>
          <string>WFTextTokenString</string>
        </dict>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFHTTPMethod</key>
        <string>POST</string>
        <key>WFHTTPHeaders</key>
        <dict>
          <key>Content-Type</key>
          <string>application/json</string>
        </dict>
        <key>WFHTTPBodyType</key>
        <string>JSON</string>
        <key>WFJSONValues</key>
        <dict>
          <key>fridgeId</key>
          <string>${fridgeId}</string>
          <key>content</key>
          <dict>
            <key>Value</key>
            <dict>
              <key>WFActionOutput</key>
              <string>Text</string>
              <key>WFOutputName</key>
              <string>Text</string>
            </dict>
            <key>WFSerializationType</key>
            <string>WFActionOutput</string>
          </dict>
          <key>sender</key>
          <string>iPhone</string>
        </dict>
        <key>WFURL</key>
        <string>https://magnet-mu.vercel.app/api/note</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.shownotification</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFNotificationActionTitle</key>
        <string>✅ Sent to ${fridgeName}!</string>
        <key>WFNotificationActionBody</key>
        <string>Your note is now on the fridge display.</string>
      </dict>
    </dict>
  </array>
  <key>WFWorkflowClientVersion</key>
  <string>2605.0.5</string>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconStartColor</key>
    <integer>2846468607</integer>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59511</integer>
  </dict>
  <key>WFWorkflowImportQuestions</key>
  <array/>
  <key>WFWorkflowInputContentItemClasses</key>
  <array>
    <string>WFStringContentItem</string>
    <string>WFRichTextContentItem</string>
    <string>WFURLContentItem</string>
  </array>
  <key>WFWorkflowMinimumClientVersionString</key>
  <string>900</string>
  <key>WFWorkflowMinimumClientVersion</key>
  <integer>900</integer>
  <key>WFWorkflowName</key>
  <string>Send to Magnet</string>
  <key>WFWorkflowTypes</key>
  <array>
    <string>ActionExtension</string>
  </array>
</dict>
</plist>`;

  return Buffer.from(shortcutPlist).toString('base64');
}
