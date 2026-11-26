#!/usr/bin/env python3
"""Shared helpers for data/news.json. Public market data only. No personal records."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import tempfile
from html import unescape
from typing import Iterable

try:
    from zoneinfo import ZoneInfo
    IL = ZoneInfo("Asia/Jerusalem")
except Exception:  # pragma: no cover
    IL = dt.timezone(dt.timedelta(hours=2))

DISCLAIMER = "מידע בלבד, לא ייעוץ"
KIND_ORDER = {"funds": 0, "digest": 1, "rss": 2}


def now_il() -> dt.datetime:
    return dt.datetime.now(IL)


def iso_il(value: dt.datetime | None = None) -> str:
    if value is None:
        value = now_il()
    if value.tzinfo is None:
        value = value.replace(tzinfo=IL)
    return value.astimezone(IL).isoformat(timespec="minutes")


def parse_il_time(text: str | None, fallback_date: str | None = None) -> str | None:
    """Best-effort parse of desk timestamps such as 'הנתונים נכונים ל־26.11.2026, 15:59'."""
    if not text and not fallback_date:
        return None
    raw = text or ""
    date = fallback_date
    time_part = "12:00"
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", raw)
    if m:
        date = f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    t = re.search(r"(\d{1,2}):(\d{2})", raw)
    if t:
        time_part = f"{int(t.group(1)):02d}:{t.group(2)}"
    if not date:
        return None
    try:
        value = dt.datetime.strptime(f"{date} {time_part}", "%Y-%m-%d %H:%M").replace(tzinfo=IL)
        return iso_il(value)
    except ValueError:
        return None


def strip_html(text: str | None, limit: int = 420) -> str:
    if not text:
        return ""
    s = unescape(re.sub(r"(?is)<script.*?>.*?</script>", " ", text))
    s = re.sub(r"(?is)<style.*?>.*?</style>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > limit:
        s = s[: limit - 1].rstrip() + "…"
    return s


def load_news(path: str) -> dict:
    if not os.path.exists(path):
        return {"updated": None, "disclaimer": DISCLAIMER, "items": []}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"updated": None, "disclaimer": DISCLAIMER, "items": []}
    items = data.get("items")
    if not isinstance(items, list):
        items = []
    data["items"] = items
    data["disclaimer"] = DISCLAIMER
    return data


def save_news(path: str, feed: dict) -> None:
    feed = dict(feed)
    feed["updated"] = iso_il()
    feed["disclaimer"] = DISCLAIMER
    items = list(feed.get("items") or [])
    items.sort(key=lambda it: (it.get("time") or "", KIND_ORDER.get(it.get("kind"), 9), it.get("id") or ""), reverse=True)
    feed["items"] = items
    folder = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(feed, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def upsert_items(feed: dict, incoming: Iterable[dict], replace_kinds: Iterable[str] | None = None) -> dict:
    incoming = [it for it in incoming if it and it.get("id")]
    new_ids = {it["id"] for it in incoming}
    kept = []
    drop = set(replace_kinds or [])
    for it in feed.get("items") or []:
        if not it or not it.get("id"):
            continue
        if it["id"] in new_ids:
            continue
        if it.get("kind") in drop:
            continue
        kept.append(it)
    feed["items"] = kept + incoming
    return feed
