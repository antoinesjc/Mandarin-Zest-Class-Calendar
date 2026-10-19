/**
 * Mandarin Zest · Club trial bookings
 *
 * Every 5 minutes: finds new paid US$2.50 trial bookings in Stripe, adds the buyer to that session in the
 * Club Google Calendar (so the Meet lets them in) and emails them the Meet link. Also tells the website how
 * many trial seats are left (max 6 per session), so the "Book my seat" button can switch to "Sold out".
 *
 * Set up (once):
 *  1. In this Apps Script project: Services (+) → add "Google Calendar API".
 *  2. Project Settings → Script properties:
 *       STRIPE_KEY     your Stripe restricted key (rk_live_…), read access to Checkout Sessions
 *       TRIAL_LINK_ID  plink_… id of the trial payment link
 *       CALENDAR_ID    the Club calendar's ID (Google Calendar → Settings → the calendar → "Calendar ID")
 *       NOTIFY_EMAIL   where problems are reported (your email)
 *       REFUND_REPEATS optional: "yes" = automatically refund someone who books a second trial
 *                      (the Stripe key then also needs WRITE access to Refunds)
 *  3. Run the `setup` function once (it creates the timer and the "Trial bookings" tab).
 *  4. Deploy → New deployment → Web app → Execute as Me → Anyone. Send the URL to Claude/the website.
 */

var MAX_SEATS = 6;
var TAB = 'Trial bookings';
var PAST = 'Past trials';           // emails of everyone who bought a trial before this script (filled by setup)
var HEAD = ['Session', 'Start (UTC)', 'Session title', 'Email', 'Name', 'Stripe checkout', 'Paid at', 'Status', 'Done at'];

