#!/usr/bin/env python3
"""
Build bootcamps.json for the Bootcamps page from the bootcamp pages on
mandarinzest.com.

How it finds bootcamps: every page in the website's sitemap whose address
contains "bootcamp" (except the Bootcamps page itself and terms pages).

What it reads on each page: the section that holds the "AT A GLANCE" box.
  - Labelled lines in that box, e.g.
        Dates: Sat 21 Nov – Sun 6 Dec
        Time: 3 PM CET · 9 AM ET · 10 PM Taiwan
        Format: 6 live online sessions, Sat & Sun
        Level: HSK 2–3
        Group: Max 6 students
        Early bird: US$111 until 25 Oct
        Price: US$139            (or "Standard:")
        Club members: US$92      (or "Club:")
        Sign up by: 15 Nov
        Status: Open / Waitlist / Sold out / Coming soon   (optional)
        Summary: one sentence for the card                  (optional)
    "TBD" or a missing line shows as TBD on the card.
  - The section's background picture (used as the card picture).
  - Prices: if the box has no price lines but the page embeds one of our
    *-pricing.html widgets, the prices come from that widget's CONFIG block.

Usage:
  python scripts/build_bootcamps.py
  python scripts/build_bootcamps.py --html-dir saved_pages/   # local testing
"""

import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse

SITE = "https://www.mandarinzest.com"
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "bootcamps.json"
SKIP_WORDS = ("terms", "condition", "privacy")

