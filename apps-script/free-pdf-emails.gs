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
// Click tracking: every link goes through this redirect first (Supabase edge function "go"), which notes the click
// under a random id (the "Click ID" column, no email address leaves the sheet) and opens the page right away.
// The "Clicked" column is filled in from it every 10 minutes. Set to '' to switch tracking off.
var GO = 'https://eypehvhcqzhwssydvrhn.supabase.co/functions/v1/go';
var RID = '';   // id of the email being built

/* ═══ TEXTS (edit freely; write \' for an apostrophe) ═══ */
var TEXT = {
  subject: 'Welcome to Mandarin Zest: what to do next',
  hello: 'Hi,',
  intro: 'Thanks for %PDF% from Mandarin Zest! We\'re a small team of advanced learners and native teachers, and we build everything to help you actually use your Chinese. Here\'s what we do.',
  clubTitle: 'The Mandarin Zest Club',
  clubText: 'Live speaking sessions on Google Meet every week, in small groups by level, from HSK 1 to advanced. After each session you get the notes, and between sessions you keep practising in the Club app.',
  clubPrice: 'US$25 a month, cancel anytime. Club members also get 70% off our materials.',
  trialButton: 'Try one session for US$2.50',
  clubLink: 'Discover the Club',
  townTag: 'INCLUDED IN THE CLUB',
  townTitle: 'Zest Town: keep practising between sessions',
  townText: 'The Club app turns your study time into a little town that grows with you.',
  townLink: 'See everything the app can do',
  bootTitle: 'Upcoming bootcamps',
  bootText: 'Short, focused courses with live sessions and a small group.',
  bootNone: 'New bootcamps are coming soon. You\'ll find them on our bootcamps page.',
  matTitle: 'Our textbooks and materials',
  matText: 'Written by advanced learners and checked by professional native teachers.',
  matButton: 'See all our materials',
  outro: 'Questions? Just reply to this email, it comes straight to us.',
  sign: '加油！<br>The Mandarin Zest team',
  footer: 'You\'re receiving this one-time email because you used one of our free resources on mandarinzest.com.'
};
var LINKS = {
  app: 'https://www.mandarinzest.com/mandarin-zest-app',
  club: 'https://www.mandarinzest.com/mandarin-zest-club',
  trial: 'https://www.mandarinzest.com/mandarin-zest-club-trial-session',
  bootcamps: 'https://www.mandarinzest.com/bootcamps',
  shop: 'https://www.mandarinzest.com/shop'
};
// Zest Town buildings shown in the email (pictures from the app, enlarged in app/zt/email/)
var TOWN = [
  { img: 'tree-5.png', name: 'Streak tree', text: 'Join a session or review each day, and watch a seed grow into an orange tree.' },
  { img: 'house.png', name: 'Flashcard Center', text: 'Review the words from your sessions and the HSK lists, a few new ones every day.' },
  { img: 'temple.png', name: 'HSK Temple', text: 'Every New HSK 1–9 word, how well you know each one, and a map of your progress.' },
  { img: 'library.png', name: 'Library', text: 'Graded readers and workbooks from HSK 1 to 6. Add a book\'s words to your flashcards.' },
  { img: 'callig.png', name: 'Calligraphy School', text: 'Look up any character, watch its strokes and practise writing it.' },
  { img: 'post.png', name: 'Post Office', text: 'Write short letters in Chinese to other members and hosts, and get letters back.' },
  { img: 'arcade.png', name: 'Arcade (new)', text: 'Learning games, starting with Character Clash <span style="white-space:nowrap">字妖大战</span>: beat ink monsters by picking the right meaning.' },
  { img: 'gallery.png', name: 'Sticker Gallery', text: 'Collect stickers from bootcamps, reading and Club life.' },
  { img: 'sign-forest.png', name: 'Magical Forest', text: 'See who else studied in the last 24 hours, with their streaks.' }
];
var MATERIALS = [
  { name: 'NEW HSK 1: A Comprehensive Introduction to the Chinese Language',
    url: 'https://www.mandarinzest.com/shop/new-hsk-1-a-comprehensive-introduction-to-the-chinese-language-10',
    img: 'https://www.mandarinzest.com/web/image/product.template/10/image_256' },
  { name: 'TOCFL Novice 1: Beginner Mandarin, One Real Conversation at a Time',
    url: 'https://www.mandarinzest.com/shop/textbooks-3/tocfl-novice-1-beginner-mandarin-one-real-conversation-at-a-time-60',
    img: 'https://www.mandarinzest.com/web/image/product.template/60/image_256' },
  { name: 'Unlocking Chinese Characters: understanding the Chinese writing system',
    url: 'https://www.mandarinzest.com/shop/textbooks-3/unlocking-chinese-characters-a-guide-on-understanding-the-chinese-writing-system-26',
    img: 'https://www.mandarinzest.com/web/image/product.template/26/image_256' }
];

