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
 *  3. Run the `setup` function once (it creates the timer and the "Trial bookings" tab).
 *  4. Deploy → New deployment → Web app → Execute as Me → Anyone. Send the URL to Claude/the website.
 */

var MAX_SEATS = 6;
var TAB = 'Trial bookings';
var HEAD = ['Session', 'Start (UTC)', 'Session title', 'Email', 'Name', 'Stripe checkout', 'Paid at', 'Status', 'Done at'];

/* ---------- website: seats taken per session ---------- */
function doGet() {
  var rows = tab().getDataRange().getValues().slice(1);
  var taken = {};
  rows.forEach(function (r) { if (r[0] && String(r[7]).indexOf('invited') === 0) taken[r[0]] = (taken[r[0]] || 0) + 1; });  // set Status to "refunded" to free a seat
  return ContentService.createTextOutput(JSON.stringify({ max: MAX_SEATS, taken: taken, updated: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- run once ---------- */
function setup() {
  tab();
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
    if (!list || !list.data) return;
    var sh = tab();
    var done = {};
    sh.getDataRange().getValues().slice(1).forEach(function (r) { done[r[5]] = true; });

    list.data.slice().reverse().forEach(function (cs) {                 // oldest first
      if (cs.payment_status !== 'paid' || done[cs.id]) return;
      var ref = String(cs.client_reference_id || '');
      var email = String((cs.customer_details && cs.customer_details.email) || cs.customer_email || '').toLowerCase();
      var name = (cs.customer_details && cs.customer_details.name) || '';
      var start = parseRef(ref);
      var row = [ref, start || '', '', email, name, cs.id, new Date(cs.created * 1000), '', new Date()];
      if (!start || !email) { row[7] = 'check by hand'; sh.appendRow(row); notify('Trial booking needs a look', 'A paid trial booking has no session or email.\nStripe checkout: ' + cs.id + '\nReference: ' + ref + '\nEmail: ' + email); return; }
      var ev = findEvent(start);
      if (!ev) { row[7] = 'session not found'; sh.appendRow(row); notify('Trial booking: session not found', email + ' paid for the trial session at ' + start.toISOString() + ' (UTC), but there is no event at that time in the Club calendar. Please invite them by hand or refund.\nStripe checkout: ' + cs.id); return; }
      row[2] = ev.summary || '';
      var taken = sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0] === ref && String(r[7]).indexOf('invited') === 0; }).length;
      addGuest(ev, email);
      sendConfirmation(email, name, ev, start);
      row[7] = taken >= MAX_SEATS ? 'invited (over ' + MAX_SEATS + ' seats)' : 'invited';
      sh.appendRow(row);
      if (taken >= MAX_SEATS) notify('Trial session over ' + MAX_SEATS + ' seats', email + ' booked "' + (ev.summary || '') + '" (' + start.toISOString() + ' UTC) just as it filled up. They are invited; you may want to check the group size.');
    });
  } finally { lock.releaseLock(); }
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
function stripe(path) {
  var key = PropertiesService.getScriptProperties().getProperty('STRIPE_KEY');
  if (!key) { console.warn('STRIPE_KEY missing'); return null; }
  var res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { console.warn('Stripe ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300)); return null; }
  return JSON.parse(res.getContentText());
}
