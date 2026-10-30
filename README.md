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

Give the session a short name (a leading "MZ Club" is removed automatically), then set its
**level**, **category** and **host** with one line each in the Google Calendar event description:

```
Level: Beginner
Category: Conversation, Culture
Host: Dorota
```

- **Level**: `Beginner`, `Intermediate`, `Advanced` or `All levels` (one per session).
  Visitors who filter on a level also see the "All levels" sessions.
- **Category**: one or more of `Conversation`, `Culture`, `Grammar`, `Characters`, `Book club`,
  `Listening`, `Reading`, `Vocabulary`, `No agenda`, separated by commas. The first one sets the colour.
- **Host**: shown on the session on the website ("with Dorota") and in its details.
- Labels and colours: `categories.js` (shared by the calendar, the trial widget and the next-session strip).
- No `Level:` line? It is guessed from the title ("Advanced…", or an HSK range like `(HSK 3-4)`), else no level is shown.
  "All levels" means anyone can join, so it only appears when a host writes `Level: All levels`.
  No `Category:` line? It is guessed from title words (vocab, reading, listening, character, grammar, book club,
  food/holiday/geography → Culture, TopicTBD → No agenda), else Conversation.
- Visitors filter by level and category above the calendar. A page can open it pre-filtered:
  `…Calendar.html?level=beginner&category=conversation,culture` (`?level=all-levels` = only sessions open to everyone).

To keep an event off the public calendar, add `#hide` to its title or set
its visibility to *Private* in Google Calendar. Cancelled events are
skipped automatically.

### What visitors see when they open a session

Hovering (or tapping) a session on the website shows its time in the
visitor's own time zone, plus anything you choose to publish from the
description. Only these lines are ever read from the description (plus `Level:` and `Category:`):

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

**Every session is open for a trial by default** (since 24 Oct 2026): one trial per
person is enforced by email (see "Trial bookings" below), and every trial card, the calendar
pop-up and the legend say "one trial session per person". To keep a session for members
only, write `#notrial` in its description (or title). An optional topic line is shown on the trial page:

```
Topic: Tips for learning and remembering characters
```

The trial page shows the next 8 upcoming sessions (two side by side; swipe or use the arrows for more). Only
`#notrial` and the `Topic:` line are read from the description; everything
else in it (Meet links included) is ignored. Sessions that have already started can't be booked.

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
  Meta Pixel steps: clicking "Book my seat" sends `InitiateCheckout`, going on to Stripe sends `AddPaymentInfo`
  (the paid trial itself is `Purchase`, on the thank-you page). The widget only posts a message to the page;
  the Odoo site's <head> code injection must contain the listener, right after the pixel code:
  see `odoo-head-code.html` (the full <head> code: Meta Pixel, this listener, GA events and Stripe purchases).
  Embed with no inner scrolling (fits the email step on phones too):
  `height:max(480px, min(500px, calc((448px - 100vw) * 10000)), min(530px, calc((348px - 100vw) * 10000)))` + `scrolling="no"`.
- `hsk1-offer.html`: the HSK 1 Bundle offer with the NEWCOMER2026 code, for
  the Start Here thank-you page (all links open in a new tab; text, price and
  code are edited directly in the file).
- `downloads.html` + `downloads/`: the two free beginner PDFs and their
  covers, for the Start Here thank-you page. To update a PDF, upload the new
  file into `downloads/` with the same name.
- `whats-inside.html`: the two free guides with covers and contents (no
  download buttons), for the Start Here page above the email form.
- `banners/`: article banners for SEO posts: `shop.html` (WELCOME01),
  `club.html`, `start-here.html` and `characters-guide.html` (WELCOME01),
  `bootcamps.html` (all bootcamps; "Open now / Next cohort" line updates itself,
  300px frame) and `bootcamp.html?bootcamp=<page-address-ending>` (one
  bootcamp, filled in from its page: picture, status, dates, price; 320px frame).
  All links open in a new tab. `banners/snippets/` holds frame-free
  versions to paste straight into an Odoo Embed Code block (they always
  display in full, but text changes must be made in each article).
