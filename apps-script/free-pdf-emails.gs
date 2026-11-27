/**
 * Mandarin Zest · free PDF emails
 *
 * Every 10 minutes: looks at new rows in the Start Here sheet (the sheet that collects the emails of the
 * website forms) and, when someone asked for a free PDF, emails them that PDF as an attachment,
 * from Mandarin Zest <mandarinzest@polylocal.eu>. It does not touch the sheet's own form script.
 *
 * Which PDF: from the row's "source" (written by each widget), see PDFS below.
 * Each person gets each PDF only once. Rows that are not a PDF (newsletter bar, HSK map, account hub…) are skipped.
 * Rows that were already in the sheet before `setup` ran are never emailed.
 *
 * Set up (once):
 *  1. Open the Start Here Google Sheet → Extensions → Apps Script.
 *  2. Add a new file (+ → Script), name it "free-pdf-emails", paste this whole file, save.
 *  3. Choose the function `setup` in the bar at the top → Run → allow the permissions (Gmail, Sheets, external requests).
 *     It adds a "PDF email" column, marks the existing rows as "before automation" and starts the 10-minute timer.
 *  4. Optional test: put your own email in a new row with source "free-pdf | slang" and run `sendPdfEmails`.
 * To stop it: run `stop`.
 */

var SITE = 'https://antoinesjc.github.io/Mandarin-Zest-Class-Calendar/';   // where the PDFs are stored (never shown in the email)
var STATUS_HEAD = 'PDF email';

