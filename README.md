# Mandarin Zest Class Calendar

The public session calendar shown on mandarinzest.com/mandarin-zest-club.

Sessions are no longer typed into the HTML. Hosts add them to the club's
Google Calendar, and a GitHub Action rebuilds `events.json` from it every
6 hours. **Only the session title, date, time, level and category are
published. Google Meet links, descriptions, locations and attendees never
leave Google Calendar.**

## One-time setup

1. **Copy the calendar's secret address.** In Google Calendar (on a computer),
   open Settings → click the club calendar on the left → *Integrate calendar*
   → copy **Secret address in iCal format**. Treat it like a password.
2. **Store it as a secret in this repo.** On GitHub: Settings → Secrets and
   variables → Actions → *New repository secret*.
   Name: `CALENDAR_ICS_URL`. Value: the address you copied.
3. **Run it once.** Actions tab → *Sync class calendar* → *Run workflow*.
   After that it runs by itself every 6 hours.

If the secret address ever leaks, reset it in the same Google Calendar
settings screen and paste the new one into the GitHub secret.

## For hosts: how to name sessions

Write the session name with the level in brackets. A leading "MZ Club" is
removed automatically. For example:

- `Advanced Chinese (HSK 4-6)`
- `Vocab + Reading Practice (HSK 1-4)`
- `Native Teacher Conversation (HSK 3-4)`

The colour is picked automatically from words in the title (advanced,
intermediate, beginner, vocab, native, character, bopomofo…) or from the
HSK level. To force a colour, add a tag: `#advanced`, `#intermediate`,
`#beginner`, `#native`, `#character` or `#general`.

To keep an event off the public calendar, add `#hide` to its title or set
its visibility to *Private* in Google Calendar. Cancelled events are
skipped automatically.

### What visitors see when they open a session

Hovering (or tapping) a session on the website shows its time in the
visitor's own time zone, plus anything you choose to publish from the
description. Only these lines are ever read from the description:

```
Topic: Ordering bubble tea like a local
About: We'll practise menu words and role-play ordering at a tea shop.
Bring your own drink!
Host: Dorota
```

- `About:` can run over several lines; it stops at the first empty line or
  at the next `Something:` line.
- Links, emails, phone numbers and the Google Meet details are never
  published. Anything you don't put after `Topic:`, `About:` or `Host:`
  stays private.

### Trial sessions

Keep the session name as usual and write `#trial` in the event
description, optionally with a topic line:

```
#trial
Topic: Tips for learning and remembering characters
```

The trial page then shows the next 2 trial sessions automatically. Only
`#trial` and the `Topic:` line are read from the description; everything
else in it (Meet links included) is ignored.

No payment link goes in the calendar. Every trial card uses the one Stripe
link set at the top of `trial.html`, and adds the session to it
(`client_reference_id`, e.g. `trial-2026-11-08T13-00-utc`, in UTC) so each
payment in Stripe shows which session was booked.

On the calendar, times are shown in each visitor's own time zone (they can
switch it in the menu at the top). Trial sessions get an orange "Try it" tag
that opens the trial page in a new tab.

## Files

- `Mandarin Zest — Class Calendar.html`: the page (colours, category names,
  the trial page link and the time zone menu are at the top of its script).
  Use a 1060px frame.
- `next-sessions.html`: a small strip showing the next session in the
  visitor's own time zone, for the club landing page. Options in the URL:
  `?count=3` (1 to 6 sessions, default 1), `&bg=f8dacd` (background colour; default
  transparent).
- `pricing.html`: the Monthly / Yearly membership cards for the club page,
  with the Stripe links (they open in a new tab). Edit prices and bullets
  directly in the file.
- `trial.html`: the upcoming `#trial` sessions as booking cards, for the
  trial page (price and Stripe link at the top of its script).
- `hsk1-offer.html`: the HSK 1 Bundle offer with the NEWCOMER2026 code, for
  the Start Here thank-you page (all links open in a new tab; text, price and
  code are edited directly in the file).
