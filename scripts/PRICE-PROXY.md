# פרוקסי לשערי מניות (Cloudflare Worker)

האתר מושך שערים קודם כול מ־`prices.json` (מתעדכן כל רבע שעה). מטבעות קריפטו ושערי מט״ח נמשכים גם ישירות מהדפדפן, בלי מפתח.

למניות, קרנות סל וניירות של הבורסה בתל אביב **אין** מקור ציבורי בלי מפתח שמחזיר כותרת CORS. כדי שכל טיקר שהמשתמש מזין יקבל שער מיד, ולא רק בעדכון הבא, צריך פרוקסי קטן בחינם.

## מה עושים פעם אחת

1. נרשמים ל־[Cloudflare](https://dash.cloudflare.com/sign-up) בחשבון חינמי.
2. נכנסים ל־Workers & Pages ולוחצים Create / Deploy a Worker.
3. מוחקים את הקוד שמופיע ומדביקים את התוכן של `scripts/price-proxy-worker.js`.
4. שומרים ומפרסמים (Deploy). מעתיקים את הכתובת, למשל `https://options-prices.YOURNAME.workers.dev`.
5. בקבצי ה־HTML של האתר (`index.html`, `savings.html` ושאר הדפים), **לפני** `portal.js`, מוסיפים שורה אחת:

```html
<script>window.PORTAL_PRICE_PROXY = 'https://options-prices.YOURNAME.workers.dev';</script>
```

6. מעלים את האתר. בלי השורה הזו האתר ממשיך לעבוד: שערים מתוך `prices.json` וקריפטו/מט״ח ישירות, ולטיקר חסר מוצג «השער יתעדכן בעדכון הבא» (ואפשר להוסיף אותו ל־`scripts/extra_tickers.json`).

הפרוקסי מאפשר גישה רק מהאתר `https://aviad12377-ai.github.io` ומ־localhost, ורק לכתובות של Yahoo Finance (שער וחיפוש). אין בו מפתחות.
