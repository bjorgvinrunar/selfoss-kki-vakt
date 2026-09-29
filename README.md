# Selfoss KKÍ vakt

Sækir leiki og úrslit allra liða Selfoss úr mótakerfi KKÍ með Playwright (headless Chrome) á GitHub Actions og vistar sem JSON í `data/`. WordPress sækir svo bara `data/allt.json`.

Skrifað er í `data/` **aðeins þegar eitthvað breytist**, svo það verður ekki commit í hverri keyrslu.

```
selfoss-kki-vakt/
├── .github/workflows/kki-vakt.yml   ← tímaáætlun og keyrsla á GitHub
├── lid.json                         ← listinn yfir liðin sem á að vakta
├── scrape.js                        ← Playwright-skriftan
├── wordpress-daemi.php              ← dæmi um hvernig WordPress sækir gögnin
├── CLAUDE.md                        ← samhengi fyrir Claude Code
├── package.json / package-lock.json
└── data/                            ← verður til í fyrstu keyrslu
```

---

## Skref 1 — Stofna repo á GitHub

1. Farðu á **github.com/new**.
2. Nafn: `selfoss-kki-vakt`.
3. Veldu **Public**. Actions-mínútur eru þá ókeypis og ótakmarkaðar, og gögnin eru hvort sem er opinber á kki.is. (Sjá „Kostnaður“ neðst ef þú vilt Private.)
4. **Ekki** haka við „Add a README“. Smelltu á **Create repository**.

## Skref 2 — Setja kóðann inn

Pakkaðu zip-skránni upp og keyrðu í terminal:

```bash
cd selfoss-kki-vakt
git init -b main
git add .
git commit -m "Fyrsta útgáfa"
git remote add origin https://github.com/NOTANDI/selfoss-kki-vakt.git
git push -u origin main
```

(Skiptu `NOTANDI` út fyrir GitHub-notandanafnið þitt.)

> Ef þú hleður upp í gegnum vefinn í staðinn („uploading an existing file“): passaðu að `.github`-mappan fari með, því hún er falin. Á Mac sérðu hana með **Cmd+Shift+.** í Finder. Í Windows velurðu **View → Show → Hidden items** í File Explorer.

## Skref 3 — Leyfa workflowinu að skrifa í repoið

**Settings → Actions → General → Workflow permissions →** veldu **Read and write permissions** → **Save**.

## Skref 4 — Finna slóðir fyrir alla flokka

Fyrir **hvert lið** félagsins:

1. Farðu á kki.is → **Mótamál → Leikir og úrslit → Mótayfirlit**.
2. Veldu mótið eða flokkinn (t.d. 1. deild karla, Drengjaflokkur, 10. flokkur drengja …).
3. Smelltu á **Selfoss** svo „Eitt lið“-síðan opnist.
4. Gakktu úr skugga um að **leikjalistinn sjáist** á skjánum (réttur flipi valinn).
5. Afritaðu **alla** slóðina úr vafranum, líka `#mbt:…` hlutann í endann.

Ef félagið á fleiri en eitt lið í sama flokki (t.d. Selfoss og Selfoss b) fær hvert þeirra sína færslu.

Settu svo slóðirnar inn í `lid.json`:

```json
{
  "felag": "Selfoss Körfuknattleiksfélag",
  "timabil": "2026-2027",
  "lid": [
    {
      "slug": "mfl-karla",
      "nafn": "Meistaraflokkur karla",
      "url": "https://kki.is/motamal/leikir-og-urslit/motayfirlit/Eitt-lid?league_id=...&season_id=...&team_id=...#mbt:..."
    },
    {
      "slug": "mfl-kvenna",
      "nafn": "Meistaraflokkur kvenna",
      "url": "https://kki.is/..."
    },
    {
      "slug": "drengjaflokkur",
      "nafn": "Drengjaflokkur",
      "url": "https://kki.is/..."
    }
  ]
}
```

- **slug** verður skráarnafn (`data/mfl-karla.json`). Notaðu bara a–z, 0–9 og bandstrik, ekkert æ/ð/þ.
- **nafn** er það sem birtist.
- Commit-aðu og push-aðu breytinguna (eða breyttu `lid.json` beint á github.com með blýantstákninu).

> **Nýtt tímabil:** `season_id` (og oft `league_id`/`team_id`) breytist á hverju hausti. Þá þarf að sækja slóðirnar aftur og uppfæra `lid.json`.

## Skref 5 — Fyrsta keyrsla

1. Farðu í **Actions**-flipann í repoinu. Ef GitHub spyr, smelltu á **„I understand my workflows, go ahead and enable them“**.
2. Veldu **KKÍ vakt** vinstra megin → **Run workflow** → **Run workflow**.
3. Keyrslan tekur um 2 mínútur. Grænt ✓ = allt í lagi.
4. Smelltu á keyrsluna → **scrape** → skrefið **„Sækja gögn frá KKÍ“** sýnir eina línu á hvert lið:
   ```
   ✓ Meistaraflokkur karla: 18 leikir (7 leiknir) (breytt)
   ```
5. `data/`-mappan birtist nú í repoinu.

### Ef eitthvað lið mistekst

Neðst á keyrslusíðunni er **Artifacts → debug** (geymt í 3 daga). Þar eru:

