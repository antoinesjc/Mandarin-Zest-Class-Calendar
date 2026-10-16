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

Write the session name with the level in brackets, for example:

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

Times are shown in Europe (CET/CEST) and US Eastern time. Sessions that
fall overnight in Europe are listed under the US date with only the US time.

## Files

- `Mandarin Zest — Class Calendar.html`: the page (colours and category
  names are at the top of its script).
- `events.json`: generated, don't edit by hand.
- `scripts/build_events.py`: reads the feed and keeps only the safe fields.
- `.github/workflows/sync-calendar.yml`: the schedule.

Local test: `python scripts/build_events.py --ics-file some-calendar.ics`