- `downloads.html` + `downloads/`: the two free beginner PDFs and their
  covers, for the Start Here thank-you page. To update a PDF, upload the new
  file into `downloads/` with the same name.
- `whats-inside.html`: the two free guides with covers and contents (no
  download buttons), for the Start Here page above the email form.
- `banners/`: article banners for SEO posts: `shop.html` (WELCOME01),
  `club.html`, `start-here.html` and `characters-guide.html` (WELCOME01).
  All links open in a new tab. `banners/snippets/` holds frame-free
  versions to paste straight into an Odoo Embed Code block (they always
  display in full, but text changes must be made in each article).
- `promo/club.html` and `promo/bootcamps.html`: animated promo cards with
  the mascot, linking to the club page and the bootcamps page. They fill
  any frame height (use 300px); no resize script needed.
- `promo/home-hero.html`: animated homepage hero visual (the mascot with a
  "tap me!" hint and a speech bubble that changes when tapped).
  Transparent background; scales to any frame (use about 360x400).
- `journey.html`: the homepage "Where are you on your Chinese journey?" cards
  (beginner → Start Here, HSK/TOCFL → shop, speaking → Club, level up fast →
  bootcamps). 4 in a row on desktop, swipeable on phones; use a 290px frame.
- `reviews.html`: learner reviews sliding in from the side in an endless loop
  (pauses on hover or tap). Edit the REVIEWS list at the bottom of the file;
  `club: true` makes a green Club card. Use a 250px frame.
- `our-story.html`: the founders' story as a timeline for the About us page
  (10 years ago → 2020 → 2024 → 2026), no title. The line draws itself when
  it scrolls into view; swipeable on phones. Use a 300px frame.
- `founders.html` + `about/`: Antoine and Dorota cards (photo, quote, role,
  LinkedIn and Instagram, opening in a new tab) for the About us page, no title.
  Side by side on desktop, swipeable on phones. Use a 480px frame.
- `bootcamps.html` + `bootcamps.json`: the bootcamp cards for the Bootcamps
  page, built every day by `scripts/build_bootcamps.py` from every page on
  mandarinzest.com with "bootcamp" in its address. It reads the "AT A GLANCE"
  box (Dates, Time, Format, Level, Group, Early bird, Price, Club members,
  Sign up by, optional Status and Summary) and the background picture of that
  section. Missing lines or "TBD" show a grey TBD tag. Status is worked out
  from the dates (Open until "Sign up by", Waitlist when only a month is set or
  sign-up has closed, Coming soon when the dates have passed); a "Status:" line
  wins. If the box has no prices, they come from an embedded *-pricing.html
  widget's CONFIG. "Join the waitlist" opens a form that saves to the Bootcamp
  waitlist Google Sheet. Use a 720px frame.
- `waitlist.html?bootcamp=<page-address-ending>`: the same waitlist form for a
  bootcamp's own page, e.g. `?bootcamp=chinese-pronunciation-bootcamp`. Use a
  440px frame.
- `apps-script/bootcamp-waitlist.gs`: the Google Apps Script behind the
  waitlist sheet (for reference; it runs in Google, not here).
- `taiwan-vs-textbook.html`: textbook vs. Taiwan word cards for the Taiwanese
  bootcamp page (4 in a row on desktop, swipeable on phones; use a 220px frame).
- `taiwan-agenda.html`: the Taiwanese bootcamp agenda by weekend, with no dates
  so it works for every cohort (3 columns on desktop, swipeable on phones; use a
  410px frame).
- `taiwan-pricing.html`: the Taiwanese bootcamp tickets (early bird, standard,
  Club). All prices, dates and Stripe links are in the CONFIG block at the
  bottom of the file. The early bird card switches itself off after
  `earlyEnds` (Taiwan time) and the standard ticket becomes the highlighted
  one. For a new cohort: update CONFIG (dates, prices, links). Use a 320px frame.
- `events.json`: generated, don't edit by hand.
- `scripts/build_events.py`: reads the feed and keeps only the safe fields.
- `.github/workflows/sync-calendar.yml`: the schedule.

Local test: `python scripts/build_events.py --ics-file some-calendar.ics`
