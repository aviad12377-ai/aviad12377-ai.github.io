#!/usr/bin/env python3
"""Public market briefs (מבזקי שוק) for every site visitor.

Rule-based Hebrew text built only from public market data (Yahoo chart API),
the news hub headlines and a public economic calendar. Tracking only: no
recommendations. Writes data/briefs/<date>-<slot>.json, index.json, latest.json.

  python3 scripts/make_brief.py --slot auto        # picks the slot from the Israel clock
  python3 scripts/make_brief.py --slot close --force
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from news_util import IL, iso_il  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "data", "briefs")
UA = "Mozilla/5.0 (compatible; balances-portal-briefs/1.0; +https://aviad12377-ai.github.io/)"
DISCLAIMER = "מידע כללי בלבד, לא ייעוץ. אין כאן המלצה לקנות, למכור או להחזיק נייר ערך כלשהו."

SLOTS = {
    "morning": {"at": (8, 0), "edition": "מבזק בוקר", "days": range(0, 5)},
    "open": {"at": (10, 15), "edition": "פתיחת המסחר בתל אביב", "days": range(0, 5)},
    "midday": {"at": (13, 0), "edition": "סיכום צהריים", "days": range(0, 5)},
    "us_open": {"at": (16, 45), "edition": "פתיחת וול סטריט", "days": range(0, 5)},
    "evening": {"at": (19, 45), "edition": "מבזק ערב", "days": range(0, 5)},
    "close": {"at": (23, 20), "edition": "סגירת המסחר", "days": range(0, 5)},
    "week_ahead": {"at": (9, 0), "edition": "השבוע שמחכה לנו", "days": [6]},
}
EDITIONS = {**{k: v["edition"] for k, v in SLOTS.items()}, "week": "סיכום השבוע", "month": "סיכום החודש"}

# symbol, name, group, gender(m/f), kind(index|fx|yield|cmd|crypto), digits
INSTR = [
    ("TA35.TA", "ת״א 35", "ישראל", "m", "index", 2),
    ("^TA125.TA", "ת״א 125", "ישראל", "m", "index", 2),
    ("ILS=X", "דולר/שקל", "ישראל", "m", "fx", 3),
    ("EURILS=X", "אירו/שקל", "ישראל", "m", "fx", 3),
    ("^GSPC", "S&P 500", "ארה״ב", "m", "index", 2),
    ("^IXIC", "נאסד״ק", "ארה״ב", "m", "index", 2),
    ("^DJI", "דאו ג׳ונס", "ארה״ב", "m", "index", 2),
    ("^RUT", "ראסל 2000", "ארה״ב", "m", "index", 2),
    ("^VIX", "מדד הפחד VIX", "ארה״ב", "m", "index", 2),
    ("ES=F", "חוזה S&P 500", "ארה״ב", "m", "index", 2),
    ("NQ=F", "חוזה נאסד״ק 100", "ארה״ב", "m", "index", 2),
    ("^TNX", "תשואת 10 שנים בארה״ב", "אג״ח", "f", "yield", 3),
    ("^STOXX", "סטוקס 600", "אירופה ואסיה", "m", "index", 2),
    ("^GDAXI", "דאקס", "אירופה ואסיה", "m", "index", 2),
    ("^N225", "ניקיי", "אירופה ואסיה", "m", "index", 2),
    ("^KS11", "קוספי", "אירופה ואסיה", "m", "index", 2),
    ("^TWII", "טאייוואן", "אירופה ואסיה", "m", "index", 2),
    ("^HSI", "האנג סנג", "אירופה ואסיה", "m", "index", 2),
    ("CL=F", "נפט WTI", "סחורות וקריפטו", "m", "cmd", 2),
    ("BZ=F", "נפט ברנט", "סחורות וקריפטו", "m", "cmd", 2),
    ("GC=F", "זהב", "סחורות וקריפטו", "m", "cmd", 1),
    ("SI=F", "כסף", "סחורות וקריפטו", "m", "cmd", 2),
    ("BTC-USD", "ביטקוין", "סחורות וקריפטו", "m", "crypto", 0),
    ("ETH-USD", "את׳ריום", "סחורות וקריפטו", "m", "crypto", 0),
]
BYSYM = {i[0]: i for i in INSTR}
DAYS_HE = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]
MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]

CAL_HE = [
    (r"^core cpi", "מדד המחירים לצרכן, ליבה"), (r"^cpi", "מדד המחירים לצרכן"),
    (r"non-farm employment change", "דוח התעסוקה (משרות חדשות)"), (r"^adp non-farm", "דוח ADP על משרות במגזר הפרטי"),
    (r"unemployment rate", "שיעור האבטלה"), (r"unemployment claims", "תביעות דמי אבטלה"),
    (r"federal funds rate", "החלטת הריבית של הפד"), (r"fomc statement", "הודעת הפד"), (r"fomc meeting minutes", "פרוטוקול הפד"),
    (r"fed chair .* speaks", "נאום יו״ר הפד"), (r"core pce price index", "מדד PCE ליבה"),
    (r"^advance gdp|^prelim gdp|^final gdp|^gdp", "תוצר"), (r"^core retail sales", "מכירות קמעונאיות, ליבה"), (r"^retail sales", "מכירות קמעונאיות"),
    (r"^ppi|core ppi", "מדד המחירים ליצרן"), (r"ism manufacturing pmi", "מדד מנהלי הרכש בתעשייה (ISM)"), (r"ism services pmi", "מדד מנהלי הרכש בשירותים (ISM)"),
    (r"jolts", "משרות פנויות (JOLTS)"), (r"cb consumer confidence", "אמון הצרכנים"), (r"uom consumer sentiment", "סנטימנט הצרכנים (מישיגן)"),
    (r"main refinancing rate", "החלטת הריבית של הבנק המרכזי האירופי"), (r"ecb president .* speaks", "נאום נשיאת הבנק המרכזי האירופי"),
    (r"boj policy rate", "החלטת הריבית ביפן"), (r"official bank rate", "החלטת הריבית בבריטניה"),
]
COUNTRY_HE = {"USD": "ארה״ב", "EUR": "אירופה", "GBP": "בריטניה", "JPY": "יפן", "CNY": "סין"}


# ---------- data ----------
BROWSER_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
                   "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"}


def get_json(url, timeout=20):
    hdr = BROWSER_HEADERS if "nasdaq.com" in url else {"User-Agent": UA, "Accept": "application/json"}
    req = urllib.request.Request(url, headers=hdr)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def chart(sym, rng="3mo"):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range={rng}&interval=1d"
    for host in ("query1", "query2"):
        try:
            d = get_json(url.replace("query1", host))["chart"]["result"][0]
            break
        except Exception:  # noqa: BLE001
            d = None
    if not d:
        return None
    m = d["meta"]
    ts = d.get("timestamp") or []
    cl = (d.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    tz = dt.timezone(dt.timedelta(seconds=m.get("gmtoffset", 0)))
    bars = []
    for t, c in zip(ts, cl):
        if c is None:
            continue
        day = dt.datetime.fromtimestamp(t, tz).date()
        if bars and bars[-1][0] == day:
            bars[-1] = (day, c)
        else:
            bars.append((day, c))
    price = m.get("regularMarketPrice")
    mt = dt.datetime.fromtimestamp(m.get("regularMarketTime") or 0, dt.timezone.utc).astimezone(IL)
    mday = dt.datetime.fromtimestamp(m.get("regularMarketTime") or 0, tz).date()
    if price is None or not bars:
        return None
    # make sure the last bar is the latest session at the live price
    if bars[-1][0] == mday:
        bars[-1] = (mday, price)
    elif mday > bars[-1][0]:
        bars.append((mday, price))
    reg = (m.get("currentTradingPeriod") or {}).get("regular") or {}
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    is_open = bool(reg) and reg.get("start", 0) <= now <= reg.get("end", 0) and (now - (m.get("regularMarketTime") or 0)) < 1800
    return {"sym": sym, "price": price, "time": mt, "day": mday, "bars": bars, "open": is_open}


def fetch_all(symbols, rng):
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for sym, res in zip(symbols, ex.map(lambda s: chart(s, rng), symbols)):
            if res:
                out[sym] = res
    return out


def day_change(q):
    b = q["bars"]
    if len(b) < 2:
        return None
    prev = b[-2][1]
    return (q["price"] / prev - 1) * 100 if prev else None


def change_since(q, since_day, inclusive=False):
    """% change from the last close strictly before since_day to the latest price."""
    base = None
    for d, c in q["bars"]:
        if d < since_day or (inclusive and d == since_day):
            base = c
    if base is None:
        return None
    return (q["price"] / base - 1) * 100


# ---------- formatting ----------
def num(x, digits=2):
    return f"{x:,.{digits}f}"


def pct(x, sign=True):
    s = f"{abs(x):.2f}%"
    if not sign:
        return s
    return ("+" if x > 0 else "−" if x < 0 else "") + s


def bp(q):
    b = q["bars"]
    return (q["price"] - b[-2][1]) * 100 if len(b) >= 2 else 0


def verb(chg, live, gender="m"):
    f = gender == "f"
    if abs(chg) < 0.05:
        return ("נסחרת" if f else "נסחר") + " כמעט ללא שינוי" if live else ("ננעלה" if f else "ננעל") + " כמעט ללא שינוי"
    up = chg > 0
    if live:
        big = abs(chg) >= 2
        if up:
            return ("מזנקת" if f else "מזנק") if big else ("עולה" if f else "עולה")
        return ("צונחת" if f else "צונח") if big else ("יורדת" if f else "יורד")
    return ("ננעלה" if f else "ננעל") + (" בעלייה של" if up else " בירידה של")


def phrase(q, live=None, with_level=True):
    """e.g. 'ת״א 35 עולה 1.20% ל־3,889.50' or 'S&P 500 ננעל בעלייה של 0.80% ב־7,182.78'."""
    sym, name, _g, gender, kind, digits = BYSYM[q["sym"]]
    chg = day_change(q)
    if chg is None:
        return None
    if live is None:
        live = q["open"]
    if kind == "yield":
        d = bp(q)
        if abs(d) < 0.5:
            return f"{name} {'נסחרת' if live else 'ננעלה'} סביב {q['price']:.2f}%"
        return f"{name} {'עולה' if d > 0 else 'יורדת'} ב־{abs(d):.0f} נקודות בסיס ל־{q['price']:.2f}%" if live else \
            f"{name} {'עלתה' if d > 0 else 'ירדה'} ב־{abs(d):.0f} נקודות בסיס ל־{q['price']:.2f}%"
    v = verb(chg, live, gender)
    body = f"{name} {v}" if abs(chg) < 0.05 else f"{name} {v} {pct(chg, False)}"
    if with_level:
        unit = {"fx": " שקלים", "cmd": " דולר", "crypto": " דולר"}.get(kind, "")
        if kind == "cmd" and "נפט" in name:
            unit = " דולר לחבית"
        if kind == "cmd" and name in ("זהב", "כסף"):
            unit = " דולר לאונקיה"
        prep = "ל־" if live else "ב־" if abs(chg) >= 0.05 else "ב־"
        body += f" {prep}{num(q['price'], digits)}{unit}"
    return body


def stamp(q, now):
    if q["day"] == now.date() or q["open"]:
        return q["time"].strftime("%H:%M")
    return q["day"].strftime("%d.%m")


def index_rows(qs, syms, now):
    rows = []
    for s in syms:
        q = qs.get(s)
        if not q:
            continue
        _s, name, group, _g, kind, digits = BYSYM[s]
        chg = day_change(q)
        if chg is None:
            continue
        if kind == "yield":
            d = bp(q)
            ct, dr = (("+" if d > 0 else "−") + f"{abs(d):.0f} נ״ב" if abs(d) >= 0.5 else "0 נ״ב"), ("up" if d > 0.5 else "down" if d < -0.5 else "level")
            disp = f"{q['price']:.2f}%"
        else:
            ct, dr = pct(chg), ("up" if chg > 0.05 else "down" if chg < -0.05 else "level")
            disp = num(q["price"], digits)
        rows.append({"group": group, "name": name, "display": disp, "change_text": ct, "dir": dr, "note": stamp(q, now), "live": q["open"]})
    return rows


def movers(qs, names, n=3, since=None):
    rows = []
    for sym, name in names.items():
        q = qs.get(sym)
        if not q:
            continue
        c = change_since(q, since) if since else day_change(q)
        if c is None or abs(c) > 60:
            continue
        rows.append({"sym": sym.replace(".TA", ""), "name": name, "chg": round(c, 2)})
    rows.sort(key=lambda r: r["chg"], reverse=True)
    up = [r for r in rows if r["chg"] > 0][:n]
    down = [r for r in reversed(rows) if r["chg"] < 0][:n]
    return {"up": up, "down": down}


def mover_text(m, label):
    parts = []
    if m["up"]:
        parts.append("בולטות בעליות " + ", ".join(f"{r['name']} ({pct(r['chg'])})" for r in m["up"]))
    if m["down"]:
        parts.append("ובירידות " + ", ".join(f"{r['name']} ({pct(r['chg'])})" for r in m["down"]))
    pre = "ב־" if re.match(r"[A-Za-z0-9]", label) else "ב"
    return (f"{pre}{label} " + " ".join(parts) + ".") if parts else ""


def days_txt(up, n):
    one = "יום עלייה אחד" if up == 1 else ("אף יום עלייה" if up == 0 else f"{up} ימי עלייה")
    return f"{one} מתוך {n} ימי מסחר"


def joined(parts):
    parts = [p for p in parts if p]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + " ו" + parts[-1]


# ---------- headlines / calendar ----------
def load_hub():
    try:
        return json.load(open(os.path.join(ROOT, "data", "news-hub.json"), encoding="utf-8")).get("items", [])
    except Exception:
        return []


def pick_headlines(since, n_he=3, n_en=3):
    bad = re.compile(r"\?|should (i|you|we)|good investment|stocks? to buy|best .* to buy|\bmy \$|\bi'm\b|\bi am\b|retire|podcast|opinion|quiz|פרסומ|ספורט|סלבס|רכילות|טור דעה")
    items = [i for i in load_hub() if i.get("time", "") >= iso_il(since) and not bad.search(i.get("title", "").lower())]
    scored = [i for i in items if i.get("score", 0) > 0]
    if len(scored) >= n_he + n_en:
        items = scored
    items.sort(key=lambda i: (i.get("score", 0) + len(i.get("also", [])), i.get("time", "")), reverse=True)
    he = [i for i in items if i.get("lang") == "he"][:n_he]
    en = [i for i in items if i.get("lang") != "he"][:n_en]
    return [{"title": i["title"], "source": i["source"], "url": i["url"], "lang": i.get("lang", "he")} for i in he + en]


def calendar_week(start, end):
    try:
        rows = get_json("https://nfs.faireconomy.media/ff_calendar_thisweek.json")
    except Exception:
        rows = []
    out = []
    for r in rows:
        if r.get("impact") not in ("High", "Medium") or r.get("country") not in COUNTRY_HE:
            continue
        title = None
        for rx, he in CAL_HE:
            if re.search(rx, (r.get("title") or "").lower()):
                title = he
                break
        if not title:
            continue
        try:
            when = dt.datetime.fromisoformat(r["date"]).astimezone(IL)
        except Exception:
            continue
        if not (start <= when.date() <= end):
            continue
        out.append({"when": iso_il(when), "day": DAYS_HE[when.weekday()], "hm": when.strftime("%H:%M"), "title": title,
                    "country": COUNTRY_HE[r["country"]], "impact": "גבוהה" if r["impact"] == "High" else "בינונית",
                    "forecast": r.get("forecast") or "", "previous": r.get("previous") or ""})
    # Israeli events (Bank of Israel, CBS) from the official-source file data/il-calendar.json
    for e in il_events(start, end):
        out.append(e)
    out.sort(key=lambda x: x["when"])
    seen, uniq = set(), []
    for e in out:
        k = (e["when"][:13], e["title"])
        if k not in seen:
            seen.add(k)
            uniq.append(e)
    return uniq[:20]


def load_il_calendar():
    try:
        return json.load(open(os.path.join(ROOT, "data", "il-calendar.json"), encoding="utf-8")).get("items", [])
    except Exception:
        return []


def il_events(start, end):
    out = []
    for r in load_il_calendar():
        try:
            d = dt.date.fromisoformat(r["date"])
        except Exception:
            continue
        if not (start <= d <= end):
            continue
        hm = r.get("hm") or ""
        when = dt.datetime.combine(d, dt.time.fromisoformat(hm) if hm else dt.time(23, 59), IL)
        out.append({"when": iso_il(when), "day": DAYS_HE[d.weekday()], "hm": hm or "במהלך היום", "title": r["title"],
                    "country": "ישראל", "impact": r.get("impact", "גבוהה"), "forecast": "", "previous": "", "note": r.get("note", ""),
                    "source": r.get("source", ""), "url": r.get("url", "")})
    return out


def next_il(today):
    """Next Bank of Israel decision and next CPI release from the official-source calendar."""
    nxt = {}
    for r in load_il_calendar():
        if r.get("kind") in ("boi", "cpi") and r["date"] >= today.isoformat() and r["kind"] not in nxt:
            nxt[r["kind"]] = r
    parts = []
    for k in ("boi", "cpi"):
        r = nxt.get(k)
        if r:
            d = dt.date.fromisoformat(r["date"])
            parts.append(f"{r['title']}: יום {DAYS_HE[d.weekday()]}, {d.day}.{d.month}.{d.year}" + (f" ב־{r['hm']}" if r.get("hm") else ""))
    return ("בקרוב בישראל: " + ". ".join(parts) + ".") if parts else ""


def earnings_week(start, end, n=10):
    found = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            try:
                rows = get_json(f"https://api.nasdaq.com/api/calendar/earnings?date={d.isoformat()}", 12)["data"]["rows"] or []
            except Exception:
                rows = []
            for r in rows:
                try:
                    cap = int(re.sub(r"[^0-9]", "", r.get("marketCap") or "0") or 0)
                except ValueError:
                    cap = 0
                when = {"time-pre-market": "לפני הפתיחה", "time-after-hours": "אחרי הסגירה"}.get(r.get("time"), "")
                found.append({"day": DAYS_HE[d.weekday()], "date": d.strftime("%d.%m"), "symbol": r.get("symbol"), "name": r.get("name", "")[:40], "cap": cap, "when": when})
        d += dt.timedelta(days=1)
    found.sort(key=lambda r: r["cap"], reverse=True)
    seen, uniq = set(), []
    for r in found:
        r["name"] = r["name"].rstrip(". ")
        if r["name"] in seen:
            continue
        seen.add(r["name"])
        uniq.append(r)
    return uniq[:n]


# ---------- stats ----------
def period_stats(q, start_day):
    closes = [(d, c) for d, c in q["bars"]]
    base = None
    seq = []
    for d, c in closes:
        if d < start_day:
            base = c
        else:
            seq.append((d, c))
    if base is None or not seq:
        return None
    rets = []
    prev = base
    peak, mdd = base, 0.0
    for d, c in seq:
        rets.append((d, (c / prev - 1) * 100))
        prev = c
        peak = max(peak, c)
        mdd = min(mdd, (c / peak - 1) * 100)
    vals = [r for _, r in rets]
    mean = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / (len(vals) - 1)) if len(vals) > 1 else 0
    best = max(rets, key=lambda x: x[1])
    worst = min(rets, key=lambda x: x[1])
    return {"change": (seq[-1][1] / base - 1) * 100, "days": len(vals), "up_days": sum(1 for v in vals if v > 0),
            "best": {"date": best[0].strftime("%d.%m"), "chg": round(best[1], 2)}, "worst": {"date": worst[0].strftime("%d.%m"), "chg": round(worst[1], 2)},
            "max_drawdown": round(mdd, 2), "vol_annual": round(sd * math.sqrt(252), 1), "base": base, "series": seq}


def norm_series(q, start_day, name):
    st = period_stats(q, start_day)
    if not st:
        return None
    pts = [["בסיס", 100.0]] + [[d.isoformat(), round(c / st["base"] * 100, 2)] for d, c in st["series"]]
    return {"name": name, "points": pts}


def line_chart(title, series):
    """Align every series on the union of trading dates; labels shown as dd.mm."""
    series = [s for s in series if s]
    days = sorted({p[0] for s in series for p in s["points"] if p[0] != "בסיס"})
    labels = ["בסיס"] + days
    for s in series:
        s["points"] = [[p[0] if p[0] == "בסיס" else dt.date.fromisoformat(p[0]).strftime("%d.%m"), p[1], labels.index(p[0])] for p in s["points"]]
    return {"type": "line", "title": title, "labels": ["בסיס"] + [dt.date.fromisoformat(d).strftime("%d.%m") for d in days], "series": series}


# ---------- universe ----------
def load_universe():
    u = json.load(open(os.path.join(ROOT, "scripts", "universe.json"), encoding="utf-8"))
    ta = {r["symbol"]: r["name"] for r in u.get("ta35", [])}
    sp = {r["symbol"]: r["name"] for r in u.get("sp100", []) if r["symbol"] != "GOOG"}
    return ta, sp


# ---------- builders ----------
def daily(slot, now, qs, ta_q, sp_q, ta, sp):
    g = lambda s: qs.get(s)  # noqa: E731
    today = now.date()
    il_live = g("TA35.TA") and (g("TA35.TA")["open"] or g("TA35.TA")["day"] == today)
    us_live = g("^GSPC") and (g("^GSPC")["open"] or (g("^GSPC")["day"] == today and slot == "close"))
    ta_m = movers(ta_q, ta) if il_live else {"up": [], "down": []}
    sp_m = movers(sp_q, sp) if (us_live or slot in ("morning", "open", "midday")) else {"up": [], "down": []}
    stories, lead = [], []

    def ph(sym, **kw):
        q = g(sym)
        return phrase(q, **kw) if q else None

    # Israel
    if il_live:
        t = joined([ph("TA35.TA"), ph("^TA125.TA")])
        q = g("TA35.TA")
        when = "במסחר" if q["open"] else "בנעילה"
        txt = f"{t} ({when}, {stamp(q, now)})."
        mt = mover_text(ta_m, "ת״א 35")
        stories.append({"title": "תל אביב", "text": " ".join(x for x in [txt, mt, (ph("ILS=X") or "") + "."] if x and x != ".")})
        c = day_change(q)
        lead.append(f"ת״א 35 {verb(c, q['open'])} {pct(c, False)}" if abs(c) >= 0.05 else "ת״א 35 ללא שינוי")
    elif g("TA35.TA"):
        stories.append({"title": "תל אביב", "text": f"הבורסה בתל אביב לא נסחרת כרגע. {ph('TA35.TA', live=False)} ביום המסחר האחרון ({stamp(g('TA35.TA'), now)})."})

    # Wall Street
    us_syms = ["^GSPC", "^IXIC", "^DJI"]
    if us_live:
        t = joined([ph(s) for s in us_syms])
        extra = joined([ph("^RUT"), ph("^VIX")])
        mt = mover_text(sp_m, "S&P 100")
        state = "במסחר" if g("^GSPC")["open"] else "בנעילה"
        stories.append({"title": "וול סטריט", "text": f"{t} ({state}). {extra}. {mt}".strip()})
        c = day_change(g("^GSPC"))
        n = day_change(g("^IXIC")) if g("^IXIC") else None
        if g("^GSPC")["open"]:
            lead.insert(0 if slot in ("evening", "us_open") else len(lead), f"S&P 500 {verb(c, True)} {pct(c, False)}" + (f", נאסד״ק {pct(n)}" if n is not None else ""))
        else:
            lead.insert(0, f"וול סטריט ננעלה {'בעלייה' if c > 0 else 'בירידה'}: S&P 500 {pct(c)}" + (f", נאסד״ק {pct(n)}" if n is not None else ""))
    else:
        fut = joined([ph("ES=F", live=True), ph("NQ=F", live=True)]) if g("ES=F") and g("ES=F")["open"] else ""
        last = joined([ph(s, live=False) for s in us_syms if g(s)])
        mt = mover_text(sp_m, "S&P 100 ביום המסחר האחרון") if slot in ("morning", "open") else ""
        txt = (f"בנעילה האחרונה ({stamp(g('^GSPC'), now) if g('^GSPC') else ''}) {last}." if last else "")
        if fut:
            txt += f" בחוזים: {fut}."
        stories.append({"title": "וול סטריט", "text": (txt + " " + mt).strip()})
        if slot in ("evening", "close") and g("^GSPC") and g("^GSPC")["day"] < today:
            lead.append("וול סטריט לא נסחרה היום")
            stories[-1]["text"] = "הבורסות בניו יורק לא נסחרו היום. " + stories[-1]["text"]
        if slot in ("morning", "open", "midday") and fut:
            c = day_change(g("ES=F"))
            lead.append(f"חוזה S&P 500 {pct(c)}")

    # Europe & Asia
    if slot in ("morning", "open"):
        t = joined([ph(s) for s in ("^N225", "^KS11", "^TWII", "^HSI") if g(s)])
        if t:
            stories.append({"title": "אסיה", "text": t + "."})
            best = max((s for s in ("^N225", "^KS11", "^TWII", "^HSI") if g(s)), key=lambda s: abs(day_change(g(s)) or 0), default=None)
            if best and slot == "morning":
                lead.insert(0, f"{BYSYM[best][1]} {verb(day_change(g(best)), g(best)['open'])} {pct(day_change(g(best)), False)}")
    if slot in ("midday", "us_open", "evening"):
        t = joined([ph(s) for s in ("^STOXX", "^GDAXI") if g(s)])
        if t:
            stories.append({"title": "אירופה", "text": t + "."})

    # rates, commodities, crypto
    r = joined([ph("^TNX"), ph("ILS=X") if not il_live else None, ph("EURILS=X")])
    if r:
        stories.append({"title": "אג״ח ומטבעות", "text": r + "."})
    c = joined([ph("CL=F"), ph("GC=F"), ph("BTC-USD")])
    if c:
        stories.append({"title": "סחורות וקריפטו", "text": c + "."})
        btc = g("BTC-USD")
        if btc and abs(day_change(btc) or 0) >= 3:
            lead.append(f"ביטקוין {pct(day_change(btc))}")
    fx = g("ILS=X")
    if fx and abs(day_change(fx) or 0) >= 0.5:
        d = day_change(fx)
        lead.append(f"הדולר {'מתחזק' if d > 0 else 'נחלש'} ל־{fx['price']:.3f} שקלים")

    cal = []
    if slot in ("morning", "open", "midday", "us_open"):
        cal = [e for e in calendar_week(today, today) if e["hm"] >= now.strftime("%H:%M")]
        if cal:
            stories.append({"title": "היום ביומן", "text": " ".join(f"{e['hm']}: {e['title']} ({e['country']})." for e in cal[:6])})

    title = "; ".join(lead[:3]) or EDITIONS[slot]
    summary = " ".join(s["text"] for s in stories[:2])
    if len(summary) > 420:
        summary = summary[:417].rsplit(" ", 1)[0] + "…"
    groups = {"morning": ["^N225", "^KS11", "^TWII", "^HSI", "ES=F", "NQ=F", "^GSPC", "^IXIC", "^DJI", "TA35.TA", "ILS=X", "^TNX", "CL=F", "GC=F", "BTC-USD"]}
    syms = groups.get(slot, ["TA35.TA", "^TA125.TA", "ILS=X", "EURILS=X", "^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "ES=F", "^STOXX", "^TNX", "CL=F", "GC=F", "BTC-USD"])
    if slot == "close":
        syms = [s for s in syms if s not in ("ES=F",)]
    return {"title": title, "summary": summary, "stories": stories, "indices": index_rows(qs, syms, now),
            "movers": {"il": ta_m, "us": sp_m}, "calendar": cal}


def week_review(now, qs, ta_q, sp_q, ta, sp):
    today = now.date()
    monday = today - dt.timedelta(days=today.weekday())
    rows, perf = [], []
    for s in ["TA35.TA", "^TA125.TA", "^GSPC", "^IXIC", "^DJI", "^RUT", "^STOXX", "^N225", "ILS=X", "^TNX", "CL=F", "GC=F", "BTC-USD"]:
        q = qs.get(s)
        if not q:
            continue
        st = period_stats(q, monday)
        if not st:
            continue
        name = BYSYM[s][1]
        if BYSYM[s][4] == "yield":
            chg_txt = f"{(q['price'] - st['base']) * 100:+.0f} נ״ב".replace("+", "+").replace("-", "−")
        else:
            chg_txt = pct(st["change"])
            perf.append((name, st["change"]))
        rows.append([name, num(q["price"], BYSYM[s][5]), chg_txt, f"{st['up_days']}/{st['days']}", pct(st["best"]["chg"]), pct(st["worst"]["chg"])])
    perf.sort(key=lambda x: x[1], reverse=True)
    ta_m = movers(ta_q, ta, 5, since=monday)
    sp_m = movers(sp_q, sp, 5, since=monday)
    spx, ta35 = qs.get("^GSPC"), qs.get("TA35.TA")
    s1 = period_stats(spx, monday) if spx else None
    s2 = period_stats(ta35, monday) if ta35 else None
    lead = []
    if s2:
        lead.append(f"ת״א 35 {'עלה' if s2['change'] > 0 else 'ירד'} השבוע {pct(s2['change'], False)}")
    if s1:
        lead.append(f"S&P 500 {'עלה' if s1['change'] > 0 else 'ירד'} {pct(s1['change'], False)}")
    if perf:
        lead.append(f"הבולט: {perf[0][0]} {pct(perf[0][1])}" if abs(perf[0][1]) >= abs(perf[-1][1]) else f"החלש: {perf[-1][0]} {pct(perf[-1][1])}")
    stories = []
    if s2:
        stories.append({"title": "תל אביב בשבוע", "text": f"ת״א 35 {'עלה' if s2['change'] > 0 else 'ירד'} השבוע {pct(s2['change'], False)}, עם {days_txt(s2['up_days'], s2['days'])}. היום הטוב: {s2['best']['date']} ({pct(s2['best']['chg'])}), היום החלש: {s2['worst']['date']} ({pct(s2['worst']['chg'])}). " + mover_text(ta_m, "ת״א 35 השבוע")})
    if s1:
        stories.append({"title": "וול סטריט בשבוע", "text": f"S&P 500 {'עלה' if s1['change'] > 0 else 'ירד'} השבוע {pct(s1['change'], False)} ל־{num(spx['price'])}, עם {days_txt(s1['up_days'], s1['days'])}. " + mover_text(sp_m, "S&P 100 השבוע")})
    if perf:
        stories.append({"title": "מי הוביל ומי פיגר", "text": f"הטוב ביותר השבוע מבין המדדים והנכסים שאנחנו עוקבים אחריהם: {perf[0][0]} ({pct(perf[0][1])}). החלש ביותר: {perf[-1][0]} ({pct(perf[-1][1])})."})
    nxt_mon = monday + dt.timedelta(days=7)
    earn = earnings_week(nxt_mon, nxt_mon + dt.timedelta(days=4), 8)
    if earn:
        stories.append({"title": "מה בשבוע הבא", "text": "דוחות בולטים בוול סטריט: " + ", ".join(f"{e['name']} ({e['day']}{', ' + e['when'] if e['when'] else ''})" for e in earn[:6]) + ". לוח נתוני המאקרו המלא יופיע בסקירת \"השבוע שמחכה לנו\" ביום ראשון בבוקר."})
    il_next = next_il(today)
    il_week = il_events(nxt_mon - dt.timedelta(days=1), nxt_mon + dt.timedelta(days=4))
    if il_week or il_next:
        txt = " ".join(f"{e['day']} {e['hm']}: {e['title']}." for e in il_week)
        stories.append({"title": "בישראל בשבוע הבא" if il_week else "בקרוב בישראל", "text": (txt + " " + (il_next if not il_week else "")).strip()})
    charts = [norm_series(qs[s], monday, BYSYM[s][1]) for s in ("TA35.TA", "^GSPC", "^IXIC") if s in qs]
    return {"title": "סיכום השבוע: " + ", ".join(lead[:3]), "summary": " ".join(s["text"] for s in stories[:2])[:420],
            "stories": stories, "table": {"columns": ["נכס", "רמה", "שינוי שבועי", "ימי עלייה", "היום הטוב", "היום החלש"], "rows": rows},
            "movers": {"il": ta_m, "us": sp_m}, "earnings": earn,
            "charts": [line_chart("השבוע במדדים (בסיס 100 = נעילת השבוע הקודם)", charts),
                       {"type": "bar", "title": "שינוי שבועי באחוזים", "bars": [[n, round(c, 2)] for n, c in perf]}]}


def month_review(now, qs, ta_q, sp_q, ta, sp):
    today = now.date()
    first = today.replace(day=1)
    ytd0 = today.replace(month=1, day=1)
    rows, perf, stats = [], [], []
    for s in ["TA35.TA", "^TA125.TA", "^GSPC", "^IXIC", "^DJI", "^RUT", "^STOXX", "^N225", "ILS=X", "EURILS=X", "^TNX", "CL=F", "GC=F", "BTC-USD"]:
        q = qs.get(s)
        if not q:
            continue
        st = period_stats(q, first)
        if not st:
            continue
        name, kind = BYSYM[s][1], BYSYM[s][4]
        ytd = change_since(q, ytd0)
        if kind == "yield":
            rows.append([name, f"{q['price']:.2f}%", f"{(q['price'] - st['base']) * 100:+.0f} נ״ב".replace("-", "−"), "—", f"{st['up_days']}/{st['days']}", "—", "—"])
            continue
        perf.append((name, st["change"]))
        rows.append([name, num(q["price"], BYSYM[s][5]), pct(st["change"]), pct(ytd) if ytd is not None else "—", f"{st['up_days']}/{st['days']}", pct(st["max_drawdown"]), f"{st['vol_annual']}%"])
        if s in ("TA35.TA", "^GSPC", "^IXIC"):
            stats.append({"name": name, **{k: st[k] for k in ("change", "days", "up_days", "best", "worst", "max_drawdown", "vol_annual")}})
    perf.sort(key=lambda x: x[1], reverse=True)
    main = {s["name"]: s["change"] for s in stats}
    a, b = main.get("ת״א 35"), main.get("S&P 500")
    vals = [v for v in (a, b) if v is not None]
    if vals and all(v >= 1 for v in vals):
        verdict = "חודש טוב"
    elif vals and all(v <= -1 for v in vals):
        verdict = "חודש חלש"
    elif vals and all(v > 0 for v in vals):
        verdict = "חודש חיובי מתון"
    elif vals and all(v < 0 for v in vals):
        verdict = "חודש שלילי מתון"
    else:
        verdict = "חודש מעורב"
    why = joined([f"{n} {pct(c)}" for n, c in main.items()])
    month_name = MONTHS_HE[today.month - 1]
    ta_m = movers(ta_q, ta, 5, since=first)
    sp_m = movers(sp_q, sp, 5, since=first)
    stories = [{"title": f"השורה התחתונה: {verdict}", "text": f"לפי המספרים, {month_name} היה {verdict}: {why}. מבין הנכסים שאנחנו עוקבים אחריהם הטוב ביותר היה {perf[0][0]} ({pct(perf[0][1])}) והחלש ביותר {perf[-1][0]} ({pct(perf[-1][1])})." if perf else ""}]
    for s in stats:
        stories.append({"title": s["name"] + " בחודש", "text": f"{s['name']} {'עלה' if s['change'] > 0 else 'ירד'} {pct(s['change'], False)} ב{month_name}, עם {days_txt(s['up_days'], s['days'])}. הירידה המקסימלית מהשיא בתוך החודש: {pct(s['max_drawdown'], False)}. היום הטוב: {s['best']['date']} ({pct(s['best']['chg'])}), החלש: {s['worst']['date']} ({pct(s['worst']['chg'])}). תנודתיות שנתית: כ־{s['vol_annual']}%."})
    stories.append({"title": "המניות הבולטות", "text": " ".join(x for x in [mover_text(ta_m, f"ת״א 35 ב{month_name}"), mover_text(sp_m, f"S&P 100 ב{month_name}")] if x)})
    charts = [norm_series(qs[s], first, BYSYM[s][1]) for s in ("TA35.TA", "^GSPC", "^IXIC", "GC=F", "BTC-USD") if s in qs]
    return {"title": f"סיכום {month_name}: {verdict}. " + why, "summary": stories[0]["text"][:420], "verdict": verdict, "stories": stories,
            "stats": stats, "movers": {"il": ta_m, "us": sp_m},
            "table": {"columns": ["נכס", "רמה", "שינוי חודשי", "מתחילת השנה", "ימי עלייה", "ירידה מקסימלית", "תנודתיות שנתית"], "rows": rows},
            "charts": [line_chart(f"{month_name} במדדים (בסיס 100 = נעילת החודש הקודם)", charts),
                       {"type": "bar", "title": "שינוי חודשי באחוזים", "bars": [[n, round(c, 2)] for n, c in perf]}]}


def week_ahead(now):
    today = now.date()
    start = today if today.weekday() == 6 else today + dt.timedelta(days=(6 - today.weekday()) % 7)
    end = start + dt.timedelta(days=5)
    cal = calendar_week(start, end)
    mon = start + dt.timedelta(days=1)
    earn = earnings_week(mon, mon + dt.timedelta(days=4), 10)
    high = [e for e in cal if e["impact"] == "גבוהה"]
    lead = []
    if high:
        lead.append("השבוע: " + ", ".join(dict.fromkeys(e["title"] for e in high[:3])))
    if earn:
        lead.append("דוחות: " + ", ".join(e["name"].split(",")[0].split(" Inc")[0] for e in earn[:3]))
    stories = []
    if cal:
        stories.append({"title": "נתוני מאקרו", "text": " ".join(f"{e['day']} {e['hm']}: {e['title']} ({e['country']})." for e in cal[:10])})
    if earn:
        stories.append({"title": "דוחות כספיים", "text": " ".join(f"{e['day']} {e['date']}: {e['name']}{' (' + e['when'] + ')' if e['when'] else ''}." for e in earn)})
    il = next_il(today)
    if il:
        stories.append({"title": "בנק ישראל והלמ״ס", "text": il})
    if not stories:
        stories.append({"title": "השבוע", "text": "לא מצאנו כרגע אירועים בולטים בלוח. נעדכן במבזקים היומיים."})
    return {"title": "; ".join(lead) or "השבוע שמחכה לנו", "summary": stories[0]["text"][:420], "stories": stories, "calendar": cal, "earnings": earn}


def is_month_end(day):
    nxt = day + dt.timedelta(days=1)
    while nxt.weekday() >= 5:
        nxt += dt.timedelta(days=1)
    return nxt.month != day.month


def pick_slot(now, window=(-10, 55)):
    for slot, cfg in SLOTS.items():
        if now.weekday() not in cfg["days"]:
            continue
        target = now.replace(hour=cfg["at"][0], minute=cfg["at"][1], second=0, microsecond=0)
        mins = (now - target).total_seconds() / 60
        if window[0] <= mins <= window[1]:
            return slot
    return None


def save(brief):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{brief['id']}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(brief, f, ensure_ascii=False, indent=1)
        f.write("\n")
    idx_path = os.path.join(OUT, "index.json")
    try:
        idx = json.load(open(idx_path, encoding="utf-8"))
    except Exception:
        idx = {"items": []}
    items = [i for i in idx.get("items", []) if i.get("id") != brief["id"]]
    items.append({k: brief.get(k) for k in ("id", "slot", "kind", "edition", "time", "date", "title", "summary", "verdict")})
    items.sort(key=lambda i: i["time"], reverse=True)
    json.dump({"updated": iso_il(), "items": items[:400]}, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(brief, open(os.path.join(OUT, "latest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slot", default="auto")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--now", help="ISO time label override for a late backfill, e.g. 2026-11-26T23:20+02:00")
    ap.add_argument("--also", default="auto", help="auto|week|month|none: period reviews to add after the close brief")
    args = ap.parse_args()
    now = dt.datetime.fromisoformat(args.now).astimezone(IL) if args.now else dt.datetime.now(IL)
    slot = pick_slot(now) if args.slot == "auto" else args.slot
    if not slot:
        print("no slot due at", now.isoformat())
        return
    made = []
    kinds = [slot]
    if slot == "close" and args.also in ("auto", "week", "month"):
        if args.also == "week" or (args.also == "auto" and now.weekday() == 4):
            kinds.append("week")
        if args.also == "month" or (args.also == "auto" and is_month_end(now.date())):
            kinds.append("month")
    if slot in ("week", "month"):
        kinds = [slot]
    need_quotes = any(k not in ("week_ahead",) for k in kinds)
    qs = ta_q = sp_q = {}
    ta, sp = load_universe()
    if need_quotes:
        rng = "1y" if "month" in kinds else "3mo"
        qs = fetch_all([i[0] for i in INSTR], rng)
        ta_q = fetch_all(list(ta), "3mo")
        sp_q = fetch_all(list(sp), "3mo")
        print(f"quotes {len(qs)}/{len(INSTR)}, ta35 {len(ta_q)}, sp100 {len(sp_q)}")
        if len(qs) < 6:
            print("too few quotes; skipping", file=sys.stderr)
            sys.exit(1)
    prev_slot_time = now - dt.timedelta(hours=4 if slot != "morning" else 10)
    for kind in kinds:
        bid = f"{now.date().isoformat()}-{kind}"
        if os.path.exists(os.path.join(OUT, bid + ".json")) and not args.force:
            print("exists", bid)
            continue
        if kind == "week":
            body = week_review(now, qs, ta_q, sp_q, ta, sp)
        elif kind == "month":
            body = month_review(now, qs, ta_q, sp_q, ta, sp)
        elif kind == "week_ahead":
            body = week_ahead(now)
        else:
            body = daily(kind, now, qs, ta_q, sp_q, ta, sp)
        body["headlines"] = pick_headlines(now - dt.timedelta(days=7) if kind in ("week", "week_ahead") else now - dt.timedelta(days=30) if kind == "month" else prev_slot_time)
        brief = {"id": bid, "slot": kind, "kind": "daily" if kind in SLOTS and kind != "week_ahead" else kind, "edition": EDITIONS[kind],
                 "time": iso_il(now), "date": now.strftime("%d.%m.%Y"), "day": DAYS_HE[now.weekday()], **body,
                 "source_note": "נתוני שוק ציבוריים (עשויים להתעכב עד 20 דקות), כותרות מאתרי החדשות ולוח אירועים ציבורי.",
                 "disclaimer": DISCLAIMER}
        save(brief)
        made.append(bid)
    with open(os.path.join(OUT, ".last-run.json"), "w", encoding="utf-8") as f:
        json.dump({"time": iso_il(now), "made": made}, f)


if __name__ == "__main__":
    main()
