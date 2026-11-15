/**
 * Mandarin Zest - Club Partner Program (monthly membership only)
 * Google Apps Script bound to the "MZ Club Partners" Google Sheet.
 *
 * What it does
 *  - Reads Club monthly sign-ups from Stripe that used a partner promotion code
 *  - Logs referred members and commissions on their first 3 paid months, plus refunds
 *  - Awards the 5-active-members bonus and tracks the partner's free Club access
 *  - Keeps a Balances tab (what you owe) and a Monthly tab (Club cost for the freelancer split)
 *  - Answers the partner dashboard on GitHub Pages (login: email + discount code)
 *
 * Source of truth: partners/apps-script/Code.gs in the GitHub repo.
 * Setup: see the "Club Partner Program: Setup Guide" doc.
 */

// ----- Settings -----
const CONFIG = {
  // Program start: payments before this date are ignored.
  PROGRAM_START: '2026-12-01',

  // Your Club monthly Stripe Payment Link (used to build each partner's ready-made link).
  MONTHLY_LINK: 'https://buy.stripe.com/REPLACE_MONTHLY',

  RATE: 0.20,              // partner share of the standard monthly price (US$25 -> US$5)
  PAID_MONTHS: 3,          // paid months that earn commission
  HOLD_DAYS: 14,           // commission becomes payable after this many days (refund window)
  PAYOUT_MIN: 50,          // USD
  BONUS_AMOUNT: 25,        // USD
  BONUS_MEMBERS: 5,        // active members needed for the bonus
  WINDOW_MONTHS: 3,        // bonus window, and length of each free-access period
  CONTACT_EMAIL: 'contact@mandarinzest.com', // where partners request payouts

  STRIPE_VERSION: '2024-06-20', // pinned so field names stay stable
};

// Sheet tabs and their columns (setupSheets() creates them).
const TABS = {
  // No payment details are stored: partners email a payout request with their method.
  Partners: ['Name', 'Email', 'Code', 'Start date', 'Status', 'Free access', 'Notes'],
  Referrals: ['Session ID', 'Date', 'Partner', 'Member', 'Subscription ID', 'Status'],
  Commissions: ['Payment ID', 'Referral', 'Date', 'Partner', 'Member', 'Type', 'Month #',
                'Price before discount', 'Paid', 'Commission', 'Charge ID', 'Status'],
  Payouts: ['Date', 'Partner', 'Amount', 'Method', 'Reference'],
  Balances: ['Partner', 'Name', 'Earned', 'Pending', 'Payable', 'Paid out', 'Balance', 'Can request payout'],
  Monthly: ['Month', 'Member commissions', 'Bonuses', 'Total partner cost'],
};

// ----- Menu & triggers -----
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Partners')
    .addItem('Sync now', 'syncAll')
    .addItem('Create tabs (first time)', 'setupSheets')
    .addItem('Start automatic sync (every 15 min)', 'installTrigger')
    .addToUi();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  const status = SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Ended'], true).build();
  ss.getSheetByName('Partners').getRange('E2:E').setDataValidation(status);
  const method = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PayPal', 'Bank transfer', 'Invoice', 'Other'], true).build();
  ss.getSheetByName('Payouts').getRange('D2:D').setDataValidation(method);
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncAll')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(15).create();
}

// ----- Main sync -----
function syncAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const partners = readTable_('Partners').filter(p => p.Code);
    importSessions_(buildPromoMap_(partners));
    importPayments_(partners);
    updateCommissionStatuses_();
    updateReferralStatuses_();
    awardBonuses_(partners);
    updateFreeAccess_(partners);
    writeBalances_(partners);
    writeMonthly_();
  } finally {
    lock.releaseLock();
  }
}

