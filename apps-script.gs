// Lift log: receives workouts from the app and adds them to the "Log" tab of this spreadsheet.
// 1. Change TOKEN below to your own long random string (letters and numbers, no spaces).
// 2. Deploy as a web app (see SETUP.md).

const TOKEN = "CHANGE-THIS-TO-A-LONG-RANDOM-STRING";
const TAB = "Log";
const HEADER = ["Date", "Exercise", "Set", "Reps", "Weight", "Unit", "Volume", "Workout minutes", "Set ID"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return reply({ ok: false, error: "bad_token" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    ensureHeader(sheet);

    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) return reply({ ok: true, added: 0, sheetUrl: ss.getUrl() });

    // Skip sets that are already in the sheet, so retrying never creates duplicates.
    const last = sheet.getLastRow();
    const have = new Set(last > 1 ? sheet.getRange(2, 9, last - 1, 1).getValues().map(r => String(r[0])) : []);
    const fresh = rows.filter(r => !have.has(String(r[8])));
    if (fresh.length) {
      sheet.getRange(last + 1, 1, fresh.length, HEADER.length).setValues(fresh.map(r => HEADER.map((_, i) => r[i] === undefined ? "" : r[i])));
    }
    return reply({ ok: true, added: fresh.length, sheetUrl: ss.getUrl() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function ensureHeader(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
  if (current.join("|") !== HEADER.join("|")) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