- `slug.png`: skjáskot af síðunni eins og Playwright sá hana
- `slug-net.json`: hrá svör frá BasketHotel
- `slug-toflur.json`: töflurnar eins og þær voru lesnar, áður en leikir voru greindir
- `slug-texti.txt`: allur texti síðunnar, ef engin tafla fannst

Algengasta ástæðan fyrir „Engin tafla fannst“ er að slóðin opnar rangan flipa. Sæktu slóðina þá aftur þegar leikjalistinn sést.

Lið sem mistekst heldur síðustu góðu gögnunum sínum. Þau eyðast aldrei við villu.

## Skref 6 — Tengja WordPress

JSON-skráin er aðgengileg á:

```
https://raw.githubusercontent.com/NOTANDI/selfoss-kki-vakt/main/data/allt.json
```

`wordpress-daemi.php` sýnir hvernig á að sækja hana:

- **Cache í 10 mínútur** (transient), svo WordPress spyr GitHub ekki við hverja síðuhleðslu.
- **Varaafrit** (option) af síðustu góðu gögnum, ef GitHub svarar ekki.
- **Shortcode** `[selfoss_leikir lid="mfl-karla"]` sem birtir einfalda leikjatöflu.

---

## Snið gagnanna

`data/allt.json`:

```json
{
  "felag": "Selfoss Körfuknattleiksfélag",
  "timabil": "2026-2027",
  "lid": [ { ...eins og data/<slug>.json... } ],
  "sidastBreytt": "2026-10-03T21:14:02.118Z"
}
```

Hver leikur í `lid[].leikir`:

| Reitur | Dæmi | Athugasemd |
|---|---|---|
| `dags`, `timi` | `2026-09-21`, `20:30` | `dags` er alltaf á ISO-sniði (ÁÁÁÁ-MM-DD) |
| `iso` | `2026-09-21T20:30:00+00:00` | Ísland er á UTC allt árið |
| `heima`, `gestir` | `Selfoss 11.fl.dr.`, `KR/KV 11.fl.dr.` | |
| `heimaId`, `gestaId` | `4749663`, `4749913` | `team_id` hjá KKÍ |
| `urslit` | `88 : 86` | tómt ef leik er ólokið |
| `heimaStig`, `gestaStig` | `88`, `86` | `null` ef leik er ólokið |
| `leikinn` | `true` | hvort leikurinn er búinn |
| `vollur` | `Vallaskóli` | |
| `leikId` | `6156395` | `game_id` hjá KKÍ |
| `slod` | `https://kki.is/…/Leikur?…` | tengill á leikinn |
| `okkarMegin` | `heima` / `gestir` | hvorum megin Selfoss-liðið er |
| `andstaedingur` | `KR/KV 11.fl.dr.` | |
| `okkarStig`, `andstaedingsStig` | `88`, `86` | aðeins ef leik er lokið |
| `sigur` | `true` | aðeins ef leik er lokið |

Leikirnir eru raðaðir eftir dagsetningu og ná yfir **allt tímabilið** (skriftan víkkar
mánaðarsíu widgetsins, sem sýnir annars bara yfirstandandi mánuð).

Töflurnar á kki.is hafa engan haus, svo dálkar eru þekktir á innihaldi reitanna
(dagsetning, `team_id`-tengill, skor `86 : 62`) en ekki á dálkaheitum. Breytist röð
dálkanna hjá KKÍ heldur lesturinn því áfram að virka. Hráu töflurnar eru vistaðar í
`debug/<slug>-toflur.json` til samanburðar ef greiningin klikkar.

## Tímaáætlun

Í `.github/workflows/kki-vakt.yml`:

- á **15 mínútna fresti kl. 17–23** alla daga, þegar flestir leikir eru
- á **klukkutíma fresti kl. 8–16**, fyrir yngri flokka mót um helgar

Tímarnir eru í UTC, sem er sami tími og á Íslandi allt árið. GitHub getur seinkað áætluðum keyrslum um 5–15 mínútur þegar álag er mikið.

> **Sumarfrí:** Ef engin breyting verður í repoinu í 60 daga slekkur GitHub á tímaáætluninni. Farðu þá í **Actions → KKÍ vakt → Enable workflow** á haustin.

## Keyra á eigin tölvu (valfrjálst)

Þetta er þægilegt til að prófa nýjar slóðir áður en þú push-ar:

```bash
npm install
npx playwright install chromium
node scrape.js                    # öll lið
EINUNGIS=mfl-karla node scrape.js # bara eitt lið
HEADLESS=0 node scrape.js         # sýnir vafrann á meðan
```

Í Windows PowerShell er breytan sett svona: `$env:EINUNGIS="mfl-karla"; node scrape.js`

## Kostnaður

- **Public repo:** ókeypis, ótakmarkaðar mínútur.
- **Private repo:** 2.000 mínútur á mánuði eru ókeypis. Þessi tímaáætlun notar um 34 keyrslur á dag × ~2 mín ≈ 2.000 mín á mánuði, sem er alveg á mörkunum. Ef þú vilt Private skaltu fækka keyrslum, t.d. í `'3 17-22 * * *'` (klukkutíma fresti á kvöldin).

## Kurteisi við kki.is

Skriftan sækir liðin eitt í einu með 2,5 sekúndna bili, sleppir myndum og leturgerðum, og keyrir ekki oftar en á 15 mínútna fresti. Það er álíka álag og einn notandi sem smellir sig í gegnum síðurnar.
