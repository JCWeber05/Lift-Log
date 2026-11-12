// Lift log: receives workouts from the app and adds them to the "Log" tab of this spreadsheet.
// Each workout gets its own banner row (date, workout number, exercises, sets, total volume, minutes)
// with a blank row between workouts. Set rows stay one per set, so you can still filter and sort.
//
// Setup: change TOKEN below to your own secret (at least 24 random characters), then deploy as a
// web app (see SETUP.md). The script refuses to run until you do.
// Tidy up existing rows: run reformatLog() once from the Apps Script editor.

const TOKEN = "CHANGE-THIS-TO-A-LONG-RANDOM-STRING";
const TAB = "Log";
// Columns A-H are the readable ones. I (Set ID) is used to skip duplicates and is hidden. J labels the workout.
const HEADER = ["Date", "Exercise", "Set", "Reps", "Weight", "Unit", "Volume", "Workout minutes", "Set ID", "Workout"];
const COLS = HEADER.length;
const BANNER_BG = "#2B4BD8";
const BANNER_FG = "#FFFFFF";
const MAX_BODY = 100000; // bytes of request body
const MAX_ROWS = 500;    // sets per request

function doGet() {
  return reply({ ok: false, error: "post_only" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (TOKEN === "CHANGE-THIS-TO-A-LONG-RANDOM-STRING" || String(TOKEN).length < 24) {
      return reply({ ok: false, error: "token_not_set" });
    }
    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== "string" || raw.length > MAX_BODY) return reply({ ok: false, error: "bad_request" });
    let data;
    try { data = JSON.parse(raw); } catch (_) { return reply({ ok: false, error: "bad_request" }); }
    if (!data || typeof data !== "object" || !safeEqual(data.token, TOKEN)) {
      return reply({ ok: false, error: "bad_token" });
    }
    // Read-only: lets the app restore its history from this sheet (same token required).
    if (data.action === "export") return reply(exportRows(data.offset, data.limit));
    if (data.rows !== undefined && !Array.isArray(data.rows)) return reply({ ok: false, error: "bad_request" });
    const input = data.rows || [];
    if (input.length > MAX_ROWS) return reply({ ok: false, error: "too_many_rows" });

    // Keep only well-formed sets; count the rest so the app can tell you.
    const rows = [];
    let rejected = 0;
    input.forEach(r => {
      const clean = cleanRow(r);
      if (clean) rows.push(clean); else rejected++;
    });

    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
    ensureHeader(sheet);
    if (!rows.length) return reply({ ok: true, added: 0, rejected, sheetUrl: ss.getUrl() });

    // Skip sets that are already in the sheet, so retrying never creates duplicates.
    const last = sheet.getLastRow();
    const have = new Set(last > 1 ? sheet.getRange(2, 9, last - 1, 1).getValues().map(r => String(r[0])) : []);
    const fresh = rows.filter(r => !have.has(String(r[8])));

    if (fresh.length) {
      const tz = ss.getSpreadsheetTimeZone();
      const counts = workoutsPerDate(sheet, tz);
      const byDate = {};
      const dates = [];
      fresh.forEach(r => {
        const d = r[0];
        if (!byDate[d]) { byDate[d] = []; dates.push(d); }
        byDate[d].push(r);
      });
      const hasRows = last > 1;
      const blocks = dates.map((d, i) => {
        counts[d] = (counts[d] || 0) + 1;
        return makeBlock(d, counts[d], byDate[d], hasRows || i > 0, tz);
      });
      writeBlocks(sheet, blocks);
    }
    return reply({ ok: true, added: fresh.length, rejected, sheetUrl: ss.getUrl() });
  } catch (err) {
    console.error(err); // details stay in the script's execution log, not in the response
    return reply({ ok: false, error: "server_error" });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// Returns saved sets (rows that have a Set ID) in pages, for the app's "Restore from sheet" button.
function exportRows(offset, limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAB);
  const start = intIn(offset, 0, 10000000) || 0;
  const size = intIn(limit, 1, 2000) || 2000;
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, total: 0, rows: [] };
  const tz = ss.getSpreadsheetTimeZone();
  const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  const data = vals
    .filter(r => String(r[1]).trim() !== "" && String(r[8]).trim() !== "")
    .map(r => [dateText(r[0], tz), String(r[1]), r[2], r[3], r[4], String(r[5]), r[6], r[7], String(r[8])]);
  return { ok: true, total: data.length, rows: data.slice(start, start + size) };
}

// Run this once from the editor to give existing rows the banner layout.
// It keeps a copy of the old tab ("Log backup ...") that you can delete when you're happy.
function reformatLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAB);
  if (!sheet) throw new Error('No "' + TAB + '" tab found.');
  const tz = ss.getSpreadsheetTimeZone();
  ensureHeader(sheet);
  const last = sheet.getLastRow();
  if (last < 2) return;

  const values = sheet.getRange(2, 1, last - 1, COLS).getValues();
  const data = [];
  values.forEach((r, i) => {
    if (String(r[1]).trim() === "") return; // banner and blank rows have no exercise name
    const row = r.slice();
    row[0] = dateText(row[0], tz);
    data.push({ row, i });
  });
  data.sort((a, b) => (a.row[0] < b.row[0] ? -1 : a.row[0] > b.row[0] ? 1 : a.i - b.i));

  const groups = [];
  const perDate = {};
  let cur = null;
  data.forEach(({ row }) => {
    const key = row[9] ? String(row[9]) : row[0];
    if (!cur || cur.key !== key) {
      perDate[row[0]] = (perDate[row[0]] || 0) + 1;
      cur = { key, d: row[0], n: perDate[row[0]], rows: [] };
      groups.push(cur);
    }
    cur.rows.push(row);
  });
  const blocks = groups.map((g, i) => makeBlock(g.d, g.n, g.rows, i > 0, tz));

  sheet.copyTo(ss).setName("Log backup " + Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH-mm"));
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), COLS).clear();
  writeBlocks(sheet, blocks);
}

