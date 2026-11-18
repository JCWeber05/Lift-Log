# Lift Log changelog

Current version: **1.8**. History > Data and backup shows the version your phone is running.
If it doesn't match, close the app fully and open it again while online.

How numbers work: 1.x = new features or fixes. The "Files" line says what to upload to GitHub.
"Script" says whether the Google Apps Script needs re-pasting (keep your own TOKEN) and a new deployment version.

## 1.8 (Nov 18, 2026): Welcome screen
- A full-screen welcome appears every time the app opens, for new and returning users alike. Flowing animated colors (they follow your accent color), a floating barbell and a shimmering title.
- Shows your name, how many workouts you have logged and the last one. If a workout is running it says so and the button becomes "Back to workout".
- One tap, Enter, Space or Escape gets you in. First-time users go on to the setup guide.
- Animation turns off if your phone's "reduce motion" setting is on. Works in portrait and landscape.
- Files: app.js, index.html, sw.js, CHANGELOG.md (sw.js changed, so you will see the "App updated" banner)
- Script: no change

## 1.7 (Nov 18, 2026): View your workouts on a computer
- New page `view.html`: drop your backup file on it and see totals, volume per workout day, progress charts per exercise, a searchable list of every set, a lb/kg toggle and CSV download.
- It runs only in the computer's browser and can't make network requests. Nothing is uploaded or collected.
- History > Data and backup has **Send to my computer** (shares the backup file) and **Copy viewer link**.
- CSV exports now defuse text that starts with = + - @ so it can't run as a formula in Excel or Sheets.
- Files: app.js, index.html, sw.js, view.html, view.js, CHANGELOG.md (new files: view.html and view.js. sw.js changed, so you will see the "App updated" banner)
- Script: no change

## 1.6 (Nov 18, 2026): Phone-friendly setup
- Google's script editor isn't available in the phone apps, so on a phone or tablet the guide now has two steps: do the Google part on a computer, then paste the URL on the phone.
- "Send the script to my computer" shares (or copies) the script with your token inside, so you can email or message it to yourself.
- "I'm on a computer right now" switches back to the full 5-step guide.
- Setting up on a computer connects that computer only, and the guide says so.
- Files: app.js, index.html, sw.js, CHANGELOG.md (sw.js changed, so you will see the "App updated" banner)
- Script: no change

## 1.5 (Nov 18, 2026): Setup guide, name and color, privacy panel
- First launch shows a welcome screen and a 5-step guide to connect Google Sheets. It is optional and can be skipped. Reopen it any time from History > Google Sheets sync > Step-by-step setup guide.
- The app makes your secret token for you and builds the script with it already inside. Copy script button, a Test and connect check, and plain-language error messages. No editing code.
- Personalize: your name (greeting at the top) and an accent color. The share card uses your color.
- Privacy and security panel in History explains where your data lives and the one limit (no passcode in the app).
- Existing users with history are not interrupted by the welcome screen.
- Files: app.js, index.html, sw.js, CHANGELOG.md, SETUP.md (sw.js changed, so you will see the "App updated" banner)
- Script: no change needed (apps-script.gs unchanged; the guide embeds a copy)

## 1.4 (Nov 18, 2026): Bodyweight exercises
- Bodyweight toggle on each exercise. The weight column becomes "Added" (vest, belt, dumbbell).
- Bodyweight work with no added weight shows total reps instead of volume.
- Sets display as "10 × BW" or "6 × BW + 25 lb". Backups keep the setting.
- History refreshes when you open it. App version shown in History > Data and backup. "App updated" banner.
- Files: app.js, index.html, sw.js, CHANGELOG.md, SETUP.md
- Script: no change

## 1.3: Secure and reliable storage
- Backup copy of your history, recovery of damaged data, saves are verified, persistent-storage request.
- Backup file export/import, restore from your sheet, locked-down security policy.
- Script hardened (token required, validation, duplicate protection).
- Files: all app files
- Script: new script (this is where the TOKEN requirement started)

## 1.2: Last time and Share
- "Last time" numbers under each exercise.
- Share button on the workout summary (image card).
- Files: app.js, index.html

## 1.1: Readable sheet and delete history
- Each workout gets its own banner row in the Google Sheet.
- Delete history on this device only (the sheet is never touched).
- Files: app.js, index.html
- Script: new script

## 1.0: First standalone app
- Lift logging with timer, per-set rows, "+" add set, local storage, volume after End workout.
- Installable on your home screen, works offline, syncs to Google Sheets.
