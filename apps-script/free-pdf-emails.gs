/**
 * Mandarin Zest · welcome email for free PDF sign-ups
 *
 * Every 10 minutes: looks at new rows in the Start Here sheet (the sheet that collects the emails of the
 * website forms). The first time an email address asks for any free PDF, it gets ONE welcome email
 * (from Mandarin Zest <mandarinzest@polylocal.eu>) presenting the Club + trial session, the upcoming
 * bootcamps and our textbooks. No attachment: people already download the PDF on the page.
 * Someone who takes 5 PDFs (5 rows) still gets the email only once. It does not touch the sheet's form script.
 *
 * Bootcamps are read live from the website's bootcamp list (bootcamps.json, updated daily),
 * so the email always shows what's currently open.
 * Rows that were already in the sheet before `setup` ran are never emailed.
 *
 * Set up (once):
 *  1. Open the Start Here Google Sheet → Extensions → Apps Script.
 *  2. Add a new file (+ → Script), name it "free-pdf-emails", paste this whole file, save.
 *  3. Choose `setup` in the bar at the top → Run → allow the permissions.
 *  Test without waiting: run `sendTestToMe` (sends the email to the account running the script).
 *  To stop it: run `stop`.
 *
 * To edit the email: the texts are in TEXT and MATERIALS below (and the layout in buildEmail).
 */

var SITE = 'https://antoinesjc.github.io/Mandarin-Zest-Class-Calendar/';   // only read by the script, never shown in the email
var STATUS_HEAD = 'Welcome email';

/* ═══ TEXTS (edit freely; write \' for an apostrophe) ═══ */
var TEXT = {
  subject: 'Welcome to Mandarin Zest: what to do next',
  hello: 'Hi,',
  intro: 'Thanks for downloading %PDF% from Mandarin Zest! We\'re a small team of advanced learners and native teachers, and we build everything to help you actually use your Chinese. Here\'s what we do.',
  clubTitle: 'The Mandarin Zest Club',
  clubText: 'Live speaking sessions on Google Meet every week, in small groups by level, from HSK 1 to advanced. After each session you get the notes, and between sessions you keep practising in the Club app: flashcards, the HSK Temple and Zest Town.',
  clubPrice: 'US$25 a month, cancel anytime. Club members also get 70% off our materials.',
  trialButton: 'Try one session for US$2.50',
  clubLink: 'Discover the Club',
  bootTitle: 'Upcoming bootcamps',
  bootText: 'Short, focused courses with live sessions and a small group.',
  bootNone: 'New bootcamps are coming soon. You\'ll find them on our bootcamps page.',
  matTitle: 'Our textbooks and materials',
  matText: 'Written by advanced learners and checked by professional native teachers.',
  matButton: 'See all our materials',
  outro: 'Questions? Just reply to this email, it comes straight to us.',
  sign: '加油！<br>The Mandarin Zest team',
  footer: 'You\'re receiving this one-time email because you downloaded a free PDF on mandarinzest.com.'
};
var LINKS = {
  club: 'https://www.mandarinzest.com/mandarin-zest-club',
  trial: 'https://www.mandarinzest.com/mandarin-zest-club-trial-session',
  bootcamps: 'https://www.mandarinzest.com/bootcamps',
  shop: 'https://www.mandarinzest.com/shop'
};
var MATERIALS = [
  { name: 'NEW HSK 1: A Comprehensive Introduction to the Chinese Language', price: 'US$15',
    url: 'https://www.mandarinzest.com/shop/new-hsk-1-a-comprehensive-introduction-to-the-chinese-language-10',
    img: 'https://www.mandarinzest.com/web/image/product.template/10/image_256' },
  { name: 'TOCFL Novice 1: Beginner Mandarin, One Real Conversation at a Time', price: 'US$15',
    url: 'https://www.mandarinzest.com/shop/textbooks-3/tocfl-novice-1-beginner-mandarin-one-real-conversation-at-a-time-60',
    img: 'https://www.mandarinzest.com/web/image/product.template/60/image_256' },
  { name: 'Unlocking Chinese Characters: understanding the Chinese writing system', price: '',
    url: 'https://www.mandarinzest.com/shop/textbooks-3/unlocking-chinese-characters-a-guide-on-understanding-the-chinese-writing-system-26',
    img: 'https://www.mandarinzest.com/web/image/product.template/26/image_256' }
];

