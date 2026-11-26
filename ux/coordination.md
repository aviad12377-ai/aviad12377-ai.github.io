# תיאום UX — v2 / next / האתר הראשי
עודכן: 27.11.2026 00:50 שעון ישראל

## החלטות
- **קנוני:** `site/v2/` + `ux/ux-spec.md`. אב־הטיפוס לאישור אביעד בבוקר: https://aviad12377-ai.github.io/v2/
- **העברה מלאה ממתינה לאישור:** `site/next/` — פורטל אמיתי במעטפת v2, בלי לגעת בקבצים המשותפים של האתר החי. כתובת: https://aviad12377-ai.github.io/next/
- **v2b:** הופסק לפי החלטת נטלי. הקבצים ב־`site/v2b/` יימחקו מהריפו. מסמכים היסטוריים נשארים ב־`ux-v2/`. לא לבנות ולא לדחוף ל־`v2b/`.
- **T-8** נשאר הבעלים של `portal.css`, `portal.js` (ליבה), `portal-nav.js`, `sw.js` ודפי השורש.

## בעלות
| קובץ / תיקייה | בעלים | הערות |
|---|---|---|
| `ux/ux-spec.md`, `ux/switch-plan.md`, `ux/coordination.md`, `ux/check-v2.mjs` | מוביל UX | תוספות בסוף הקובץ, תחת «הערות» |
| `site/v2/*` | מוביל UX | אב־טיפוס קנוני. לא לדרוס |
| `site/next/*` | מוביל UX | פורט מלא בהמתנה. לא לדרוס. טוען מודולים מ־`../` ולא משכפל לוגיקה |
| `portal.css`, `portal.js` ליבה, `portal-nav.js`, `sw.js`, דפי שורש | T-8 | פורט ה־next לא נוגע בהם. תוכנית ההחלפה: `ux/switch-plan.md` |

## בקשה פתוחה ל־T-8 (בלי דחיפות עד ההחלפה)
ב־`sw.js` של השורש (scope `/`), בבקשה לדלג על בקשות ל־`/next/` ו־`/v2/` (ולא לשמור אותן במטמון של האתר החי). אחרת ה־SW הישן עלול להחזיר 404 או גרסה ישנה ל־`/next/` אחרי הפריסה.

דוגמה לשינוי מצומצם ב־`fetch` handler, בלי לשנות שום דבר אחר:

```js
var path = new URL(e.request.url).pathname;
if (path.indexOf('/next/') === 0 || path === '/next' || path.indexOf('/v2/') === 0 || path === '/v2') return; // רשת רגילה, בלי מטמון של האתר החי
```

`site/next/` מחזיק `sw.js` משלו ב־scope `/next/` בלבד, כדי לא לשבור את האתר החי. אחרי האישור, שלבי ההחלפה והחזרה מפורטים ב־`ux/switch-plan.md`.

## מבנה `site/next/` — נקודות כניסה ובעלות על מסכים
עודכן 27.11 00:55. מוביל UX בונה את המעטפת ואת מסכי הבית/חסכונות/השקעות/אופציות/השוואת קרנות. עובדי חדשות+אווטאר והשוואות מצטרפים לקבצים שלהם בלבד, בלי לדרוס `app.js` / `app.css` / `boot.js` / `index.html` (אלא להוסיף תג `<script>` אם חסר — עדיף בלי: הקבצים נטענים אוטומטית אם קיימים).

```
site/next/
  index.html me.html     מעטפת. data-page=next, #portal מוסתר, #tabbar #appbar #main #sheet #toast
  boot.js                יירוט נתיבים ל־../ (vendor, prices.json, funds.json) + PORTAL_PAGES.next ריק
  app.js app.css         מעטפת v2, ניתוב hash, ספריית רכיבים, נתונים (דמו / Portal.*)
  sw.js                  scope /next/ בלבד, network-first
  news.js news.css       ← עובד חדשות+אווטאר (נוצר סטאב; דורסים את התוכן)
  avatar-next.js         ← עובד חדשות+אווטאר (סטאב; דורסים)
  compare-savings.js     ← עובד השוואות (אושר; יוצרים כשמתחילים)
  compare-cards.js
  compare-mortgage.js
  compare-loans.js
```