// ---- validation and safety ----

// Compares two strings without stopping at the first difference.
function safeEqual(a, b) {
  const x = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a));
  const y = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Returns a cleaned 9-value row, or null if anything is off.
function cleanRow(r) {
  if (!Array.isArray(r) || r.length < 9 || r.length > 12) return null;
  const date = String(r[0]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return null;
  const name = cleanText(r[1], 60);
  const set = intIn(r[2], 1, 100);
  const reps = intIn(r[3], 1, 1000);
  const weight = r[4] === "" || r[4] === null ? "" : numIn(r[4], 0, 5000);
  const unit = String(r[5]);
  const volume = numIn(r[6], 0, 5000000);
  const mins = r[7] === "" || r[7] === null || r[7] === undefined ? "" : numIn(r[7], 0, 1440);
  const id = String(r[8]);
  if (!name || set === null || reps === null || weight === null || volume === null || mins === null) return null;
  if (unit !== "lb" && unit !== "kg") return null;
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) return null;
  return [date, name, set, reps, weight, unit, volume, mins, id];
}

function cleanText(v, max) {
  const t = String(v).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return t && t.length <= max ? t : null;
}

function numIn(v, lo, hi) {
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}

function intIn(v, lo, hi) {
  const n = numIn(v, lo, hi);
  return n !== null && Math.floor(n) === n ? n : null;
}

// ---- helpers ----

function makeBlock(d, n, setRows, withSpacer, tz) {
  const label = d + " #" + n;
  const rows = [];
  if (withSpacer) rows.push(new Array(COLS).fill(""));
  const bannerIdx = rows.length;
  const banner = new Array(COLS).fill("");
  banner[0] = bannerText(d, n, setRows, tz);
  rows.push(banner);
  setRows.forEach(r => {
    const out = [];
    for (let i = 0; i < 9; i++) out.push(r[i] === undefined || r[i] === null ? "" : r[i]);
    out[0] = d;
    out.push(label);
    rows.push(out);
  });
  return { rows, bannerIdx };
}

function writeBlocks(sheet, blocks) {
  const start = Math.max(sheet.getLastRow(), 1) + 1;
  const values = [];
  const bannerRows = [];
  blocks.forEach(b => {
    bannerRows.push(start + values.length + b.bannerIdx);
    b.rows.forEach(r => values.push(r));
  });
  const area = sheet.getRange(start, 1, values.length, COLS);
  area.setBackground(null).setFontColor(null).setFontWeight("normal");
  // Plain-text format on the text columns, so a value like "=1+1" is stored as text and never runs as a formula.
  [1, 2, 6, 9, 10].forEach(c => sheet.getRange(start, c, values.length, 1).setNumberFormat("@"));
  area.setValues(values);
  bannerRows.forEach(r => {
    sheet.getRange(r, 1, 1, COLS).setBackground(BANNER_BG).setFontColor(BANNER_FG).setFontWeight("bold");
  });
}

function bannerText(d, n, setRows, tz) {
  const [y, m, day] = d.split("-").map(Number);
  const pretty = Utilities.formatDate(new Date(y, m - 1, day, 12), tz, "EEE, MMM d, yyyy");
  const names = {};
  const totals = {};
  let mins = "";
  setRows.forEach(r => {
    names[String(r[1]).toLowerCase()] = true;
    const unit = r[5] || "";
    totals[unit] = (totals[unit] || 0) + (Number(r[6]) || 0);
    if (mins === "" && r[7] !== "" && r[7] !== undefined && r[7] !== null) mins = Number(r[7]);
  });
  const ex = Object.keys(names).length;
  const vol = Object.keys(totals).map(u => commas(Math.round(totals[u])) + " " + u).join(" + ");
  const parts = [pretty, "Workout " + n, ex + (ex === 1 ? " exercise" : " exercises"), setRows.length + (setRows.length === 1 ? " set" : " sets"), vol];
  if (mins !== "" && !isNaN(mins)) parts.push(mins + " min");
  return parts.join("  ·  ");
}

function workoutsPerDate(sheet, tz) {
  const last = sheet.getLastRow();
  const counts = {};
  if (last < 2) return counts;
  const vals = sheet.getRange(2, 1, last - 1, COLS).getValues();
  const seen = {};
  vals.forEach(r => {
    if (String(r[1]).trim() === "") return;
    const d = dateText(r[0], tz);
    const key = d + "|" + (r[9] ? String(r[9]) : "older");
    if (!seen[key]) { seen[key] = true; counts[d] = (counts[d] || 0) + 1; }
  });
  return counts;
}

function dateText(v, tz) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  return String(v);
}

function commas(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ensureHeader(sheet) {
  const current = sheet.getRange(1, 1, 1, COLS).getValues()[0];
  if (current.join("|") !== HEADER.join("|")) {
    sheet.getRange(1, 1, 1, COLS).setValues([HEADER]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  if (!sheet.isColumnHiddenByUser(9)) sheet.hideColumns(9);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