/* ═══ which sign-ups count as "free PDF" (start of the source written by each widget) ═══ */
var PDF_SOURCES = [
  ['free-pdf | hsk-', 'the HSK vocabulary list'], ['free-pdf | phrases', 'the Essential Mandarin Phrases guide'],
  ['free-pdf | adult', 'the Adult Vocabulary booklet'], ['free-pdf | slang', 'the Chinese slang guide'],
  ['free-pdf | zodiac', 'the Chinese Zodiac vocabulary guide'], ['free-pdf | radicals', 'the 214 radicals list'],
  ['free-pdf | huang', 'the huáng writing guide'], ['free-pdf | 100-characters', 'the 100 most common characters'],
  ['free-pdf | dorota-guide', 'Dorota\'s learning guide'], ['free-pdf', 'our free PDF'],
  ['hsk-vocab-pdfs', 'the HSK vocabulary lists'], ['hsk-levels | all', 'the HSK vocabulary lists'],
  ['tocfl-levels', 'the TOCFL vocabulary lists'], ['start-here', 'our beginner pack']
];
function pdfName(source) {
  var s = String(source || '').trim().toLowerCase();
  for (var i = 0; i < PDF_SOURCES.length; i++) if (s.indexOf(PDF_SOURCES[i][0]) === 0) return PDF_SOURCES[i][1];
  return null;
}

/* ---------- the timer ---------- */
function sendPdfEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var sh = startHereSheet(), cols = columns(sh), last = sh.getLastRow();
    if (last < 2) return;
    var data = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
    var done = {};   // emails that already got the welcome email
    for (var r = 1; r < data.length; r++) if (/^sent/i.test(String(data[r][cols.status - 1] || ''))) done[String(data[r][cols.email - 1]).trim().toLowerCase()] = 1;
    var budget = 40, boot = null;   // max 40 per run, far below Gmail's daily limit
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cols.status - 1] || '')) continue;
      var email = String(data[i][cols.email - 1] || '').trim().toLowerCase(), name = pdfName(data[i][cols.source - 1]);
      var cell = sh.getRange(i + 1, cols.status);
      if (!name) { cell.setValue('not a PDF'); continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cell.setValue('bad email'); continue; }
      if (done[email]) { cell.setValue('already welcomed'); continue; }
      if (budget <= 0) break;
      try {
        if (!boot) boot = upcomingBootcamps();
        sendWelcome(email, name, boot);
        done[email] = 1; budget--;
        cell.setValue('sent ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'));
      } catch (e) {
        cell.setValue('error: ' + String(e.message || e).slice(0, 120));
      }
    }
  } finally { lock.releaseLock(); }
}

/* ---------- the email ---------- */
function sendWelcome(email, pdfLabel, boot) {
  var photo = null;
  try { photo = UrlFetchApp.fetch(SITE + 'sessions/s02.jpg').getBlob().setName('club-session.jpg'); } catch (e) {}
  var opts = { to: email, subject: TEXT.subject, htmlBody: buildEmail(pdfLabel, boot, !!photo) };
  if (photo) opts.inlineImages = { session: photo };
  mzSend(opts);
}

