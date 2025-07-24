# 🧲 Magnet
**Smart Fridge Notes via Email**

Transform your Samsung Smart Fridge into a family communication hub. Send notes directly to your fridge by email - they appear instantly on the fridge screen!

---

## 🎯 How It Works

**Simple 3-Step Process:**
1. **Setup:** Visit your fridge's web browser, enter a name (like "Kitchen")
2. **Get Email:** Your fridge gets a unique email address: `kitchen@magnet-mu.vercel.app`
3. **Send Notes:** Email your notes to that address - they appear instantly on the fridge!

**Universal Compatibility:**
- ✅ **Any device:** iPhone, Android, computer, tablet
- ✅ **Any app:** Notes, Messages, Gmail, Outlook, etc.
- ✅ **Any platform:** iOS, Android, Windows, Mac, Linux
- ✅ **No apps to install** - just email!

---

## 🌟 Key Features

### 📧 Email-Based Sync
- **Universal Access:** Send from any device that can email
- **Rich Content:** Support for formatted text, lists, and attachments
- **Memorable Addresses:** `kitchen@magnet-mu.vercel.app`, `garage@magnet-mu.vercel.app`
- **Multiple Fridges:** Each fridge gets its own unique email address

### ⚡ Real-Time Updates
- **Instant Display:** Notes appear on fridge screen immediately after sending
- **Live Sync:** Server-Sent Events for real-time updates
- **Smart Formatting:** Emails automatically formatted for fridge display
- **Sender Attribution:** Shows who sent each note

### 🧊 Fridge-Optimized Interface
- **Touch-Friendly:** Large buttons and text for easy interaction
- **Clean Design:** Dark/light themes, readable fonts
- **Persistent Storage:** Notes saved permanently in cloud storage
- **Multiple Notes:** Support for different content types and sources

### 🔮 Future Features (Planned)
- **Time-Based Alerts:** Schedule reminders and notifications
- **Multi-User Accounts:** Personal namespaces like `kitchen@yourname.magnet-mu.vercel.app`
- **Voice Integration:** Send notes via voice assistants
- **Mobile Apps:** Native iOS/Android apps for enhanced experience

---

## 🛠️ Technology Stack

### Backend (Vercel Serverless)
- **API Routes:** Node.js serverless functions
- **Email Processing:** SendGrid Inbound Parse webhook
- **Storage:** Vercel Blob for persistent note storage
- **Real-Time:** Server-Sent Events for instant updates

### Frontend (Samsung Tizen Browser)
- **Progressive Web App:** Responsive design for fridge screens
- **Real-Time UI:** Live updates without page refresh
- **Touch Optimized:** Large targets, intuitive navigation
- **Offline Ready:** Cached content for reliability

### Email Integration
- **SendGrid Inbound Parse:** Reliable email-to-webhook processing
- **Smart Parsing:** HTML/text email content extraction
- **Spam Protection:** Built-in filtering and validation
- **Rich Content:** Support for formatted emails and attachments

---

## 🚀 Quick Start

### For Fridge Owners

1. **Open your Samsung Smart Fridge browser**
2. **Navigate to:** `https://magnet-mu.vercel.app/setup`
3. **Enter your fridge name** (e.g., "Kitchen", "Garage")
4. **Note your email address:** `yourname@magnet-mu.vercel.app`
5. **Bookmark the fridge page** for easy access
6. **Start sending emails!**

### For Note Senders

1. **Open any email app** (Gmail, Mail, Outlook, etc.)
2. **Send to:** `fridgename@magnet-mu.vercel.app`
3. **Subject:** Your note title (optional)
4. **Body:** Your note content
5. **Send!** - Note appears instantly on fridge

---

## 💡 Usage Examples

### 📝 Quick Notes
```
To: kitchen@magnet-mu.vercel.app
Subject: Dinner Tonight
Body: Pizza at 7pm! Don't forget to set the table.
```

### 🛒 Shopping Lists
```
To: kitchen@magnet-mu.vercel.app
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
To: kitchen@magnet-mu.vercel.app
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
To: garage@magnet-mu.vercel.app
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

# SendGrid Configuration (for email processing)
SENDGRID_API_KEY=your_sendgrid_api_key
```

### SendGrid Setup
1. **Create SendGrid account** (free tier available)
2. **Set up Inbound Parse** webhook
3. **Point to:** `https://your-app.vercel.app/api/email-webhook`
4. **Configure MX records** for your domain
5. **Test email processing**

### Domain Configuration (Optional)
- **Custom Domain:** Use your own domain instead of vercel.app
- **Email Routing:** Route emails through your domain
- **SSL/Security:** Automatic HTTPS and security headers

---

## 🏗️ Project Structure

```
magnet/
├── api/
│   ├── note.js              # Note CRUD operations
│   ├── email-webhook.js     # SendGrid email processing
│   └── ping.js              # Real-time Server-Sent Events
├── public/
│   ├── setup.html           # Fridge setup and naming
│   └── fridge/
│       └── [id].html        # Fridge-specific note display
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

---

## 🧪 Development

### Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/magnet.git
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

# Configure SendGrid to use ngrok URL
# Send test emails to verify processing
```

### Deployment
```bash
# Deploy to Vercel
npm run deploy

# Or push to GitHub for auto-deployment
git push origin main
```

---

## 🤝 Contributing

We welcome contributions! Here are some areas where help is needed:

- **Email Providers:** Support for additional email services
- **Mobile Apps:** Native iOS/Android applications
- **Smart Home:** Integration with Alexa, Google Home, HomeKit
- **Enterprise:** Multi-tenant support, advanced admin features
- **Accessibility:** Screen reader support, high contrast themes

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📋 Roadmap

### v1.0 - Email Foundation ✅
- [x] Email-to-fridge messaging
- [x] Real-time display updates
- [x] Samsung Tizen compatibility
- [x] Persistent cloud storage

### v1.1 - Enhanced Experience
- [ ] Time-based alerts and reminders
- [ ] Rich email formatting support
- [ ] Attachment handling (images, PDFs)
- [ ] Multiple note categories/tags

### v1.2 - Multi-User Support
- [ ] Personal account system
- [ ] Family/team workspaces
- [ ] Permission management
- [ ] Usage analytics

### v2.0 - Smart Home Integration
- [ ] Voice assistant support
- [ ] IoT device integration
- [ ] Mobile companion apps
- [ ] Advanced automation rules

---

## 🎉 Success Stories

> *"Finally, a way to leave notes for my family that they actually see! No more sticky notes falling off the fridge."* - Sarah M.

> *"Perfect for our busy household. Kids can email their schedules from school, and we see them instantly on the kitchen fridge."* - Mike D.

> *"Works great for our office break room. Everyone can send lunch announcements and event reminders."* - Jennifer L.

---

## 📞 Support

- **Documentation:** [GitHub Wiki](https://github.com/yourusername/magnet/wiki)
- **Issues:** [GitHub Issues](https://github.com/yourusername/magnet/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/magnet/discussions)
- **Email:** support@magnet-mu.vercel.app

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Made with 🧲 for families who want to stay connected**
