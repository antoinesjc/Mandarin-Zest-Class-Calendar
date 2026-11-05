# Mandarin Zest brand kit

Everything needed to make something that looks like Mandarin Zest: logos, mascots, colours, fonts and style rules.
Taken from the website (mandarinzest.com), the PDFs and the widgets. Last updated 5 Nov 2026.

All files are online (public, no login), so any tool or conversation can load them:
**https://antoinesjc.github.io/Mandarin-Zest-Class-Calendar/brand/** + file name.
Source: folder `brand/` in the GitHub repo antoinesjc/Mandarin-Zest-Class-Calendar.

## Logos

| File | What it is | Use |
|---|---|---|
| `logo-wordmark.png` (435×145, transparent) | "MANDARIN ZEST" in orange, 中文皮 in green underneath, mandarin icon on the right. The website header logo | Headers, PDF covers, email headers |
| `mascot-icon.png` (240×183, transparent) | The mandarin on its own (smiling, two leaves) | Small logo, avatars, favicons, "no host" placeholder |
| `club-app-icon-512.png` | Club app icon (512×512) | App and social profile pictures |
| `favicon.ico` | Website favicon | Browser tabs |

The Chinese name is **中文皮** (shown under the wordmark). The brand is written **Mandarin Zest** (two words, both capitalised).

## Mascots (the mandarin character)

A round orange mandarin with a green leaf, simple black outline, small smile, often wearing a green robe.
Used on every tool and PDF. Transparent PNGs:

| File | Pose | Used on |
|---|---|---|
| `mascot-laptop.png` | On a laptop with a coffee | Learning calculator, all HSK vocab list PDF covers |
| `mascot-reading.png` | Reading a book | HSK level test |
| `mascot-reading-outlined.png` | Reading, with a white sticker outline | Shop banner (regular offer), dark backgrounds |
| `mascot-writing.png` | Holding a 平安喜 scroll | Stroke order tool, writing sheet maker |
| `mascot-head.png` | Head only | Pinyin and zhuyin practice |
| `mascot-halloween-outlined.png` | Witch hat + black cat, white outline | Halloween 2026 campaign (seasonal) |
| `mascot.svg` | Vector mandarin | Club app |

Rule used so far: on dark or busy backgrounds, use an **outlined** version (white sticker border).

## Colours

| Role | Hex | Notes |
|---|---|---|
| **Orange** (brand) | `#f37a48` | Main buttons, highlights, prices. Logo wordmark is ~`#f27849` |
| Orange hover | `#e2632f` | |
| **Green** (brand) | `#1b6f1b` | Eyebrow labels, ticks, success, green buttons ("Book my seat") |
| Logo green | `#21881f` | The 中文皮 under the logo, HSK PDF titles |
| Ink | `#2a2420` | Text and dark sections (warm near-black, never pure black) |
| Muted text | `#5c4f47` | Secondary text |
| Soft grey | `#8a7d74` | Small labels |
| Brick | `#a8431a` | Orange-red text on light backgrounds (eyebrows, warnings) |
| **Mint** | `#e6f1e1` | Light green cards and sections |
| **Peach** | `#f8dacd` | Light orange cards and sections |
| Cream | `#fffaf6` | Page / tool background |
| Sand | `#faf6f3` | Subtle panels |
| Line | `#efe2d9` | Borders, dividers |

The look: **mint + peach + cream** backgrounds, **orange** for actions, **green** for labels and trust, **warm dark ink** for text and for
dark promo blocks (e.g. the shop banner's deal side). The PDF covers use a mint background with soft peach circles.

HSK bands: Elementary (HSK 1–3) `#4f9a4f`, Intermediate (4–6) `#e0835f`, Advanced (7–9) `#d5602f`.

Club session categories: Conversation `#b4512a`, Culture `#a63d6b`, Grammar `#3f63a3`, Characters `#7d5a8c`, Book club `#8a5a2b`,
Listening `#2a7480`, Reading `#3f6d5e`, Vocabulary `#8f6418`, No agenda `#6b6559`.

Ready-made files: `tokens.css` (CSS variables `--mz-…`) and `tokens.json`.

## Fonts

- **Outfit** (Google Fonts, weights 400–800): everything. Headings 800 (extra bold), body 400–500, buttons 800.
- **Noto Sans SC** (500, 700): Chinese characters. Noto Serif SC for a more traditional feel (calendar, banners).
- Exception: Dorota's guide uses **Montserrat** (700/800) with pink `#b8325f` and blush `#f2c6d1`, to match that PDF.

## Shapes and style

- Rounded everything: cards 20px radius, buttons and tags fully rounded (pills).
- Soft shadows (`0 8px 24px rgba(42,36,32,.06)`), no hard borders.
- Small uppercase **eyebrow** above titles: 12px, extra bold, letter-spacing .09em, green or brick
  (e.g. "HOW OUR MATERIALS ARE MADE", "FREE PDF").
- Buttons: orange pill with dark ink text ("Get the PDF ↓", "Try a session ↗"); green pill with white text for booking.
- Links that leave the page end with ↗ and open in a new tab. Downloads end with ↓.
- Gentle motion only (floating mascot, small hover lifts). No gradients-heavy or neon looks.

## Voice

- Friendly, plain English, short sentences. Speak to the learner ("you").
- Never use em dashes (—); use commas, periods or parentheses.
- No corporate filler, no invented stories or fake reviews.
- Key messages used on the site: "Built by advanced learners, checked by professional native teachers";
  "Speak Chinese every week, with real people"; "One trial session per person".

## Offers and codes (for reference; check before using)

- Regular shop code **WELCOME01** (10% off). Seasonal codes live in `shop/offers.js`.
- Club: US$25/month or US$250/year; trial session US$2.50 (one per person).