// Map Stripe promotion-code ids to active partners, using the codes in the Partners tab.
function buildPromoMap_(partners) {
  const byCode = {};
  partners.filter(p => p.Status !== 'Ended').forEach(p => { byCode[up_(p.Code)] = up_(p.Code); });
  const map = {};
  stripeList_('promotion_codes', 'limit=100').forEach(pc => {
    if (byCode[up_(pc.code)]) map[pc.id] = byCode[up_(pc.code)];
  });
  return map;
}

// New completed monthly Checkout Sessions that used a partner code -> Referrals.
function importSessions_(promoMap) {
  const props = PropertiesService.getScriptProperties();
  const start = Math.floor(new Date(CONFIG.PROGRAM_START + 'T00:00:00Z').getTime() / 1000);
  const last = Number(props.getProperty('LAST_SESSION_CREATED') || 0);
  const since = Math.max(start, last - 3600);
  const referrals = readTable_('Referrals');
  const known = new Set(referrals.map(r => r['Session ID']));

  const sessions = stripeList_('checkout/sessions',
    'limit=100&status=complete&' + enc_('created[gte]') + '=' + since +
    '&' + enc_('expand[]') + '=' + enc_('data.total_details.breakdown'));

  let maxCreated = last;
  sessions.sort((a, b) => a.created - b.created).forEach(s => {
    maxCreated = Math.max(maxCreated, s.created);
    if (known.has(s.id) || s.mode !== 'subscription' || !s.subscription) return;
    const discounts = (s.total_details && s.total_details.breakdown &&
                       s.total_details.breakdown.discounts) || [];
    let partner = null;
    discounts.forEach(d => {
      const pc = d.discount && d.discount.promotion_code;
      const id = pc && typeof pc === 'object' ? pc.id : pc;
      if (id && promoMap[id]) partner = promoMap[id];
    });
    if (!partner) return;

    const ref = {
      'Session ID': s.id, 'Date': new Date(s.created * 1000), 'Partner': partner,
      'Member': 'Member ' + (referrals.filter(r => r.Partner === partner).length + 1),
      'Subscription ID': s.subscription, 'Status': 'Active',
    };
    appendRow_('Referrals', ref);
    referrals.push(ref);
    known.add(s.id);
  });
  props.setProperty('LAST_SESSION_CREATED', String(maxCreated));
}

// First 3 paid invoices of each referred subscription -> Commissions.
function importPayments_(partners) {
  const comms = readTable_('Commissions');
  const recorded = new Set(comms.map(c => c['Payment ID']));
  // Remaining months stop earning once a partnership is set to Ended.
  const ended = new Set(partners.filter(p => p.Status === 'Ended').map(p => up_(p.Code)));
  readTable_('Referrals').forEach(r => {
    if (ended.has(r.Partner) || r.Status === 'Cancelled') return;
    const count = comms.filter(c => c.Referral === r['Session ID'] && c.Type === 'Monthly').length;
    if (count >= CONFIG.PAID_MONTHS) return;

    stripeList_('invoices', 'limit=100&status=paid&subscription=' + r['Subscription ID'])
      .filter(inv => inv.amount_paid > 0)
      .sort((a, b) => a.created - b.created)
      .slice(0, CONFIG.PAID_MONTHS)
      .forEach((inv, i) => {
        if (recorded.has(inv.id)) return;
        const paidAt = (inv.status_transitions && inv.status_transitions.paid_at) || inv.created;
        const subtotal = inv.subtotal / 100;
        const row = {
          'Payment ID': inv.id, 'Referral': r['Session ID'], 'Date': new Date(paidAt * 1000),
          'Partner': r.Partner, 'Member': r.Member, 'Type': 'Monthly', 'Month #': i + 1,
          'Price before discount': subtotal, 'Paid': inv.amount_paid / 100,
          'Commission': round2_(subtotal * CONFIG.RATE), 'Charge ID': inv.charge || '',
          'Status': 'Pending',
        };
        appendRow_('Commissions', row);
        comms.push(row);
        recorded.add(inv.id);
      });
  });
}

