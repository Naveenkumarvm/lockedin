# Locked In - Study Routine Tracker (PWA)

"Locked In" is a private, zero-knowledge, offline-first study routine tracker designed as a Progressive Web App (PWA). It is built with vanilla HTML5, CSS3, and modern JavaScript with no external dependencies, no libraries, no analytics, and no build steps. It is hosted completely free on GitHub Pages at:

`https://naveenkumarvm.github.io/lockedin/`

---

## 🔒 Privacy & Architecture

- **Zero-Knowledge Device Storage**: All data exists solely in your browser's IndexedDB, encrypted at rest using AES-GCM (256-bit) and PBKDF2 (200,000 iterations with cryptographically random salts).
- **Never Stores the PIN**: Your PIN is never saved. A cryptographic verification token confirms your PIN upon entry.
- **Separate Multi-Profile Isolation**: If friends or family share a device, each profile maintains its own completely independent PIN, salt, and encrypted database.
- **Background Auto-Lock**: The app automatically locks after 2 minutes of background inactivity and applies progressive delays after 5 consecutive incorrect PIN attempts.
- **Private Cloud Backups**: Backups go only to your own personal Google Drive (under folder `LockedInBackups`) or via Web Share / email to your registered address.

---

## 🚀 How to Deploy on GitHub Pages

Because the repository is named `lockedin`, the app is served from the subpath `https://<username>.github.io/lockedin/`.

1. Push all files to the `main` branch of your GitHub repository:
   ```bash
   git add .
   git commit -m "Deploy Locked In PWA"
   git push origin main
   ```
2. In your GitHub repository:
   - Click **Settings** → **Pages** (under Code and automation).
   - Under **Build and deployment**:
     - Source: **Deploy from a branch**
     - Branch: `main` / Folder: `/ (root)`
   - Click **Save**.
3. Within 1–2 minutes, GitHub Pages will publish your site at:
   `https://naveenkumarvm.github.io/lockedin/`
4. Open the link on Android Chrome, iPhone Safari, or desktop Chrome.
   - **Android Chrome**: Tap the three dots menu → **Install app** or **Add to Home screen**.
   - **iPhone Safari**: Tap the Share button → **Add to Home Screen**.
   - **Desktop Chrome**: Click the install icon in the URL bar.

---

## 🔑 How to Create Google OAuth Client ID & Configure `config.js`

To enable direct Google Drive backups ("Save to Google Drive" and "Restore from Google Drive"), set up a free Google OAuth Client ID:

### Step 1: Create a Google Cloud Project
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. Click the project dropdown at the top and click **New Project**. Name it `Locked In` and click **Create**.

### Step 2: Configure the OAuth Consent Screen
1. In the left navigation menu, go to **APIs & Services** → **OAuth consent screen**.
2. Select User Type: **External**, then click **Create**.
3. Fill in the required fields:
   - **App name**: `Locked In`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the **Scopes** page:
   - Click **Add or Remove Scopes**.
   - Under "Manually add scopes", add:
     `https://www.googleapis.com/auth/drive.file`
   - Click **Add to Table**, then click **Update** and **Save and Continue**.
6. On the **Test Users** page (Crucial for you and friends):
   - Click **+ Add Users**.
   - Enter your Gmail address and the Gmail addresses of your 2-3 friends who will use the app.
   - Click **Save and Continue**.

### Step 3: Enable the Google Drive API
1. In the left navigation menu, go to **APIs & Services** → **Library**.
2. Search for **Google Drive API**.
3. Click **Enable**.

### Step 4: Create OAuth 2.0 Web Client ID
1. In the left navigation menu, go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. Set **Application type** to: **Web application**.
4. Set **Name** to: `Locked In Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `https://naveenkumarvm.github.io`
   - *(Optional for local testing)*: `http://localhost:8080` or `http://127.0.0.1:8080`
6. Click **Create**.
7. Copy the generated **Client ID** (it ends with `.apps.googleusercontent.com`).

### Step 5: Update `config.js`
Open `config.js` in the repository and paste your Client ID:

```javascript
window.LOCKEDIN_CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_COPIED_CLIENT_ID.apps.googleusercontent.com",
  APP_NAME: "Locked In",
  VERSION: "1.0.0"
};
```
Commit and push the change to GitHub. Since `config.js` is public by design, all authorized test users can now back up to their respective personal Google Drives without pasting credentials.

---

## 👥 How to Add Friends as Google Test Users

Because your Google Cloud app is in "Testing" mode (which requires no Google verification), only approved Test Users can authorize Google Drive:

1. Go to **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**.
2. Scroll to the **Test users** section.
3. Click **+ Add Users**.
4. Type each friend's Google email address.
5. Click **Save**.
6. Each friend installs the app from your GitHub Pages URL, logs in with their own Google account when backing up, and their encrypted backup is stored exclusively in their personal Google Drive!

---

## ⏰ Alarm System & Calendar Export (.ics)

