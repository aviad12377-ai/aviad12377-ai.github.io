#!/usr/bin/env python3
"""News hub: pull many public RSS feeds into data/news-hub.json and flag
high-importance headlines into data/breaking.json.

Headline + short snippet + link out only (no full articles). Standard library only.
Public data only, no personal records.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from news_util import IL, iso_il, strip_html  # noqa: E402

UA = "Mozilla/5.0 (compatible; balances-portal-news/2.0; +https://aviad12377-ai.github.io/)"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GN = "https://news.google.com/rss/search?hl={hl}&gl={gl}&ceid={ceid}&q="

# cats: il, us, macro, stocks, crypto, world
FEEDS = [
    # Hebrew / Israel
    {"id": "globes-markets", "source": "גלובס", "lang": "he", "cats": ["il", "stocks"], "url": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585"},
    {"id": "globes-news", "source": "גלובס", "lang": "he", "cats": ["il"], "url": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2"},
    {"id": "globes-wallst", "source": "גלובס", "lang": "he", "cats": ["us", "stocks"], "url": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1225"},
    {"id": "themarker", "source": "TheMarker", "lang": "he", "cats": ["il"], "url": "https://www.themarker.com/srv/tm-markets", "limit": 25},
    {"id": "calcalist", "source": "כלכליסט", "lang": "he", "cats": ["il"], "gn": True, "url": GN.format(hl="he", gl="IL", ceid="IL:he") + "site:calcalist.co.il", "limit": 20},
    {"id": "bizportal", "source": "ביזפורטל", "lang": "he", "cats": ["il", "stocks"], "gn": True, "url": GN.format(hl="he", gl="IL", ceid="IL:he") + "site:bizportal.co.il", "limit": 20},
    {"id": "ynet-economy", "source": "ynet כלכלה", "lang": "he", "cats": ["il"], "url": "https://www.ynet.co.il/Integration/StoryRss6.xml"},
    # Global
    {"id": "reuters", "source": "Reuters", "lang": "en", "cats": ["world"], "gn": True, "url": GN.format(hl="en-US", gl="US", ceid="US:en") + "site:reuters.com+markets+OR+economy+when:2d", "limit": 25},
    {"id": "ap", "source": "AP", "lang": "en", "cats": ["world"], "gn": True, "url": GN.format(hl="en-US", gl="US", ceid="US:en") + "site:apnews.com+business+when:2d", "limit": 15},
    {"id": "bloomberg-markets", "source": "Bloomberg", "lang": "en", "cats": ["us", "stocks"], "url": "https://feeds.bloomberg.com/markets/news.rss"},
    {"id": "bloomberg-econ", "source": "Bloomberg", "lang": "en", "cats": ["macro"], "url": "https://feeds.bloomberg.com/economics/news.rss"},
    {"id": "cnbc-markets", "source": "CNBC", "lang": "en", "cats": ["us", "stocks"], "url": "https://www.cnbc.com/id/10000664/device/rss/rss.html"},
    {"id": "cnbc-top", "source": "CNBC", "lang": "en", "cats": ["us"], "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html"},
    {"id": "cnbc-economy", "source": "CNBC", "lang": "en", "cats": ["macro"], "url": "https://www.cnbc.com/id/20910258/device/rss/rss.html"},
    {"id": "mw-top", "source": "MarketWatch", "lang": "en", "cats": ["us"], "url": "https://feeds.content.dowjones.io/public/rss/mw_topstories"},
    {"id": "mw-pulse", "source": "MarketWatch", "lang": "en", "cats": ["us", "stocks"], "url": "https://feeds.content.dowjones.io/public/rss/mw_marketpulse"},
    {"id": "wsj-markets", "source": "WSJ", "lang": "en", "cats": ["us", "stocks"], "url": "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", "limit": 20},
    {"id": "ft-markets", "source": "Financial Times", "lang": "en", "cats": ["world", "stocks"], "url": "https://www.ft.com/markets?format=rss"},
    {"id": "investing-news", "source": "Investing.com", "lang": "en", "cats": ["world"], "url": "https://www.investing.com/rss/news.rss"},
    {"id": "investing-stocks", "source": "Investing.com", "lang": "en", "cats": ["stocks"], "url": "https://www.investing.com/rss/news_25.rss"},
    {"id": "investing-econ", "source": "Investing.com", "lang": "en", "cats": ["macro"], "url": "https://www.investing.com/rss/news_14.rss"},
    {"id": "yahoo-spx", "source": "Yahoo Finance", "lang": "en", "cats": ["us", "stocks"], "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US"},
    {"id": "nyt-business", "source": "New York Times", "lang": "en", "cats": ["us"], "url": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", "limit": 15},
    {"id": "bbc-business", "source": "BBC", "lang": "en", "cats": ["world"], "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "limit": 15},
    {"id": "economist", "source": "The Economist", "lang": "en", "cats": ["macro"], "url": "https://www.economist.com/finance-and-economics/rss.xml", "limit": 8},
    {"id": "fed", "source": "הפדרל ריזרב", "lang": "en", "cats": ["macro", "us"], "url": "https://www.federalreserve.gov/feeds/press_all.xml", "limit": 8},
    {"id": "seekingalpha", "source": "Seeking Alpha", "lang": "en", "cats": ["stocks"], "url": "https://seekingalpha.com/market_currents.xml"},
    {"id": "fxstreet", "source": "FXStreet", "lang": "en", "cats": ["macro"], "url": "https://www.fxstreet.com/rss/news", "limit": 12},
    {"id": "coindesk", "source": "CoinDesk", "lang": "en", "cats": ["crypto"], "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
    {"id": "cointelegraph", "source": "Cointelegraph", "lang": "en", "cats": ["crypto"], "url": "https://cointelegraph.com/rss", "limit": 15},
]

CAT_RULES = [
    ("crypto", r"bitcoin|crypto|ethereum|\bbtc\b|stablecoin|ביטקוין|קריפטו|מטבע דיגיטלי"),
    ("macro", r"\bfed\b|fomc|powell|inflation|\bcpi\b|\bpce\b|payroll|jobs report|unemployment|\bgdp\b|recession|treasur|yield|rate cut|rate hike|central bank|\becb\b|bank of japan|tariff|ריבית|אינפלציה|מדד המחירים|בנק ישראל|תוצר|אבטלה|אג\"?ח|תשואות|מכס"),
    ("il", r"israel|tel aviv|\btase\b|shekel|ישראל|ת\"?א 35|ת\"?א 125|הבורסה בתל אביב|שקל|בורסת תל אביב"),
    ("us", r"wall street|s&p|nasdaq|\bdow\b|u\.s\.|\bus\b|american|וול סטריט|נאסד\"?ק|דאו ג'ונס|ארה\"ב"),
    ("stocks", r"shares|stock|earnings|ipo|מניה|מניות|דוחות|הנפקה|רבעון"),
]

# Breaking rules: (weight, regex)
BREAK_RULES = [
    (6, r"\bfomc\b|fed (holds|raises|cuts|keeps|leaves)|rate decision|cuts rates|raises rates|hikes rates|החלטת הריבית|בנק ישראל (הוריד|העלה|הותיר)|הריבית (תרד|תעלה|נותרה)"),
    (5, r"\bcpi\b|consumer price|inflation (rises|falls|accelerat|slow|cool|hot)|nonfarm|payrolls|jobs report|\bpce\b|\bgdp\b|מדד המחירים לצרכן|נתוני התעסוקה|האינפלציה"),
    (5, r"plunge|plunges|tumble|crash|sell-?off|soar|soars|surge|surges|record high|all-time high|worst day|best day|circuit breaker|halted|צונח|קורס|מזנק|שיא כל הזמנים|נפילה חדה|ירידות חדות|עליות חדות"),
    (5, r"war\b|missile|invasion|ceasefire|attack on|sanction|strike on iran|מלחמה|טילים|הפסקת אש|תקיפה|סנקציות|פיגוע"),
    (4, r"bankrupt|chapter 11|default|downgrade|credit rating|bailout|collapse|פשיטת רגל|חדלות פירעון|הורדת דירוג|דירוג האשראי|קריסה"),
    (4, r"tariff|trade war|מכסים|מלחמת סחר"),
    (3, r"acquire|acquisition|merger|takeover|buyout|רכישה|מיזוג|עסקת ענק|מיליארד"),
    (3, r"nvidia|apple|microsoft|tesla|amazon|alphabet|google|meta\b|אנבידיה|טבע|אלביט|לאומי|פועלים"),
    (2, r"breaking|urgent|just in|מבזק|דחוף"),
]
SOURCE_WEIGHT = {"fed": 2, "reuters": 1, "bloomberg-markets": 1, "bloomberg-econ": 1, "ap": 1, "globes-markets": 1, "cnbc-top": 1}
BREAK_THRESHOLD = 8
BREAK_MAX_AGE_H = 6

QUOTE_WATCH = [
    ("^GSPC", "S&P 500", 1.8), ("^IXIC", "נאסד״ק", 2.2), ("^DJI", "דאו ג׳ונס", 1.8),
    ("TA35.TA", "ת״א 35", 1.8), ("^TA125.TA", "ת״א 125", 1.8), ("^VIX", "מדד הפחד VIX", 15.0),
    ("ILS=X", "דולר/שקל", 1.2), ("CL=F", "נפט WTI", 4.0), ("GC=F", "זהב", 2.5), ("BTC-USD", "ביטקוין", 5.0),
]


def local(tag: str) -> str:
    return tag.split("}", 1)[-1].lower() if tag else ""


def child_text(el, *names):
    want = {n.lower() for n in names}
    for ch in list(el):
        if local(ch.tag) in want:
            return "".join(ch.itertext()).strip()
    return ""


def parse_time(text):
    if not text:
        return None
    text = text.strip()
    try:
        v = email.utils.parsedate_to_datetime(text)
        if v.tzinfo is None:
            v = v.replace(tzinfo=dt.timezone.utc)
        return v.astimezone(IL)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            v = dt.datetime.strptime(text.replace("Z", "+0000") if "%z" in fmt else text, fmt)
            if v.tzinfo is None:
                v = v.replace(tzinfo=dt.timezone.utc)
            return v.astimezone(IL)
        except Exception:
            continue
    return None


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def norm_title(t):
    t = t.lower()
    t = re.sub(r"[\"'׳״`’“”.,:;!?()\[\]\-–—|/]", " ", t)
    return [w for w in t.split() if len(w) > 1]


def categorize(text, base):
    cats = list(base)
    low = text.lower()
    for cat, rx in CAT_RULES:
        if re.search(rx, low) and cat not in cats:
            cats.append(cat)
    if "world" in cats and len(cats) > 1:
        cats.remove("world")
    return cats[:3]


def break_score(text, feed_id):
    low = text.lower()
    s = SOURCE_WEIGHT.get(feed_id, 0)
    hits = []
    for w, rx in BREAK_RULES:
        if re.search(rx, low):
            s += w
            hits.append(w)
    if re.search(r"stock market news|live updates|what to watch|podcast|opinion|newsletter|כמה כסף|טור דעה|פודקאסט", low):
        s -= 4
    return max(0, s) if hits else 0


def parse(blob, meta, now):
    root = ET.fromstring(blob)
    out = []
    nodes = [el for el in root.iter() if local(el.tag) in ("item", "entry")]
    for el in nodes[: meta.get("limit", 12)]:
        title = strip_html(child_text(el, "title"), 220)
        link = child_text(el, "link")
        if not link:
            for ch in list(el):
                if local(ch.tag) == "link" and ch.get("href"):
                    link = ch.get("href").strip()
                    break
        if not title or not link.startswith("http"):
            continue
        if meta.get("gn"):
            title = re.sub(r"\s+-\s+[^-]{2,40}$", "", title).strip()
            snippet = ""
        else:
            snippet = strip_html(child_text(el, "description", "summary") or "", 200)
            if snippet.strip() == title.strip():
                snippet = ""
        when = parse_time(child_text(el, "pubdate", "published", "updated", "date")) or now
        if when > now + dt.timedelta(minutes=10):
            when = now
        if now - when > dt.timedelta(days=4):
            continue
        hid = hashlib.sha1(f"{meta['id']}|{link}".encode()).hexdigest()[:14]
        text = f"{title} {snippet}"
        out.append({
            "id": hid, "title": title, "snippet": snippet, "url": link,
            "source": meta["source"], "feed": meta["id"], "lang": meta["lang"],
            "cats": categorize(text, meta["cats"]), "time": iso_il(when),
            "score": break_score(text, meta["id"]),
        })
    return out


def dedupe(items):
    items.sort(key=lambda x: x["time"], reverse=True)
    kept, sigs = [], []
    for it in items:
        toks = set(norm_title(it["title"]))
        dup = None
        for k, s in zip(kept, sigs):
            if toks and s and len(toks & s) / max(1, len(toks | s)) >= 0.7:
                dup = k
                break
        if dup:
            also = dup.setdefault("also", [])
            if it["source"] != dup["source"] and it["source"] not in also:
                also.append(it["source"])
            dup["score"] = max(dup["score"], it["score"]) + (1 if it["source"] != dup["source"] else 0)
            continue
        kept.append(it)
        sigs.append(toks)
    return kept


def market_moves(now):
    moves = []
    for sym, name, thr in QUOTE_WATCH:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=5d&interval=1d"
            d = json.loads(fetch(url, 15))["chart"]["result"][0]
            m = d["meta"]
            price = m.get("regularMarketPrice")
            t = dt.datetime.fromtimestamp(m.get("regularMarketTime", 0), dt.timezone.utc).astimezone(IL)
            closes = [c for c in (d.get("indicators", {}).get("quote", [{}])[0].get("close") or []) if c is not None]
            if price is None or len(closes) < 2 or now - t > dt.timedelta(hours=2):
                continue
            prev = closes[-2]
            chg = (price / prev - 1) * 100
            if abs(chg) >= thr:
                verb = "מזנק" if chg > 0 else "צונח"
                if sym == "ILS=X":
                    verb = "מזנק" if chg > 0 else "צונח"
                moves.append({
                    "id": "mv-" + hashlib.sha1(f"{sym}|{t.date()}|{int(abs(chg)//1)}|{chg>0}".encode()).hexdigest()[:12],
                    "title": f"{name} {verb} {abs(chg):.1f}% ({'+' if chg>0 else '−'}{abs(chg):.2f}%)",
                    "snippet": f"תנועה חריגה במסחר היום. הרמה האחרונה: {price:,.2f}.",
                    "url": "https://aviad12377-ai.github.io/briefs.html",
                    "source": "מבזקי השוק", "feed": "market", "lang": "he", "cats": ["il"] if sym.endswith(".TA") or sym == "ILS=X" else ["us"] if sym.startswith("^") else ["macro"] if sym in ("CL=F", "GC=F") else ["crypto"],
                    "time": iso_il(t if t < now else now), "score": 99, "kind": "move",
                })
        except Exception as e:  # noqa: BLE001
            print(f"quote {sym}: {e}", file=sys.stderr)
    return moves


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hub", default=os.path.join(ROOT, "data", "news-hub.json"))
    ap.add_argument("--breaking", default=os.path.join(ROOT, "data", "breaking.json"))
    ap.add_argument("--max", type=int, default=400)
    args = ap.parse_args()
    now = dt.datetime.now(IL)
    status, items = [], []

    def one(meta):
        try:
            got = parse(fetch(meta["url"]), meta, now)
            return meta, got, None
        except Exception as e:  # noqa: BLE001
            return meta, [], str(e)[:120]

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for meta, got, err in ex.map(one, FEEDS):
            status.append({"id": meta["id"], "source": meta["source"], "ok": not err and bool(got), "count": len(got), "error": err})
            items.extend(got)
            print(f"{meta['id']}: {len(got)}{' ERR ' + err if err else ''}")

    # keep older items from previous snapshot for continuity (up to 48h) when a feed fails this run
    try:
        prev = json.load(open(args.hub, encoding="utf-8"))
        ok_feeds = {s["id"] for s in status if s["ok"]}
        cutoff = iso_il(now - dt.timedelta(hours=48))
        for it in prev.get("items", []):
            if it.get("feed") not in ok_feeds and it.get("time", "") >= cutoff and it.get("feed") != "market":
                items.append(it)
    except Exception:
        prev = {}

    items = dedupe(items)[: args.max]
    moves = market_moves(now)
    sources = sorted({s["source"] for s in status if s["ok"]})
    write_json(args.hub, {"updated": iso_il(now), "disclaimer": "כותרות ותקצירים קצרים מאתרי החדשות, עם קישור לכתבה המלאה. מידע בלבד, לא ייעוץ.", "sources": sources, "feeds": status, "items": items})

    # breaking: keep previous entries for 24h, add new high-score ones
    try:
        old = json.load(open(args.breaking, encoding="utf-8")).get("items", [])
    except Exception:
        old = []
    cutoff24 = iso_il(now - dt.timedelta(hours=24))
    by_id = {b["id"]: b for b in old if b.get("time", "") >= cutoff24}
    fresh_cut = iso_il(now - dt.timedelta(hours=BREAK_MAX_AGE_H))
    new_ids = []
    for it in moves + [i for i in items if i["score"] >= BREAK_THRESHOLD and i["time"] >= fresh_cut]:
        if it["id"] in by_id:
            continue
        b = {k: it[k] for k in ("id", "title", "snippet", "url", "source", "lang", "cats", "time", "score")}
        b["also"] = it.get("also", [])
        b["flagged"] = iso_il(now)
        by_id[it["id"]] = b
        new_ids.append(it["id"])
    br = sorted(by_id.values(), key=lambda x: (x["time"]), reverse=True)[:30]
    write_json(args.breaking, {"updated": iso_il(now), "new": new_ids, "items": br})
    print(f"hub {len(items)} items from {len(sources)} sources; breaking {len(br)} (new {len(new_ids)})")


if __name__ == "__main__":
    main()
