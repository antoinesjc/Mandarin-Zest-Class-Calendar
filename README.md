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

Times are shown in Europe (CET/CEST) and US Eastern time. Sessions that
fall overnight in Europe are listed under the US date with only the US time.

## Files

- `Mandarin Zest — Class Calendar.html`: the page (colours and category
  names are at the top of its script).
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
- `taiwan-vs-textbook.html`: textbook vs. Taiwan word cards for the Taiwanese
  bootcamp page (4 in a row on desktop, swipeable on phones; use a 220px frame).
- `events.json`: generated, don't edit by hand.
- `scripts/build_events.py`: reads the feed and keeps only the safe fields.
- `.github/workflows/sync-calendar.yml`: the schedule.

Local test: `python scripts/build_events.py --ics-file some-calendar.ics`