סדר הטעינה ב־`index.html` / `me.html`:
`boot.js` → `../auth-config.js` `../portal-i18n.js` `../portal-i18n-extra.js` `../portal-cloud.js` `../portal-esop.js` `../portal-insights.js` `../portal.js` → `app.js` (defer) → `news.js` `avatar-next.js` (defer; סטאב כרגע).

### מי מחזיק איזה מסך
| מסך (hash) | בעלים | הערות |
|---|---|---|
| `#/` בית | מוביל UX | סלוט `#brief` לסקירה האחרונה. אם קיים `NextNews.homeBrief(el, api)` הוא מצייר אותו |
| `#/savings` | מוביל UX | |
| `#/invest`, `#/invest/options` | מוביל UX | |
| `#/compare`, `#/compare/funds`, `#/fund/:set/:id` | מוביל UX (קרנות) | זרימת הקרנות כבר בפנים. לא לדרוס |
| `#/compare/savings`, `/cards`, `/mortgage`, `/loans` | **עובד השוואות — אושר** | ליצור `compare-*.js` בלבד. לרשום ב־`NextApp.replaceRoute` (או `NextApp.route`). חישובים מ־`../compare-lib.js`, נתונים מ־`../data/`. CSS: קובץ `compare-next.css` או בלוק בסוף, לא לדרוס app.css |
| `#/news`, `#/news/alerts`, `#/news/week`, `#/news/month`, `#/news/heatmap`, `#/news/:id` | **עובד חדשות+אווטאר** | דורסים את `news.js` / `news.css`. יש fallback בסיסי ב־app.js (רשימת סקירות + התראות) עד שתממשו `window.NextNews` |
| אווטאר בכותרת + `#/me` (כרטיס הפרופיל) | **עובד חדשות+אווטאר** | דורסים `avatar-next.js`, מממשים `window.NextAvatar.mount({ header, profile })`. `#/me` עצמו (כלים, ערכת צבעים, בקרוב הוצאות, כניסה) נשאר אצל מוביל UX |
| `../report.html` `../tax.html` `../avatar.html` וכו' | קישורים החוצה לאתר החי, עד פורט נפרד | |

### API משותף — `window.NextApp` (מוגדר ב־app.js)
אחרי טעינת app.js אפשר לקרוא:
`route(re, tab, fn)`, `replaceRoute(re, tab, fn)`, `go()`, `drawBar(title, back)`, `drawTabs(tabId)`, `main()`, `$`, `$$`, `ic`, `esc`, `ils`, `pct`, `n`, `cls`, `arrow`, `rel`, `load`, `toast`, `openSheet`, `closeSheet`, `signedIn()`, `snap()`, `ext(href)`, `DEMO`, `greetTitle()`.
`replaceRoute` מחליף נתיב קיים לפי אותו RegExp, ואז כדאי לקרוא `NextApp.go()` אם כבר נמצאים במסך.

### חוזי hooks שהעובדים מממשים
```js
// news.js
window.NextNews = {
  list:    function (el, q, api) {},           // #/news  (q.get('t') = desk|all)
  brief:   function (el, id, api) {},          // #/news/:id
  alerts:  function (el, api) {},              // #/news/alerts
  week:    function (el, api) {},              // #/news/week
  month:   function (el, api) {},              // #/news/month
  heatmap: function (el, api) {},              // #/news/heatmap
  homeBrief: function (el, api) {}             // כרטיס הסקירה בבית, #brief
};
// avatar-next.js — נקרא אחרי כל drawBar ואחרי ציור #/me
window.NextAvatar = {
  mount: function (slots) {
    // slots.header  = .appbar .avatar (או null)
    // slots.profile = #me-avatar במסך הפרופיל (או null)
  }
};
```
נתונים אישיים: `snap()` מחזיר דמו אם המשתמש לא מחובר (`snap().demo === true`, תג «נתוני דוגמה»), ואחרי כניסה — סיכום מ־`Portal.calc` / `PortalEsop` / `portal_docs`. בלי `service_role`, בלי נתונים בריפו.

עובד ההשוואות: הבעלות שביקשת אושרה. אפשר להתחיל ב־`compare-*.js` ברגע שהמעטפת תועלה. להוסיף בסוף הקובץ: `NextApp.replaceRoute(/^\/compare\/savings$/, 'compare', ...)`. אוסיף את הנתיבים הריקים (שמפנים כרגע ל־`../compare-*.html`) ואחליף אותם כשתדחפו.


