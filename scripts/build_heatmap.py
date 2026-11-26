#!/usr/bin/env python3
"""Build data/heatmap.json: TA-35 and S&P 100 day/week/month % changes.

Uses Yahoo Finance chart (same UA as fetch_prices.py). Standard library only.
The heatmap page also overlays a live day change from prices.json when present.
"""
from __future__ import annotations

import json
import sys
import time
import concurrent.futures
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
UNIVERSE = Path(__file__).resolve().parent / "universe.json"
OUT = ROOT / "data" / "heatmap.json"
USER_AGENT = (
    "Mozilla/5.0 (compatible; options-calc-prices/1.1; "
    "+https://aviad12377-ai.github.io/)"
)
TIMEOUT = 20
RETRIES = 3


def http_json(url: str) -> dict:
    last = None
    for attempt in range(RETRIES):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urlopen(req, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8", "replace"))
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            last = exc
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(last)


def closes_of(symbol: str) -> list[float]:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + quote(symbol, safe="")
        + "?range=2mo&interval=1d"
    )
    payload = http_json(url)
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        return []
    quotes = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quotes.get("close") or []
    return [float(c) for c in closes if c is not None]


def pct(now: float, then: float) -> float | None:
    if not then:
        return None
    return (now / then - 1.0) * 100.0


def changes(closes: list[float]) -> dict:
    if len(closes) < 2:
        return {"day": None, "week": None, "month": None, "price": closes[-1] if closes else None}
    last = closes[-1]
    day = pct(last, closes[-2])
    week_i = -6 if len(closes) > 6 else 0
    month_i = -21 if len(closes) > 21 else 0
    return {
        "price": last,
        "day": day,
        "week": pct(last, closes[week_i]),
        "month": pct(last, closes[month_i]),
    }


def main() -> int:
    uni = json.loads(UNIVERSE.read_text(encoding="utf-8"))
    jobs = []
    for market, key in (("ta35", "ta35"), ("sp100", "sp100")):
        for item in uni.get(key) or []:
            if isinstance(item, dict) and item.get("symbol"):
                jobs.append((market, item["symbol"], item.get("name") or item["symbol"], item.get("currency") or ""))
    items = []
    errors = 0

    def one(job):
        market, symbol, name, currency = job
        try:
            ch = changes(closes_of(symbol))
            return {
                "symbol": symbol,
                "name": name,
                "market": market,
                "currency": currency,
                "price": ch["price"],
                "day": ch["day"],
                "week": ch["week"],
                "month": ch["month"],
            }, None
        except Exception as exc:  # noqa: BLE001
            return None, (symbol, str(exc))

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(one, j) for j in jobs]
        for i, fut in enumerate(concurrent.futures.as_completed(futs), 1):
            row, err = fut.result()
            if err:
                errors += 1
                print("fail", err[0], err[1], file=sys.stderr)
            else:
                items.append(row)
            if i % 20 == 0:
                print(f"{i}/{len(jobs)}", file=sys.stderr)
            time.sleep(0.05)

    items.sort(key=lambda r: (r["market"], r["name"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Yahoo Finance chart, range=2mo interval=1d",
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {OUT} n={len(items)} errors={errors}")
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