// key (start of the source, before any " | " extra) → title shown in the email + files to attach
var PDFS = {
  'free-pdf | hsk-1': { title: 'New HSK 1 vocabulary list', files: ['downloads/hsk/New-HSK-1-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | hsk-2': { title: 'New HSK 2 vocabulary list', files: ['downloads/hsk/New-HSK-2-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | hsk-3': { title: 'New HSK 3 vocabulary list', files: ['downloads/hsk/New-HSK-3-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | hsk-4': { title: 'New HSK 4 vocabulary list', files: ['downloads/hsk/New-HSK-4-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | hsk-5': { title: 'New HSK 5 vocabulary list', files: ['downloads/hsk/New-HSK-5-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | hsk-6': { title: 'New HSK 6 vocabulary list', files: ['downloads/hsk/New-HSK-6-Vocab-List-Mandarin-Zest.pdf'], kind: 'hsk' },
  'free-pdf | phrases': { title: 'Essential Mandarin Phrases for Everyday Life', files: ['downloads/guides/Essential-Mandarin-Phrases-Mandarin-Zest.pdf'] },
  'free-pdf | adult': { title: 'Adult Vocabulary in Chinese', files: ['downloads/guides/Adult-Vocabulary-in-Chinese-Mandarin-Zest.pdf'] },
  'free-pdf | slang': { title: '20 Must-Know Chinese Slang Words', files: ['downloads/guides/20-Chinese-Slang-Words-Mandarin-Zest.pdf'] },
  'free-pdf | zodiac': { title: 'Chinese Zodiac Vocabulary guide', files: ['downloads/zodiac/Chinese-Zodiac-Vocabulary-Mandarin-Zest.pdf'] },
  'free-pdf | radicals': { title: 'List of All 214 Chinese Radicals', files: ['downloads/guides/214-Chinese-Radicals-Mandarin-Zest.pdf'], kind: 'chars' },
  'free-pdf | huang': { title: 'How to Write Huáng', files: ['downloads/guides/How-to-Write-Huang-Mandarin-Zest.pdf'], kind: 'chars' },
  'free-pdf | 100-characters': { title: '100 Most Common Chinese Characters', files: ['downloads/guides/100-Most-Common-Chinese-Characters-HSK1-Mandarin-Zest.pdf'], kind: 'chars' },
  'free-pdf | dorota-guide': { title: 'Chinese learning advice I wish someone gave me 10 years ago', files: ['downloads/guides/Chinese-Learning-Advice-Dorota-Mandarin-Zest.pdf'] },
  'hsk-levels | all 1-6': { title: 'New HSK 1 to 6 vocabulary lists', files: ['downloads/hsk/New-HSK-1-to-6-Vocab-Lists-Mandarin-Zest.zip'], kind: 'hsk', zip: true },
  'tocfl-levels | novice-1': { title: 'TOCFL Novice 1 vocabulary list', files: ['downloads/tocfl/TOCFL-Novice-1-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | novice-2': { title: 'TOCFL Novice 2 vocabulary list', files: ['downloads/tocfl/TOCFL-Novice-2-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | level-1': { title: 'TOCFL Level 1 vocabulary list', files: ['downloads/tocfl/TOCFL-Level-1-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | level-2': { title: 'TOCFL Level 2 vocabulary list', files: ['downloads/tocfl/TOCFL-Level-2-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | level-3': { title: 'TOCFL Level 3 vocabulary list', files: ['downloads/tocfl/TOCFL-Level-3-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | level-4': { title: 'TOCFL Level 4 vocabulary list', files: ['downloads/tocfl/TOCFL-Level-4-Vocab-List-Mandarin-Zest.pdf'], kind: 'tocfl' },
  'tocfl-levels | all 6': { title: 'TOCFL Novice 1 to Level 4 vocabulary lists', files: ['downloads/tocfl/TOCFL-Novice-1-to-Level-4-Vocab-Lists-Mandarin-Zest.zip'], kind: 'tocfl', zip: true },
  'start-here': { title: 'Beginner\'s Roadmap and First Steps Workbook', files: ['downloads/Mandarin-Zest-Beginners-Roadmap.pdf', 'downloads/Mandarin-Zest-First-Steps-Workbook.pdf'], kind: 'start' }
};
// "hsk-vocab-pdfs | HSK 3" (the HSK page form) → the PDF of that level
function pdfFor(source) {
  var s = String(source || '').trim().toLowerCase();
  var m = s.match(/^hsk-vocab-pdfs \| hsk (\d)\b/);
  if (m && PDFS['free-pdf | hsk-' + m[1]]) return { key: 'free-pdf | hsk-' + m[1], pdf: PDFS['free-pdf | hsk-' + m[1]] };
  if (s.indexOf('hsk-vocab-pdfs') === 0) return { key: 'hsk-levels | all 1-6', pdf: PDFS['hsk-levels | all 1-6'] };   // "not sure", HSK 7–9…
  var keys = Object.keys(PDFS).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (s === k || s.indexOf(k + ' |') === 0 || (k === 'start-here' && s.indexOf('start-here') === 0)) return { key: k, pdf: PDFS[k] };
  }
  return null;
}

// what to suggest after the PDF, by kind (links open the website; no prices that change with offers)
var NEXT = {
  hsk: ['Want to know which words you already know? Our free <a href="https://www.mandarinzest.com/the-new-hsk-vocabulary-lists-2026" style="color:#a8431a">HSK pages</a> show every level side by side.',
        'Ready to use the words out loud? Try a live <a href="https://www.mandarinzest.com/mandarin-zest-club" style="color:#a8431a">Mandarin Zest Club</a> speaking session for US$2.50.'],
  tocfl: ['Studying for the TOCFL? Our <a href="https://www.mandarinzest.com/shop" style="color:#a8431a">shop</a> has textbooks made for Taiwan Mandarin.',
          'Ready to use the words out loud? Try a live <a href="https://www.mandarinzest.com/mandarin-zest-club" style="color:#a8431a">Mandarin Zest Club</a> speaking session for US$2.50.'],
  chars: ['Practise the stroke order of every HSK 1 character with our free <a href="https://www.mandarinzest.com/hsk-1-characters-stroke-order" style="color:#a8431a">stroke order tool</a>.',
          'Want to speak, not just write? Try a live <a href="https://www.mandarinzest.com/mandarin-zest-club" style="color:#a8431a">Mandarin Zest Club</a> session for US$2.50.'],
  start: ['Next step: write your first characters with our free <a href="https://www.mandarinzest.com/hsk-1-characters-stroke-order" style="color:#a8431a">HSK 1 stroke order tool</a>.',
          'When you feel ready to speak, try a live <a href="https://www.mandarinzest.com/mandarin-zest-club" style="color:#a8431a">Mandarin Zest Club</a> session for US$2.50. Beginners are welcome.'],
  other: ['More free tools and lists are on <a href="https://www.mandarinzest.com" style="color:#a8431a">mandarinzest.com</a>.',
          'Want to practise speaking? Try a live <a href="https://www.mandarinzest.com/mandarin-zest-club" style="color:#a8431a">Mandarin Zest Club</a> session for US$2.50.']
};

/* ---------- the timer ---------- */
function sendPdfEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var sh = startHereSheet(), cols = columns(sh), last = sh.getLastRow();
    if (last < 2) return;
    var data = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
    var sent = {};   // email|key already sent
    for (var r = 1; r < data.length; r++) {
      var st = String(data[r][cols.status - 1] || '');
      if (/^sent/i.test(st)) { var hit = pdfFor(data[r][cols.source - 1]); if (hit) sent[String(data[r][cols.email - 1]).trim().toLowerCase() + '|' + hit.key] = 1; }
    }
    var budget = 40;   // per run, keeps far below Gmail's daily limit
    for (var i = 1; i < data.length && budget > 0; i++) {
      if (String(data[i][cols.status - 1] || '')) continue;
      var email = String(data[i][cols.email - 1] || '').trim().toLowerCase(), hit = pdfFor(data[i][cols.source - 1]);
      var cell = sh.getRange(i + 1, cols.status);
      if (!hit) { cell.setValue('no PDF'); continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cell.setValue('bad email'); continue; }
      if (sent[email + '|' + hit.key]) { cell.setValue('already sent'); continue; }
      try {
        sendOne(email, hit.pdf);
        sent[email + '|' + hit.key] = 1; budget--;
        cell.setValue('sent ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'));
      } catch (e) {
        cell.setValue('error: ' + String(e.message || e).slice(0, 120));
      }
    }
  } finally { lock.releaseLock(); }
}

function sendOne(email, pdf) {
  var files = pdf.files.map(function (f) {
    var res = UrlFetchApp.fetch(SITE + f, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('could not fetch ' + f + ' (' + res.getResponseCode() + ')');
    return res.getBlob().setName(f.split('/').pop());
  });
  var next = NEXT[pdf.kind] || NEXT.other;
  var many = files.length > 1 || pdf.zip;
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#2a2420;line-height:1.55;max-width:540px">' +
    '<p>Hi,</p>' +
    '<p>Thanks for downloading the <b>' + pdf.title + '</b>! ' + (many ? 'The files are' : 'It\'s') + ' attached to this email, so you can find ' + (many ? 'them' : 'it') + ' again whenever you need ' + (many ? 'them' : 'it') + '.' +
    (pdf.zip ? ' (It\'s a ZIP file: open it to get one PDF per level.)' : '') + '</p>' +
    '<p>' + next[0] + '</p>' +
    '<p>' + next[1] + '</p>' +
    '<p>Questions or feedback? Just reply to this email, it comes straight to us.</p>' +
    '<p>加油！<br>The Mandarin Zest team</p>' +
    '<p style="font-size:12px;color:#8a7b72;border-top:1px solid #ecdcd2;padding-top:10px;margin-top:22px">You\'re receiving this because you asked for this free PDF on mandarinzest.com.</p>' +
    '</div>';
  mzSend({ to: email, subject: 'Your free PDF: ' + pdf.title, htmlBody: html, attachments: files });
}

/* ---------- set up / stop ---------- */
function setup() {
  var sh = startHereSheet(), cols = columns(sh), last = sh.getLastRow();
  if (last >= 2) {
    var rng = sh.getRange(2, cols.status, last - 1, 1), v = rng.getValues();
    for (var i = 0; i < v.length; i++) if (!v[i][0]) v[i][0] = 'before automation';
    rng.setValues(v);
  }
  stop();
  ScriptApp.newTrigger('sendPdfEmails').timeBased().everyMinutes(10).create();
  var aliasOk = false; try { aliasOk = GmailApp.getAliases().indexOf(FROM) >= 0; } catch (e) {}
  Logger.log('Ready. Sheet "' + sh.getName() + '": email in column ' + cols.email + ', source in column ' + cols.source + ', status in column ' + cols.status + '. ' +
    (aliasOk ? 'Emails will come from ' + FROM + '.' : 'WARNING: ' + FROM + ' is not under "Send mail as" for ' + Session.getEffectiveUser().getEmail() + ', emails will come from that account.'));
}
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendPdfEmails') ScriptApp.deleteTrigger(t); });
}

/* ---------- helpers ---------- */
// The tab holding the emails: the first tab whose header row has an "email" column (or set SHEET_TAB in Script properties).
function startHereSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var name = PropertiesService.getScriptProperties().getProperty('SHEET_TAB');
  if (name && ss.getSheetByName(name)) return ss.getSheetByName(name);
  var tabs = ss.getSheets();
  for (var i = 0; i < tabs.length; i++) {
    var head = tabs[i].getRange(1, 1, 1, Math.max(1, tabs[i].getLastColumn())).getValues()[0].join('|').toLowerCase();
    if (head.indexOf('email') >= 0) return tabs[i];
  }
  return tabs[0];
}
// Finds the email / source columns by their header (falls back to looking at the data), adds the "PDF email" column.
function columns(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var c = { email: 0, source: 0, status: 0 };
  head.forEach(function (h, i) {
    if (!c.email && h.indexOf('email') >= 0 && h !== STATUS_HEAD.toLowerCase()) c.email = i + 1;
    if (!c.source && h.indexOf('source') >= 0) c.source = i + 1;
    if (h === STATUS_HEAD.toLowerCase()) c.status = i + 1;
  });
  if (!c.email || !c.source) {   // no headers: guess from the latest row
    var row = sh.getRange(Math.max(2, sh.getLastRow()), 1, 1, lastCol).getValues()[0];
    row.forEach(function (v, i) {
      v = String(v);
      if (!c.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())) c.email = i + 1;
      else if (!c.source && /\|/.test(v) || (!c.source && /^start-here/.test(v))) c.source = i + 1;
    });
  }
  if (!c.email || !c.source) throw new Error('Could not find the email and source columns. Give them a header ("Email", "Source") in row 1.');
  if (!c.status) { c.status = lastCol + 1; sh.getRange(1, c.status).setValue(STATUS_HEAD).setFontWeight('bold'); }
  return c;
}

/* ---------- sender: every email to customers goes out as Mandarin Zest <mandarinzest@polylocal.eu> ---------- */
var FROM = 'mandarinzest@polylocal.eu';
function mzSend(o) {
  var opts = { htmlBody: o.htmlBody, name: o.name || 'Mandarin Zest', replyTo: FROM };
  if (o.attachments) opts.attachments = o.attachments;
  try { if (GmailApp.getAliases().indexOf(FROM) >= 0) opts.from = FROM; } catch (e) {}
  var text = String(o.htmlBody || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  GmailApp.sendEmail(o.to, o.subject, text, opts);
}