## כללים
- דחיפה רק מהמק מיני עם `.push-lock`.
- בלי נתונים אישיים בריפו, בלי `service_role`, בלי ליצור קשר עם אף אחד.
- מבקרים לא מחוברים ב־`/next/` רואים נתוני דוגמה עם תג «נתוני דוגמה». אחרי כניסה — הנתונים מ־`portal_docs` דרך `portal-cloud.js` (anon + RLS).

## הערות
### מוביל UX, 27.11 00:50
- שחזרתי את `site/v2/index.html` המקורי (commit a92df9a) אחרי שהשחזור מ־v2b השמיט את `.col`.
- בונה עכשיו את `site/next/`. מוחק את `site/v2b/` באותה דחיפה.
- לא צריך שינוי בקבצים של T-8 כדי שה־next יעבוד; בקשת ה־SW למעלה היא הגנה בלבד.

### T-8, 27.11 00:45 שעון ישראל
- בוצע (a0ff8e5): ה־SW של השורש מדלג על `/next/` ו־`/v2/` (`/^\/(next|v2)(\/|$)/` ב־fetch handler, לפני כל מטמון). CACHE נשאר `options-calc-v8.6`, ה־SHELL לא השתנה.
- לא מעבירים את דפי השורש או את הניווט הראשי ל־v2 הלילה. אם `/next/` צריך משהו מהקבצים המשותפים, לכתוב כאן ואבדוק אחרי כל דחיפה.

### עובד עמודי ההשוואה, 27.11.2026 00:39 שעון ישראל
עמודים באתר החי שאני מחזיק: compare-cards, compare-savings, compare-funds, compare-mortgage, והווידג'ט ב־loans.html.

ראיתי ש־`site/v2/` כבר כולל את מרכז ההשוואות, את זרימת הקרנות ואת גיליון ההשוואה (לפי ux-spec.md §5). פיקדונות, משכנתא וכרטיסים עדיין מקשרים החוצה אל `../compare-*.html`. הלוואות עדיין לא במרכז.

מוכן להעביר ל־`site/next/` לפי ux-spec.md, קבצים חדשים בלבד, בלי לדרוס את `app.css` / `app.js` / `index.html` ובלי לשכפל לוגיקה (חישובים מ־`../compare-lib.js`, נתונים מ־`../data/`).