/* ═══ which sign-ups count as "free PDF" (start of the source written by each widget) ═══ */
var PDF_SOURCES = [
  ['free-pdf | hsk-', 'downloading the HSK vocabulary list'], ['free-pdf | phrases', 'downloading the Essential Mandarin Phrases guide'],
  ['free-pdf | adult', 'downloading the Adult Vocabulary booklet'], ['free-pdf | slang', 'downloading the Chinese slang guide'],
  ['free-pdf | zodiac', 'downloading the Chinese Zodiac vocabulary guide'], ['free-pdf | radicals', 'downloading the 214 radicals list'],
  ['free-pdf | huang', 'downloading the huáng writing guide'], ['free-pdf | 100-characters', 'downloading the 100 most common characters'],
  ['free-pdf | countries', 'downloading the Countries of the World list'], ['free-pdf | dorota-guide', 'downloading Dorota\'s learning guide'], ['free-pdf', 'downloading our free PDF'],
  ['hsk-vocab-pdfs', 'downloading the HSK vocabulary lists'], ['hsk-levels | all', 'downloading the HSK vocabulary lists'],
  ['tocfl-levels', 'downloading the TOCFL vocabulary lists'], ['start-here', 'downloading our beginner pack'],
  ['hsk-map', 'using our HSK Map']
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
      var st0 = String(data[i][cols.status - 1] || '');
      if (st0 && !(st0 === 'not a PDF' && pdfName(data[i][cols.source - 1]))) continue;   // rows skipped before a source was added get another chance
      var email = String(data[i][cols.email - 1] || '').trim().toLowerCase(), name = pdfName(data[i][cols.source - 1]);
      var cell = sh.getRange(i + 1, cols.status);
      if (!name) { cell.setValue('not a PDF'); continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cell.setValue('bad email'); continue; }
      if (done[email]) { cell.setValue('already welcomed'); continue; }
      if (budget <= 0) break;
      try {
        if (!boot) boot = upcomingBootcamps();
        var rid = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
        sendWelcome(email, name, boot, rid);
        done[email] = 1; budget--;
        cell.setValue('sent ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'));
        sh.getRange(i + 1, cols.rid).setValue(rid);
      } catch (e) {
        cell.setValue('error: ' + String(e.message || e).slice(0, 120));
      }
    }
    try { updateClicks(sh, cols); } catch (e) { Logger.log('clicks: ' + e); }
  } finally { lock.releaseLock(); }
}

// Fills the "Clicked" column: which links each person clicked, and when (Taiwan time). Last 120 days of emails.
function updateClicks(sh, cols) {
  if (!GO) return;
  var last = sh.getLastRow(); if (last < 2) return;
  var data = sh.getRange(1, 1, last, sh.getLastColumn()).getValues(), rows = {}, rids = [];
  var since = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), 'Asia/Taipei', 'yyyy-MM-dd');
  for (var i = 1; i < data.length; i++) {
    var rid = String(data[i][cols.rid - 1] || ''), st = String(data[i][cols.status - 1] || '');
    if (!rid || !/^sent /.test(st) || st.slice(5, 15) < since) continue;
    rows[rid] = i; rids.push(rid);
  }
  for (var b = 0; b < rids.length; b += 500) {
    var res = UrlFetchApp.fetch(GO, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ rids: rids.slice(b, b + 500) }), muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    var byRid = {};
    JSON.parse(res.getContentText()).forEach(function (c) {
      var key = c.l, list = byRid[c.r] = byRid[c.r] || [];
      if (list.some(function (x) { return x.l === key; })) return;   // first click on each link only
      list.push({ l: key, t: Utilities.formatDate(new Date(c.t), 'Asia/Taipei', 'd MMM HH:mm') });
    });
    Object.keys(byRid).forEach(function (rid) {
      var txt = byRid[rid].map(function (x) { return x.l + ' (' + x.t + ')'; }).join(', '), i = rows[rid];
      if (String(data[i][cols.clicked - 1] || '') !== txt) sh.getRange(i + 1, cols.clicked).setValue(txt);
    });
  }
}

