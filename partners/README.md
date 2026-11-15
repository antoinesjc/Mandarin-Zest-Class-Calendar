# Mandarin Zest Club partner dashboard

The page partners use to see their Club referrals, commissions and balance.
It is embedded in an unindexed page on mandarinzest.com.

## Files

| File | What it is | Where it runs |
| --- | --- | --- |
| `index.html` | The dashboard page (design, texts, login) | GitHub Pages |
| `mz-mark.png` | The orange mascot used as the logo | GitHub Pages |
| `apps-script/Code.gs` | Stripe sync, sheet logic and the API the page calls | Google Apps Script (copy) |

## Editing

- **Design or texts:** edit `index.html` and commit. GitHub Pages publishes it within a minute or two.
- **Preview without logging in:** open `index.html?demo=1` (sample data). Add `&embed=1` to see it as it looks inside the website.
- **Script logic (commissions, rules, sync):** edit `apps-script/Code.gs` here, paste the whole file into the Apps Script project, then
  Deploy → Manage deployments → pencil → Version: New version → Deploy. This keeps the same API URL.

## Settings

- `API_URL` at the top of the script block in `index.html`: the Apps Script web app URL (ends in `/exec`).
- `CONFIG` at the top of `Code.gs`: payment link, program start date, rates, payout minimum, contact email.
- The Stripe key is never in this repo: it lives in Apps Script → Project Settings → Script properties (`STRIPE_KEY`).

## How the login works

The page sends the partner's email and discount code to the Apps Script API, which checks them against the
Partners tab and returns only that partner's numbers. No member names, emails or payment details are ever sent.
After 8 wrong attempts, an email is blocked for 15 minutes.
