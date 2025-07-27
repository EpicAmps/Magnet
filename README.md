# 🧲 Magnet
**Smart Fridge Notes via Email**

Transform your Samsung Smart Fridge into a family communication hub. Send notes directly to your fridge by email - they appear instantly on the fridge screen!

---

## 🎯 How It Works

**Simple 3-Step Process:**
1. **Setup:** Visit your fridge's web browser, enter a name (like "Kitchen")
2. **Get Email:** Your fridge gets a unique email address: `incoming.magnet+kitchen@gmail.com`
3. **Send Notes:** Email your notes to that address - they appear on the fridge within minutes!

**Universal Compatibility:**
- ✅ **Any device:** iPhone, Android, computer, tablet
- ✅ **Any app:** Notes, Messages, Gmail, Outlook, etc.
- ✅ **Any platform:** iOS, Android, Windows, Mac, Linux
- ✅ **No apps to install** - just email!

---

## 🔄 Complete System Flow

### The Journey of Your Note

1. **📧 Email Sent:** You send an email to `incoming.magnet+kitchen@gmail.com`
2. **📨 Gmail Receives:** Email arrives in the monitored Gmail inbox
3. **🔄 Pipedream Monitors:** Pipedream workflow detects the new email
4. **📤 Data Processing:** Pipedream extracts email content, subject, and sender
5. **🌐 Webhook Delivery:** Pipedream sends formatted data to Vercel webhook
6. **💾 Cloud Storage:** Vercel processes email and saves note to Blob storage
7. **📡 Real-time Notification:** Vercel attempts to notify connected fridges via Server-Sent Events
8. **🔄 Backup Polling:** If real-time fails, fridge polls for updates every 2 minutes
9. **🧊 Fridge Display:** Note appears on Samsung fridge screen with sender attribution

### Hybrid Reliability System

- **⚡ Real-time Updates:** Instant notifications when SSE connection works
- **🔄 Polling Backup:** Automatic fallback checks every 2 minutes
- **🔘 Manual Refresh:** Always-available manual update button
- **✅ Guaranteed Delivery:** Notes appear within 2 minutes maximum

---

## 🌟 Key Features

### 📧 Email-Based Sync
- **Universal Access:** Send from any device that can email
- **Rich Content:** Support for formatted text, lists, and line breaks
- **Gmail Integration:** Uses your existing Gmail account with Pipedream monitoring
- **Multiple Fridges:** Each fridge gets its own unique email suffix (`+kitchen`, `+garage`)

### ⚡ Hybrid Update System
- **Real-time Notifications:** Server-Sent Events for instant updates (when working)
- **Intelligent Polling:** Automatic backup checks every 2 minutes
- **Manual Refresh:** Always-reliable manual update button
- **Connection Status:** Clear indicators showing connection method

### 🧊 Fridge-Optimized Interface
- **Touch-Friendly:** Large buttons and text for easy Samsung fridge interaction
- **Clean Design:** Modern gradient design with clear status indicators
- **Persistent Storage:** Notes saved permanently in Vercel Blob storage
- **Smart Formatting:** Email content automatically formatted for display

### 🔒 Security & Reliability
- **Webhook Authentication:** Secure communication between Pipedream and Vercel
- **Public API Endpoint:** Bypasses Vercel OIDC authentication for external webhooks
- **Dynamic Blob Handling:** Automatically handles Vercel's dynamic blob key system
- **Fault Tolerance:** Multiple backup systems ensure notes always get delivered

---

## 🛠️ Technology Stack

### Email Processing Pipeline
- **Gmail:** Primary email inbox (`incoming.magnet+fridgename@gmail.com`)
- **Pipedream:** Email monitoring and webhook automation service
- **Webhook Authentication:** Secure communication with shared secrets

### Backend (Vercel Serverless)
- **Public API Routes:** `/api/public/webhook.js` for external Pipedream integration
- **Protected API Routes:** `/api/note.js` for fridge communication, `/api/ping.js` for real-time updates
- **Storage:** Vercel Blob for persistent note storage with dynamic key handling
- **Real-Time:** Server-Sent Events with polling backup for reliability

