# Selfoss KKÍ vakt

Sækir leiki og úrslit allra liða Selfoss Körfuknattleiksfélags úr mótakerfi KKÍ (kki.is) og vistar sem JSON í `data/`. Keyrir á GitHub Actions; WordPress-vefurinn (selfosskarfa.is) les `data/allt.json` af raw.githubusercontent.com.

## Samhengi
- KKÍ býður ekki upp á API. Leikjasíðurnar á kki.is ("Eitt lið", Mótayfirlit) eru BasketHotel/MBT widget sem hleðst með JavaScript, svo HTML-ið frá kki.is inniheldur engin leikjagögn.
- Reynt var að kalla beint á `widgets.baskethotel.com/widget-service/...` en það virkaði ekki. Því var valin leið með Playwright (headless Chromium) sem opnar síðuna eins og notandi.
- `#mbt:...` í slóðunum er staða widgetsins (hvaða flipi er opinn) og þarf að fylgja slóðinni.

## Skrár
- `scrape.js`: Playwright-skriftan. Les `table.mbt-table` í öllum römmum eftir að widgetið hleðst, víkkar mánaðarsíuna í „Allir mánuðir“, **flettir gegnum allar síður flettarans**, greinir leiki út frá **innihaldi** reitanna (`rodILeik()`), hlerar svör frá baskethotel og vistar þau í `debug/`. Skrifar í `data/` aðeins ef gögn breytast.
- `lid.json`: listinn yfir liðin (slug, nafn, url). Slug-ar eru ASCII (a–z, 0–9, -).
- `.github/workflows/kki-vakt.yml`: tímaáætlun (á 15 mín fresti kl. 17–23 UTC, á klst. fresti kl. 8–16), commit-ar `data/` ef breyting.
- `wordpress-daemi.php`: dæmi um sókn í WordPress (transient + varaafrit + shortcode).

## Staða
- Skriftan hefur verið **keyrð og staðfest á raunverulegu kki.is** fyrir öll liðin, með fullri flettingu og „Allir mánuðir“.
- `lid.json` inniheldur öll 10 lið félagsins. Keyrt á þeim öllum: 192 leikir, 10/10 tókust.
- Repoið er á GitHub: `bjorgvinrunar/selfoss-kki-vakt` (public, SSH-remote). Workflowið er skráð og virkt.

## Það sem raunverulegt kki.is sýndi
- **Leikjatöflur hafa engan haus** — engin `<th>` og engin dálkaheiti. Þess vegna gat greining eftir dálkaheitum aldrei virkað og var skipt út fyrir greiningu á innihaldi.
- Raunveruleg dálkaröð: `dags+tími | heimalið | úrslit | gestalið | völlur | (tómt)`. Úrslitin eru **á milli liðanna**, ekki aftast.
- Snið: dagsetning `DD-MM-ÁÁÁÁ HH:MM`, úrslit `86 : 62` (tómt ef leikur er ekki leikinn).
- Reitirnir innihalda `<script>`-klumpa (BasketHotel setur `href` með JS). Textinn er því lesinn af klónuðum reit þar sem `script`/`style` hefur verið fjarlægt — annars lekur JS-kóði inn í gögnin.
- `game_id` og `team_id` eru **attribute á `<a>`**, ekki í `href`. Þau eru notuð til að þekkja liðin og til að útbúa slóð á leikinn.
- Widgetið sýnir sjálfgefið **aðeins yfirstandandi mánuð** hjá yngri flokkum. Án þess að velja „Allir mánuðir“ (`select[id$="filter-month"]` = `all`) fengust bara 3 leikir í stað 21. Meistaraflokkarnir standa þó sjálfgefið á „Allir mánuðir“.
- Widgetið sýnir **aðeins 20 leiki í einu** og setur afganginn á síðu 2, 3 … Slóðin breytist ekki við flettingu (`#mbt:`-hlutinn er sá sami), svo hún segir ekkert til um hvaða síða er opin. Síðutenglar hafa id á borð við `6-200-page-2` og flett er með `window.changeScheduleAndResultsPage(N)`. **20 leikir nákvæmlega er merki um að síðu 2 vanti.**
- `table.mbt-table.mbt-whitelinks` eru faldar flakk-töflur (listi yfir alla flokka) og innihalda enga leiki. Síðasta taflan er skýringartafla (`MIN – Tími á velli`) og er líka hunsuð.
- **Bein sókn í BasketHotel borgar sig ekki**: `widget-service/show` skilar JS (`MBT.API.update('...', '<table>...')`) með HTML í escape-uðum streng — ekki JSON. Það þyrfti samt að þátta HTML, og til viðbótar `client_hash` sem lifir stutt. Playwright-leiðin er áfram réttari.

- Vaktin er **staðfest enda á milli**: `github-actions[bot]` skrifaði `data/` 29.09.2026 og skrifréttindin virka. Keyrsla á GitHub tekur um 9–10 mín.

## Næstu skref
1. Tengja WordPress við `data/allt.json` og aðlaga `wordpress-daemi.php` að reitunum (`dags` á ISO-sniði, `urslit` sem `86 : 62`, `okkarMegin`/`sigur`).

## Prófun á skrifréttindum
Grænt workflow sannar ekki að commit-skrefið virki — finni skriftan engar breytingar hoppar hún yfir push-ið og verður græn hvort sem er. Til að prófa í alvöru þarf að eyða einni skrá í `data/`, ýta, og keyra svo workflowið handvirkt; þá á `github-actions[bot]` að endurskapa hana og commit-a.

## Venjur
- Samskipti og athugasemdir í kóða á íslensku; breytuheiti mega vera á íslensku eins og nú er.
- Þegar verkefnið er afhent sem zip skal útgáfunúmer vera í endanum á skráarnafninu, t.d. `selfoss-kki-vakt-v0.1.1.zip`, og `version` í `package.json` uppfærð í samræmi.
- Vera kurteis við kki.is: eitt lið í einu, bil milli síðna, ekki tíðari keyrslur en á 15 mín fresti.

## Keyrsla
```bash
npm install
npx playwright install chromium
node scrape.js                    # öll lið
EINUNGIS=slug node scrape.js      # eitt lið
HEADLESS=0 node scrape.js         # sýnir vafrann
```
