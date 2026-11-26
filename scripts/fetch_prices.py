#!/usr/bin/env python3
"""Fetch Yahoo Finance chart quotes server-side and write prices.json.

Standard library only. No secrets. Tolerates per-symbol failures.
Symbol universe: scripts/universe.json (TA-35, S&P 100, Israeli banks, FX).
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
USER_AGENT = (
    "Mozilla/5.0 (compatible; options-calc-prices/1.0; "
    "+https://aviad12377-ai.github.io/)"
)
RETRIES = 3
TIMEOUT = 20
BATCH_SIZE = 8
BATCH_PAUSE = 0.25


def load_symbols() -> list[str]:
    data = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    seen: set[str] = set()
    symbols: list[str] = []
    for key in ("banks", "ta35", "sp100", "fx"):
        for item in data.get(key) or []:
            sym = item["symbol"] if isinstance(item, dict) else item
            if sym not in seen:
                seen.add(sym)
                symbols.append(sym)
    return symbols


def chart_url(symbol: str) -> str:
    return (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + quote(symbol, safe="")
        + "?range=1d&interval=1d"
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
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
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


def parse_quote(payload: dict, symbol: str) -> dict:
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        raise RuntimeError("no chart result")
    meta = result[0].get("meta") or {}
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
    fetched: dict[str, dict] = {}
    errors: dict[str, str] = {}

    for i in range(0, len(symbols), BATCH_SIZE):
        batch = symbols[i : i + BATCH_SIZE]
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(6, len(batch))) as pool:
            for symbol, quote, err in pool.map(fetch_one, batch):
                if quote:
                    fetched[symbol] = quote
                else:
                    errors[symbol] = err or "unknown error"
                    print(f"WARN {symbol}: {err}", file=sys.stderr)
        if i + BATCH_SIZE < len(symbols):
            time.sleep(BATCH_PAUSE)

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
    print(f"Wrote {out_path} with {len(payload['quotes'])} quotes ({len(fetched)} fresh, {len(errors)} failed).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
