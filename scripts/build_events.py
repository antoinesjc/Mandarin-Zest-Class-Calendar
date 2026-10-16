#!/usr/bin/env python3
"""
Build events.json for the public Mandarin Zest class calendar from the
private Google Calendar feed.

PRIVACY: the Google Calendar feed contains Google Meet links, descriptions,
locations and attendee emails. This script copies ONLY an allowlist of
fields (date, title, level, category, start times) into events.json.
Anything that looks like a link is also scrubbed from titles, in case a
host pastes a Meet link into the session name.

Usage:
  CALENDAR_ICS_URL="<secret iCal address>" python scripts/build_events.py
  python scripts/build_events.py --ics-file sample.ics      # local testing
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "events.json"

# Time zones shown on each session pill. The event's date is taken in the
# first zone (Europe), matching how the calendar has always been written.
EU_TZ = ZoneInfo("Europe/Brussels")
US_TZ = ZoneInfo("America/New_York")

# How far back and ahead to publish.
MONTHS_BACK = 1
MONTHS_AHEAD = 6

# Category keys must match CATEGORIES in the HTML page.
# 1) A host can force a category with a tag in the title, e.g. "#advanced".
# 2) Otherwise the first keyword rule that matches the title wins.
# 3) Otherwise it is inferred from the HSK level, or falls back to "general".
CATEGORY_TAGS = {"advanced", "intermediate", "beginner", "native", "character", "general"}
KEYWORD_RULES = [
    ("native", ["native"]),
    ("advanced", ["advanced"]),
    ("intermediate", ["intermediate", "hsk review", "listening"]),
    ("character", ["character", "bopomofo", "zhuyin", "stroke"]),
    ("beginner", ["beginner", "vocab"]),
]

URL_RE = re.compile(r"(https?://\S+|www\.\S+|\b[\w.-]+\.(?:com|google\.com|meet|zoom\.us|us|io|net|org)/\S*)", re.I)
LEVEL_RE = re.compile(r"\(?\s*\b(HSK|TOCFL)\s*(\d)(?:\s*[-–~]\s*(\d))?\s*\)?", re.I)
TAG_RE = re.compile(r"#(\w+)")
HIDE_TAGS = {"hide", "private"}
TRIAL_TAG = "trial"

# Trial sessions only: two optional lines in the event description.
#   Topic: <one line shown on the trial page>
#   Book: https://buy.stripe.com/...   (the session's own Stripe payment link)
# Nothing else from the description is ever read. The booking link must be a
# Stripe payment link; any other link (Meet included) is ignored.
STRIPE_LINK_RE = re.compile(r"https://buy\.stripe\.com/[A-Za-z0-9_]+")
TOPIC_RE = re.compile(r"^\s*topic\s*:\s*(.+)$", re.I | re.M)


def description_text(raw: str) -> str:
    """Google sends descriptions as HTML: turn breaks into newlines, drop tags."""
    text = re.sub(r"<\s*br\s*/?>|</p>|</div>|</li>", "\n", raw or "", flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return (text.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", '"'))


def trial_details(raw_description: str):
    """Return (topic, book_url) from a trial session's description."""
    text = description_text(raw_description)
    topic = ""
    m = TOPIC_RE.search(text)
    if m:
        topic = URL_RE.sub("", m.group(1))
        topic = re.sub(r"\s{2,}", " ", topic).strip()[:200]
    m = STRIPE_LINK_RE.search(raw_description or "")
    return topic, (m.group(0) if m else "")


