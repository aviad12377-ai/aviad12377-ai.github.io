#!/usr/bin/env python3
"""Pull a few public market RSS feeds into data/news.json as a fallback.

The desk digests stay in the file; this only refreshes kind=rss items.
Hebrew UI is rendered by the page; English source titles are kept as published
and tagged lang=en. No personal data.
"""
from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import hashlib
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from news_util import IL, iso_il, load_news, save_news, strip_html, upsert_items  # noqa: E402

UA = "balances-portal/1.0 (+https://aviad12377-ai.github.io/)"

FEEDS = [
    {"id": "globes-markets", "source": "גלובס", "lang": "he",
     "url": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585"},
    {"id": "themarker-markets", "source": "TheMarker", "lang": "he",
     "url": "https://www.themarker.com/cmlink/1.243"},
    # Calcalist public RSS has been failing in 2026; kept so a recovery starts working on its own.
    {"id": "calcalist-markets", "source": "כלכליסט", "lang": "he",
     "url": "https://www.calcalist.co.il/GeneralRSS/0,16335,L-3674,00.xml"},
    {"id": "cnbc-markets", "source": "CNBC", "lang": "en",
     "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"id": "yahoo-spx", "source": "Yahoo Finance", "lang": "en",
     "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US"},
    {"id": "bbc-business", "source": "BBC Business", "lang": "en",
     "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
]


def local(tag: str) -> str:
    return tag.split("}", 1)[-1].lower() if tag else ""


def child_text(el: ET.Element, *names: str) -> str:
    want = {n.lower() for n in names}
    for ch in list(el):
        if local(ch.tag) in want:
            return "".join(ch.itertext()).strip()
    return ""


def parse_pub(text: str | None) -> str | None:
    if not text:
        return None
    text = text.strip()
    try:
        value = email.utils.parsedate_to_datetime(text)
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return iso_il(value.astimezone(IL))
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            raw = text.replace("Z", "+0000")
            value = dt.datetime.strptime(raw, fmt)
            if value.tzinfo is None:
                value = value.replace(tzinfo=dt.timezone.utc)
            return iso_il(value.astimezone(IL))
        except Exception:
            continue
    return None


def fetch(url: str, timeout: int = 25) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            if getattr(res, "status", 200) >= 400:
                print(f"http {res.status} {url}", file=sys.stderr)
                return None
            return res.read()
    except Exception as e:
        print(f"fail {url}: {e}", file=sys.stderr)
        return None


def parse_feed(blob: bytes, meta: dict, limit: int) -> list[dict]:
    try:
        root = ET.fromstring(blob)
    except Exception as e:
        print(f"xml {meta['id']}: {e}", file=sys.stderr)
        return []
    items = []
    nodes = [el for el in root.iter() if local(el.tag) in ("item", "entry")]
    for el in nodes[:limit]:
        title = strip_html(child_text(el, "title"), 220)
        link = child_text(el, "link")
        if not link:
            for ch in list(el):
                if local(ch.tag) == "link":
                    link = (ch.get("href") or "").strip()
                    if link:
                        break
        guid = child_text(el, "guid", "id") or link or title
        if not title or not (link or guid):
            continue
        summary = strip_html(child_text(el, "description", "summary", "content") or "", 420)
        pub = parse_pub(child_text(el, "pubdate", "published", "updated", "date")) or iso_il()
        hid = hashlib.sha1(f"{meta['id']}|{guid}".encode("utf-8")).hexdigest()[:16]
        items.append({
            "id": f"rss-{meta['id']}-{hid}",
            "kind": "rss",
            "time": pub,
            "title": title,
            "summary": summary,
            "source": meta["source"],
            "lang": meta["lang"],
            "links": [{"title": meta["source"], "url": link}] if link else [],
        })
    return items


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "news.json"))
    ap.add_argument("--per-feed", type=int, default=8)
    args = ap.parse_args()
    out_path = os.path.abspath(args.out)
    incoming: list[dict] = []
    for meta in FEEDS:
        blob = fetch(meta["url"])
        if not blob:
            continue
        got = parse_feed(blob, meta, args.per_feed)
        print(f"{meta['id']}: {len(got)} items")
        incoming.extend(got)
    feed = load_news(out_path)
    # Replace previous RSS snapshot so stale headlines drop off, keep desk/funds items.
    upsert_items(feed, incoming, replace_kinds=["rss"] if incoming else None)
    save_news(out_path, feed)
    print(f"rss items now {sum(1 for it in feed['items'] if it.get('kind')=='rss')} in {out_path}")
    if not incoming:
        sys.exit(0)  # empty fallback is not a hard failure; digests may still fill the page


if __name__ == "__main__":
    main()
