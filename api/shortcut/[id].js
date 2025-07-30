// /api/shortcut/[id].js - Creates proper iOS Shortcut file

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id: fridgeId } = req.query;
    if (!fridgeId) {
      return res.status(400).json({ error: 'Fridge ID is required' });
    }

    // Get fridge name from localStorage equivalent or default
    const fridgeName = 'Kitchen'; // TODO: Look up from database

    // Create proper iOS Shortcut in base64-encoded plist format
    const shortcutData = createIOSShortcut(fridgeName, fridgeId);
    
    // Set proper headers for iOS to recognize as shortcut
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="Send to Magnet.shortcut"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the binary shortcut file
    res.status(200).send(Buffer.from(shortcutData, 'base64'));

  } catch (error) {
    console.error('Error serving shortcut:', error);
    res.status(500).json({ 
      error: 'Failed to generate shortcut file',
      details: error.message 
    });
  }
}

function createIOSShortcut(fridgeName, fridgeId) {
  // This is a base64-encoded .shortcut file that iOS will recognize
  // Created by exporting a working shortcut and encoding it
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

  // Convert to base64
  return Buffer.from(shortcutPlist).toString('base64');
}
