# 🧲 Magnet
**Smart Fridge Notes via Email & iOS Shortcuts**

Transform your Samsung Smart Fridge into a family communication hub. Send notes directly to your fridge using iOS Shortcuts or email - they appear instantly on the fridge screen with task management, tag filtering, and celebration animations!

---

## 🎯 How It Works

**Simple 3-Step Process:**
1. **Setup:** Visit your fridge's web browser, enter your Samsung fridge's name (hint, you gave it a name during the Samsung setup)
2. **Scan QR Code:** QR code appears with custom iOS Shortcut - scan with your phone
3. **Add Shortcut:** iOS prompts to add shortcut - tap "Add" and start sharing notes!

**Universal Compatibility:**
- ✅ **One-Scan Setup:** QR code installs shortcut directly to your iPhone
- ✅ **Direct Processing:** Shortcuts send notes straight to your specific fridge
- ✅ **Rich Features:** Checkboxes, task completion, family tags (`#dad`, `#mom`, `#jess`)
- ✅ **No apps to install** - just scan and go!

---

## 🔄 Complete System Flow

### Setup & Shortcut Flow

1. **Fridge visits `/setup.html`:** Enter the Samsung-assigned fridge name.
2. **Fridge ID generated:** The page hashes the name into `fridge_<hash>` and stores it in localStorage for the fridge UI.
3. **Shortcut install link created:** The serverless `api/generate-shortcut` route builds a fridge-specific iOS Shortcut URL and renders a QR code on the fridge.
4. **Scan & install:** Scanning the QR code opens the shortcut installer on iOS; tapping “Add” drops the “Send to Magnet” shortcut directly into the iOS share sheet.
5. **Bookmark the fridge:** Setup links you to `/fridge.html?id=<fridgeId>` so the Family Hub browser always loads the right fridge state.

### Note Delivery Pipeline

1. **Share from iPhone:** Any app that supports the share sheet can pass text/HTML into the shortcut.
2. **Shortcut → `api/webhook`:** The shortcut POSTs the payload (`fridgeId`, note content, sender info) straight to Vercel.
3. **Serverless processing:** `api/webhook.js` sanitises/beautifies the note (marked -> HTML, checkbox fixes, tag extraction) and appends it to the fridge’s JSON document stored in Vercel Blob (`fridge-<id>.json`).
4. **Blob storage rotation:** Notes are stored newest-first; older entries are trimmed automatically so blob files stay small.
5. **Fridge polling:** `tada.js` polls `api/note?fridgeId=<id>` every ~15 s. The route reads the blob, normalises timestamps, and returns the note array.
6. **Display & interaction:** The fridge UI renders the current note list, keeps local completion state synced, and triggers celebrations when tasks finish.

### Delete & Cleanup

- **Individual deletes:** The fridge UI calls `DELETE /api/note` with the note ID; the API rewrites the blob without that entry.
- **Clear all:** `DELETE /api/note` with `deleteAll=true` wipes the blob entirely.
- **Consistency:** Blob reads bypass CDN caching, so deletions are reflected on the next poll (no more “note resurrection”).

### Smart Features in Action

- **✅ Task Management:** Check off items with celebration animations
- **🏷️ Family Tags:** Filter notes by `#dad`, `#mom`, `#jess` tabs
- **📱 Multiple Notes:** Paginated display with newest first, completed last
- **🧟 Note Resurrection:** Uncheck all tasks to move note back to active
- **🗑️ Smart Cleanup:** Delete individual notes or all at once

---

## 🌟 Key Features

### 📱 iOS Shortcuts Integration
- **Native Share Sheet:** Works from Notes, Messages, Safari, any app
- **One-Tap Sending:** Custom shortcut processes and sends instantly
- **Rich Formatting:** Preserves checkboxes, lists, headers from iOS Notes
- **QR Code Setup:** Scan code on fridge to install shortcut automatically

### 🧠 Smart Task Management
- **Interactive Checkboxes:** Click individual boxes or entire rows
- **Completion Celebrations:** Confetti and sound effects when all tasks done
- **Smart Sorting:** Active notes first, completed notes at bottom
- **Task Resurrection:** Uncheck all items to reactivate completed notes

### 🏷️ Family Organization
- **Tag Filtering:** Add `#dad`, `#mom`, `#jess` to organize by person
- **Tab Counts:** See how many notes each family member has
- **Visual Tags:** Styled tag badges with emoji indicators
- **Smart Navigation:** Switch between All/Dad/Mom/Jess views

### 🧊 Fridge-Optimized Interface
- **Touch-Friendly:** Large buttons optimized for Samsung Family Hub
- **Modern Design:** Gradient backgrounds with glassmorphism effects
- **Smart Polling:** 15-second updates for near real-time experience
- **Connection Status:** Clear indicators showing system health

---

## 🛠️ Technology Stack & Architecture

### Frontend (Samsung Tizen Browser)
- **`public/fridge.html`:** Main fridge interface with modern CSS
- **`public/tada.js`:** Core JavaScript for note display, task management, polling
- **`public/setup.html`:** Initial fridge configuration and QR code generation
- **Progressive Web App:** Responsive design optimized for fridge touchscreens

