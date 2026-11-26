# Israeli funds and ETFs — how names and NAVs get into the site

The browser cannot write to the GitHub repo. Holdings typed in the portal stay in local storage only.

## Search list (`tase_securities.json`)

The Actions job (`prices.yml`) fetches two keyless Funder pages on every run (cheap — two HTML pages; weekly would also be enough for names):

- `https://www.funder.co.il/fundlist` — all mutual funds (קרנות נאמנות)
- `https://www.funder.co.il/etflist` — ETFs (קרנות סל)

Each row has a security number (מספר נייר) and a Hebrew name. Search matches all typed words in any order, ignores punctuation / parentheses / `%` / quotes, understands a few aliases (e.g. נאסדק → NASDAQ), and treats a leading digit string as a security-number prefix.

## Prices (`prices.json`)

- **ETFs:** last price comes from the ETF list page itself (intragday, agorot).
- **Mutual funds:** official daily NAV from the individual Funder fund page (`buyPrice` / `sellPrice` in agorot), which matches the bank. The job always refreshes IDs in `universe.json` → `mutual_funds` and in `extra_tickers.json`. It also fetches any fund in the Funder list whose official `lastUpdate` is missing from `prices.json` or newer than the stored `navDate`. After the first backfill, only funds with a new official date are re-fetched.

## How a fund you added gets a NAV

1. If it is already in the Funder list (almost every Israeli fund/ETF is), it is searchable immediately after the list refresh, and its NAV is fetched on the next Action run that sees it as missing or stale (the first full backfill, or the run after Funder publishes a new date).
2. To force a security number to the front of the queue: add it to `scripts/extra_tickers.json` (`symbols` or `funds`) and push, or run the “Update prices” workflow by hand. There is no way for the browser to do that itself.
