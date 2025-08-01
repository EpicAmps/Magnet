# iPhone Setup Guide: "Send to Fridge" Shortcut

This guide will walk you through creating an Apple Shortcut that lets you share any note directly to your smart fridge.

## 📋 Prerequisites

- iPhone with iOS 13 or later
- Shortcuts app installed (comes pre-installed on newer iOS versions)
- Your fridge's unique ID (obtained by scanning the QR code on your fridge setup page)
- Your Vercel app URL

## 🎯 What You'll Build

A shortcut that:
- ✅ Appears in your share sheet when sharing text
- ✅ Sends notes directly to your specific fridge
- ✅ Gives you instant feedback when successful
- ✅ Works from Notes, Messages, Safari, Mail, and any text-sharing app

---

## 📱 Step-by-Step Instructions

### Step 1: Open Shortcuts App

1. Find and tap the **Shortcuts** app on your iPhone
2. If you don't see it, swipe down and search for "Shortcuts"

### Step 2: Create New Shortcut

1. Tap the **"+"** button in the top-right corner
2. This opens the shortcut editor

### Step 3: Add "Receive Input" Action

1. Tap **"Add Action"**
2. In the search bar, type **"receive"**
3. Select **"Receive Input from Share Sheet"**
4. Configure the settings:
   - **Input Type**: Select **"Text"**
   - **Source**: Should show **"Share Sheet"**

> 💡 **Tip**: This action allows your shortcut to receive text when someone shares content to it.

### Step 4: Add HTTP Request Action

1. Tap the **"+"** button to add another action
2. Search for **"get contents"**
3. Select **"Get Contents of URL"**
4. Configure the HTTP request:

#### URL Configuration
- **URL**: `https://your-vercel-app.vercel.app/api/note`
- Replace `your-vercel-app` with your actual Vercel deployment URL

#### Method & Headers
- **Method**: Change from "GET" to **"POST"**
- **Headers**: Tap "Add Header" and add:
  - **Name**: `Content-Type`
  - **Value**: `application/json`

#### Request Body
1. Tap **"Request Body"**
2. Change format to **"JSON"**
3. Tap in the JSON field and add this structure:

```json
{
  "content": "Shortcut Input",
  "fridgeId": "YOUR_FRIDGE_ID_HERE"
}
```

**Important**: 
- For the `"content"` value, tap and select **"Shortcut Input"** from the variables (it will appear as a blue bubble)
- Replace `YOUR_FRIDGE_ID_HERE` with your actual fridge ID (the one from the QR code scan)

### Step 5: Add Success Notification

1. Add another action by tapping **"+"**
2. Search for **"notification"**
3. Select **"Show Notification"**
4. Configure the notification:
   - **Title**: `📝 Sent to Fridge!`
   - **Body**: `Your note is now on the fridge screen`

### Step 6: Configure Shortcut Settings

1. Tap the **settings icon (⚙️)** at the bottom of the screen
2. **Name your shortcut**: `Send to Fridge`
3. **Choose an icon**: Tap the icon and select 🧊, 🏠, or 📝
4. **Enable Share Sheet**:
   - Toggle ON **"Use with Share Sheet"**
   - Under **"Accepted Types"**, make sure **"Text"** is checked
5. **Set Privacy**: Choose **"Anyone"** if you want to share this shortcut later

### Step 7: Save Your Shortcut

1. Tap **"Done"** in the top-right corner
2. Your shortcut is now saved and ready to use!

---

## 🧪 Testing Your Shortcut

### Test Method 1: Direct Test
1. Open the Shortcuts app
2. Find your "Send to Fridge" shortcut
3. Tap it directly
4. Type some test content when prompted
5. You should see the success notification

### Test Method 2: Share Sheet Test (Real Usage)
1. Open the **Notes** app
2. Create a note with content like:
   ```
   🛒 Grocery List
   - Milk
   - Bread
   - Eggs
   - Coffee
   ```
3. Tap the **Share** button (square with arrow pointing up)
4. Scroll down and look for **"Send to Fridge"**
5. Tap it
6. You should see the success notification
7. Check your fridge screen - the note should appear instantly!

---

## 🔧 Troubleshooting

### "Send to Fridge" doesn't appear in share sheet
- **Solution**: Make sure "Use with Share Sheet" is enabled in shortcut settings
- **Check**: Ensure "Text" is selected under "Accepted Types"
- **Try**: Restart the Shortcuts app

### Shortcut runs but note doesn't appear on fridge
- **Check your URL**: Make sure it matches your Vercel deployment exactly
- **Verify Fridge ID**: Double-check the fridge ID matches what's shown on your fridge
- **Test the API**: Try the "Direct Test" method first
- **Network**: Ensure both iPhone and fridge have internet connectivity

### "Network Error" or shortcut fails
- **URL Format**: Ensure URL starts with `https://` 
- **Spelling**: Double-check your Vercel app name spelling
- **Deployment**: Verify your Vercel app is deployed and accessible in a browser

### Wrong content appears on fridge
- **Check JSON**: Make sure "Shortcut Input" is selected as a variable (blue bubble), not typed as text
- **Fridge ID**: Verify you're using the correct fridge ID for your specific fridge

---

## 📋 Quick Reference

### Required Information
- **API URL**: `https://your-vercel-app.vercel.app/api/note`
- **Fridge ID**: `abc123xyz` (your unique ID from QR code)
- **Method**: POST
- **Header**: `Content-Type: application/json`

### JSON Body Template
```json
{
  "content": [Shortcut Input Variable],
  "fridgeId": "your-actual-fridge-id"
}
```

### Actions Summary
1. **Receive Input from Share Sheet** (Text)
2. **Get Contents of URL** (POST request with JSON)
3. **Show Notification** (Success feedback)

---

## 🎉 You're Done!

Once set up correctly, you can:
- Share any text from any app
- Select "Send to Fridge" from the share menu
- See your note appear instantly on the fridge
- Get confirmation that it worked

**Pro tip**: You can share from Messages, Safari (selected text), Mail, or any app that supports text sharing - not just Notes!

---

## 🔄 Advanced: Multiple Fridges

If you have multiple smart fridges, create separate shortcuts:
- "Send to Kitchen Fridge" (with kitchen fridge ID)
- "Send to Garage Fridge" (with garage fridge ID)
- Each will appear as separate options in your share sheet

Happy note sharing! 📝✨