### Backend API (Vercel Serverless)
- **`api/webhook.js`:** Receives shortcut payloads, formats notes, writes to blob storage
- **`api/note.js`:** Reads/deletes blob-stored notes for each fridge
- **`api/ping.js`:** Server-Sent Events for real-time updates (backup)
- **`api/generate-shortcut.js`:** Creates custom iOS Shortcuts for each fridge

### Storage & Processing
- **Vercel Blob Storage:** Persistent note storage (`fridge-<id>.json`) with automatic trimming
- **Marked.js:** Converts iOS Notes markdown to fridge-friendly HTML
- **Smart Checkbox Processing:** Fixes disabled checkboxes, enables interaction
- **Blob Access Token:** `BLOB_READ_WRITE_TOKEN` env var grants read/write access for all fridge blobs

### External Integrations
- **iOS Shortcuts:** Direct QR code installation and native Share Sheet integration
- **Vercel Blob:** Persistent storage with automatic cleanup and versioning
- **Samsung Tizen:** Optimized for Family Hub browser environment

---

## 📂 Project Structure

```
magnet/
├── 📁 api/                          # Vercel serverless functions
│   ├── 📄 webhook.js                # Main email processing endpoint
│   ├── 📄 note.js                   # Note CRUD operations
│   ├── 📄 ping.js                   # Real-time notifications (SSE)
│   ├── 📄 generate-shortcut.js      # iOS Shortcut creation
│   ├── 📄 send-shortcut-email.js    # Email shortcut to user
│   └── 📄 shortcut-config.js        # Shortcut template configuration
│
├── 📁 public/                       # Frontend static files
│   ├── 📄 fridge.html               # Main fridge display interface
│   ├── 📄 tada.js                   # Core JavaScript logic
│   ├── 📄 setup.html                # Initial fridge setup
│   ├── 📄 install-shortcut.html     # iOS Shortcut installation
│   ├── 📄 shortcut-setup.html       # Shortcut configuration
│   └── 📁 img/                      # Icons and assets
│
├── 📁 workflows/                    # GitHub Actions
│   └── 📄 project-tree.yml          # Auto-generated project structure
│
├── 📄 package.json                  # Dependencies and scripts
├── 📄 README.md                     # This documentation
└── 📄 PhoneConfig.md                # iOS setup instructions
```

### Key File Descriptions

#### Core API Routes
- **`webhook.js`** - Processes emails from Pipedream, converts markdown to HTML, saves to blob storage
- **`note.js`** - Retrieves notes for fridge display, handles individual/bulk deletion
- **`ping.js`** - Server-Sent Events endpoint for real-time updates (currently disabled, using polling)

#### Frontend Components  
- **`fridge.html`** - Modern UI with tab filtering, task management, celebration animations
- **`tada.js`** - 1300+ lines handling note display, checkbox interaction, polling, celebrations
- **`setup.html`** - Initial configuration, generates unique fridge ID and email address

#### iOS Integration
- **`generate-shortcut.js`** - Creates custom iOS Shortcut URLs based on fridge names
- **`shortcut-config.js`** - Template configuration for iOS Shortcuts generation

---

## 🚀 Quick Start

### For Fridge Owners

1. **Open Samsung Smart Fridge browser**
2. **Navigate to:** `https://magnet-mu.vercel.app/setup`
3. **Enter your fridge's Samsung name:** (the name you gave it during Samsung setup)
4. **Save your fridge info and get QR code**
5. **Bookmark fridge page:** `https://magnet-mu.vercel.app/fridge?id=your_id`

### For iOS Users

1. **Scan QR code** displayed on fridge setup page
2. **iOS prompts:** "Add 'Send to Magnet' Shortcut?"
3. **Tap "Add"** - shortcut installs immediately
4. **Test:** Share any note from Notes app → "Send to Magnet"
5. **Watch it appear** on fridge within 15 seconds!

### For Other Devices

1. **Use the web interface:** Visit your fridge's URL from any device
2. **Manual entry:** Type notes directly in the web interface
3. **Future:** Additional methods may be added for non-iOS devices

---

## 💡 Usage Examples

### 📱 iOS Notes with Tasks
```
Honey Do List

- [ ] Weed Garden Bed
- [ ] Hang Bathroom Stuff  
- [ ] Put golf clubs away

#dad
```
*Result: Interactive checklist on fridge with celebration when completed*

### 🛒 Shopping List for Mom
```
Grocery Run

- [ ] Milk (2%)
- [ ] Bread (whole wheat)
- [ ] Coffee (dark roast)
- [ ] Bananas

#mom
```
*Result: Appears in Mom tab, checkboxes for marking items as picked up*

### 🍕 Quick Family Note
```
Dinner Tonight

Pizza delivery at 7pm! 
Don't forget to set the table.

#jess
```
*Result: Simple note in Jess tab with styled formatting*

---

## 🔧 Current Implementation Details

