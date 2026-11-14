// ═══ Club membership offers, shared by the Club widgets (club-popup, club-home, pricing, trial-booked, banners/club) ═══
// The first offer whose dates include today (Taiwan time, both days included) is shown; outside the dates
// CLUB_OFFER is null and every widget shows the regular price. ?date=2026-11-26 previews another day.
// The discount itself is a Stripe promotion code on the regular monthly link (so the Club app's Stripe sync keeps working).
var CLUB_OFFERS = [
  { name: "Black Friday", from: "2026-11-25", until: "2026-11-30",
    pct: 20, months: 3, price: "US$20", value: 20, regular: "US$25", code: "BLACKFRIDAY26",
    ends: "30 November" }
];
var CLUB_TODAY = (function () {
  var q = new URLSearchParams(location.search).get("date");
  return /^\d{4}-\d{2}-\d{2}$/.test(q || "") ? q : new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
})();
var CLUB_OFFER = CLUB_OFFERS.filter(function (x) { return x.from <= CLUB_TODAY && CLUB_TODAY <= x.until; })[0] || null;

// copies the code, shows "Copied ✓" on the button for 2 seconds
function clubCopy(btn, code) {
  var label = btn.textContent;
  function ok() { btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = label; }, 2000); }
  function fallback() {
    var t = document.createElement("textarea"); t.value = code; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { document.execCommand("copy"); ok(); } catch (e) {} t.remove();
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(ok, fallback); else fallback();
}
