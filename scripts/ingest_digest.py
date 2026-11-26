#!/usr/bin/env python3
"""Append desk digest JSON files to data/news.json (public items only).

Usage:
  python3 scripts/ingest_digest.py [digest.json ...]
  python3 scripts/ingest_digest.py --newsroom /workspace/newsroom --out data/news.json
  python3 scripts/ingest_digest.py --from-feed /workspace/options-calc/feeds/news.json

After each market-desk digest is written under /workspace/newsroom/<date>-<edition>.json,
run this script so the public news page picks it up on the next publish.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from news_util import iso_il, load_news, parse_il_time, save_news, upsert_items  # noqa: E402

LABELS = {
    "asia": "ישראל ואסיה",
    "open": "פתיחת ארה״ב",
    "mid": "אמצע יום",
    "close": "נעילה",
}


def digest_to_item(raw: dict, path: str | None = None) -> dict | None:
    if not raw:
        return None
    # Already a public feed item
    if raw.get("kind") in ("digest", "funds", "rss") and raw.get("title") and raw.get("id"):
        return raw
    # Public feed digest entry (feeds/news.json)
    if raw.get("headline") and raw.get("id") and ("stories" in raw or "summary" in raw) and "slug" not in raw:
        date = raw.get("date") or (raw.get("id") or "")[:10]
        typ = raw.get("type") or ""
        time = parse_il_time(
            " ".join(filter(None, [raw.get("timestamp"), raw.get("data_time"), raw.get("date_display"), date])),
            fallback_date=date,
        ) or (f"{date}T12:00+02:00" if date else iso_il())
        summary = raw.get("summary") or {}
        if isinstance(summary, dict):
            summary_text = " ".join(filter(None, [summary.get("israel"), summary.get("world")])).strip()
        else:
            summary_text = str(summary)
        links = []
        for src in raw.get("sources") or []:
            if isinstance(src, dict) and src.get("url"):
                links.append({"title": src.get("title") or src.get("name") or src["url"], "url": src["url"]})
            elif isinstance(src, str) and src.startswith("http"):
                links.append({"title": src, "url": src})
        return {
            "id": f"digest-{raw['id']}" if not str(raw["id"]).startswith("digest-") else raw["id"],
            "kind": "digest",
            "time": time,
            "title": raw.get("headline") or raw.get("title"),
            "summary": summary_text,
            "source": "דסק השוק",
            "edition": raw.get("label") or LABELS.get(typ, typ),
            "links": links,
            "stories": raw.get("stories") or [],
            "indices": raw.get("indices") or [],
            "calendar": raw.get("calendar") or [],
        }
    # Newsroom digest JSON
    slug = raw.get("slug")
    if not slug and path:
        base = os.path.basename(path)
        if base.endswith(".json") and len(base) >= 16:
            slug = base[:-5]
    if not slug or not raw.get("headline"):
        return None
    date, typ = slug[:10], slug[11:]
    stamp = raw.get("timestamp") or raw.get("timestamp_note") or raw.get("world_hint") or raw.get("israel_row_hint")
    time = parse_il_time(stamp, fallback_date=date) or parse_il_time(raw.get("date"), fallback_date=date) or f"{date}T12:00+02:00"
    summary = raw.get("summary") or {}
    if isinstance(summary, dict):
        summary_text = " ".join(filter(None, [summary.get("israel"), summary.get("world")])).strip()
    else:
        summary_text = str(summary)
    stories = []
    for s in raw.get("stories") or []:
        title = s.get("lead") or s.get("title")
        text = s.get("text") or ""
        if title or text:
            stories.append({"title": title, "text": text})
    indices = []
    for group, key in (("ישראל", "israel_row"), ("עולם", "world_tiles")):
        for t in raw.get(key) or []:
            indices.append({
                "group": group,
                "name": t.get("label") or t.get("name"),
                "display": t.get("value"),
                "change_text": t.get("change"),
                "dir": t.get("dir"),
                "note": t.get("tag") or t.get("note"),
            })
    return {
        "id": f"digest-{slug}",
        "kind": "digest",
        "time": time,
        "title": raw["headline"],
        "summary": summary_text,
        "source": "דסק השוק",
        "edition": LABELS.get(typ, raw.get("edition") or typ),
        "links": [],
        "stories": stories,
        "indices": indices,
        "calendar": (raw.get("calendar") or {}).get("rows", raw.get("calendar") or []),
    }


def collect_paths(args) -> list[str]:
    paths = list(args.files or [])
    if args.newsroom:
        paths.extend(sorted(glob.glob(os.path.join(args.newsroom, "20??-??-??-*.json"))))
    if args.from_feed and os.path.exists(args.from_feed):
        paths.append(args.from_feed)
    # Default search when nothing was passed
    if not paths and not args.from_feed and not args.newsroom:
        for folder in ("/workspace/newsroom", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "feeds"))):
            if os.path.isdir(folder):
                paths.extend(sorted(glob.glob(os.path.join(folder, "20??-??-??-*.json"))))
        default_feed = "/workspace/options-calc/feeds/news.json"
        if os.path.exists(default_feed):
            paths.append(default_feed)
    return paths


def items_from_path(path: str) -> list[dict]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"skip {path}: {e}", file=sys.stderr)
        return []
    out = []
    if isinstance(data, dict) and isinstance(data.get("digests"), list):
        for d in data["digests"]:
            item = digest_to_item(d, path)
            if item:
                out.append(item)
        return out
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        for d in data["items"]:
            if d.get("kind") == "digest" or d.get("headline") or (d.get("id") or "").startswith("digest-"):
                item = digest_to_item(d, path)
                if item:
                    out.append(item)
        return out
    item = digest_to_item(data, path)
    return [item] if item else []


def main() -> None:
    ap = argparse.ArgumentParser(description="Append desk digests to data/news.json")
    ap.add_argument("files", nargs="*", help="newsroom digest JSON files")
    ap.add_argument("--newsroom", help="folder of YYYY-MM-DD-<edition>.json digests")
    ap.add_argument("--from-feed", help="existing feeds/news.json with a digests array")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "news.json"))
    ap.add_argument("--keep-days", type=int, default=21, help="drop digests older than this many days")
    args = ap.parse_args()
    out_path = os.path.abspath(args.out)
    incoming = []
    for path in collect_paths(args):
        incoming.extend(items_from_path(path))
    # de-dupe incoming by id, last wins
    by_id = {}
    for it in incoming:
        by_id[it["id"]] = it
    incoming = list(by_id.values())
    feed = load_news(out_path)
    upsert_items(feed, incoming)
    if args.keep_days:
        from datetime import datetime, timedelta
        try:
            from news_util import now_il
            cutoff = now_il() - timedelta(days=args.keep_days)
            cut = cutoff.isoformat(timespec="minutes")
        except Exception:
            cut = None
        if cut:
            feed["items"] = [
                it for it in feed["items"]
                if it.get("kind") != "digest" or (it.get("time") or "") >= cut
            ]
    save_news(out_path, feed)
    n = sum(1 for it in feed["items"] if it.get("kind") == "digest")
    print(f"ingested {len(incoming)} digest item(s); {n} digests in {out_path}")


if __name__ == "__main__":
    main()
