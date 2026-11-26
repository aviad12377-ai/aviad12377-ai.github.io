#!/usr/bin/env python3
"""Fetch public fund statistics (fees, returns) from data.gov.il and write funds.json at the repo root.
Datasets (Israel Capital Market Authority, published on data.gov.il CKAN):
  gemelnet   (gemel, hishtalmut, gemel lehashkaa)  resource a30dcbea-a1d2-482c-ae29-8f781f5025fb  "נתוני הגמל נט לשנים 2024-היום"
  pensianet  (new/old pension funds)               resource 6d47d6b5-cb08-488b-b333-f1e717b1e1bd  "נתוני הפנסיה נט לשנים 2024-היום"
  bituachnet (insurance savings policies)          resource c6c62cc7-fe02-4b18-8f3e-813abfbb4647  "נתוני הביטוח נט לשנים 2024-היום"
Only the latest REPORT_PERIOD of each dataset is kept for the statistics. "monthly" adds MONTHLY_YIELD (%) per track (FUND_ID)
for the last MONTHS periods, used by the site to roll a balance forward per track. Standard library only. Public data, no keys."""
import json, sys, time, urllib.parse, urllib.request, datetime

API = 'https://data.gov.il/api/3/action/datastore_search'
SETS = {
    'gemelnet': 'a30dcbea-a1d2-482c-ae29-8f781f5025fb',
    'pensianet': '6d47d6b5-cb08-488b-b333-f1e717b1e1bd',
    'bituachnet': 'c6c62cc7-fe02-4b18-8f3e-813abfbb4647',
}
KEEP = ['FUND_ID', 'FUND_NAME', 'FUND_CLASSIFICATION', 'MANAGING_CORPORATION', 'PARENT_COMPANY_NAME', 'SPECIALIZATION', 'SUB_SPECIALIZATION', 'TARGET_POPULATION',
        'TOTAL_ASSETS', 'AVG_ANNUAL_MANAGEMENT_FEE', 'AVG_DEPOSIT_FEE', 'YEAR_TO_DATE_YIELD', 'AVG_ANNUAL_YIELD_TRAILING_3YRS', 'AVG_ANNUAL_YIELD_TRAILING_5YRS',
        'YIELD_TRAILING_3_YRS', 'YIELD_TRAILING_5_YRS', 'STANDARD_DEVIATION', 'SHARPE_RATIO']
SHORT = {'FUND_ID': 'id', 'FUND_NAME': 'name', 'FUND_CLASSIFICATION': 'cls', 'MANAGING_CORPORATION': 'mgr', 'PARENT_COMPANY_NAME': 'parent', 'SPECIALIZATION': 'spec',
         'SUB_SPECIALIZATION': 'sub', 'TARGET_POPULATION': 'pop', 'TOTAL_ASSETS': 'assets', 'AVG_ANNUAL_MANAGEMENT_FEE': 'feeAcc', 'AVG_DEPOSIT_FEE': 'feeDep',
         'YEAR_TO_DATE_YIELD': 'ytd', 'AVG_ANNUAL_YIELD_TRAILING_3YRS': 'y3', 'AVG_ANNUAL_YIELD_TRAILING_5YRS': 'y5', 'YIELD_TRAILING_3_YRS': 'c3', 'YIELD_TRAILING_5_YRS': 'c5',
         'STANDARD_DEVIATION': 'sd', 'SHARPE_RATIO': 'sharpe'}

def get(params, tries=3):
    url = API + '?' + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'balances-portal/1.0 (+https://aviad12377-ai.github.io/)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.load(r)
            if j.get('success'): return j['result']
        except Exception as e:
            print('retry', i, e, file=sys.stderr); time.sleep(3 * (i + 1))
    raise RuntimeError('failed: ' + url)

def fetch(rid):
    latest = get({'resource_id': rid, 'limit': 1, 'sort': 'REPORT_PERIOD desc', 'fields': 'REPORT_PERIOD'})['records'][0]['REPORT_PERIOD']
    out, offset = [], 0
    while True:
        res = get({'resource_id': rid, 'limit': 1000, 'offset': offset, 'filters': json.dumps({'REPORT_PERIOD': latest})})
        recs = res['records']
        for r in recs:
            o = {SHORT[k]: r.get(k) for k in KEEP if r.get(k) not in (None, '')}
            out.append(o)
        offset += len(recs)
        if not recs or offset >= res.get('total', 0): break
    return latest, out

MONTHS = 15

def prev_period(p):
    y, m = divmod(int(p), 100)
    return (y - 1) * 100 + 12 if m == 1 else y * 100 + m - 1

def fetch_monthly(rid, latest):
    # {fund_id: {period: monthly_yield_pct}} for the last MONTHS periods (one filtered query per period, minimal fields)
    out, p = {}, int(latest)
    for _ in range(MONTHS):
        offset = 0
        while True:
            res = get({'resource_id': rid, 'limit': 5000, 'offset': offset, 'fields': 'FUND_ID,REPORT_PERIOD,MONTHLY_YIELD', 'filters': json.dumps({'REPORT_PERIOD': p})})
            recs = res['records']
            for r in recs:
                if r.get('MONTHLY_YIELD') in (None, ''): continue
                out.setdefault(str(r['FUND_ID']), {})[str(p)] = round(float(r['MONTHLY_YIELD']), 4)
            offset += len(recs)
            if not recs or offset >= res.get('total', 0): break
        p = prev_period(p)
    return out

def main():
    dst = sys.argv[1] if len(sys.argv) > 1 else 'funds.json'
    result = {'generatedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'data.gov.il (Capital Market Authority)', 'sets': {}}
    for name, rid in SETS.items():
        try:
            period, rows = fetch(rid)
            result['sets'][name] = {'resource': rid, 'period': period, 'funds': rows}
            try: result['sets'][name]['monthly'] = fetch_monthly(rid, period)
            except Exception as e: print('monthly skip', name, e, file=sys.stderr)
            print(name, period, len(rows))
        except Exception as e:
            print('skip', name, e, file=sys.stderr)
    if not result['sets']:
        sys.exit('no data')
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
