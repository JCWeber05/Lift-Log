# Lift log: setup (about 15 minutes, one time)

You'll do three things: connect the app to your Google Sheet, put the app online, and install it on your phone.

## 1. Connect your Google Sheet

1. Open your **Lift log** spreadsheet in Google Drive.
2. Choose **Extensions → Apps Script**.
3. Delete everything in the editor and paste in the contents of `apps-script.gs`.
4. On the line `const TOKEN = "..."`, replace the text in quotes with your own random string of **at least 24 characters** (letters and numbers, no spaces). Remember it: you'll enter it in the app. The script refuses to run with the placeholder or a short token.
5. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
7. Google asks you to authorize the script. Click **Authorize access**, choose your account, then **Advanced → Go to (project name) → Allow**. This warning is normal for your own scripts.
8. Copy the **Web app URL** (it ends in `/exec`).

"Anyone" only means the URL can be reached. Nothing is written unless the request carries your secret token.

## 2. Put the app online

Upload everything in this folder except `apps-script.gs` and `SETUP.md`.

**GitHub Pages (free):**
1. Sign in at github.com and create a new **public** repository (for example `lift-log`).
2. Click **Add file → Upload files**, drag in `index.html`, `app.js`, `manifest.webmanifest`, `sw.js` and the four `.png` files, then **Commit changes**.
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

## Keeping your data safe

- **Data and backup** (History tab) shows how many sets are on the phone and how many are not in your sheet yet. It also has **Export backup** (a file of your workouts, never your token), **Import backup**, and **Restore from sheet**, which rebuilds your history from the Lift log tab if the phone's data is ever lost.
- The app asks the browser to treat its data as persistent, and keeps a previous copy of your history. If it ever finds damaged data, it restores that copy and tells you.
- Sets from earlier days that didn't reach the sheet are retried automatically when you open the app or get back online. Today's sets still go when you tap **End workout**.
- **Forget this connection** (in Google Sheets sync) removes the script URL and token from the phone.
- **Hosting tip:** on GitHub Pages, every project under `yourname.github.io` shares one browser storage space. Keep this app in its own repository on an account that hosts nothing else, or use a custom domain.
- Export a backup now and then. The sheet is your permanent copy, but a backup file is free insurance.

## Updating the script later

1. Open the sheet, then Extensions → Apps Script, and paste in the new `apps-script.gs`. Keep your own `TOKEN` line.
2. Click **Deploy → Manage deployments**, the pencil icon, set Version to **New version**, and click Deploy. Don't create a new deployment: that gives you a new URL.

## Updating the app later

Re-upload the changed files to the same repository. The app picks up updates the next time it's opened with a connection.

Your workout data lives in your phone's browser storage. Clearing the site data for the app erases it, so the sheet is your permanent record.
