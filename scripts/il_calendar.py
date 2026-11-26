#!/usr/bin/env python3
"""Israeli macro calendar -> data/il-calendar.json (official sources only).

Bank of Israel interest-rate decisions: copied from the Bank of Israel's own published table
  2027 - Apr 2028: https://www.boi.org.il/bank-of-israel/2027-2028-interest-rate-dates/ (page updated 24/06/2026).
  Minutes date and next decision: BOI press release of 23/11/2026.
  Announcements are published at 16:00; BOI notes that dates may change with advance notice.
Consumer Price Index (CBS): the CBS publication rule as stated on its release-calendar pages:
  price indices are published on the 15th at 18:30; if the 15th is a Friday / holiday eve or a
  Saturday / holiday, on the Friday / eve at 14:00. Dates below apply that rule; for Dec 2026 - Nov 2027
  no 15th falls on a holiday or holiday eve that is not already a Friday (checked by hand), so the rule
  gives the exact date. Rows carry "rule": true.
Other CBS releases (GDP, labour force) come out at 13:00 on dates from the CBS calendar, which is not
reachable from automated runners, so they are left out rather than guessed.

www.boi.org.il and www.cbs.gov.il sit behind bot protection, so this file is the maintained copy:
when BOI publishes a new table, add its rows to BOI_DECISIONS and rerun.
"""
from __future__ import annotations

import datetime as dt
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BOI_2027 = "https://www.boi.org.il/bank-of-israel/2027-2028-interest-rate-dates/"
BOI_PR = "https://boi.org.il/en/communication-and-publications/press-releases/the-monetary-committee-decides-on-november-23-2026-to-keep-the-interest-rate-unchanged-at-325-percent/"
CBS_RULE = "https://www.cbs.gov.il/en/Pages/Release-Calendar.aspx"

# (decision date, rate takes effect, research-department forecast + press conference that day)
BOI_DECISIONS = [
    ("2027-01-04", "2027-01-07", True), ("2027-02-22", "2027-02-25", False), ("2027-04-05", "2027-04-08", True),
    ("2027-05-24", "2027-05-27", False), ("2027-07-05", "2027-07-08", True), ("2027-08-18", "2027-08-22", False),
    ("2027-09-27", "2027-09-30", True), ("2027-11-22", "2027-11-25", False), ("2028-01-03", "2028-01-06", True),
    ("2028-02-21", "2028-02-24", False), ("2028-04-03", "2028-04-06", True),
]
BOI_OTHER = [("2026-12-07", "", "בנק ישראל מפרסם את סיכום הדיון המוניטרי לקראת החלטת 23.11", BOI_PR)]
MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]


def cpi_rows(first: dt.date, last: dt.date):
    rows = []
    y, m = first.year, first.month
    while (y, m) <= (last.year, last.month):
        d = dt.date(y, m, 15)
        hm = "18:30"
        if d.weekday() in (4, 5):  # Friday or Saturday -> Friday 14:00
            d = d - dt.timedelta(days=d.weekday() - 4)
            hm = "14:00"
        ref_m, ref_y = (12, y - 1) if m == 1 else (m - 1, y)
        rows.append({"date": d.isoformat(), "hm": hm, "title": f"מדד המחירים לצרכן ל{MONTHS_HE[ref_m - 1]} {ref_y}",
                     "country": "ישראל", "impact": "גבוהה", "kind": "cpi", "rule": True,
                     "source": "הלשכה המרכזית לסטטיסטיקה", "url": CBS_RULE})
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return rows


def main():
    rows = []
    for d, eff, fc in BOI_DECISIONS:
        e = dt.date.fromisoformat(eff)
        rows.append({"date": d, "hm": "16:00", "title": "החלטת הריבית של בנק ישראל" + (" ותחזית חטיבת המחקר" if fc else ""),
                     "note": f"הריבית החדשה חלה מ־{e.day}.{e.month}" + (", ומסיבת עיתונאים של הנגיד" if fc else ""),
                     "country": "ישראל", "impact": "גבוהה", "kind": "boi", "rule": False, "source": "בנק ישראל", "url": BOI_2027})
    for d, hm, title, url in BOI_OTHER:
        rows.append({"date": d, "hm": hm, "title": title, "country": "ישראל", "impact": "בינונית", "kind": "boi_minutes",
                     "rule": False, "source": "בנק ישראל", "url": url})
    rows += cpi_rows(dt.date(2026, 12, 1), dt.date(2027, 11, 30))
    rows.sort(key=lambda r: (r["date"], r["hm"] or "99"))
    out = {"updated": dt.date.today().isoformat(),
           "note": "מועדי בנק ישראל מהלוח הרשמי של הבנק. מועדי מדד המחירים לפי כלל הפרסום הרשמי של הלמ״ס (15 בחודש ב־18:30; כשה־15 חל בשישי או בשבת: שישי ב־14:00). המועדים עשויים להשתנות בהודעה מראש.",
           "sources": [BOI_2027, BOI_PR, CBS_RULE], "items": rows}
    path = os.path.join(ROOT, "data", "il-calendar.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"wrote {len(rows)} rows to {path}")


if __name__ == "__main__":
    main()