function buildEmail(pdfLabel, boot, withPhoto) {
  var ink = '#2a2420', muted = '#5c4f47', orange = '#f37a48', brick = '#a8431a';
  var btn = function (href, label, bg, fg) { return '<a href="' + href + '" style="display:inline-block;background:' + bg + ';color:' + fg + ';text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">' + label + '</a>'; };
  var h2 = function (t) { return '<h2 style="margin:0 0 6px;font-size:21px;line-height:1.25;color:' + ink + '">' + t + '</h2>'; };
  var p = function (t, extra) { return '<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:' + ink + ';' + (extra || '') + '">' + t + '</p>'; };

  var club = '<tr><td style="padding:22px;background:#173f17;border-radius:18px;color:#fff">' +
    (withPhoto ? '<img src="cid:session" alt="A Mandarin Zest Club session" width="516" style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px;margin:0 0 16px">' : '') +
    '<div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;color:#9fd49f;margin-bottom:4px">LIVE EVERY WEEK</div>' +
    '<h2 style="margin:0 0 8px;font-size:22px;color:#fff">' + TEXT.clubTitle + '</h2>' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#fff">' + TEXT.clubText + '</p>' +
    '<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#cfe5c7">' + TEXT.clubPrice + '</p>' +
    btn(LINKS.trial, TEXT.trialButton, orange, ink) +
    '&nbsp;&nbsp;<a href="' + LINKS.club + '" style="color:#fff;font-size:14px;font-weight:bold">' + TEXT.clubLink + '</a>' +
    '</td></tr>';

  var bootRows = boot.length ? boot.map(function (b) {
    var price = b.datesTbd || !b.price ? 'Waitlist open' : (b.early && !earlyOver(b) ? 'From ' + b.early + ' (early bird)' : 'From ' + b.price) + (b.club ? ' · Club members ' + b.club : '');
    return '<tr><td style="padding:12px 0;border-top:1px solid #ecdcd2">' +
      '<a href="' + b.url + '" style="font-size:16px;font-weight:bold;color:' + ink + ';text-decoration:none">' + b.title + '</a>' +
      '<div style="font-size:14px;color:' + muted + ';line-height:1.5;margin-top:2px">' + [b.dates, b.format, b.level].filter(Boolean).join(' · ') + '</div>' +
      '<div style="font-size:14px;margin-top:4px"><span style="color:' + brick + ';font-weight:bold">' + price + '</span> &nbsp;<a href="' + b.url + '" style="color:' + brick + '">' + (b.datesTbd || !b.price ? 'Join the waitlist' : 'See the bootcamp') + ' →</a></div>' +
      '</td></tr>';
  }).join('') : '<tr><td style="padding:10px 0;font-size:14px;color:' + muted + '">' + TEXT.bootNone + '</td></tr>';
  var bootcamps = '<tr><td style="padding:26px 4px 0">' + h2(TEXT.bootTitle) + p(TEXT.bootText, 'color:' + muted) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + bootRows + '</table>' +
    '<p style="margin:8px 0 0;font-size:14px"><a href="' + LINKS.bootcamps + '" style="color:' + brick + ';font-weight:bold">All bootcamps →</a></p></td></tr>';

  var mats = '<tr><td style="padding:26px 4px 0">' + h2(TEXT.matTitle) + p(TEXT.matText, 'color:' + muted) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    MATERIALS.map(function (m) {
      return '<td width="33%" valign="top" style="padding:0 5px;text-align:center">' +
        '<a href="' + m.url + '" style="text-decoration:none;color:' + ink + '"><img src="' + m.img + '" alt="" width="150" style="display:block;width:100%;max-width:150px;height:auto;margin:0 auto 8px;border-radius:10px;background:#fdf1ea">' +
        '<span style="font-size:13px;line-height:1.35;font-weight:bold;display:block">' + m.name + '</span></a>' +
        (m.price ? '<span style="font-size:13px;color:' + brick + ';font-weight:bold">' + m.price + '</span>' : '') + '</td>';
    }).join('') +
    '</tr></table><p style="margin:16px 0 0;text-align:center">' + btn(LINKS.shop, TEXT.matButton, '#fdf1ea', ink) + '</p></td></tr>';

  return '<div style="background:#fffaf6;padding:20px 10px;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto"><tbody>' +
    '<tr><td style="padding:0 4px 18px">' + p(TEXT.hello) + p(TEXT.intro.replace('%PDF%', pdfLabel)) + '</td></tr>' +
    club + bootcamps + mats +
    '<tr><td style="padding:26px 4px 0">' + p(TEXT.outro) + p(TEXT.sign) +
    '<p style="margin:18px 0 0;padding-top:10px;border-top:1px solid #ecdcd2;font-size:12px;color:#8a7b72">' + TEXT.footer + '</p></td></tr>' +
    '</tbody></table></div>';
}

// bootcamps still open (or with a waitlist), soonest first, max 3
function upcomingBootcamps() {
  var list = [];
  try { list = JSON.parse(UrlFetchApp.fetch(SITE + 'bootcamps.json?t=' + Date.now()).getContentText()).bootcamps || []; } catch (e) {}
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  return list.filter(function (b) {
    if (b.signupBy && b.signupBy < today) return false;
    if (b.start && b.start < today) return false;
    return true;
  }).sort(function (a, b) { return (a.start || '9999') < (b.start || '9999') ? -1 : 1; }).slice(0, 3);
}
function earlyOver(b) { return b.earlyEnds && b.earlyEnds < Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }

/* ---------- set up / test / stop ---------- */
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
function sendTestToMe() {
  sendWelcome(Session.getEffectiveUser().getEmail(), 'the New HSK 1 vocabulary list', upcomingBootcamps());
  Logger.log('Test sent to ' + Session.getEffectiveUser().getEmail());
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
// Finds the email / source columns by their header (falls back to looking at the data), adds the status column.
function columns(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var c = { email: 0, source: 0, status: 0 };
  head.forEach(function (h, i) {
    if (h === STATUS_HEAD.toLowerCase() || h === 'pdf email') { if (!c.status) c.status = i + 1; return; }
    if (!c.email && h.indexOf('email') >= 0) c.email = i + 1;
    if (!c.source && h.indexOf('source') >= 0) c.source = i + 1;
  });
  if (!c.email || !c.source) {   // no headers: guess from the latest row
    var row = sh.getRange(Math.max(2, sh.getLastRow()), 1, 1, lastCol).getValues()[0];
    row.forEach(function (v, i) {
      v = String(v).trim();
      if (!c.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) c.email = i + 1;
      else if (!c.source && (/\|/.test(v) || /^start-here/.test(v))) c.source = i + 1;
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
  if (o.inlineImages) opts.inlineImages = o.inlineImages;
  try { if (GmailApp.getAliases().indexOf(FROM) >= 0) opts.from = FROM; } catch (e) {}
  var text = String(o.htmlBody || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|tr|h2)>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  GmailApp.sendEmail(o.to, o.subject, text, opts);
}