### Frontend (Samsung Tizen Browser)
- **Progressive Web App:** Responsive design optimized for fridge screens
- **Hybrid Update System:** Real-time + polling + manual refresh
- **Touch Optimized:** Large targets, clear status indicators
- **Connection Resilience:** Smart reconnection and fallback systems

### Security & Authentication
- **OIDC Bypass:** Public webhook endpoints for external service integration
- **Webhook Secrets:** Authenticated communication between services
- **CORS Configuration:** Proper cross-origin handling for fridge browsers

---

## 🚀 Quick Start

### For Fridge Owners

1. **Open your Samsung Smart Fridge browser**
2. **Navigate to:** `https://magnet-mu.vercel.app/setup`
3. **Enter your fridge name** (e.g., "Kitchen", "Garage")
4. **Note your email address:** `incoming.magnet+yourname@gmail.com`
5. **Bookmark the fridge page** for easy access
6. **Start sending emails!**

### For Note Senders

1. **Open any email app** (Gmail, Mail, Outlook, etc.)
2. **Send to:** `incoming.magnet+fridgename@gmail.com`
3. **Subject:** Your note title (optional)
4. **Body:** Your note content
5. **Send!** - Note appears on fridge within 2 minutes

---

## 💡 Usage Examples

### 📝 Quick Notes
```
To: incoming.magnet+kitchen@gmail.com
Subject: Dinner Tonight
Body: Pizza at 7pm! Don't forget to set the table.
```

### 🛒 Shopping Lists
```
To: incoming.magnet+kitchen@gmail.com
Subject: Grocery List
Body: 
- Milk (2%)
- Bread (whole wheat)
- Eggs (dozen)
- Coffee (dark roast)
- Bananas
```

### 📅 Family Reminders
```
To: incoming.magnet+kitchen@gmail.com
Subject: Weekend Plans
Body: 
Saturday:
- Soccer practice 9am
- Grocery shopping 2pm
- Movie night 7pm

Sunday:
- Church 10am
- Family BBQ 3pm
```

### 🏠 Household Updates
```
To: incoming.magnet+garage@gmail.com
Subject: Maintenance
Body: 
Scheduled this week:
✓ HVAC service (Wed 2pm)
✓ Lawn care (Fri 10am)
⚠️ Plumber coming Monday for kitchen sink
```

---

## 🔧 Setup & Configuration

### Environment Variables (Vercel)
```bash
# Automatically configured by Vercel
BLOB_READ_WRITE_TOKEN=your_blob_token
VERCEL_URL=your_deployment_url

# Webhook Security (for Pipedream authentication)
WEBHOOK_SECRET=your_secure_random_string
```

### Pipedream Setup
1. **Create Pipedream account** (free tier available)
2. **Set up Gmail trigger** to monitor `incoming.magnet+*@gmail.com`
3. **Configure HTTP webhook step** pointing to: `https://your-app.vercel.app/api/public/webhook`
4. **Add webhook secret** in HTTP headers: `X-Webhook-Secret: your_secret`
5. **Test email processing** end-to-end

### Gmail Configuration
- **Email Address:** Use your existing Gmail account
- **Email Format:** `incoming.magnet+fridgename@gmail.com`
- **Pipedream Access:** Grant Pipedream permission to monitor your Gmail
- **No MX Records Needed:** Uses standard Gmail infrastructure

---

## 🏗️ Project Structure

```
magnet/
├── api/
│   ├── note.js                    # Note CRUD operations
│   ├── email-webhook.js           # Legacy SendGrid webhook (deprecated)
│   ├── ping.js                    # Real-time Server-Sent Events
│   └── public/
│       └── webhook.js             # Public webhook for Pipedream integration
├── public/
│   ├── magnet-logo.png           # Magnet logo asset
│   ├── setup.html                # Fridge setup and naming
│   └── fridge/
│       └── [id].html             # Fridge-specific note display
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
```

---

## 🧪 Development