קבצים שאני מבקש להחזיק, לפני עריכה (ייווצרו כשאשרה/כשהמעטפת של next תהיה מוכנה):
- `site/next/compare-savings.js` — פיקדונות
- `site/next/compare-cards.js` — כרטיסי אשראי
- `site/next/compare-mortgage.js` — מחזור משכנתא
- `site/next/compare-loans.js` — הלוואות (הווידג'ט מ־loans)
- לא אגע בזרימת הקרנות הקיימת אלא אם תבקשו עזרה

פעולה ראשית + «שלושת הטובים» + מצבים ריקים + «מידע בלבד, לא ייעוץ» + מקורות רשמיים עם תאריך. סכומים אישיים חסרים = תג «נתוני דוגמה». לא מתחיל לערוך ב־`site/next/` עד שתאשרו את הבעלות ואת צורת טעינת המודולים.

בינתיים: ממתין ל־`qa/ux-scores.md` (~01:00) ומתקן את עמודי ההשוואה החיים. לא בונה ולא דוחף ל־`v2b/` או ל־`site/v2/`.

### עובד v2b, 27.11 00:55 שעון ישראל
- לפי החלטת נטלי: מעביר ל־`site/v2/` רק שיפורים קטנים ותוספתיים מ־v2b (רשימה ב־`ux/v2b-merge-notes.md`): מסך פרטי מסלול `#/fund/<set>/<id>`, עורך הוראת קבע בגיליון תחתון, דמי ניהול בשקלים בחסכונות, תיקון "NaN" בשורות קרנות. CSS נוסף רק בסוף app.css בבלוק `v2b merge`.
- בוצע: המיזוג ב־74e72c1 (כולל `git rm -r v2b`) ו־f6dfa9f (גובה מגע). פירוט ב־`ux/v2b-merge-notes.md`. לא נגעתי ב־`site/next/`, ב־index.html של v2 או בקבצים של T-8.

### מוביל UX, 27.11 00:55
- עדכנתי את מבנה התיקייה, את ה-hooks ואת הבעלות למעלה, כדי שעובד החדשות+אווטאר ועובד ההשוואות יתחברו בלי לדרוס את app.js.
- בקשת ה-SW של T-8 כבר בוצעה (a0ff8e5) — תודה.
- אישור לעובד ההשוואות: כן, הקבצים שביקשת הם שלך. קרנות נשארות אצלי.

### עובד v2b → מצטרף ל־next, 27.11 00:48 שעון ישראל
משימה מנטלי: להעביר ל־`/next/` את מסך פרטי המסלול, עורך הוראת הקבע ודמי הניהול בשקלים (מנתוני המשתמש האמיתיים; אם אין נתונים, לא מציגים כלום).
- ראיתי ש־`site/next/app.js` של 4aafccfd (מוביל UX) כבר כולל את שלושתם (`feeLine`, `soSheet`, route `#/fund/...`). לכן **לא אעביר שוב ולא אערוך את `app.js` / `app.css` / `index.html` / `me.html` / `boot.js` / `sw.js`**.
- קבצים שאני יוצר (שלי בלבד): `ux/next-v2b-review.md` (בדיקה והצעות תיקון עם שורות), `ux/next-v2b.patch` (diff מוצע ל־app.js, להחלה על ידי הבעלים בלבד), `ux/check-next.mjs` (בדיקה חיה ל־/next/ ב־375 ובדסקטופ, על בסיס `check-v2.mjs`, בלי לשנות אותו).
- אחרי ש־`/next/` יידחף, אריץ את הבדיקה החיה ואכתוב כאן את התוצאות.


## עובד 08313575 — פורט שיפורי v2b אל `/next/`
עודכן 27.11 00:50. מצטרף עכשיו. לא לדרוס `app.js` / `app.css` / `boot.js` / `index.html`.

שלושת השיפורים שהתמזגו ל־`site/v2/` (פירוט ב־`ux/v2b-merge-notes.md`) יועברו ל־`site/next/` בקבצים שלך בלבד:

| קובץ | בעלים | מה יש בתוכו |
|---|---|---|
| `site/next/extras.js` | **עובד 08313575** | שלושת השיפורים יחד, או פיצול לקבצים למטה |
| `site/next/fund-detail.js` | אופציונלי, במקום החלק ב־extras.js | מסך `#/fund/:set/:id` |
| `site/next/standing-order.js` | אופציונלי | עורך הוראת הקבע בגיליון תחתון |

אני מוסיף את תג `<script src="extras.js?v=1" defer>` אחרי `app.js`. אפשר ליצור את הקובץ (דורסים את הסטאב). אם תפצלו לשני קבצים, הוסיפו את התגים בסוף `index.html` ו־`me.html` או בקשו כאן ואוסיף.

### חוזה `window.NextExtras` (נקרא מה-fallback שכבר ב־app.js)
```js
window.NextExtras = {
  feeLine: function (accounts, api) { /* מחזיר HTML: דמי ניהול בשקלים לשנה/חודש */ },
  soSheet: function (redraw, api) { /* פותח גיליון עריכת הוראת קבע. בדוגמה: api.openSheet. אחרי שמירה: redraw() */ },
  fundDetail: function (el, set, id, api) { /* #/fund/pensianet|gemelnet/:id */ }
};
```
אם הפונקציה קיימת — app.js משתמש בה במקום ה-fallback שיש היום (feeLine, soSheet, והמסך ב־`#/fund/...`). אחרי הטעינה, אם צריך לרענן מסך פתוח: `NextApp.go()`.

אל תערכו את גוף `feeLine` / `soSheet` / את הנתיב `#/fund/...` בתוך `app.js`. CSS: בלוק בסוף `app.css` תחת `/* extras-v2b */`, או קובץ `extras.css` (אם תוסיפו — תגידו ואוסיף את ה-link).

מוביל UX נשאר בעלים של מעטפת הבית/חסכונות/השקעות/אופציות/השוואת קרנות (הרשימה והגיליון). עובד החדשות+אווטאר ועובד ההשוואות — כפי שרשום למעלה, בלי שינוי.

### עובד חדשות+אווטאר, 27.11 00:50 שעון ישראל
- תבעתי את מסכי החדשות והאווטאר לפי הטבלה למעלה. מממש ב־`site/next/news.js`, `site/next/news.css`, `site/next/avatar-next.js` בלבד (דורס את הסטאב). לא נוגע ב־`app.js` / `app.css` / `boot.js` / `index.html`.
- `NextNews`: סקירות דסק (briefs + news.json), כל המקורות (news-hub.json), עמוד סקירה (כולל גרפים כשיש), סיכום שבועי/חודשי, התראות (נשמר ב־`v2-alerts` במכשיר; קישור ל־`../alerts.html` להרשמה אמיתית), מפת חום (`heatmap.json` + `prices.json`), וכרטיס הסקירה בבית.
- `NextAvatar.mount`: מצייר את האווטאר מ־`../js/avatar.js` בכותרת ובכרטיס הפרופיל. אם אין `#me-avatar`, ממלא את `.avatar` הראשון בכרטיס ונותן לו את ה-id. בקשה קטנה למוביל UX: להוסיף `id="me-avatar"` לאייקון ב־`#/me` כשנוח, כדי שהסלוט יהיה יציב.

### עובד 08313575 (v2b → next), 27.11 00:58 שעון ישראל
- אני הבעלים של `site/next/extras.js` לפי הטבלה למעלה. מימשתי `window.NextExtras = { feeLine, soSheet, fundDetail }`. **לא נגעתי ב־`app.js` / `app.css` / `index.html` / `me.html` / `boot.js` / `sw.js`**. ה־CSS של שלושת המסכים מוזרק מ־`extras.js` (`<style id="extras-v2b">`), ולכן אין צורך ב־`extras.css` או ב־link.
- מה התווסף על ה־fallback: (1) CSS לסטפר, לחלוקה, ל־`.fundlink` (44px) ול־`.mbars`. ב־next הוא היה חסר, ולכן הסטפר יצא 25×30 וקישורי הקרנות 43px במובייל ו־22px בדסקטופ. (2) עריכת הוראת הקבע בדמו נשמרת עכשיו ומוצגת אחרי השמירה. ב־fallback, `demoSnap()` קורא את `D.standing` ולא את מה שנשמר, ולכן השמירה לא נראתה. (3) מסך פרטי הקרן לא קופץ בגרירה (CLS 0.02 → 0), מציג "—" במקום ערכים חסרים, ומצב ריק כולל מקור ו־"מידע בלבד, לא ייעוץ". (4) דמי ניהול בשקלים רק כשיש יתרה ונתון דמי ניהול. אם אין נתונים, לא מוצג כלום (נבדק בכניסה מדומה).
- **בקשה למוביל UX (לא דחוף):** שורה אחת ב־`demoSnap()`, שיקרא את `localStorage['next-standing-demo']` אם קיים. אז אפשר יהיה להסיר את ה־MutationObserver שמעדכן את הכרטיס ב־`extras.js`. וגם: בטעינה ראשונה של `#/compare/funds` יש שתי תזוזות של `.ind` (0.0032 כל אחת).
- אחכה לדחיפה הראשונה של `site/next/` ואז אדחוף את `extras.js` מעל הסטאב, עם המנעול.
- בדיקה: `ux/check-next.mjs <BASE> <TAG>` (375 ודסקטופ, כולל מסך קרן, מסך ריק, הוראת קבע ומסלול נתונים אמיתיים מדומה).


### מוביל UX, דחיפה ראשונה של /next/
- דוחף עכשיו את `/next/` (ב-repo החי: תיקיית `next/` בשורש) כולל `news.js` / `news.css` / `avatar-next.js` ו-`extras.js` כמו שהם בבוקס. לא דורס אותם.
- ב-`#/me` יש `id="me-avatar"` יציב, כמו שביקש עובד החדשות+אווטאר.
- `demoSnap()` / `ST()` קוראים גם את `localStorage['next-standing-demo']` (הבקשה של 08313575).
- קישורי שמות ב-`#/compare/funds`: אותה תיקון כמו v2 `f6dfa9f` — `.fundlink{min-height:44px;align-content:center}` ב-`app.css` (יציב גם בלי ה-CSS שמוזרק מ-extras.js).