### Polling vs Real-Time
- **Current:** 15-second polling (fast and reliable)
- **Attempted:** Server-Sent Events (SSE) - disabled due to 405 errors
- **Why Polling Works:** Simple, reliable, fast enough for family use
- **Performance:** Minimal server load, excellent user experience

### Task Management System
- **Checkbox Detection:** Converts iOS Notes checkboxes to interactive HTML
- **Click Handling:** Works on both checkbox and entire row
- **Visual Feedback:** Strikethrough, opacity changes, background highlights
- **Completion Logic:** Requires 2+ tasks, celebrates when all checked
- **Resurrection:** Uncheck all tasks to move note back to active

### Tag System
- **Detection:** Regex parsing for `#dad`, `#mom`, `#jess` patterns
- **Visual Display:** Styled badges with gradients and emojis
- **Tab Filtering:** Separate views with note counts
- **Smart Sorting:** Active notes first, completed notes last

---

## 🎯 Roadmap & Future Plans

### v1.1 - Enhanced Smart Features 🚧
- [ ] **Alarm Integration:** Set reminders with time-based notifications
- [ ] **Calendar Sync:** Integrate with family calendars for events
- [ ] **Voice Notes:** Record audio messages via iPhone shortcuts
- [ ] **Photo Attachments:** Send images that display on fridge

### v1.2 - Standalone Tizen App 🔮
- [ ] **Native Tizen App:** Move beyond web browser to full app
- [ ] **Background Processing:** Real-time updates without browser limitations  
- [ ] **Offline Support:** Cache notes locally on fridge
- [ ] **Push Notifications:** True instant updates via Samsung services

### v1.3 - Advanced Family Features 🌟
- [ ] **Smart Scheduling:** Recurring tasks and family schedules
- [ ] **Location Awareness:** "Remind me when I'm at the store" integration
- [ ] **Family Analytics:** Track completion rates and family activity
- [ ] **Multi-Fridge Support:** Kitchen, garage, basement displays

### v2.0 - Smart Home Ecosystem 🏠
- [ ] **Voice Control:** "Hey Google, add milk to fridge list"
- [ ] **IoT Integration:** Connect with smart appliances and sensors
- [ ] **Home Assistant:** Full smart home platform integration
- [ ] **Mobile Companion:** Dedicated iPhone/Android apps with widgets

### v2.1 - Enterprise & Community 🏢
- [ ] **Multi-Tenant SaaS:** Custom domains for families/organizations
- [ ] **API Platform:** Let developers build integrations
- [ ] **Marketplace:** Community shortcuts and templates
- [ ] **Analytics Dashboard:** Family insights and usage patterns

---

## 🔧 Development & Contributing

### Local Development
```bash
# Clone and setup
git clone https://github.com/yourusername/magnet.git
cd magnet
npm install

# Environment setup
cp .env.example .env.local
# Add your BLOB_READ_WRITE_TOKEN and WEBHOOK_SECRET

# Run development server
npm run dev
# Visit http://localhost:3000
```

### Testing Email Flow
1. **Setup ngrok:** `ngrok http 3000`
2. **Configure Pipedream:** Point webhook to ngrok URL
3. **Send test email:** Use your fridge's email address
4. **Check logs:** Vercel function logs and browser console

### Common Issues & Solutions
- **405 SSE Errors:** Normal, polling backup works great
- **Checkbox not clicking:** Clear browser cache, check event handlers
- **Notes not appearing:** Check Pipedream workflow status and Vercel logs
- **QR codes not working:** Verify shortcut generation endpoint

---

## 🎉 Why Magnet Works

### Technical Strengths
- **Hybrid Architecture:** Combines simplicity of email with power of iOS Shortcuts
- **Fault Tolerance:** Multiple backup systems ensure notes always get through
- **Samsung Optimized:** Specifically designed for Family Hub browser limitations
- **Modern UX:** Celebration animations, smooth interactions, responsive design

### Family Benefits
- **Zero Learning Curve:** Uses tools families already know (email, iOS Notes)
- **Universal Access:** Anyone can send notes from any device
- **Smart Organization:** Tags and tabs keep family chaos organized
- **Satisfying Interactions:** Task completion feels rewarding and fun

### Developer Benefits
- **Serverless Architecture:** Scales automatically, minimal maintenance
- **Modern Stack:** Latest Vercel features, ES6 modules, progressive enhancement
- **Extensible Design:** Easy to add new features and integrations
- **Well Documented:** Clear code structure and comprehensive documentation

---

## 📞 Support & Community

- **GitHub Issues:** [Report bugs and request features](https://github.com/yourusername/magnet/issues)
- **Discussions:** [Community Q&A and ideas](https://github.com/yourusername/magnet/discussions)  
- **Email Support:** `incoming.magnet+support@gmail.com`
- **Demo Video:** [Watch Magnet in action](https://your-demo-link.com)

---

## 📄 License

MIT License - Build amazing things with this foundation!

---

**Made with 🧲 for families who want to stay connected**

*"Finally, a fridge app that actually works and feels magical to use!"*