### Local Development
```bash
# Clone repository
git clone https://github.com/EpicAmps/Magnet.git
cd magnet

# Install dependencies
npm install

# Run development server
npm run dev

# Visit http://localhost:3000
```

### Testing Email Integration
```bash
# Test webhook locally with ngrok
ngrok http 3000

# Configure Pipedream to use ngrok URL
# Send test emails to verify end-to-end processing
```

### Testing Individual Components
```bash
# Test webhook endpoint directly
curl -X POST http://localhost:3000/api/public/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your_secret" \
  -d '{"to": "incoming.magnet+test@gmail.com", "from": "you@example.com", "subject": "Test", "body": "Hello World"}'

# Test note retrieval
curl "http://localhost:3000/api/note?fridgeId=your_fridge_id"
```

### Deployment
```bash
# Deploy to Vercel (auto-deployment via GitHub)
git push origin main

# Manual deployment
vercel deploy --prod
```

---

## 🔧 Troubleshooting

### Email Not Appearing on Fridge

1. **Check Pipedream workflow status** - Is it active and processing emails?
2. **Verify webhook endpoint** - Is `https://your-app.vercel.app/api/public/webhook` accessible?
3. **Test webhook secret** - Are Pipedream and Vercel using the same secret?
4. **Check Vercel function logs** - Any errors in email processing?
5. **Try manual refresh** - Does the refresh button work on the fridge?

### Connection Issues

- **🟢 Connected:** System is working (any method)
- **🔴 Connecting...:** All methods failing, check network/config

### Common Issues

- **OIDC Authentication Errors:** Use `/api/public/webhook` instead of `/api/email-webhook`
- **Blob Not Found:** Vercel uses dynamic blob keys, handled automatically
- **SSE Connection Timeouts:** Normal on fridge browsers, polling backup active
- **Module Import Errors:** Ensure consistent ES6 module usage across API routes

---

## 🤝 Contributing

We welcome contributions! Here are some areas where help is needed:

- **Email Providers:** Support for additional email services beyond Gmail
- **Mobile Apps:** Native iOS/Android applications with push notifications
- **Smart Home:** Integration with Alexa, Google Home, HomeKit
- **Enterprise:** Multi-tenant support, advanced admin features
- **UI/UX:** Improved fridge interface, accessibility features

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (especially email flow)
5. Submit a pull request

---

## 📋 Roadmap

### v1.0 - Core Email System ✅
- [x] Gmail + Pipedream email processing
- [x] Hybrid real-time + polling updates
- [x] Samsung Tizen fridge compatibility
- [x] Persistent Vercel Blob storage
- [x] Secure webhook authentication

### v1.1 - Enhanced Experience
- [ ] Rich email formatting (HTML, images)
- [ ] Attachment handling (images, PDFs)
- [ ] Multiple note persistence and history
- [ ] Improved error handling and status messages

### v1.2 - Multi-User Support
- [ ] Personal account system with unique domains
- [ ] Family/team workspaces
- [ ] Permission management and access control
- [ ] Usage analytics and insights

### v2.0 - Smart Home Integration
- [ ] Voice assistant support (Alexa, Google)
- [ ] IoT device integration beyond fridges
- [ ] Mobile companion apps with push notifications
- [ ] Advanced automation and scheduling rules

---

## 🎉 Success Stories

> *"Finally, a way to leave notes for my family that they actually see! No more sticky notes falling off the fridge."* - Sarah M.

> *"Perfect for our busy household. Kids can email their schedules from school, and we see them instantly on the kitchen fridge."* - Mike D.

> *"The hybrid system is genius - even when our WiFi is flaky, notes still get through via the polling backup."* - Jennifer L.

---

## 📞 Support

- **Documentation:** [GitHub Wiki](https://github.com/EpicAmps/Magnet/wiki)
- **Issues:** [GitHub Issues](https://github.com/EpicAmps/Magnet/issues)
- **Discussions:** [GitHub Discussions](https://github.com/EpicAmps/Magnet/discussions)
- **Email:** incoming.magnet+support@gmail.com

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Made with 🧲 for families who want to stay connected**