- `speak.html` + `promo/mz-logo.png` + `press/`: the Club landing page for the Meta ads (Odoo page /mz-club-ad). Sells the
  monthly membership (limited offer US$20 instead of US$25, Stripe monthly link; prices and links in CONFIG at the bottom),
  with the US$2.50 trial as a secondary link to the trial page. Sections: problem/promise + offer, press logos
  (ThinkChinese, Asiaglot, Jagiellonian University, Polyglot Conference, Expolingua Berlin), problem → solution,
  session screenshots strip, "$1 per session" + what's included, reviews, hosts, final offer.
  Clicks report to the Meta Pixel through the Odoo listener: Join = InitiateCheckout, trial link = ViewContent.
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
- `waitlist-button.html?bootcamp=<page-address-ending>`: just a "Join the
  waitlist" button. On desktop it opens the waitlist form in a small window; on
  phones in a new tab. Options: `&label=`, `&style=orange|outline|light`,
  `&align=center|left|right`. Use a 72px frame.
- `apps-script/bootcamp-waitlist.gs`: the Google Apps Script behind the
  waitlist sheet (for reference; it runs in Google, not here).
- `pronunciation-week.html`: how a Pronunciation Bootcamp week works (no
  title): onboarding call before, Mon–Fri recordings (teacher's voice, social
  media reels, C-drama scenes, street interviews and more, rotating each week),
  Saturday live class, Sunday rest, final assessment after. Days light up one by
  one; hover or tap a day. Material types are in SOURCES at the bottom. Use a
  460px frame.
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

## Chinese clothing timeline (articles)

- `fashion-timeline.html` + `fashion/f01.jpg … f21.jpg`: 21 figures of women's clothing from the Qin–Han to today,
  with dynasty bar, dates, a short explanation and the Chinese name of each style (FIGS list in the file).
  Illustrations © N. Duong (iridescentdream.com), used with permission; the credit is shown under the widget.
  `?start=9` opens on figure 9. Embed: `height:max(780px, min(900px, calc((790px - 100vw) * 1000)))` with `scrolling="no"`.

## Club reviews as message cards

- `club-reviews.html`: the Club page reviews (Matt, Nancy, Agnieszka, Debbie) shown as chat-style message cards;
  messages "arrive" one by one with a typing indicator when scrolled into view. Edit the REVIEWS list
  (`==text==` = highlighted). Four side by side from 1180px, swipe below.
  Embed: `height:740px` with `scrolling="no"` (4 cards: ~720px on wide screens and phones, less in between).

## Trial bookings (automatic invites + seat limit)

- `apps-script/trial-bookings.gs`: Google Apps Script (on the account that owns the Club calendar). Every 5 minutes it reads
  new paid trial checkouts from Stripe, adds the buyer to that session in the Club calendar (Meet access, guests can't see
  each other, no update emails to members) and emails them a confirmation with the Meet link. Log in the "Trial bookings" tab;
  set a row's Status to "refunded" to free its seat. Its web app URL tells the website how many of the 6 trial seats are taken.
- `trial.html` and the calendar read it through `SEATS_URL` and show "x seats left", "Last seat!" or "Sold out".
- The calendar's "Join as a trial" button asks for the email, checks it has never had a trial (`?check=`), then opens Stripe checkout with the email locked. The trial page does the same.
- One trial per person: trial.html asks for the email and checks it (`?check=email`) before opening Stripe with that email locked.
  Past buyers are imported into the "Past trials" tab by `setup`. A second booking that slips through (e.g. from the calendar button)
  is not invited; the buyer gets a friendly email and is refunded automatically if `REFUND_REPEATS` = yes.

## Radical game: "Shake a radical 摇部首"

`radical-game.html` + `radical-game-data.json`. The visitor shakes a mandarin ball, gets one of the 214 Kangxi radicals and writes 5 characters that contain it (typed with pinyin or handwriting input). Simplified / traditional switch (讠/言, 钅/金, 门/門…).

- A character counts when the radical appears anywhere in it (from the CJK decomposition data), in the chosen script, among the ~6,000 most common characters. Right character in the other script = "Traditional form" / "Simplified form", not counted.
- Rare radicals (fewer than 5 common characters) ask for fewer boxes; they only come up once the common ones are collected.
- 5/5 collects the radical. The collection (214 grid, tap one to play it) is saved in the visitor's browser.
- `?radical=85` opens on a radical, `&script=t` in traditional.
- **Draw mode** (handwriting): a drawing pad replaces the ball; after each stroke it suggests 6 characters (chosen script first), tap one to fill the box. Recognition runs in the browser with HanziLookupJS (`vendor/hanzilookup/`, GPL v3 code + Arphic-licensed data, ~0.8 MB loaded only when Draw is chosen). The Type/Draw choice is remembered.
- Rebuild the data: `cd scripts/radical-game && npm install hanzi opencc-js && node build.js 6000 ../../radical-game-data.json` (radicals.txt = the 214 radicals, pinyin, meaning, variant forms; needs the writing-sheets `dict.json` for pinyin and hint order).

