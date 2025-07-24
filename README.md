# Magnet
Fridge Notes + Alerts System

## 🎯 Goal
Create a web-based system that allows:
- **One-way sync from Apple Notes to a Samsung Smart Fridge**
- **Touch-friendly note and checklist viewing**
- **Time-based alerts and reminders**
- Optional: **Global volume control widget** for ease-of-use on Samsung Family Hub

---

## 🧩 Key Features

### ✅ Notes & Lists to Fridge
- Share Apple Notes directly to a web app via iOS Shortcut
- Support for plain text, Markdown, and checklists (`- [ ]` style)
- Display notes in a clean, fridge-optimized interface (large touch targets, dark/light themes)
- Optional support for multiple notes (tabs or filters)

### ✅ Alerts System
- Define reminders in one of two ways:
  - Manually via Shortcut (custom time + message)
  - Embedded in a synced note using a special shorthand (e.g., `@alert 12:30 Feed the cats`)
- Alerts appear on the fridge screen with optional:
  - Audio cue (chime, meow, etc.)
  - Modal or banner display
  - Dismiss or auto-hide behavior
- Configurable repeat intervals (daily, once, weekends, etc.)

### ✅ Volume Widget (Bonus Feature)
- Display and control fridge system volume via touchscreen
- Quick access widget overlaid or docked on main interface
- Possibly use SmartThings API or hidden OS-level controls (if accessible)

---

## 🛠️ Technologies

### iPhone (Sender)
- **Apple Shortcuts**
  - Triggers from iOS Share Sheet or Home Screen
  - Actions:
    - Get Note Text
    - Format and POST to Web API
  - Optional: Parse note for `@alert` shorthand

### Backend (Vercel or similar)
- **Node.js / Serverless API Routes**
  - `/api/note` → Accepts and stores latest note content
  - `/api/alerts` → Receives and stores scheduled alerts
  - Optional: Parse note for inline `@alert` metadata and save
- **Database**
  - Supabase, Firebase, or file-based JSON store
  - Tables:
    - `notes`: `{ id, content, timestamp }`
    - `alerts`: `{ id, time, message, repeat, acknowledged }`

### Frontend (Fridge UI)
- Hosted static SPA (React/Svelte)
- Pages:
  - **Notes Page**: Render latest note as Markdown/checklist
  - **Alerts Engine**:
    - Poll every X seconds or use setInterval
    - Display modal/overlay if alert is due
    - Optional sound play
  - **Volume Widget** (experimental):
    - Simple slider or buttons
    - Interface with Tizen OS/SmartThings if possible

---

## 🖼️ UI Mockups & Flows

### 📝 Notes Screen (Default View)
- Large title at top: "Fridge Notes"
- Display latest synced note:
  - Markdown rendered
  - Checkboxes (`- [ ]`) are touch-friendly
  - Optional tabs for multiple notes: `Groceries | Chores | Travel`
- Footer or corner button: "Refresh", "Settings"

### ⏰ Alerts Pop-up
- Triggered by time match
- Full-screen or banner:
  - Header: 🚨 "Reminder!"
  - Message: "Feed the cats"
  - Buttons: `Dismiss`, `Snooze`, `Done`
  - Optional audio plays on open

### 🎚️ Volume Widget
- Docked panel (side or bottom)
- Minimal design:
  - Volume icon + slider
  - Mute button
  - Current level displayed
- Auto-hide when inactive

---

## ✨ Future Ideas
- Editable notes from fridge UI (two-way sync)
- Auth + multiple users or channels ("Dad List", "Chores", etc.)
- Audio recording support for reminders
- Fridge screen themes / dark mode / family avatars