1. **In-App Alarms**: When the app is open, an internal timer monitors your schedule blocks. When a routine starts, the app triggers a pleasant synthesized chime via Web Audio API, phone vibration, and a banner with "Stop" and "Snooze 5 min".
2. **Background Alarms via Calendar Export**:
   - Progressive Web Apps in mobile browsers cannot reliably wake the phone or ring alarms when closed or when the screen is turned off due to mobile operating system battery saving constraints.
   - Locked In includes an **"Export to Calendar (lockedin.ics)"** feature in the Timetable tab.
   - This generates a standard iCalendar `.ics` file with recurring events for Mon-Sat (`BYDAY=MO,TU,WE,TH,FR,SA`) and Sunday (`BYDAY=SU`), configured with native `VALARM` triggers at the start of each study block.
   - Opening this file on your phone imports recurring reminders into Google Calendar or Apple Calendar, ensuring your phone rings loudly even when Locked In is completely closed.

---

## 📋 Comprehensive Test Checklist

Use this checklist to verify complete functionality:

### 1. First Run & PIN Security
- [ ] On first load, the First Run setup wizard appears.
- [ ] Clear warning is displayed stating that lost PINs/passphrases cannot be recovered.
- [ ] Profile name and email entered.
- [ ] PIN requires at least 6 digits and matching confirmation.
- [ ] Choose "Start with the sample timetable" or "Start empty".
- [ ] App initializes and unlocks cleanly into the Today tab.

### 2. PIN Locking & Inactivity Lock
- [ ] Click the quick lock button in the top bar. App locks and shows the PIN keypad.
- [ ] Enter wrong PIN 5 times: verify that a 30-second lockout countdown is enforced.
- [ ] Enter correct PIN: app immediately unlocks.
- [ ] Switch to another tab or minimize browser for > 2 minutes: verify that app automatically locks.

### 3. Today Tab & Schedule Checklist
- [ ] Prev / Next buttons navigate between days. "Tap to jump to today" restores today's date.
- [ ] Current day loads correct schedule: Mon-Sat schedule for weekdays/Saturday, Sunday schedule for Sundays.
- [ ] Sleep blocks display a sleep icon and **have no tick button**.
- [ ] Ticking an active block toggles done status and plays audio confirmation.
- [ ] Progress ring updates dynamically with completion percentage.
- [ ] Stats update: Blocks Done (e.g. 5 / 8), Study Time (completed study blocks), and Streak (consecutive days >= 80%).
- [ ] Active block displays glowing "NOW" pill.
- [ ] "Now / Next" banner displays current block remaining time and next upcoming block start time.

### 4. What Did You Learn Today?
- [ ] Enter Topic, Session (Morning/Night/Other), Notes, and Minutes.
- [ ] Submitting immediately adds the entry to today's learning list.
- [ ] Deleting an entry updates the list.

### 5. Learning Log Tab
- [ ] Shows all past learning entries in a searchable table.
- [ ] Search input filters entries by topic, note, session, or date in real-time.
- [ ] Summary displays total study time formatted as `Xh Ym`.
- [ ] Click "Save as CSV": downloads `lockedin-learning-log-YYYY-MM-DD.csv` with UTF-8 BOM and properly quoted cells.

### 6. Report Tab
- [ ] Displays a 7-day completion bar chart.
- [ ] Bars for days with >= 80% completion are colored Green (`#10b981`); days under 80% are colored Accent Blue.
- [ ] Metrics show 7-day average completion, total study time, streak, and best day.
- [ ] "Topics Mastered" breakdown lists topics sorted by total study time.

### 7. Timetable Tab & Calendar
- [ ] Toggle between "Mon – Sat" and "Sunday" schedules.
- [ ] Click "Add Block": modal creates a new block with start/end time, type, title, notes, alarm toggle.
- [ ] Click "Edit": edits existing block and saves changes.
- [ ] Click "Delete": removes block after confirmation.
- [ ] Click "Reset to Sample Routine": restores original default routine.
- [ ] Click "Export to Calendar (lockedin.ics)": downloads `.ics` file with recurring VEVENT and VALARM blocks.
- [ ] Toggle "Keep Screen On" (Wake Lock): screen stays awake during study sessions.

### 8. Backups (Most Critical)
- [ ] **Last Backup Indicator**: shows "Never" initially with an amber reminder banner.
- [ ] **Export Backup**: prompts for backup passphrase, encrypts all records with PBKDF2 + AES-GCM, and downloads `lockedin-backup-YYYY-MM-DD.enc.json`.
- [ ] **Save to Google Drive**: authenticates via GIS token flow, creates/finds `LockedInBackups` folder in Google Drive, and uploads encrypted backup.
- [ ] **Send by Email**: uses Web Share API with the encrypted backup file, targeting the user's saved email.
- [ ] **Restore**:
  - Prompts for backup passphrase and decrypts file.
  - Displays preview modal with original profile, creation date, days count, and entry count.
  - Clicking "Confirm Restore & Overwrite" safely imports all timetable, daily logs, and learning logs.
- [ ] **Laptop Chrome File System API**: prompts user to select a folder once, writing backups directly to disk.
- [ ] Warning reminder appears if last backup is > 7 days old.

### 9. Offline & Multi-Device
- [ ] Disconnect internet: app loads completely offline from Service Worker cache.
- [ ] Light and dark themes match system preference.
- [ ] Responsive UI fits within 720px centered on mobile and desktop.
