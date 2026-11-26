#!/usr/bin/env python3
"""Fetch Yahoo Finance quotes server-side and write prices.json.

Standard library only. No secrets. Tolerates per-symbol failures.

Symbol universe: every list in scripts/universe.json (TA-35, S&P 100,
Israeli banks, US ETFs, crypto, FX, …) plus the optional
scripts/extra_tickers.json list that can be appended between releases.

Uses the Yahoo spark endpoint in batches for speed, then falls back to
the per-symbol chart endpoint for any symbol the batch missed.
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

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
UNIVERSE_PATH = Path(__file__).resolve().parent / "universe.json"
EXTRA_PATH = Path(__file__).resolve().parent / "extra_tickers.json"
USER_AGENT = (
    "Mozilla/5.0 (compatible; options-calc-prices/1.1; "
    "+https://aviad12377-ai.github.io/)"
)
RETRIES = 4
TIMEOUT = 20
SPARK_BATCH = 20
SPARK_PAUSE = 0.3
CHART_BATCH = 8
CHART_PAUSE = 0.25


def _add_symbol(sym, seen: set[str], symbols: list[str]) -> None:
    if not isinstance(sym, str):
        return
    sym = sym.strip()
    if not sym or sym in seen:
        return
    seen.add(sym)
    symbols.append(sym)


def load_symbols() -> list[str]:
    data = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    seen: set[str] = set()
    symbols: list[str] = []
    for key, val in data.items():
        if key == "sources" or not isinstance(val, list):
            continue
        for item in val:
            if isinstance(item, dict):
                _add_symbol(item.get("symbol") or item.get("ticker"), seen, symbols)
            else:
                _add_symbol(item, seen, symbols)
    if EXTRA_PATH.exists():
        extra = json.loads(EXTRA_PATH.read_text(encoding="utf-8"))
        if isinstance(extra, dict):
            extra = extra.get("symbols") or extra.get("tickers") or []
        if isinstance(extra, list):
            for item in extra:
                if isinstance(item, dict):
                    _add_symbol(item.get("symbol") or item.get("ticker"), seen, symbols)
                else:
                    _add_symbol(item, seen, symbols)
    return symbols


def chart_url(symbol: str) -> str:
    return (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + quote(symbol, safe="")
        + "?range=1d&interval=1d"
    )


def spark_url(symbols: list[str]) -> str:
    joined = ",".join(quote(s, safe="") for s in symbols)
    return (
        "https://query1.finance.yahoo.com/v7/finance/spark"
        f"?symbols={joined}&range=1d&interval=1d"
    )


def http_json(url: str) -> dict:
    last_err: Exception | None = None
    for attempt in range(RETRIES):
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                },
            )
            with urlopen(req, timeout=TIMEOUT) as resp:
                raw = resp.read().decode("utf-8", "replace")
            return json.loads(raw)
        except HTTPError as exc:
            last_err = exc
            # Honor Retry-After on 429; otherwise back off.
            delay = 1.5 * (attempt + 1)
            if exc.code == 429:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                try:
                    delay = max(delay, float(retry_after))
                except (TypeError, ValueError):
                    delay = max(delay, 8 * (attempt + 1))
            time.sleep(delay)
        except (URLError, TimeoutError, ValueError, OSError) as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed after {RETRIES} tries: {last_err}")


def convert_price(price, currency):
    if currency == "ILA":
        return price / 100.0, "ILS", True
    if currency in ("GBp", "GBX"):
        return price / 100.0, "GBP", True
    return price, currency or "USD", False


def iso_from_unix(ts, tz_name: str | None) -> str | None:
    if not ts:
        return None
    dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
    if tz_name and ZoneInfo is not None:
        try:
            dt = dt.astimezone(ZoneInfo(tz_name))
        except Exception:
            pass
    return dt.isoformat()


def infer_hours(symbol: str, exchange: str | None, tz_name: str | None) -> str:
    """Fallback open/closed when Yahoo meta.marketState and session times are missing."""
    exchange = (exchange or "").upper()
    now_utc = datetime.now(timezone.utc)

    def local(tz):
        if ZoneInfo is None:
            return now_utc
        try:
            return now_utc.astimezone(ZoneInfo(tz))
        except Exception:
            return now_utc

    if symbol.endswith(".TA") or exchange in {"TLV", "TAE"}:
        now = local(tz_name or "Asia/Jerusalem")
        if now.weekday() >= 4:  # Fri, Sat
            return "closed"
        minutes = now.hour * 60 + now.minute
        return "open" if (9 * 60 + 50) <= minutes < (17 * 60 + 30) else "closed"
    if symbol.endswith("=X") or exchange in {"CCY", "PCN"}:
        now = local("America/New_York")
        wd, minutes = now.weekday(), now.hour * 60 + now.minute
        if wd == 5:
            return "closed"
        if wd == 4 and minutes >= 17 * 60:
            return "closed"
        if wd == 6 and minutes < 17 * 60:
            return "closed"
        return "open"
    # 24/7 crypto
    if symbol.endswith("-USD") and exchange in {"CCC", "CCY"}:
        return "open"
    now = local(tz_name or "America/New_York")
    if now.weekday() >= 5:
        return "closed"
    minutes = now.hour * 60 + now.minute
    return "open" if (9 * 60 + 30) <= minutes < (16 * 60) else "closed"


def market_state(meta: dict, symbol: str) -> str:
    ms = meta.get("marketState")
    if ms:
        return "open" if str(ms).upper() == "REGULAR" else "closed"
    regular = (meta.get("currentTradingPeriod") or {}).get("regular") or {}
    start, end = regular.get("start"), regular.get("end")
    if isinstance(start, (int, float)) and isinstance(end, (int, float)):
        now = time.time()
        return "open" if start <= now < end else "closed"
    return infer_hours(symbol, meta.get("exchangeName"), meta.get("exchangeTimezoneName"))


def quote_from_meta(meta: dict, symbol: str) -> dict:
    raw_price = meta.get("regularMarketPrice")
    if not isinstance(raw_price, (int, float)) or raw_price <= 0:
        raise RuntimeError("no regularMarketPrice")
    raw_currency = meta.get("currency") or "USD"
    price, currency, _converted = convert_price(raw_price, raw_currency)
    prev = (
        meta.get("chartPreviousClose")
        or meta.get("previousClose")
        or meta.get("regularMarketPreviousClose")
    )
    prev_conv = None
    if isinstance(prev, (int, float)):
        prev_conv, _, _ = convert_price(prev, raw_currency)
        prev_conv = round(prev_conv, 6)
    tz_name = meta.get("exchangeTimezoneName")
    return {
        "price": round(price, 6),
        "currency": currency,
        "regularMarketTime": iso_from_unix(meta.get("regularMarketTime"), tz_name),
        "previousClose": prev_conv,
        "exchange": meta.get("exchangeName") or None,
        "state": market_state(meta, symbol),
    }


def parse_quote(payload: dict, symbol: str) -> dict:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        raise RuntimeError("no chart result")
    meta = result[0].get("meta") or {}
    return quote_from_meta(meta, symbol)


def parse_spark(payload: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    results = (payload.get("spark") or {}).get("result") or []
    for item in results:
        symbol = item.get("symbol")
        responses = item.get("response") or []
        if not symbol or not responses:
            continue
        meta = responses[0].get("meta") or {}
        try:
            out[symbol] = quote_from_meta(meta, symbol)
        except Exception:
            continue
    return out


def fetch_one(symbol: str) -> tuple[str, dict | None, str | None]:
    try:
        data = http_json(chart_url(symbol))
        return symbol, parse_quote(data, symbol), None
    except Exception as exc:  # noqa: BLE001 — per-symbol tolerance
        return symbol, None, str(exc)


def comparable(quotes: dict) -> dict:
    out = {}
    for sym in sorted(quotes):
        q = quotes[sym] or {}
        out[sym] = {
            "price": q.get("price"),
            "currency": q.get("currency"),
            "regularMarketTime": q.get("regularMarketTime"),
            "previousClose": q.get("previousClose"),
            "exchange": q.get("exchange"),
            "state": q.get("state"),
        }
    return out


def load_existing(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data.get("quotes"), dict):
            return data["quotes"]
        return {k: v for k, v in data.items() if k != "generatedAt" and isinstance(v, dict) and "price" in v}
    except Exception:
        return {}


def main(argv: list[str]) -> int:
    out_path = Path(argv[1]) if len(argv) > 1 else ROOT / "prices.json"
    symbols = load_symbols()
    if not symbols:
        print("ERROR: no symbols in universe.json / extra_tickers.json", file=sys.stderr)
        return 1
    fetched: dict[str, dict] = {}
    errors: dict[str, str] = {}

    remaining = list(symbols)
    for i in range(0, len(remaining), SPARK_BATCH):
        batch = remaining[i : i + SPARK_BATCH]
        try:
            payload = http_json(spark_url(batch))
            got = parse_spark(payload)
            fetched.update(got)
        except Exception as exc:  # noqa: BLE001
            print(f"WARN spark batch {batch[0]}…: {exc}", file=sys.stderr)
        if i + SPARK_BATCH < len(remaining):
            time.sleep(SPARK_PAUSE)

    missing = [s for s in symbols if s not in fetched]
    for i in range(0, len(missing), CHART_BATCH):
        batch = missing[i : i + CHART_BATCH]
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(6, len(batch))) as pool:
            for symbol, quote, err in pool.map(fetch_one, batch):
                if quote:
                    fetched[symbol] = quote
                else:
                    errors[symbol] = err or "unknown error"
                    print(f"WARN {symbol}: {err}", file=sys.stderr)
        if i + CHART_BATCH < len(missing):
            time.sleep(CHART_PAUSE)

    old_quotes = load_existing(out_path)
    quotes = dict(old_quotes)
    quotes.update(fetched)

    if not quotes:
        print("ERROR: no quotes fetched", file=sys.stderr)
        return 1

    if comparable(quotes) == comparable(old_quotes) and out_path.exists():
        print(f"No price changes; leaving {out_path} as-is ({len(old_quotes)} quotes).")
        if errors:
            print(f"Failed symbols: {len(errors)}", file=sys.stderr)
        return 0

    payload = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "quotes": {k: quotes[k] for k in sorted(quotes)},
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {out_path} with {len(payload['quotes'])} quotes "
        f"({len(fetched)} fresh, {len(errors)} failed, {len(symbols)} requested)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