Odoo embed (taller on phones, where the ball sits above the boxes):

```html
<iframe src="https://antoinesjc.github.io/Mandarin-Zest-Class-Calendar/radical-game.html" title="Shake a radical game" style="width:100%;height:max(780px, min(1200px, calc((1100px - 100vw) * 1000)));border:0;display:block" scrolling="no" loading="lazy"></iframe>
```

## Session screenshots strip

- `session-photos.html` + `sessions/s01–s04.jpg`: screenshots of Club sessions sliding from right to left in an endless loop
  (hover or tap pauses). Add pictures to `sessions/` (2:1, 800×400) and to the PHOTOS list in the file.
  Embed: `height:max(180px, min(250px, calc((100vw - 700px) * 1000)))` with `scrolling="no"`.

- Auto height: `speak.html` posts `{mz:"height", h}` to the Odoo page, and the site's <head> listener (same script as the
  pixel steps, see trial.html above) sets that frame's height, so text changes never need a new embed line.
  The listener: see `odoo-head-code.html`.

## Trial booked (thank-you page)

- `trial-booked.html`: the page people land on after paying for a US$2.50 trial (Stripe payment link → "After payment" →
  redirect to the Odoo page that embeds it). "You're booked!", the 3 next steps (Meet link by email within 5 minutes,
  join a few minutes early, speak up), a Contact us link, and a Club card (US$25/month → Club page).
  Embed (full page, no inner scroll): see the iframe line at the top of the file.
  The Meta Pixel "Purchase" event goes in a separate Embed Code block on the same Odoo page:
  `<script>fbq('track','Purchase',{value:2.50,currency:'USD'});</script>` (needs the pixel base code on the site).

## Live session scene

- `call-scene.html`: animated video call (host + three learners drawn as flat illustrations) where people take turns
  talking: speech bubble pops up, mouth moves, green "speaking" ring and mic bars. Blinking and small movements in
  between. Transparent background; the call keeps its shape and scales to fit the frame. Calm (no animation) for
  visitors who turn off motion. Used in the hero of `speak.html`.
  Club page embed: `<iframe src="https://antoinesjc.github.io/Mandarin-Zest-Class-Calendar/call-scene.html" title="A live Mandarin Zest Club session" scrolling="no" style="width:100%;max-width:520px;aspect-ratio:520/432;border:0;display:block;margin:0 auto"></iframe>`
  (no fixed height needed). To change what people say, edit the four bubble texts in the file.

## Club App highlight

- `club-app.html`: presents the Mandarin Zest Club App (six features + an animated phone showing the app's home screen:
  floating phone, XP bar filling, "I'm in" buttons ticking, +20 XP / 红包 / "Notes are up!" chips popping in). Starts when scrolled into view.
- Homepage: default, with a "Discover the Club ↗" button to the Club page.
  Embed: `height:max(720px, min(1260px, calc((1000px - 100vw) * 10000)))`, `scrolling="no"`.
- Club page: `club-app.html?cta=none` (no button).
  Embed: `height:max(700px, min(1180px, calc((1000px - 100vw) * 10000)))`, `scrolling="no"`.

## Our team (floating portraits)

- `team.html` + `team/t1–t7.png`: "Our materials are created by a team of advanced Chinese learners and native speakers",
  round portraits floating gently (each at its own pace), and a "Meet the team ↗" button to the About us page (new tab).
  Desktop: 7 in a row. Phones: 2 rows of 3 (the portrait marked `phone: false` in the TEAM list is hidden).
  Embed: `height:600px` with `scrolling="no"`.

## New HSK vocabulary page (/the-new-hsk-vocabulary-lists-2026)

- `hsk-levels.html`: interactive "New HSK 3.0 vs old HSK 2.0" table. Bars per level (HSK 3.0 by band colour, HSK 2.0 grey),
  switch "Total words" / "New at this level", tap a level for the details and "Open the HSK n vocab list ↗" (new tab).
  Phones: the details open under the chosen level. Numbers and links: LEVELS in the file. `?level=4` opens on HSK 4.
  Bottom: email capture "Get all the vocab lists from HSK 1 to 6 at once" (Start Here sheet, source `hsk-levels | all 1-6`)
  → "Download all 6 lists (ZIP)" (`downloads/hsk/New-HSK-1-to-6-Vocab-Lists-Mandarin-Zest.zip`, rebuild it when a PDF changes) + one link per PDF.
  Embed: `height:max(850px, min(1230px, calc((800px - 100vw) * 10000)))`, `scrolling="no"`.