/* ---------- website: seats taken per session, and "has this email had a trial?" ---------- */
function doGet(e) {
  var check = e && e.parameter && e.parameter.check;
  if (check) {
    return ContentService.createTextOutput(JSON.stringify({ used: hadTrial(String(check).trim().toLowerCase()) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var rows = tab().getDataRange().getValues().slice(1);
  var taken = {};
  rows.forEach(function (r) { if (r[0] && String(r[7]).indexOf('invited') === 0) taken[r[0]] = (taken[r[0]] || 0) + 1; });  // set Status to "refunded" to free a seat
  return ContentService.createTextOutput(JSON.stringify({ max: MAX_SEATS, taken: taken, updated: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- run once ---------- */
function setup() {
  tab();
  importPastTrials();
  PropertiesService.getScriptProperties().setProperty('SINCE', String(Math.floor(Date.now() / 1000)));
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'processBookings') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processBookings').timeBased().everyMinutes(5).create();
  processBookings();
  console.log('Ready ✓ Checking Stripe every 5 minutes.');
}

/* ---------- every 5 minutes ---------- */
function processBookings() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    var p = PropertiesService.getScriptProperties();
    var since = Number(p.getProperty('SINCE') || 0);
    var link = p.getProperty('TRIAL_LINK_ID');
    var list = stripe('checkout/sessions?limit=100' + (link ? '&payment_link=' + encodeURIComponent(link) : '') + (since ? '&created%5Bgte%5D=' + since : ''));
    if (!list || !list.data) { problem('Stripe did not answer: ' + LAST_STRIPE_ERROR); return; }
    var sh = tab();
    var done = {};
    sh.getDataRange().getValues().slice(1).forEach(function (r) { done[r[5]] = true; });

    list.data.slice().reverse().forEach(function (cs) {                 // oldest first
      if ((cs.payment_status !== 'paid' && cs.payment_status !== 'no_payment_required') || done[cs.id]) return;   // no_payment_required = 100% coupon
      var ref = String(cs.client_reference_id || '');
      var email = String((cs.customer_details && cs.customer_details.email) || cs.customer_email || '').toLowerCase();
      var name = (cs.customer_details && cs.customer_details.name) || '';
      var start = parseRef(ref);
      var row = [ref, start || '', '', email, name, cs.id, new Date(cs.created * 1000), '', new Date()];
      if (!start || !email) { row[7] = 'check by hand'; sh.appendRow(row); notify('Trial booking needs a look', 'A paid trial booking has no session or email.\nStripe checkout: ' + cs.id + '\nReference: ' + ref + '\nEmail: ' + email); return; }
      var ev;
      try { ev = findEvent(start); } catch (err) { problem('Google Calendar error: ' + err.message + ' (is the "Google Calendar API" service added, and is CALENDAR_ID right?)'); throw err; }
      if (!ev) { row[7] = 'session not found'; sh.appendRow(row); notify('Trial booking: session not found', email + ' paid for the trial session at ' + start.toISOString() + ' (UTC), but there is no event at that time in the Club calendar. Please invite them by hand or refund.\nStripe checkout: ' + cs.id); return; }
      row[2] = ev.summary || '';
      // One trial per person: a second booking with the same email is not invited.
      if (hadTrial(email)) {
        row[7] = 'repeat trial';
        var refunded = refundRepeat(cs);
        if (refunded) row[7] = 'repeat trial (refunded)';
        sh.appendRow(row);
        sendRepeatEmail(email, name, refunded);
        notify('Second trial booking', email + ' already had a trial session and booked "' + (ev.summary || '') + '" (' + start.toISOString() + ' UTC). They were not invited' + (refunded ? ' and were refunded automatically.' : '. Please refund them in Stripe (checkout ' + cs.id + ').'));
        return;
      }
      var taken = sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0] === ref && String(r[7]).indexOf('invited') === 0; }).length;
      addGuest(ev, email);
      sendConfirmation(email, name, ev, start);
      row[7] = taken >= MAX_SEATS ? 'invited (over ' + MAX_SEATS + ' seats)' : 'invited';
      sh.appendRow(row);
      if (taken >= MAX_SEATS) notify('Trial session over ' + MAX_SEATS + ' seats', email + ' booked "' + (ev.summary || '') + '" (' + start.toISOString() + ' UTC) just as it filled up. They are invited; you may want to check the group size.');
    });
  } finally { lock.releaseLock(); }
}

/* ---------- one trial per person ---------- */
function hadTrial(email) {
  if (!email) return false;
  var booked = tab().getDataRange().getValues().slice(1).some(function (r) { return String(r[3]).toLowerCase() === email && String(r[7]).indexOf('invited') === 0; });
  if (booked) return true;
  var past = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAST);
  if (!past || past.getLastRow() < 1) return false;
  return past.getRange(1, 1, past.getLastRow(), 1).getValues().some(function (r) { return String(r[0]).trim().toLowerCase() === email; });
}
// Everyone who paid for a trial before this script started (so they can't book a second one either).
function importPastTrials() {
  var link = PropertiesService.getScriptProperties().getProperty('TRIAL_LINK_ID');
  if (!link) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PAST) || ss.insertSheet(PAST);
  var have = {};
  if (sh.getLastRow() === 0) sh.appendRow(['Email (had a trial before)']);
  sh.getDataRange().getValues().forEach(function (r) { have[String(r[0]).toLowerCase()] = true; });
  var after = '', rows = [];
  for (var page = 0; page < 20; page++) {
    var list = stripe('checkout/sessions?limit=100&payment_link=' + encodeURIComponent(link) + (after ? '&starting_after=' + after : ''));
    if (!list || !list.data || !list.data.length) break;
    list.data.forEach(function (cs) {
      var em = String((cs.customer_details && cs.customer_details.email) || cs.customer_email || '').toLowerCase();
      if (cs.payment_status === 'paid' && em && !have[em]) { have[em] = true; rows.push([em]); }
    });
    if (!list.has_more) break;
    after = list.data[list.data.length - 1].id;
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 1).setValues(rows);
  console.log('Past trial emails imported: ' + rows.length);
}
function refundRepeat(cs) {
  var p = PropertiesService.getScriptProperties();
  if (String(p.getProperty('REFUND_REPEATS') || '').toLowerCase() !== 'yes' || !cs.payment_intent) return false;
  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/refunds', {
    method: 'post', headers: { Authorization: 'Bearer ' + p.getProperty('STRIPE_KEY') },
    payload: { payment_intent: cs.payment_intent, reason: 'duplicate' }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { console.warn('Refund failed ' + res.getContentText().slice(0, 300)); return false; }
  return true;
}
function sendRepeatEmail(email, name, refunded) {
  var first = String(name || '').split(' ')[0];
  MailApp.sendEmail({
    to: email, name: 'Mandarin Zest',
    subject: 'About your Mandarin Zest Club trial booking',
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#2a2420;line-height:1.5;max-width:520px">' +
      '<p>' + (first ? 'Hi ' + first + ',' : 'Hi,') + '</p>' +
      '<p>Thanks for booking again! Trial sessions are one per person, and our records show you already had yours, so we couldn\'t add you to this session.' +
      (refunded ? ' Your US$2.50 has been refunded; it can take a few days to show on your card.' : ' We\'ll refund your US$2.50 within a few days.') + '</p>' +
      '<p>If you enjoyed it, the Club gives you as many speaking sessions as you like every week, plus a new workbook every month.</p>' +
      '<p><a href="https://www.mandarinzest.com/mandarin-zest-club" style="background:#f37a48;color:#2a2420;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:999px;display:inline-block">See the Club</a></p>' +
      '<p>加油！<br>Mandarin Zest</p></div>'
  });
}

