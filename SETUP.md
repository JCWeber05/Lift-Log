# Lift log: setup (about 15 minutes, one time)

You'll do three things: connect the app to your Google Sheet, put the app online, and install it on your phone.

## 1. Connect your Google Sheet

1. Open your **Lift log** spreadsheet in Google Drive.
2. Choose **Extensions → Apps Script**.
3. Delete everything in the editor and paste in the contents of `apps-script.gs`.
4. On the line `const TOKEN = "..."`, replace the text in quotes with your own long random string (for example, a few random words and numbers with no spaces). Remember it: you'll enter it in the app.
5. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
7. Google asks you to authorize the script. Click **Authorize access**, choose your account, then **Advanced → Go to (project name) → Allow**. This warning is normal for your own scripts.
8. Copy the **Web app URL** (it ends in `/exec`).

"Anyone" only means the URL can be reached. Nothing is written unless the request carries your secret token.

## 2. Put the app online

Upload everything in this folder except `apps-script.gs` and `SETUP.md`.

**GitHub Pages (free):**
1. Sign in at github.com and create a new **public** repository (for example `lift-log`).
2. Click **Add file → Upload files**, drag in `index.html`, `manifest.webmanifest`, `sw.js` and the four `.png` files, then **Commit changes**.
3. Go to **Settings → Pages**, set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute or two your app is live at `https://YOUR-USERNAME.github.io/lift-log/`.

Netlify works too: sign in and drag the folder onto app.netlify.com/drop.

## 3. Install it on your phone

Open your app's URL in your phone's browser.

- **iPhone (Safari):** tap Share, then **Add to Home Screen**, then Add.
- **Android (Chrome):** tap ⋮, then **Install app** (or **Add to Home screen**).

Open it from the new icon. Go to **History → Google Sheets sync**, paste the Web app URL and your secret token, and tap **Save and test**. You should see "Connected."

## Using it

Tap **Start workout**, add exercises and sets, and tap **End workout**. The sets are added to the **Log** tab of your sheet. If you're offline, tap Retry later. Sets already in the sheet are skipped, so retrying never makes duplicates.

The first time you connect, any sets already logged on your phone are also sent to the sheet.

## Updating the app later

Re-upload the changed files to the same repository. The app picks up updates the next time it's opened with a connection.

Your workout data lives in your phone's browser storage. Clearing the site data for the app erases it, so the sheet is your permanent record.