// Pending -> Payable after the hold period, or Refunded if Stripe shows a refund.
function updateCommissionStatuses_() {
  const now = Date.now();
  readTable_('Commissions').forEach(c => {
    if (c.Status !== 'Pending') return;
    if (c['Charge ID']) {
      const ch = stripe_('charges/' + c['Charge ID']);
      if (ch.refunded || ch.amount_refunded > 0) {
        setCell_('Commissions', c._row, 'Status', 'Refunded');
        return;
      }
    }
    if ((now - new Date(c.Date).getTime()) / 86400000 >= CONFIG.HOLD_DAYS) {
      setCell_('Commissions', c._row, 'Status', 'Payable');
    }
  });
}

// Active / Cancelled per referred member.
function updateReferralStatuses_() {
  const comms = readTable_('Commissions');
  readTable_('Referrals').forEach(r => {
    if (r.Status === 'Cancelled') return;
    const refunded = comms.some(c => c.Referral === r['Session ID'] &&
                                     Number(c['Month #']) === 1 && c.Status === 'Refunded');
    let status = 'Active';
    if (refunded) {
      status = 'Cancelled';
    } else {
      const sub = stripe_('subscriptions/' + r['Subscription ID']);
      if (!['active', 'trialing', 'past_due'].includes(sub.status)) status = 'Cancelled';
    }
    if (status !== r.Status) setCell_('Referrals', r._row, 'Status', status);
  });
}

function activeInWindow_(p, refs) {
  const end = addMonths_(p['Start date'], CONFIG.WINDOW_MONTHS);
  const count = refs.filter(r => r.Partner === up_(p.Code) && r.Status === 'Active' &&
    new Date(r.Date) >= p['Start date'] && new Date(r.Date) <= end).length;
  return { end, count };
}

// US$25 once, when a partner has 5 active members who joined within their first 3 months.
function awardBonuses_(partners) {
  const refs = readTable_('Referrals');
  const comms = readTable_('Commissions');
  const now = new Date();
  partners.forEach(p => {
    if (!(p['Start date'] instanceof Date) || p.Status === 'Ended') return;
    const key = up_(p.Code);
    if (comms.some(c => c.Type === 'Bonus' && c.Partner === key)) return;
    const w = activeInWindow_(p, refs);
    if (now <= w.end && w.count >= CONFIG.BONUS_MEMBERS) {
      appendRow_('Commissions', {
        'Payment ID': 'BONUS-' + key, 'Date': now, 'Partner': key, 'Type': 'Bonus',
        'Commission': CONFIG.BONUS_AMOUNT, 'Status': 'Payable',
      });
    }
  });
}

// Free access rule: free for the first 3 months, then the partner must bring at least one
// new member in every 3-month period to keep it for the next period.
function freeAccess_(p, refs, now) {
  const key = up_(p.Code);
  const start = p['Start date'];
  const joined = refs.filter(r => r.Partner === key).map(r => new Date(r.Date));
  let i = 0;
  while (addMonths_(start, CONFIG.WINDOW_MONTHS * (i + 1)) <= now) i++;   // current period
  for (let j = 0; j < i; j++) {
    const a = addMonths_(start, CONFIG.WINDOW_MONTHS * j);
    const b = addMonths_(start, CONFIG.WINDOW_MONTHS * (j + 1));
    if (!joined.some(d => d >= a && d < b)) return { active: false, endedOn: b };
  }
  const a = addMonths_(start, CONFIG.WINDOW_MONTHS * i);
  const periodEnd = addMonths_(start, CONFIG.WINDOW_MONTHS * (i + 1));
  const newThisPeriod = joined.filter(d => d >= a && d < periodEnd).length;
  return {
    active: true, periodEnd, newThisPeriod,
    until: newThisPeriod > 0 ? addMonths_(start, CONFIG.WINDOW_MONTHS * (i + 2)) : periodEnd,
  };
}