- `hsk-pdfs.html`: "Get all the new HSK vocab lists at once". Optional level chips + email + consent → Start Here sheet
  (source `hsk-vocab-pdfs | <level>`) → download buttons appear (remembered in the browser). PDFS list in the file;
  until the PDFs are added the buttons open the level pages. `ALL_URL` = one file with everything (zip or combined PDF).
  Embed: `height:max(440px, min(590px, calc((960px - 100vw) * 10000)))`, `scrolling="no"`.
- `hsk-club.html`: dark "Now use them out loud in the Mandarin Zest Club" strip; vocab cards light up as a live chat uses them.
  "Try a session ↗" (trial page) + "Discover the Club ↗". SCENES in the file.
  Embed: `height:max(480px, min(700px, calc((960px - 100vw) * 10000)))`, `scrolling="no"`.
- `hsk-finder.html`: "Not sure which list you need?" 4 sentences (HSK 1 → 6), "Yes, I get it" / "Not really" (pinyin and
  meaning on request) → suggested list + full level test (new tab). STEPS and RESULT in the file.
  Embed: `height:max(320px, min(500px, calc((960px - 100vw) * 10000)))`, `scrolling="no"`.

## Mailing list bar (thin)

- `subscribe.html`: one-line "Stay in the loop on Chinese" bar: email + consent → Start Here sheet (source `subscribe-bar | <page>`).
  `?bg=f8dacd` for another background colour (default mint #e6f1e1).
  Embed: `height:max(86px, min(134px, calc((900px - 100vw) * 10000)))`, `scrolling="no"`.
- Blog posts: `subscribe.html?layout=blog` (narrow, stacked: title, email + button, consent).
  Embed: `height:max(146px, min(180px, calc((520px - 100vw) * 10000)))`, `scrolling="no"`.

## Google Analytics events (GA4 G-Y4ESTYK0D6)

Widgets post `{mz:"track", ga:{event, params}}` to the Odoo page; the listener in `odoo-head-code.html` sends it to GA
(GA follows the cookie banner through Odoo's consent mode). No emails or other personal data are ever sent.
- `generate_lead` (param `lead_source`): subscribe-bar, hsk-vocab-pdfs, bootcamp-waitlist, start-here, hsk-test,
  writing-sheets, stroke-order, calculator, pinyin, zhuyin
- `begin_checkout`: Club pricing cards (club-monthly / club-yearly), trial booking, writing sheets US$9
- `add_payment_info`: trial email step → Stripe (trial.html and the calendar)
- `purchase`: writing sheets (when the tool sees the payment); Club and trial through the Stripe redirect
  `?mzp=club-monthly|club-yearly|trial&sid={CHECKOUT_SESSION_ID}` on a mandarinzest.com page
- `hsk_test_complete` (hsk_level, score), `writing_sheet_made`

## Shop banner (above the products)

- `shop-banner.html` + `shop/`: "Built by advanced learners, checked by professional native teachers" on the left, the current
  discount on the right (mascot, "30% off the entire shop", dashed code, "Copy code" button). OFFERS in `shop/offers.js`:
  each offer has from/until dates (Taiwan time, both days included); outside them the REGULAR offer shows (WELCOME01, 10%).
  Halloween: HALLOWEEN26, 30%, until 31 Oct 2026. Preview another day with `?date=2026-11-01`.
  Mascot pictures: white-outlined PNGs in `shop/`.
  Embed: `height:max(150px, min(250px, calc((680px - 100vw) * 10000)))`, `scrolling="no"`, `allow="clipboard-write"`.
- Offers (codes, dates, mascots) live in `shop/offers.js`, shared by the strip, the pop-up and the blog banners
  `banners/shop.html` and `banners/characters-guide.html` (code, % in the tap-to-copy box, guide price, small seasonal mascot).
  The pasted HTML snippets in `banners/snippets/` can't update themselves and still say WELCOME01.
- Website pop-up: `shop-popup.html`: offer + code + Copy (top, dark, mascot), "Our materials" with three covers
  (PRODUCTS in the file: `shop/p-*.jpg`, cut from the shop page), "Built by advanced learners, checked by professional
  native teachers" + "Shop now ↗" (bottom). Fixed 4:5 shape that scales with the frame. (`shop-banner.html?layout=square` redirects here.)
  Embed: `width:100%;max-width:440px;aspect-ratio:4/5;border:0;display:block;margin:0 auto`, `scrolling="no"`, `allow="clipboard-write"`.

## Club pop-up (website pop-up)

- `club-popup.html`: same 4:5 card shape as `shop-popup.html`. Real session screenshot (`sessions/s02.jpg`, slow zoom, "LIVE ON
  GOOGLE MEET"), "Speak Chinese every week", three points (20+ sessions a month in small groups, sorted by level HSK 1 to
  advanced, the Club app), "US$25/month · about $1.25 a session", buttons "Try a session ↗ (US$2.50 · one per person)" →
  trial page and "Discover the Club ↗" → Club page. Price and links: CONFIG in the file.
  Embed: `width:100%;max-width:440px;aspect-ratio:4/5;border:0;display:block;margin:0 auto`, `scrolling="no"`.

## Free PDF for an email (any PDF)

- `free-pdf.html?pdf=<id>`: cover + title + email + consent → Start Here sheet (source `free-pdf | <id>`) → "Download the PDF"
  (+ "Practise them out loud: try a Club session ↗"). Remembers people who already signed up (per PDF, in the browser).
- The PDFs are listed in `downloads/free-pdfs.js` (title, text, file, cover). PDFs and covers live in `downloads/hsk/`
  (cover = page 1 rendered as JPG). Now: `hsk-1` to `hsk-6`, `phrases` (Essential Mandarin Phrases) , `adult` (Adult Vocabulary in Chinese) and `slang` (20 Chinese slang words), all in downloads/guides/. Optional `after:` = text shown after sign-up. `hsk-pdfs.html` (all lists) links to the same files.
- Embed: `height:max(265px, min(410px, calc((640px - 100vw) * 10000)))`, `scrolling="no"`.

## Dorota's free guide (email for PDF)

- `dorota-guide.html`: "Chinese learning advice I wish someone gave me 10 years ago" (15-page PDF by Dorota). Cream card with
  pink circle (guide's look), floating cover; inside pages (p2–p4) fan out from behind on hover (phones: a peek every few
  seconds, and on tap). Lessons as tags, Dorota's photo + line, email + consent → Start Here sheet (source
  `free-pdf | dorota-guide`) → "Download the guide", Club trial link, Instagram @dorota_bolan.
  Files in `downloads/guides/` (PDF, dorota-p1–p4.jpg rendered from the PDF, avatar).
  Embed: `height:max(345px, min(470px, calc((800px - 100vw) * 10000)))`, `scrolling="no"`.

## Trial board (trial page)

- `trial-board.html`: every upcoming session open for a trial, as a board grouped by week (no swiping). Level filter
  (Any level / Beginner / Intermediate / Advanced / All levels), next 14 days first, "Show more sessions" adds 14 days,
  up to 2 months ahead (MAX_MONTHS in the file).
  Same booking flow as `trial.html` (email check, one trial per person, Stripe, seats left).
- Host photo on each card: `hosts.json` (name → photo), built by `scripts/build_hosts.py` from the "Meet your hosts" cards on
  mandarinzest.com/mandarin-zest-club (photo + bold name) at every calendar sync. New host = add a card there with the
  same first name as in the events' `Host:` line. Unknown names show their initial; no host shows the Mandarin Zest logo.
- Link to one session (no button on the cards, at Antoine's request; the id is the UTC start time) →
  `https://www.mandarinzest.com/mandarin-zest-club-trial-session?session=2026-11-05T22-00` (start time in UTC).
  The board pins that session at the top ("YOUR SESSION"). It reads the page address through the embed's
  `referrerpolicy="no-referrer-when-downgrade"` (no Odoo code needed), or through the `hello` line of `odoo-head-code.html`;
  with the `scrolltop` line the page also scrolls to the board. A past session shows "This session has passed".
- Height: resizes itself through the <head> listener (`{mz:"height"}`). Embed with a starting height:
  `<iframe src="…/trial-board.html" referrerpolicy="no-referrer-when-downgrade" style="width:100%;border:0;height:1700px" scrolling="no"></iframe>`.
