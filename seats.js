// Seats per Club session (website widgets): 8 people max in a session (members who said "I'm in" in the Club app
// + trial guests), and at most 6 of them can be trial guests. Trial bookings come from the trial-bookings Apps Script
// (TAKEN in each widget); members' "I'm in" counts come from the Club app (Supabase RPC session_going_counts, counts only).
// Keys: trial-YYYY-MM-DDTHH-MM-utc (session start in UTC). Used by the calendar, trial.html and trial-board.html.
window.MZ_SEATS = {
  MAX_TOTAL: 8,
  MAX_TRIAL: 6,
  going: {},
  ready: fetch("https://eypehvhcqzhwssydvrhn.supabase.co/rest/v1/rpc/session_going_counts", {
    method: "POST", headers: { apikey: "sb_publishable_sFnX5WLyN96IvLDDRY96mw_6dJaG6BG", "Content-Type": "application/json" }, body: "{}"
  }).then(function (r) { return r.json(); }).then(function (d) { if (d && typeof d === "object") window.MZ_SEATS.going = d; }).catch(function () {}),
  // trial seats left for a session: limited by the 6 trial seats and by the 8 seats in total
  left: function (ref, taken) {
    taken = taken || 0;
    var g = this.going[ref] || 0;
    return Math.max(0, Math.min(this.MAX_TRIAL - taken, this.MAX_TOTAL - g - taken));
  }
};