// "Free access" column in Partners, so you know whom to keep in or remove from the Club.
function updateFreeAccess_(partners) {
  const refs = readTable_('Referrals');
  const now = new Date();
  partners.forEach(p => {
    if (!(p['Start date'] instanceof Date)) return;
    let text;
    if (p.Status === 'Ended') text = 'Ended (partnership ended)';
    else {
      const f = freeAccess_(p, refs, now);
      text = f.active
        ? 'Free until ' + fmtDate_(f.until) + (f.newThisPeriod ? '' : ' (needs 1 new member by then)')
        : 'Ended ' + fmtDate_(f.endedOn) + ': remove from Club';
    }
    if (p['Free access'] !== text) setCell_('Partners', p._row, 'Free access', text);
  });
}

function partnerTotals_(key, comms, payouts) {
  const mine = comms.filter(c => c.Partner === key);
  const sum = list => round2_(list.reduce((a, c) => a + Number(c.Commission || 0), 0));
  const payable = sum(mine.filter(c => c.Status === 'Payable'));
  const paid = round2_(payouts.filter(x => up_(x.Partner) === key)
    .reduce((a, x) => a + Number(x.Amount || 0), 0));
  return {
    earned: sum(mine.filter(c => c.Status !== 'Refunded')),
    pending: sum(mine.filter(c => c.Status === 'Pending')),
    payable, paid, balance: round2_(payable - paid),
  };
}

function writeBalances_(partners) {
  const comms = readTable_('Commissions');
  const payouts = readTable_('Payouts');
  replaceBody_('Balances', partners.map(p => {
    const t = partnerTotals_(up_(p.Code), comms, payouts);
    return [up_(p.Code), p.Name, t.earned, t.pending, t.payable, t.paid, t.balance,
            t.balance >= CONFIG.PAYOUT_MIN ? 'Yes' : 'No'];
  }));
}

function writeMonthly_() {
  const months = {};
  readTable_('Commissions').forEach(c => {
    if (c.Status === 'Refunded') return;
    const m = Utilities.formatDate(new Date(c.Date), tz_(), 'yyyy-MM');
    months[m] = months[m] || { members: 0, bonus: 0 };
    months[m][c.Type === 'Bonus' ? 'bonus' : 'members'] += Number(c.Commission || 0);
  });
  replaceBody_('Monthly', Object.keys(months).sort().reverse().map(m =>
    [m, round2_(months[m].members), round2_(months[m].bonus),
     round2_(months[m].members + months[m].bonus)]));
}

