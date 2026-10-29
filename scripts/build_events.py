#!/usr/bin/env python3
"""
Build events.json for the public Mandarin Zest class calendar from the
private Google Calendar feed.

PRIVACY: the Google Calendar feed contains Google Meet links, descriptions,
locations and attendee emails. This script copies ONLY an allowlist of
fields (date, title, start/end times, and the "Level:", "Category:", "Topic:",
"About:" and "Host:" lines a host chooses to write in the description) into
events.json. Nothing else from the description is ever read.
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

# LEVELS and CATEGORIES (keys must match categories.js, which holds labels and colours).
# Hosts set them in the Google Calendar event DESCRIPTION, one line each:
#     Level: Beginner                      (Beginner, Intermediate, Advanced or All levels)
#     Category: Conversation, Culture      (one or more, separated by commas)
#     Host: Dorota
# Without a Level/Category line, they are guessed from the title (see the rules below).
LEVELS = ["Beginner", "Intermediate", "Advanced", "All levels"]
LEVEL_WORDS = {
    "beginner": "Beginner", "beginners": "Beginner", "elementary": "Beginner", "basic": "Beginner",
    "intermediate": "Intermediate", "inter": "Intermediate",
    "advanced": "Advanced",
    "all": "All levels", "all levels": "All levels", "any": "All levels", "everyone": "All levels", "mixed": "All levels",
}
CATEGORIES = ["conversation", "culture", "grammar", "characters", "bookclub", "listening", "reading", "vocabulary", "noagenda"]
CATEGORY_WORDS = {
    "conversation": "conversation", "conversations": "conversation", "speaking": "conversation", "talk": "conversation",
    "culture": "culture", "cultural": "culture",
    "grammar": "grammar",
    "characters": "characters", "character": "characters", "hanzi": "characters", "writing": "characters",
    "book club": "bookclub", "bookclub": "bookclub", "book": "bookclub",
    "listening": "listening",
    "reading": "reading",
    "vocabulary": "vocabulary", "vocab": "vocabulary", "words": "vocabulary",
    "no agenda": "noagenda", "noagenda": "noagenda", "free talk": "noagenda", "open": "noagenda", "none": "noagenda",
}
# Title keywords used only when there is no "Category:" line (several can match).
KEYWORD_RULES = [
    ("bookclub", ["book club", "bookclub"]),
    ("characters", ["character", "bopomofo", "zhuyin", "stroke", "hanzi"]),
    ("grammar", ["grammar"]),
    ("listening", ["listening", "video comprehension"]),
    ("reading", ["reading"]),
    ("vocabulary", ["vocab"]),
    ("culture", ["culture", "geography", "holiday", "festival", "dumpling", "snack", "food"]),
    ("noagenda", ["no agenda", "free talk", "topictbd", "topic tbd", "open topic"]),
    ("conversation", ["conversation", "native", "speaking", "chat"]),
]
LEVEL_LINE_RE = re.compile(r"^\s*level\s*:\s*(.+)$", re.I | re.M)
CATEGORY_LINE_RE = re.compile(r"^\s*categor(?:y|ies)\s*:\s*(.+)$", re.I | re.M)

URL_RE = re.compile(r"(https?://\S+|www\.\S+|\b[\w.-]+\.(?:com|google\.com|meet|zoom\.us|us|io|net|org)/\S*)", re.I)
LEVEL_RE = re.compile(r"\(?\s*\b(HSK|TOCFL)\s*(\d)(?:\s*[-–~/]\s*(?:HSK|TOCFL)?\s*(\d))?\s*\)?", re.I)
TAG_RE = re.compile(r"#(\w+)")
HIDE_TAGS = {"hide", "private"}
# Trial sessions: EVERY session is open for a trial by default (one trial per
# person is enforced by the trial-bookings Apps Script). To keep a session for
# members only, write "#notrial" in its DESCRIPTION or title. ("#trial" still
# works but is no longer needed.) An optional line "Topic: ..." in the description is shown
# on the trial page. Nothing else from the description is ever read, and no
# links come from it: the booking link lives in trial.html.
TRIAL_RE = re.compile(r"(?<![\w#])#trial\b", re.I)
NOTRIAL_RE = re.compile(r"(?<![\w#])#(?:notrial|no-trial|membersonly|members)\b", re.I)
TOPIC_RE = re.compile(r"^\s*(?:#trial\b[\s,.:;-]*)?topic\s*:\s*(.+)$", re.I | re.M)
# Public description: the text after "About:" (it may run over several lines,
# up to the first empty line or the next "Something:" line). Only this part is
# shown in the expanded session on the website. A "Host:" line is shown too.
ABOUT_RE = re.compile(r"^\s*about\s*:\s*(.*(?:\n(?![ \t]*\n)(?![ \t]*[A-Za-z][\w ]{0,20}:).*)*)", re.I | re.M)
HOST_RE = re.compile(r"^\s*(?:hosts?|hosted by)\s*:\s*(.+)$", re.I | re.M)
EMAIL_RE = re.compile(r"\S+@\S+\.\S+")
PHONE_RE = re.compile(r"\+?\d[\d ()./-]{7,}\d")


def description_text(raw: str) -> str:
    """Google sends descriptions as HTML: turn breaks into newlines, drop tags."""
    text = re.sub(r"<\s*br\s*/?>|</p>|</div>|</li>", "\n", raw or "", flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return (text.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", '"'))


def scrub(text: str, limit: int) -> str:
    """Remove links, emails, phone numbers, PINs and #tags; tidy spaces."""
    text = URL_RE.sub("", text)
    text = EMAIL_RE.sub("", text)
    text = PHONE_RE.sub("", text)
    text = re.sub(r"\bpin\s*:?\s*[\d#]+", "", text, flags=re.I)
    text = TAG_RE.sub("", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s*\n\s*", " ", text).strip(" -–·|,")
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def find_line(regex, text: str, limit: int) -> str:
    m = regex.search(text)
    return scrub(m.group(1), limit) if m else ""


def trial_topic(text: str) -> str:
    return find_line(TOPIC_RE, text, 200)


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

    for _ in range(3):  # "MZ Club - ...", "MZ ...", even "MZ Club MZ ..."
        text = re.sub(r"^\s*MZ(?:\s*Club)?\b[\s:\-–·|]*", "", text, flags=re.I)
    text = re.sub(r"[(（]\s*(?:HSK|TOCFL)?\s*$", "", text, flags=re.I)   # dangling "(HSK" at the end
    text = re.sub(r"[(（]\s*[)）]", "", text)        # empty brackets left behind (incl. full-width)
    text = re.sub(r"\s{2,}", " ", text).strip(" -–·|,")
    return text.strip(), level, tags


def parse_level(desc: str, title: str, hsk: str, tags: set) -> str:
    """Level line > a level word in the title or a #tag > the HSK range in the title > none (blank)."""
    m = LEVEL_LINE_RE.search(desc)
    if m:
        low = m.group(1).strip().lower().rstrip(".")
        for word, level in sorted(LEVEL_WORDS.items(), key=lambda x: -len(x[0])):
            if low.startswith(word):
                return level
    for t in tags:
        if t in LEVEL_WORDS:
            return LEVEL_WORDS[t]
    low = title.lower()
    for word in ("advanced", "intermediate", "beginner"):
        if word in low:
            return LEVEL_WORDS[word]
    nums = [int(n) for n in re.findall(r"\d", hsk)]
    if nums:
        mid = (min(nums) + max(nums)) / 2
        return "Beginner" if mid <= 2.5 else "Intermediate" if mid <= 4 else "Advanced"
    # Unknown: no level shown. "All levels" means anyone can join, so it is only set on purpose.
    return ""


def parse_categories(desc: str, title: str, tags: set) -> list:
    """Category line > #tags > title keywords > conversation."""
    found = []
    m = CATEGORY_LINE_RE.search(desc)
    if m:
        for part in re.split(r"[,/;&+]|\band\b", m.group(1).lower()):
            key = CATEGORY_WORDS.get(part.strip().strip(".!"))
            if key and key not in found:
                found.append(key)
    if not found:
        found = [CATEGORY_WORDS[t] for t in tags if t in CATEGORY_WORDS]
    if not found:
        low = title.lower()
        hits = []
        for cat, words in KEYWORD_RULES:
            pos = [low.find(w) for w in words if w in low]
            if pos:
                hits.append((min(pos), cat))
        found = [cat for _, cat in sorted(hits)]   # in the order they appear in the title
    return found or ["conversation"]


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
            end_utc = ""
            if ev.get("DTEND") is not None:
                dtend = ev.decoded("DTEND")
                if isinstance(dtend, datetime):
                    if dtend.tzinfo is None:
                        dtend = dtend.replace(tzinfo=EU_TZ)
                    end_utc = dtend.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
            elif ev.get("DURATION") is not None:
                end_utc = (dtstart + ev.decoded("DURATION")).astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            # All-day events (holidays, greetings, reminders) are not sessions: skip them.
            continue

        # ALLOWLIST: these are the only fields that ever leave the feed.
        item = {
            "date": day.isoformat(),
            "title": title,
            "level": "",
            "cats": [],
            "times": times,
            "start": start_utc,
            "end": end_utc,
            "_sort": sort_key,
        }
        desc = description_text(str(ev.get("DESCRIPTION", "")))
        item["level"] = parse_level(desc, title, level, tags)
        item["cats"] = parse_categories(desc, title, tags)
        item["cat"] = item["cats"][0]
        for key, regex, limit in (("topic", TOPIC_RE, 200), ("about", ABOUT_RE, 600), ("host", HOST_RE, 60)):
            value = find_line(regex, desc, limit)
            if value:
                item[key] = value
        if not (NOTRIAL_RE.search(desc) or tags & {"notrial", "membersonly", "members"}):
            item["trial"] = True
            item.setdefault("topic", "")
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

    # Final safety net: refuse to publish anything that still looks like a link.
    blob = json.dumps(events)
    if re.search(r"meet\.google|https?://|zoom\.us|\S+@\S+\.\S+", blob, re.I):
        sys.exit("Refusing to write events.json: a link slipped through.")

    Path(args.output).write_text(
        json.dumps({"events": events}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(events)} sessions to {args.output}")


if __name__ == "__main__":
    main()