/* ---------- the email ---------- */
function sendWelcome(email, pdfLabel, boot, rid) {
  RID = rid || '';
  var photo = null;
  try { photo = UrlFetchApp.fetch(SITE + 'sessions/s02.jpg').getBlob().setName('club-session.jpg'); } catch (e) {}
  var imgs = {};
  if (photo) imgs.session = photo;
  ['town8-phone.png'].concat(TOWN.map(function (t) { return t.img; })).forEach(function (f) {
    try { imgs['zt_' + f.replace(/\W/g, '_')] = UrlFetchApp.fetch(SITE + 'app/zt/email/' + f).getBlob().setName(f); } catch (e) {}
  });
  var opts = { to: email, subject: TEXT.subject, htmlBody: buildEmail(pdfLabel, boot, !!photo, imgs) };
  opts.inlineImages = imgs;
  RID = '';
  mzSend(opts);
}

// Adds Google Analytics tags to a link, so GA shows visits from this email and which link was clicked
// (Acquisition → Traffic acquisition: source "welcome-email"; utm_content = the link).
function tag(url, content) {
  var slug = String(content).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  var full = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'utm_source=welcome-email&utm_medium=email&utm_campaign=free-pdf-welcome&utm_content=' + slug;
  if (!GO || !RID) return full;
  return GO + '?r=' + RID + '&l=' + slug + '&u=' + encodeURIComponent(full);
}
function buildEmail(pdfLabel, boot, withPhoto, imgs) {
  imgs = imgs || {};
  var zt = function (f) { var k = 'zt_' + f.replace(/\W/g, '_'); return imgs[k] ? 'cid:' + k : ''; };
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
    btn(tag(LINKS.trial, 'trial-button'), TEXT.trialButton, orange, ink) +
    '&nbsp;&nbsp;<a href="' + tag(LINKS.club, 'club-link') + '" style="color:#fff;font-size:14px;font-weight:bold">' + TEXT.clubLink + '</a>' +
    '</td></tr>';


  var town = '<tr><td style="padding:14px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e6f1e1;border-radius:18px"><tr>' +
    (zt('town8-phone.png') ? '<td width="150" valign="top" style="padding:20px 0 20px 20px"><img src="' + zt('town8-phone.png') + '" alt="Zest Town" width="130" style="display:block;width:130px;height:auto;border-radius:12px;image-rendering:pixelated"></td>' : '') +
    '<td valign="top" style="padding:20px">' +
    '<div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;color:#1b6f1b;margin-bottom:4px">' + TEXT.townTag + '</div>' +
    '<h2 style="margin:0 0 6px;font-size:19px;line-height:1.25;color:' + ink + '">' + TEXT.townTitle + '</h2>' +
    '<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:' + muted + '">' + TEXT.townText + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    TOWN.map(function (t) {
      return '<tr><td width="40" valign="top" style="padding:5px 8px 5px 0">' + (zt(t.img) ? '<img src="' + zt(t.img) + '" alt="" width="36" style="display:block;width:36px;height:auto;image-rendering:pixelated">' : '') + '</td>' +
        '<td valign="top" style="padding:5px 0;font-size:13.5px;line-height:1.4;color:' + ink + '"><b>' + t.name + '</b><br><span style="color:' + muted + '">' + t.text + '</span></td></tr>';
    }).join('') +
    '</table><p style="margin:12px 0 0"><a href="' + tag(LINKS.app, 'app-button') + '" style="display:inline-block;background:#1b6f1b;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 18px;border-radius:999px">' + TEXT.townLink + ' →</a></p></td></tr></table></td></tr>';
  var bootRows = boot.length ? boot.map(function (b) {
    var price = b.datesTbd || !b.price ? 'Waitlist open' : (b.early && !earlyOver(b) ? 'From ' + b.early + ' (early bird)' : 'From ' + b.price) + (b.club ? ' · Club members ' + b.club : '');
    return '<tr><td style="padding:12px 0;border-top:1px solid #ecdcd2">' +
      '<a href="' + tag(b.url, 'bootcamp-' + b.title) + '" style="font-size:16px;font-weight:bold;color:' + ink + ';text-decoration:none">' + b.title + '</a>' +
      '<div style="font-size:14px;color:' + muted + ';line-height:1.5;margin-top:2px">' + [b.dates, b.format, b.level].filter(Boolean).join(' · ') + '</div>' +
      '<div style="font-size:14px;margin-top:4px"><span style="color:' + brick + ';font-weight:bold">' + price + '</span> &nbsp;<a href="' + tag(b.url, 'bootcamp-' + b.title) + '" style="color:' + brick + '">' + (b.datesTbd || !b.price ? 'Join the waitlist' : 'See the bootcamp') + ' →</a></div>' +
      '</td></tr>';
  }).join('') : '<tr><td style="padding:10px 0;font-size:14px;color:' + muted + '">' + TEXT.bootNone + '</td></tr>';
  var bootcamps = '<tr><td style="padding:26px 4px 0">' + h2(TEXT.bootTitle) + p(TEXT.bootText, 'color:' + muted) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + bootRows + '</table>' +
    '<p style="margin:8px 0 0;font-size:14px"><a href="' + tag(LINKS.bootcamps, 'all-bootcamps') + '" style="color:' + brick + ';font-weight:bold">All bootcamps →</a></p></td></tr>';

  var mats = '<tr><td style="padding:26px 4px 0">' + h2(TEXT.matTitle) + p(TEXT.matText, 'color:' + muted) +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    MATERIALS.map(function (m) {
      return '<td width="33%" valign="top" style="padding:0 5px;text-align:center">' +
        '<a href="' + tag(m.url, 'book-' + m.name.split(':')[0]) + '" style="text-decoration:none;color:' + ink + '"><img src="' + m.img + '" alt="" width="150" style="display:block;width:100%;max-width:150px;height:auto;margin:0 auto 8px;border-radius:10px;background:#fdf1ea">' +
        '<span style="font-size:13px;line-height:1.35;font-weight:bold;display:block">' + m.name + '</span></a>' +
        '</td>';
    }).join('') +
    '</tr></table><p style="margin:16px 0 0;text-align:center">' + btn(tag(LINKS.shop, 'shop-button'), TEXT.matButton, '#fdf1ea', ink) + '</p></td></tr>';

  return '<div style="background:#fffaf6;padding:20px 10px;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto"><tbody>' +
    '<tr><td style="padding:0 4px 18px">' + p(TEXT.hello) + p(TEXT.intro.replace('%PDF%', pdfLabel)) + '</td></tr>' +
    club + town + bootcamps + mats +
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
  sendWelcome(Session.getEffectiveUser().getEmail(), 'downloading the New HSK 1 vocabulary list', upcomingBootcamps());
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
  var c = { email: 0, source: 0, status: 0, rid: 0, clicked: 0 };
  head.forEach(function (h, i) {
    if (h === STATUS_HEAD.toLowerCase() || h === 'pdf email') { if (!c.status) c.status = i + 1; return; }
    if (h === 'click id') { c.rid = i + 1; return; }
    if (h === 'clicked') { c.clicked = i + 1; return; }
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
  if (!c.status) { c.status = ++lastCol; sh.getRange(1, c.status).setValue(STATUS_HEAD).setFontWeight('bold'); }
  if (!c.clicked) { c.clicked = ++lastCol; sh.getRange(1, c.clicked).setValue('Clicked').setFontWeight('bold'); }
  if (!c.rid) { c.rid = ++lastCol; sh.getRange(1, c.rid).setValue('Click ID').setFontWeight('bold'); }
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