// ----- Partner dashboard API -----
// The dashboard page lives on GitHub Pages and calls this web app.
// It POSTs {"email": "...", "code": "..."} as plain text (no CORS preflight) and gets JSON back.
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = { ok: true, data: getDashboard(body.email, body.code) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'Mandarin Zest partner dashboard API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Called from the dashboard page. Login = partner email + their discount code.
function getDashboard(email, code) {
  email = String(email || '').trim().toLowerCase();
  code = up_(code);
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + Utilities.base64EncodeWebSafe(email).slice(0, 200);
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 8) throw new Error('Too many attempts. Please try again in 15 minutes.');

  const p = readTable_('Partners').find(x =>
    String(x.Email || '').trim().toLowerCase() === email && up_(x.Code) === code);
  if (!email || !code || !p) {
    cache.put(failKey, String(fails + 1), 900);
    throw new Error("We couldn't find a partner with that email and code.");
  }

  const key = up_(p.Code);
  const allRefs = readTable_('Referrals');
  const refs = allRefs.filter(r => r.Partner === key);
  const comms = readTable_('Commissions');
  const payouts = readTable_('Payouts');
  const now = new Date();

  let bonus = null;
  if (p['Start date'] instanceof Date) {
    const w = activeInWindow_(p, allRefs);
    bonus = {
      awarded: comms.some(c => c.Type === 'Bonus' && c.Partner === key),
      active: w.count, needed: CONFIG.BONUS_MEMBERS, amount: CONFIG.BONUS_AMOUNT,
      deadline: fmtDate_(w.end), open: now <= w.end,
    };
  }

  return {
    name: String(p.Name || ''),
    code: key,
    link: CONFIG.MONTHLY_LINK + '?prefilled_promo_code=' + encodeURIComponent(key),
    access: (p['Start date'] instanceof Date && p.Status !== 'Ended') ? (function () {
      const f = freeAccess_(p, allRefs, now);
      return f.active
        ? { active: true, until: fmtDate_(f.until), periodEnd: fmtDate_(f.periodEnd), newThisPeriod: f.newThisPeriod }
        : { active: false, endedOn: fmtDate_(f.endedOn) };
    })() : null,
    contactEmail: CONFIG.CONTACT_EMAIL,
    totals: partnerTotals_(key, comms, payouts),
    payoutMin: CONFIG.PAYOUT_MIN,
    activeMembers: refs.filter(r => r.Status === 'Active').length,
    totalMembers: refs.length,
    bonus: bonus,
    members: refs.slice().reverse().map(r => {
      const months = comms.filter(c => c.Referral === r['Session ID'] && c.Status !== 'Refunded').length;
      return { member: String(r.Member), date: fmtDate_(r.Date), status: String(r.Status),
               months: months + ' of ' + CONFIG.PAID_MONTHS };
    }),
    commissions: comms.filter(c => c.Partner === key).reverse().map(c => ({
      date: fmtDate_(c.Date), member: String(c.Member || ''), type: String(c.Type),
      month: c['Month #'] ? String(c['Month #']) : '', amount: Number(c.Commission || 0),
      status: String(c.Status),
    })),
    payouts: payouts.filter(x => up_(x.Partner) === key).reverse().map(x => ({
      date: fmtDate_(x.Date), amount: Number(x.Amount || 0), method: String(x.Method || ''),
    })),
    updated: Utilities.formatDate(now, tz_(), 'd MMM yyyy, HH:mm'),
  };
}

// ----- Stripe helpers -----
function stripe_(path, params) {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_KEY');
  if (!key) throw new Error('Add STRIPE_KEY in Project Settings -> Script properties.');
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path + (params ? '?' + params : ''), {
    headers: { Authorization: 'Bearer ' + key, 'Stripe-Version': CONFIG.STRIPE_VERSION },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) {
    throw new Error('Stripe ' + res.getResponseCode() + ': ' + (body.error && body.error.message));
  }
  return body;
}

function stripeList_(path, params) {
  let all = [];
  let after = null;
  do {
    const page = stripe_(path, params + (after ? '&starting_after=' + after : ''));
    all = all.concat(page.data);
    after = page.has_more && page.data.length ? page.data[page.data.length - 1].id : null;
  } while (after);
  return all;
}

// ----- Sheet helpers -----
function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run Partners -> Create tabs.');
  return sh;
}

function headers_(name) {
  const sh = sheet_(name);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function readTable_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const headers = values.shift() || [];
  const rows = [];
  values.forEach((r, i) => {
    if (r.join('') === '') return;
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j]; });
    rows.push(o);
  });
  return rows;
}

function appendRow_(name, obj) {
  sheet_(name).appendRow(headers_(name).map(h => (obj[h] !== undefined ? obj[h] : '')));
}

function setCell_(name, row, header, value) {
  const col = headers_(name).indexOf(header) + 1;
  if (col > 0) sheet_(name).getRange(row, col).setValue(value);
}

function replaceBody_(name, rows) {
  const sh = sheet_(name);
  const width = TABS[name].length;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
}

// ----- Small utilities -----
function up_(v) { return String(v || '').trim().toUpperCase(); }
function round2_(n) { return Math.round(Number(n) * 100) / 100; }
function enc_(s) { return encodeURIComponent(s); }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Taipei'; }
function fmtDate_(d) { return d ? Utilities.formatDate(new Date(d), tz_(), 'd MMM yyyy') : ''; }
function addMonths_(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
