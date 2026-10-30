#!/usr/bin/env python3
"""
Build hosts.json (host name -> photo) from the "Meet your hosts" cards on the Club page.

Each card on https://www.mandarinzest.com/mandarin-zest-club is a picture followed by the host's
name in bold. Add a new card there (photo + bold name) and the next sync picks it up; the trial
board then shows that photo on every session whose "Host:" line has the same name.

Usage:
  python scripts/build_hosts.py                     # reads the live Club page
  python scripts/build_hosts.py --html-file page.html
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "hosts.json"
PAGE = "https://www.mandarinzest.com/mandarin-zest-club"
SITE = "https://www.mandarinzest.com"

CARD_RE = re.compile(
    r'<img\b[^>]*?\bsrc="([^"]+)"[^>]*>(?:(?!<img\b).)*?card-title[^>]*>(.*?)</p>',
    re.S | re.I,
)


def build(page: str) -> dict:
    start = page.find("Meet your hosts")
    if start < 0:
        sys.exit("Could not find the 'Meet your hosts' section on the Club page.")
    # the section ends at the next big heading (or the end of the page)
    end = page.find("<h2", start + 50)
    block = page[start:end if end > 0 else len(page)]
    hosts = {}
    for src, title in CARD_RE.findall(block):
        name = html.unescape(re.sub(r"<[^>]+>", " ", title))
        name = re.sub(r"\s+", " ", name).strip()
        if not name or len(name) > 40:
            continue
        url = src if src.startswith("http") else SITE + src
        hosts[name.lower()] = {"name": name, "photo": url}
    return hosts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html-file")
    ap.add_argument("--output", default=str(OUTPUT))
    args = ap.parse_args()
    if args.html_file:
        page = Path(args.html_file).read_text(encoding="utf-8")
    else:
        req = urllib.request.Request(PAGE, headers={"User-Agent": "mz-hosts-sync"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            page = resp.read().decode("utf-8", "replace")
    hosts = build(page)
    if not hosts:
        sys.exit("No host cards found: hosts.json left unchanged.")
    Path(args.output).write_text(json.dumps(hosts, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(hosts)} hosts: {', '.join(h['name'] for h in hosts.values())}")


if __name__ == "__main__":
    main()
