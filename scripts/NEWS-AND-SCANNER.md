# News and scanner public feeds

Hebrew pages: `news.html`, `scanner.html`. Public JSON: `data/news.json`, `data/scanner.json`.
All copy is information-only (`מידע בלבד, לא ייעוץ`). No personal records belong in this folder.

## After a desk digest

Desk JSON lands in `/workspace/newsroom/YYYY-MM-DD-<asia|open|mid|close>.json`. Then:

```bash
python3 scripts/ingest_digest.py --newsroom /workspace/newsroom --out data/news.json
```

Commit and push `data/news.json` with the site (Mac mini lock protocol).

## After the weekday radar (about 09:27 Israel time)

```bash
python3 scripts/export_radar.py --root /workspace --out data/scanner.json
```

## Automatic fallback

`.github/workflows/news.yml` runs hourly: public RSS (Globes, TheMarker, CNBC, BBC, Yahoo; Calcalist if it returns) and a monthly fund-returns article whenever `funds.json` has a newly published report period from gemelnet / pensianet / bituachnet on data.gov.il.
