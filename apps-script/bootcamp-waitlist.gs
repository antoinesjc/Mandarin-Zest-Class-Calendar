// Mandarin Zest: bootcamp waitlist → Google Sheet "Bootcamp waitlist"
// Lives in the sheet under Extensions → Apps Script, deployed as a web app
// (Execute as: Me, Who has access: Anyone). After editing: Deploy → Manage
// deployments → pencil → Version: New version → Deploy (the URL stays the same).
const HEADERS = ["Date", "Name", "Email", "Bootcamp", "Consent", "Page"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data.website) return ok();                       // hidden spam trap
    const email = String(data.email || "").trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok();
    if (data.consent !== true) return ok();              // only people who ticked the box

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date(), clean(data.name, 80), clean(email, 120), clean(data.bootcamp, 120), "Yes", clean(data.page, 300)]);
    return ok();
  } finally {
    lock.releaseLock();
  }
}

function clean(value, max) {
  const s = String(value || "").trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ok() { return ContentService.createTextOutput("ok"); }
function doGet() { return ContentService.createTextOutput("Waitlist is running"); }
