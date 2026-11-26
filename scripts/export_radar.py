#!/usr/bin/env python3
"""Export the latest /workspace/radar-YYYY-MM-DD folder to data/scanner.json.

Public, watch-only fields only. No account constraints and no personal notes.
Usage:
  python3 scripts/export_radar.py
  python3 scripts/export_radar.py --root /workspace --out data/scanner.json
  python3 scripts/export_radar.py --date 2026-11-26
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

DISCLAIMER = "מידע בלבד, לא ייעוץ. מעקב בלבד, בלי המלצה לקנייה או למכירה."

DEFAULT_FILTERS = [
    {"field": "market_cap_usd", "op": ">", "value": 200000000, "label": "שווי שוק מעל 200 מיליון דולר"},
    {"field": "pe", "op": ">", "value": 0, "label": "מכפיל רווח אחורה חיובי"},
    {"field": "fwd_pe", "op": ">", "value": 0, "label": "מכפיל רווח קדימה חיובי"},
    {"field": "peg", "op": "<", "value": 1, "label": "PEG מתחת ל־1"},
    {"field": "short_float_pct", "op": ">", "value": 10, "label": "שורט מעל 10% מהפלואט"},
]
LIQUIDITY = {"field": "avg_dollar_volume_usd", "op": ">=", "value": 20000000, "label": "מחזור דולרי יומי ממוצע של 20 מיליון דולר לפחות"}


def latest_dir(root: str, date: str | None) -> str:
    if date:
        path = os.path.join(root, f"radar-{date}")
        if not os.path.isdir(path):
            sys.exit(f"missing {path}")
        return path
    found = []
    for name in os.listdir(root):
        m = re.fullmatch(r"radar-(\d{4}-\d{2}-\d{2})", name)
        if m and os.path.isdir(os.path.join(root, name)):
            found.append(m.group(1))
    if not found:
        sys.exit(f"no radar-YYYY-MM-DD folders under {root}")
    found.sort()
    return os.path.join(root, f"radar-{found[-1]}")


def load_json(path: str):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def num(value):
    if value in (None, "", "—", "-"):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace("%", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None



US_EXCHANGES = {
    "NMS", "NYQ", "NGM", "PCX", "BTS", "NYSE", "NASDAQ", "AMEX", "ASE", "PNK", "ASE", "NYS",
}


def last_us_close_from_prices(path: str) -> str | None:
    """Return the session date of the latest US cash close in prices.json.

    Uses regularMarketTime on US-listed equities/ETFs. Israeli (TASE) and
    FX quotes are ignored, so a Thursday Israel session is not mistaken for
    a US close (e.g. US Thanksgiving).
    """
    data = load_json(path)
    if not isinstance(data, dict):
        return None
    quotes = data.get("quotes") or {}
    dates: list[str] = []
    skip = {"TASE", "TASE-MF", "TLV", "CCC", "CCY"}
    for q in quotes.values():
        if not isinstance(q, dict):
            continue
        ex = str(q.get("exchange") or "").upper()
        if ex in skip or (ex not in US_EXCHANGES):
            continue
        raw = str(q.get("regularMarketTime") or "")
        m = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
        if m:
            dates.append(m.group(1))
    if not dates:
        return None
    return Counter(dates).most_common(1)[0][0]


def filters_from_summary(summary: dict) -> list[dict]:
    raw = (summary or {}).get("locked_filters")
    if isinstance(raw, list) and raw and isinstance(raw[0], dict) and "label" in raw[0]:
        return raw
    return list(DEFAULT_FILTERS)


def row_from_liquid(item: dict) -> dict:
    return {
        "rank": item.get("rank"),
        "ticker": item.get("ticker"),
        "company": item.get("company"),
        "sector": item.get("sector"),
        "industry": item.get("industry"),
        "country": item.get("country"),
        "market_cap_usd": item.get("mcap_n") if item.get("mcap_n") is not None else item.get("market_cap_usd"),
        "market_cap_display": item.get("mcap"),
        "pe": num(item.get("pe")),
        "fwd_pe": num(item.get("fwd_pe")),
        "peg": num(item.get("peg")),
        "short_float_pct": num(item.get("short_float") if item.get("short_float") is not None else item.get("short_float_pct")),
        "days_to_cover": num(item.get("short_ratio") if item.get("short_ratio") is not None else item.get("days_to_cover") or item.get("dtc")),
        "price": num(item.get("price")),
        "change_pct": num(item.get("change_pct")),
        "perf_month_pct": num(item.get("perf_month") if item.get("perf_month") is not None else item.get("perf_month_pct")),
        "avg_dollar_volume_usd": item.get("dollar_vol") if item.get("dollar_vol") is not None else item.get("avg_dollar_volume_usd"),
        "earnings": item.get("earnings"),
    }


def rows_from_csv(path: str, limit: int = 15) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for i, r in enumerate(reader, 1):
            liquid = r.get("Liquid")
            if liquid not in (None, "", "1", "true", "True", "yes"):
                # filtered.csv is already the post-filter set; still prefer listed order
                pass
            rows.append({
                "rank": i,
                "ticker": r.get("Ticker"),
                "company": r.get("Company"),
                "sector": r.get("Sector"),
                "industry": r.get("Industry"),
                "country": r.get("Country"),
                "market_cap_usd": num(r.get("MCap_n")),
                "market_cap_display": r.get("Market Cap"),
                "pe": num(r.get("PE_n") or r.get("P/E")),
                "fwd_pe": num(r.get("FwdPE_n") or r.get("Forward P/E")),
                "peg": num(r.get("PEG_n") or r.get("PEG")),
                "short_float_pct": num(r.get("SI") or r.get("Short Float")),
                "days_to_cover": num(r.get("DTC") or r.get("Short Ratio")),
                "price": num(r.get("Price")),
                "change_pct": num(r.get("Change %")),
                "perf_month_pct": num(r.get("Perf Month")),
                "avg_dollar_volume_usd": num(r.get("DollarVol")),
                "earnings": r.get("Earnings"),
            })
            if len(rows) >= limit:
                break
        return rows


def build(folder: str, prices_path: str | None = None) -> dict:
    date = os.path.basename(folder).replace("radar-", "", 1)
    summary = load_json(os.path.join(folder, "summary.json")) or {}
    liquid = load_json(os.path.join(folder, "liquid_top15.json"))
    if isinstance(liquid, dict):
        liquid = liquid.get("top15") or liquid.get("items") or liquid.get("rows") or []
    top = [row_from_liquid(x) for x in (liquid or []) if x.get("ticker")]
    if not top:
        top = rows_from_csv(os.path.join(folder, "filtered.csv"))
    diffs = []
    for name in os.listdir(folder):
        if name.startswith("diff_vs_") and name.endswith(".json"):
            diffs.append(name)
    diff = load_json(os.path.join(folder, diffs[-1])) if diffs else {}
    counts = summary.get("counts") or {}
    source_url = summary.get("source_url") or "https://finviz.com/screener.ashx"
    assumed = summary.get("us_close_date_assumed") or summary.get("us_close_date")
    real = last_us_close_from_prices(prices_path) if prices_path else None
    if real:
        us_close = real
        us_close_source = "prices.json regularMarketTime (US exchanges)"
    else:
        us_close = assumed
        us_close_source = "summary.us_close_date_assumed (fallback; not verified against prices.json)"
    return {
        "date": date,
        "updated_at_israel": summary.get("scrape_time_israel") or f"{date} 09:30",
        "disclaimer": DISCLAIMER,
        "mode": "מעקב בלבד, בלי המלצות",
        "update_schedule": "ימי חול, אחרי סריקת הבוקר (בערך 09:27 שעון ישראל), על נתוני סגירת ארה״ב של יום המסחר הקודם",
        "source": {
            "screener": "Finviz",
            "url": source_url,
            "short_interest": "FINRA, מתעדכן בדרך כלל פעמיים בחודש ועשוי להיות מושהה",
        },
        "filters": filters_from_summary(summary),
        "liquidity_rule": LIQUIDITY,
        "counts": {
            "raw": counts.get("raw"),
            "after_filters": counts.get("after_locked") or counts.get("passed_filters"),
            "liquid": counts.get("liquid_count") or counts.get("liquid"),
        },
        "us_close_date": us_close,
        "us_close_date_source": us_close_source,
        "compared_to": (diff or {}).get("compared_to"),
        "entered": (diff or {}).get("new_entries") or (diff or {}).get("entered") or [],
        "exited": (diff or {}).get("drops") or (diff or {}).get("exited") or [],
        "top": top,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="/workspace")
    ap.add_argument("--date")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "scanner.json"))
    ap.add_argument("--prices", default=os.path.join(os.path.dirname(__file__), "..", "prices.json"),
                    help="prices.json used to read the real last US cash close")
    args = ap.parse_args()
    folder = latest_dir(args.root, args.date)
    data = build(folder, os.path.abspath(args.prices))
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"exported {folder} -> {out} ({len(data.get('top') or [])} names, date {data['date']}, us_close {data.get('us_close_date')} from {data.get('us_close_date_source')})")


if __name__ == "__main__":
    main()