def fetch_ics(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "mz-calendar-sync"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def clean_title(raw: str):
    """Return (title, level, tags) with links, level and tags pulled out."""
    text = URL_RE.sub("", raw or "")
    tags = {t.lower() for t in TAG_RE.findall(text)}
    text = TAG_RE.sub("", text)

    level = ""
    m = LEVEL_RE.search(text)
    if m:
        name, lo, hi = m.group(1).upper(), m.group(2), m.group(3)
        level = f"{name} {lo}-{hi}" if hi else f"{name} {lo}"
        text = text[: m.start()] + text[m.end():]

    text = re.sub(r"^\s*MZ\s*Club\b[\s:\-–·|]*", "", text, flags=re.I)  # "MZ Club - ..." prefix
    text = re.sub(r"\(\s*\)", "", text)            # empty brackets left behind
    text = re.sub(r"\s{2,}", " ", text).strip(" -–·|,")
    return text.strip(), level, tags


def pick_category(title: str, level: str, tags: set) -> str:
    for tag in tags:
        if tag in CATEGORY_TAGS:
            return tag
    low = title.lower()
    for cat, words in KEYWORD_RULES:
        if any(w in low for w in words):
            return cat
    nums = [int(n) for n in re.findall(r"\d", level)]
    if nums:
        top = max(nums)
        return "advanced" if top >= 5 else "intermediate" if top >= 3 else "beginner"
    return "general"


def fmt_clock(dt: datetime) -> str:
    hour = dt.hour % 12 or 12
    suffix = "am" if dt.hour < 12 else "pm"
    return f"{hour}{suffix}" if dt.minute == 0 else f"{hour}:{dt.minute:02d}{suffix}"


def month_shift(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    return date(d.year + y, m + 1, 1)


def build(ics_bytes: bytes):
    cal = icalendar.Calendar.from_ical(ics_bytes)
    today = date.today()
    start = month_shift(today.replace(day=1), -MONTHS_BACK)
    end = month_shift(today.replace(day=1), MONTHS_AHEAD + 1)

    out = []
    for ev in recurring_ical_events.of(cal).between(start, end):
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        if str(ev.get("CLASS", "PUBLIC")).upper() in {"PRIVATE", "CONFIDENTIAL"}:
            continue

        title, level, tags = clean_title(str(ev.get("SUMMARY", "")))
        if not title or tags & HIDE_TAGS:
            continue

        dtstart = ev.decoded("DTSTART")
        times = []
        if isinstance(dtstart, datetime):
            if dtstart.tzinfo is None:          # floating time: treat as Europe
                dtstart = dtstart.replace(tzinfo=EU_TZ)
            eu = dtstart.astimezone(EU_TZ)
            us = dtstart.astimezone(US_TZ)
            if eu.hour < 6:
                # Overnight in Europe = an Americas evening session:
                # file it under the US date and show only the US time.
                day = us.date()
                times = [{"flag": "us", "time": f"{fmt_clock(us)} ET"}]
            else:
                day = eu.date()
                times = [
                    {"flag": "eu", "time": f"{fmt_clock(eu)} {eu.tzname()}"},
                    {"flag": "us", "time": f"{fmt_clock(us)} ET"},
                ]
            sort_key = eu.isoformat()
            start_utc = dtstart.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:                                    # all-day event
            day = dtstart
            sort_key = day.isoformat()
            start_utc = ""

        # ALLOWLIST: these are the only fields that ever leave the feed.
        item = {
            "date": day.isoformat(),
            "title": title,
            "level": level,
            "cat": pick_category(title, level, tags),
            "times": times,
            "start": start_utc,
            "_sort": sort_key,
        }
        if TRIAL_TAG in tags:
            topic, book = trial_details(str(ev.get("DESCRIPTION", "")))
            item.update({"trial": True, "topic": topic, "book": book})
        out.append(item)

    out.sort(key=lambda e: (e["_sort"], e["title"]))
    for e in out:
        del e["_sort"]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ics-file", help="read a local .ics file instead of the URL")
    ap.add_argument("--output", default=str(OUTPUT))
    args = ap.parse_args()

    if args.ics_file:
        data = Path(args.ics_file).read_bytes()
    else:
        url = os.environ.get("CALENDAR_ICS_URL", "").strip()
        if not url:
            sys.exit("CALENDAR_ICS_URL is not set (add it as a GitHub Actions secret).")
        data = fetch_ics(url)

    events = build(data)

    # Final safety net: refuse to publish anything that still looks like a link,
    # except a trial's Stripe booking link in its own "book" field.
    for e in events:
        if e.get("book") and not STRIPE_LINK_RE.fullmatch(e["book"]):
            sys.exit("Refusing to write events.json: a booking link is not a Stripe link.")
    blob = json.dumps([{k: v for k, v in e.items() if k != "book"} for e in events])
    if re.search(r"meet\.google|https?://|zoom\.us", blob, re.I):
        sys.exit("Refusing to write events.json: a link slipped through.")

    Path(args.output).write_text(
        json.dumps({"events": events}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(events)} sessions to {args.output}")


if __name__ == "__main__":
    main()
