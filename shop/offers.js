// ═══ Shop offers, shared by shop-banner.html (strip above the products) and shop-popup.html (website pop-up) ═══
// The first offer whose dates include today (Taiwan time, both days included) is shown; otherwise REGULAR.
// For a new celebration: add a line at the top with its code, label, discount, dates and a picture in the shop/ folder.
var OFFERS = [
  { label:"Halloween sale · ends 31 October", short:"Halloween · ends 31 Oct", off:"30% off", code:"HALLOWEEN26",
    img:"shop/mascot-halloween.png", alt:"Mandarin Zest mascot dressed as a witch with a black cat", from:"2026-10-01", until:"2026-10-31" }
];
var REGULAR = { label:"Shop offer", short:"Shop offer", off:"10% off", code:"WELCOME01",
    img:"shop/mascot-reading.png", alt:"Mandarin Zest mascot reading a book" };

// today's date in Taiwan (UTC+8), as YYYY-MM-DD; ?date=2026-11-02 previews another day
var MZ_TODAY = (function () {
  var q = new URLSearchParams(location.search).get("date");
  return /^\d{4}-\d{2}-\d{2}$/.test(q || "") ? q : new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
})();
var OFFER = OFFERS.filter(function (x) { return x.from <= MZ_TODAY && MZ_TODAY <= x.until; })[0] || REGULAR;

// "Copy code" button: copies the code and shows "Copied ✓"
function mzCopy(btn, code) {
  function ok() { btn.textContent = "Copied ✓"; btn.classList.add("done"); setTimeout(function () { btn.textContent = "Copy code"; btn.classList.remove("done"); }, 2200); }
  function fallback() {
    var t = document.createElement("textarea"); t.value = code; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); ok(); } catch (e) {}
    t.remove();
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(ok, fallback); else fallback();
}