LABELS = {
    "dates": ["dates", "date", "next cohort", "next enrollment", "next enrolment"],
    "time": ["time", "class time"],
    "format": ["format"],
    "level": ["level"],
    "group": ["group", "group size"],
    "early": ["early bird", "early-bird"],
    "price": ["price", "standard", "standard price", "regular price"],
    "club": ["club members", "club member", "club", "club price"],
    "signup": ["sign up by", "sign-up by", "register by", "registration closes"],
    "status": ["status"],
    "summary": ["summary"],
}
ALL_LABELS = sorted({l for v in LABELS.values() for l in v}, key=len, reverse=True)
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "mz-bootcamps-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def to_lines(fragment: str):
    fragment = re.sub(r"<(script|style)\b.*?</\1>", "", fragment, flags=re.S | re.I)
    fragment = re.sub(r"<\s*br\s*/?>|</(p|div|li|h\d|span|section|strong|b)>", "\n", fragment, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", fragment)).replace("\xa0", " ")
    return [re.sub(r"\s+", " ", l).strip() for l in text.split("\n") if l.strip()]


def is_tbd(v: str) -> bool:
    return not v or re.fullmatch(r"(tbd|tba|to be (announced|decided|confirmed)|—|-)", v.strip(), re.I) is not None


def parse_glance(lines):
    """Read 'Label: value' pairs; the value may sit on the next line(s)."""
    found = {}
    label_re = re.compile(r"^(%s)\s*:?\s*(.*)$" % "|".join(re.escape(l) for l in ALL_LABELS), re.I)
    i = 0
    while i < len(lines):
        m = label_re.match(lines[i])
        has_colon = ":" in lines[i][: len(m.group(1)) + 3] if m else False
        if m and (has_colon or lines[i].lower().startswith(("sign up by", "early bird"))):
            label, value = m.group(1).lower(), m.group(2).strip()
            # value continues on following lines until the next label
            j = i + 1
            while j < len(lines) and not label_re.match(lines[j]) and len(value) < 160 and (not value or value.endswith((":", "·", ",", "+")) or re.fullmatch(r"\d+", value)):
                value = (value + " " + lines[j]).strip()
                j += 1
            key = next(k for k, ls in LABELS.items() if label in ls)
            found.setdefault(key, value.strip(" :"))
            i = j
        else:
            i += 1
    return found


def parse_day(text: str, today: date, after: date = None):
    """'21 Nov', 'Sat 21 Nov 2026', 'November 21' → date (year guessed if missing)."""
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(\d{4})?", text) or None
    if m:
        d, mon, y = int(m.group(1)), m.group(2)[:3].lower(), m.group(3)
    else:
        m = re.search(r"([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?", text)
        if not m:
            return None
        mon, d, y = m.group(1)[:3].lower(), int(m.group(2)), m.group(3)
    if mon not in MONTHS:
        return None
    if y:
        return date(int(y), MONTHS[mon], d)
    ref = after or (today - timedelta(days=120))
    for year in (ref.year, ref.year + 1):
        try:
            cand = date(year, MONTHS[mon], d)
        except ValueError:
            return None
        if cand >= ref:
            return cand
    return None


def month_only(text: str):
    m = re.match(r"^\s*([A-Za-z]{3,9})\b", text or "")
    if m and m.group(1)[:3].lower() in MONTHS and not re.search(r"\d{1,2}\s+[A-Za-z]{3}|[A-Za-z]{3,9}\s+\d{1,2}\b", text):
        return m.group(1).capitalize()
    return ""


def money(text: str) -> str:
    m = re.search(r"(US\$|USD\s?|\$|€|EUR\s?|£|NT\$)\s?(\d[\d,.]*)", text or "")
    return (m.group(1).replace("USD", "US$").replace("EUR", "€").strip() + m.group(2)) if m else ""


def pricing_widget_config(page_html: str):
    """If the page embeds one of our *-pricing.html widgets, read its CONFIG."""
    m = re.search(r'<iframe[^>]+src="[^"]*Mandarin-Zest-Class-Calendar/([\w-]*pricing[\w-]*\.html)"', page_html, re.I)
    if not m or m.group(1) == "pricing.html":       # pricing.html is the Club membership
        return {}
    f = ROOT / m.group(1)
    if not f.exists():
        return {}
    src = f.read_text(encoding="utf-8")
    cfg = {}
    for key in ("earlyPrice", "standardPrice", "clubPrice", "earlyEnds", "earlyEndsLabel", "registrationClosesLabel"):
        mm = re.search(r'\b%s\s*:\s*"([^"]*)"' % key, src)
        if mm:
            cfg[key] = mm.group(1)
    return cfg


def summary_from(lines, title):
    for l in lines:
        if l.upper().startswith("AT A GLANCE"):
            break
        if 60 <= len(l) <= 260 and "US$" not in l and l != title and not l.endswith(":"):
            return l
    return ""


def build_one(url: str, page: str, today: date):
    up = page.upper()
    i = up.find("AT A GLANCE")
    if i < 0:
        print(f"  skip (no AT A GLANCE box): {url}")
        return None
    a = page.rfind("<section", 0, i)
    b = page.find("</section>", i)
    section = page[a:b] if a >= 0 and b > 0 else page[max(0, i - 4000): i + 4000]

    title_m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]*)"', page) or re.search(r"<title>(.*?)</title>", page, re.S)
    title = html.unescape(title_m.group(1)).split("|")[0].strip() if title_m else url.rsplit("/", 1)[-1]

    bg = ""
    for m in re.finditer(r"background-image:\s*url\(\s*(?:&#34;|&quot;|[\"'])?([^\"')&]+)", section):
        if "/shape/" not in m.group(1):
            bg = urljoin(SITE, html.unescape(m.group(1)))
            break

    lines = to_lines(section)
    g = parse_glance(lines[next((k for k, l in enumerate(lines) if l.upper().startswith("AT A GLANCE")), 0):])
    for k in list(g):
        if is_tbd(g[k]) or re.fullmatch(r"(tbd|tba)\b.*", g[k], re.I):
            g[k] = ""

    item = {
        "url": url,
        "title": title,
        "summary": g.get("summary") or summary_from(lines, title),
        "image": bg,
        "dates": g.get("dates", ""),
        "time": g.get("time", ""),
        "format": g.get("format", ""),
        "level": g.get("level", ""),
        "group": g.get("group", ""),
        "status": g.get("status", "").strip().lower(),
    }
    raw_dates = g.get("dates", "")
    tbd_in_dates = bool(re.search(r"\b(tbd|tba)\b", raw_dates, re.I))
    item["dates"] = re.sub(r"\s*\b(TBD|TBA)\b\s*", " ", raw_dates, flags=re.I).strip()
    item["month"] = month_only(item["dates"])
    start = parse_day(item["dates"], today) if item["dates"] and not item["month"] else None
    item["start"] = start.isoformat() if start else ""
    item["datesTbd"] = tbd_in_dates or not item["dates"]

    # prices: the box first, then an embedded pricing widget
    cfg = pricing_widget_config(page)
    early_line = g.get("early", "")
    item["early"] = money(early_line) or cfg.get("earlyPrice", "")
    early_end = parse_day(re.split(r"until|till|by|before", early_line, maxsplit=1, flags=re.I)[-1], today) if re.search(r"until|till|by|before", early_line, re.I) else None
    if not early_end and cfg.get("earlyEnds"):
        early_end = date.fromisoformat(cfg["earlyEnds"][:10])
    item["earlyEnds"] = early_end.isoformat() if early_end else ""
    item["price"] = money(g.get("price", "")) or cfg.get("standardPrice", "")
    item["club"] = money(g.get("club", "")) or cfg.get("clubPrice", "")
    signup = parse_day(g.get("signup", ""), today, after=None) if g.get("signup") else None
    if not signup and cfg.get("registrationClosesLabel"):
        signup = parse_day(cfg["registrationClosesLabel"], today)
    if signup and start and signup > start:
        signup = date(signup.year - 1, signup.month, signup.day)
    item["signupBy"] = signup.isoformat() if signup else ""
    return item


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html-dir", help="read saved pages (<slug>.html) instead of the website")
    ap.add_argument("--output", default=str(OUTPUT))
    args = ap.parse_args()
    today = date.today()

    if args.html_dir:
        pages = {f"{SITE}/{p.stem}": p.read_text(encoding="utf-8") for p in Path(args.html_dir).glob("*.html")}
    else:
        sitemap = fetch(SITE + "/sitemap.xml")
        urls = sorted(set(re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", sitemap)))
        pages = {}
        for u in urls:
            path = urlparse(u).path.lower().rstrip("/")
            if "bootcamp" not in path or path in ("/bootcamps", "/bootcamp") or any(w in path for w in SKIP_WORDS):
                continue
            pages[u] = fetch(u)

    items = []
    for url, page in pages.items():
        item = build_one(url, page, today)
        if item:
            items.append(item)
            print(f"  {item['title']}: dates={item['dates'] or 'TBD'} start={item['start'] or '-'} signup={item['signupBy'] or '-'} prices={item['early'] or '-'}/{item['price'] or '-'}/{item['club'] or '-'}")

    if not items and not args.html_dir:
        sys.exit("No bootcamp pages found; keeping the old bootcamps.json.")
    items.sort(key=lambda x: (x["start"] or "9999", x["title"]))
    Path(args.output).write_text(json.dumps({"bootcamps": items}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} bootcamps to {args.output}")


if __name__ == "__main__":
    main()