/* ---------- helpers ---------- */
function tab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (sh.getLastRow() === 0) { sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function parseRef(ref) {
  var m = ref.match(/trial-(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)-utc/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}
function calId() { return PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || 'primary'; }
function findEvent(start) {
  var res = Calendar.Events.list(calId(), {
    timeMin: new Date(start.getTime() - 60000).toISOString(),
    timeMax: new Date(start.getTime() + 60000).toISOString(),
    singleEvents: true, maxResults: 10
  });
  return (res.items || []).filter(function (e) {
    return e.start && e.start.dateTime && Math.abs(new Date(e.start.dateTime) - start) < 60000 && e.status !== 'cancelled';
  })[0] || null;
}
function addGuest(ev, email) {
  var attendees = (ev.attendees || []).slice();
  if (!attendees.some(function (a) { return String(a.email).toLowerCase() === email; })) attendees.push({ email: email });
  // sendUpdates 'none': members are not emailed about each new guest; we send our own confirmation instead.
  Calendar.Events.patch({ attendees: attendees, guestsCanSeeOtherGuests: false }, calId(), ev.id, { sendUpdates: 'none' });
}
function fmt(d, tz) { return Utilities.formatDate(d, tz, "EEE d MMM, HH:mm"); }
function sendConfirmation(email, name, ev, start) {
  var meet = ev.hangoutLink || ((ev.conferenceData && ev.conferenceData.entryPoints || []).filter(function (x) { return x.entryPointType === 'video'; })[0] || {}).uri || '';
  var end = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 45 * 60000);
  var gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Mandarin Zest Club: ' + (ev.summary || 'trial session')) +
    '&dates=' + Utilities.formatDate(start, 'UTC', "yyyyMMdd'T'HHmmss'Z'") + '/' + Utilities.formatDate(end, 'UTC', "yyyyMMdd'T'HHmmss'Z'") +
    '&details=' + encodeURIComponent('Google Meet: ' + meet);
  var first = String(name || '').split(' ')[0];
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#2a2420;line-height:1.5;max-width:520px">' +
    '<p style="font-size:22px;font-weight:bold;margin:0 0 10px">You\'re booked! 🍊</p>' +
    '<p>' + (first ? 'Hi ' + first + ', thanks' : 'Thanks') + ' for booking a trial session of the Mandarin Zest Club.</p>' +
    '<div style="background:#fdf1ea;border-radius:12px;padding:14px 16px;margin:14px 0">' +
    '<b style="font-size:17px">' + (ev.summary || 'Trial session') + '</b><br>' +
    fmt(start, 'Europe/Brussels') + ' Central Europe<br>' + fmt(start, 'America/New_York') + ' New York<br>' + fmt(start, 'Asia/Taipei') + ' Taipei<br>' +
    '<span style="color:#5c4f47">(45 minutes)</span></div>' +
    (meet ? '<p><a href="' + meet + '" style="background:#f37a48;color:#2a2420;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:999px;display:inline-block">Join on Google Meet</a></p>' : '<p>Your Google Meet link will be sent before the session.</p>') +
    '<p><a href="' + gcal + '" style="color:#a8431a">Add it to your calendar</a></p>' +
    '<p>Join a few minutes early with your camera and microphone on. Everyone is there to practise, so mistakes are welcome!</p>' +
    '<p>加油！<br>Mandarin Zest</p></div>';
  MailApp.sendEmail({ to: email, subject: 'You\'re booked: ' + (ev.summary || 'Mandarin Zest Club trial') + ', ' + fmt(start, 'UTC') + ' UTC', htmlBody: html, name: 'Mandarin Zest' });
}
function notify(subject, body) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, '[Mandarin Zest] ' + subject, body);
}
var LAST_STRIPE_ERROR = '';
function stripe(path) {
  var key = String(PropertiesService.getScriptProperties().getProperty('STRIPE_KEY') || '').trim();
  if (!key) { LAST_STRIPE_ERROR = 'STRIPE_KEY is missing in Script properties'; console.warn(LAST_STRIPE_ERROR); return null; }
  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { LAST_STRIPE_ERROR = res.getResponseCode() + ' ' + res.getContentText().slice(0, 300); console.warn('Stripe ' + LAST_STRIPE_ERROR); return null; }
  return JSON.parse(res.getContentText());
}
// Emails you about a problem, at most once every 6 hours (the timer runs every 5 minutes).
function problem(msg) {
  console.warn(msg);
  var p = PropertiesService.getScriptProperties(), last = Number(p.getProperty('LAST_PROBLEM') || 0);
  if (Date.now() - last < 6 * 3600 * 1000) return;
  p.setProperty('LAST_PROBLEM', String(Date.now()));
  notify('Trial bookings script has a problem', msg + '\n\nOpen the script and run "diagnose" to see more.');
}

