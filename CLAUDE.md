# Selfoss KKÍ vakt

Sækir leiki og úrslit allra liða Selfoss Körfuknattleiksfélags úr mótakerfi KKÍ (kki.is) og vistar sem JSON í `data/`. Keyrir á GitHub Actions; WordPress-vefurinn (selfosskarfa.is) les `data/allt.json` af raw.githubusercontent.com.

## Samhengi
- KKÍ býður ekki upp á API. Leikjasíðurnar á kki.is ("Eitt lið", Mótayfirlit) eru BasketHotel/MBT widget sem hleðst með JavaScript, svo HTML-ið frá kki.is inniheldur engin leikjagögn.
- Reynt var að kalla beint á `widgets.baskethotel.com/widget-service/...` en það virkaði ekki. Því var valin leið með Playwright (headless Chromium) sem opnar síðuna eins og notandi.
- `#mbt:...` í slóðunum er staða widgetsins (hvaða flipi er opinn) og þarf að fylgja slóðinni.

## Skrár
- `scrape.js`: Playwright-skriftan. Les `table.mbt-table` í öllum römmum eftir að widgetið hleðst, víkkar mánaðarsíuna í „Allir mánuðir“, greinir leiki út frá **innihaldi** reitanna (`rodILeik()`), hlerar svör frá baskethotel og vistar þau í `debug/`. Skrifar í `data/` aðeins ef gögn breytast.
- `lid.json`: listinn yfir liðin (slug, nafn, url). Slug-ar eru ASCII (a–z, 0–9, -).
- `.github/workflows/kki-vakt.yml`: tímaáætlun (á 15 mín fresti kl. 17–23 UTC, á klst. fresti kl. 8–16), commit-ar `data/` ef breyting.
- `wordpress-daemi.php`: dæmi um sókn í WordPress (transient + varaafrit + shortcode).

## Staða
- Skriftan hefur verið **keyrð og staðfest á raunverulegu kki.is** (dæmisslóðin, 11. flokkur drengja): 20 leikir allt tímabilið, þar af 2 leiknir.
- `lid.json` inniheldur bara eitt dæmi. Það þarf að setja inn slóðir fyrir alla flokka félagsins.
- Git-repo er komið upp staðbundið með `.gitignore` og `.github/workflows/kki-vakt.yml`. **Ekki enn ýtt á GitHub** — það vantar remote.
- `data/daemi-lid-1.json` er dæmisgagn; eyða því þegar raunveruleg lið koma í `lid.json`.

## Það sem raunverulegt kki.is sýndi
- **Leikjatöflur hafa engan haus** — engin `<th>` og engin dálkaheiti. Þess vegna gat greining eftir dálkaheitum aldrei virkað og var skipt út fyrir greiningu á innihaldi.
- Raunveruleg dálkaröð: `dags+tími | heimalið | úrslit | gestalið | völlur | (tómt)`. Úrslitin eru **á milli liðanna**, ekki aftast.
- Snið: dagsetning `DD-MM-ÁÁÁÁ HH:MM`, úrslit `86 : 62` (tómt ef leikur er ekki leikinn).
- Reitirnir innihalda `<script>`-klumpa (BasketHotel setur `href` með JS). Textinn er því lesinn af klónuðum reit þar sem `script`/`style` hefur verið fjarlægt — annars lekur JS-kóði inn í gögnin.
- `game_id` og `team_id` eru **attribute á `<a>`**, ekki í `href`. Þau eru notuð til að þekkja liðin og til að útbúa slóð á leikinn.
- Widgetið sýnir sjálfgefið **aðeins yfirstandandi mánuð**. Án þess að velja „Allir mánuðir“ (`select[id$="filter-month"]` = `all`) fengust bara 3 leikir í stað 20.
- `table.mbt-table.mbt-whitelinks` eru faldar flakk-töflur (listi yfir alla flokka) og innihalda enga leiki. Síðasta taflan er skýringartafla (`MIN – Tími á velli`) og er líka hunsuð.
- **Bein sókn í BasketHotel borgar sig ekki**: `widget-service/show` skilar JS (`MBT.API.update('...', '<table>...')`) með HTML í escape-uðum streng — ekki JSON. Það þyrfti samt að þátta HTML, og til viðbótar `client_hash` sem lifir stutt. Playwright-leiðin er áfram réttari.

## Næstu skref
1. Stofna repo á GitHub, bæta við remote og ýta (`git push -u origin main`).
2. Setja inn slóðir fyrir alla flokka félagsins í `lid.json` og eyða `data/daemi-lid-1.json`.
3. Keyra á fleiri flokkum og staðfesta að greiningin haldi (t.d. meistaraflokkur, þar sem dálkar gætu verið fleiri).
4. Skipta `NOTANDI` út fyrir raunverulegt GitHub-notandanafn í `README.md` og `wordpress-daemi.php`.

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