/* ---------- run from the editor if bookings don't come through: it only reads, changes nothing ---------- */
function diagnose() {
  var p = PropertiesService.getScriptProperties();
  ['STRIPE_KEY', 'TRIAL_LINK_ID', 'CALENDAR_ID', 'NOTIFY_EMAIL', 'REFUND_REPEATS'].forEach(function (k) {
    var v = String(p.getProperty(k) || '');
    console.log(k + ': ' + (!v ? 'MISSING' : k === 'STRIPE_KEY' ? v.slice(0, 8) + '… (' + v.length + ' characters' + (v.trim() !== v ? ', has spaces around it!' : '') + ')' : '"' + v + '"'));
  });
  var since = Number(p.getProperty('SINCE') || 0);
  console.log('Handles bookings made after: ' + (since ? new Date(since * 1000).toISOString() + ' UTC' : 'not set (run setup)'));
  var trig = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'processBookings'; });
  console.log('5-minute timer: ' + (trig.length ? 'on' : 'OFF (run setup)'));
  var link = String(p.getProperty('TRIAL_LINK_ID') || '').trim();
  if (link && link.indexOf('plink_') !== 0) console.log('TRIAL_LINK_ID should start with plink_ (not the buy.stripe.com address)');
  var all = stripe('checkout/sessions?limit=5');
  console.log('Stripe key: ' + (all ? 'works' : 'ERROR ' + LAST_STRIPE_ERROR));
  if (all) (all.data || []).forEach(function (cs) {
    console.log('  latest checkout ' + new Date(cs.created * 1000).toISOString() + ' | ' + cs.payment_status + ' | link ' + cs.payment_link + ' | ref ' + cs.client_reference_id + ' | ' + ((cs.customer_details && cs.customer_details.email) || ''));
  });
  if (link) {
    var mine = stripe('checkout/sessions?limit=5&payment_link=' + encodeURIComponent(link));
    console.log('Checkouts on the trial link: ' + (mine ? mine.data.length + ' found' : 'ERROR ' + LAST_STRIPE_ERROR));
    if (mine) mine.data.forEach(function (cs) {
      var start = parseRef(String(cs.client_reference_id || ''));
      var ev = null, err = '';
      if (start) { try { ev = findEvent(start); } catch (e) { err = e.message; } }
      console.log('  ' + new Date(cs.created * 1000).toISOString() + ' | ' + cs.payment_status + ' | ref ' + cs.client_reference_id +
        (since && cs.created < since ? ' | BEFORE setup, ignored' : '') +
        ' | session: ' + (!start ? 'no session in reference' : err ? 'CALENDAR ERROR ' + err : ev ? '"' + ev.summary + '"' : 'NOT FOUND in calendar'));
    });
  }
  try { Calendar.Events.list(calId(), { maxResults: 1 }); console.log('Calendar: works'); }
  catch (e) { console.log('Calendar: ERROR ' + e.message); }
}
