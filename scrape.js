// Vaktar liðssíður í mótakerfi KKÍ (BasketHotel/MBT widget) með Playwright.
// Les töflurnar eftir að widgetið hefur hlaðist, vistar JSON í data/
// og skrifar skrár bara ef gögnin hafa breyst (svo ekki verði commit í hverri keyrslu).

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const DEBUG_DIR = path.join(ROOT, 'debug');
const CONFIG = path.join(ROOT, 'lid.json');

const HEADLESS = process.env.HEADLESS !== '0';      // HEADLESS=0 sýnir vafrann (staðbundið)
const EINUNGIS = process.env.EINUNGIS || '';        // EINUNGIS=slug keyrir bara eitt lið
const BID_MILLI_SIDNA_MS = 2500;                    // kurteisi við kki.is
const HLEDSLA_TIMEOUT_MS = 60_000;
const TOFLU_TIMEOUT_MS = 30_000;
const MAX_SIDUR = 30;                               // öryggisventill á flettingu

// ---------- hjálparföll ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lesJson(skra, sjalfgefid = null) {
  try {
    return JSON.parse(await fs.readFile(skra, 'utf8'));
  } catch {
    return sjalfgefid;
  }
}

// Skrifar JSON bara ef innihaldið (fyrir utan sidastBreytt) hefur breyst.
// Skilar true ef skráin var skrifuð.
async function skrifaEfBreytt(skra, gogn) {
  const gamalt = await lesJson(skra);
  if (gamalt) {
    const { sidastBreytt, ...gamaltInnihald } = gamalt;
    if (JSON.stringify(gamaltInnihald) === JSON.stringify(gogn)) return false;
  }
  const nytt = { ...gogn, sidastBreytt: new Date().toISOString() };
  await fs.writeFile(skra, JSON.stringify(nytt, null, 2) + '\n', 'utf8');
  return true;
}

// Leikjatöflur KKÍ hafa ENGAN haus (engin <th>, engin dálkaheiti), svo dálkar
// verða að þekkjast á innihaldi reitanna. Raunveruleg röð á kki.is er:
//   dags+tími | heimalið | úrslit | gestalið | völlur | (tómur reitur)
// Við treystum þó ekki á fasta stöðu heldur greinum hvern reit fyrir sig,
// svo breytist dálkaröðin hjá BasketHotel heldur lesturinn áfram.
const DAGS_REGLA = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;
const SKOR_REGLA = /^(\d{1,3})\s*[:\-–]\s*(\d{1,3})$/;

// "07-09-2026 20:30" -> { dags: '2026-09-07', timi: '20:30', iso: '...' }
// Ísland er á UTC allt árið, svo hægt er að nota +00:00 án leiðréttingar.
function thattaDagsetningu(texti) {
  const m = DAGS_REGLA.exec(texti.trim());
  if (!m) return null;
  const [, d, man, ar, klst, min] = m;
  const dags = `${ar}-${man.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const timi = klst ? `${klst.padStart(2, '0')}:${min}` : null;
  return { dags, timi, iso: timi ? `${dags}T${timi}:00+00:00` : null };
}

// Þekkir eina röð sem leik. Skilar null ef röðin er ekki leikur
// (t.d. skýringartaflan "MIN – Tími á velli" eða flakk-töflur).
function rodILeik(rod) {
  let dagsetning = null;
  let slod = null;
  let leikId = null;
  const lidsreitir = [];   // reitir með team_id = liðin tvö
  const skorreitir = [];   // reitir sem líta út eins og "86 : 62"
  const afgangur = [];     // reitir sem eftir standa (völlur o.fl.)

  for (const reitur of rod) {
    const texti = reitur.texti;
    if (reitur.leikId && !leikId) {
      leikId = reitur.leikId;
      if (reitur.tengill) slod = reitur.tengill;
    }
    if (!dagsetning) {
      const d = thattaDagsetningu(texti);
      if (d) {
        dagsetning = d;
        continue;
      }
    }
    if (reitur.lidId) {
      lidsreitir.push(reitur);
      continue;
    }
    if (SKOR_REGLA.test(texti)) {
      skorreitir.push(reitur);
      continue;
    }
    if (texti) afgangur.push(texti);
  }

  // Leikur krefst dagsetningar og tveggja liða.
  if (!dagsetning || lidsreitir.length < 2) return null;

  const [heima, gestir] = lidsreitir;
  const leikur = {
    leikId,
    dags: dagsetning.dags,
    timi: dagsetning.timi,
    iso: dagsetning.iso,
    heima: heima.texti,
    heimaId: heima.lidId,
    gestir: gestir.texti,
    gestaId: gestir.lidId,
    urslit: skorreitir[0]?.texti || '',
    heimaStig: null,
    gestaStig: null,
    leikinn: false,
    vollur: afgangur[0] || null,
    slod,
  };

  const skor = SKOR_REGLA.exec(leikur.urslit);
  if (skor) {
    leikur.heimaStig = Number(skor[1]);
    leikur.gestaStig = Number(skor[2]);
    leikur.leikinn = true;
  }
  return leikur;
}

// Bætir við upplýsingum um okkar lið (hvort það er heima eða úti, stig, sigur).
function merkjaOkkarLid(leikur, okkarLidId) {
  if (!okkarLidId) return leikur;
  const heimaHja = leikur.heimaId === okkarLidId;
  const utiHja = leikur.gestaId === okkarLidId;
  if (!heimaHja && !utiHja) return leikur;

  leikur.okkarMegin = heimaHja ? 'heima' : 'gestir';
  leikur.andstaedingur = heimaHja ? leikur.gestir : leikur.heima;
  if (leikur.leikinn) {
    leikur.okkarStig = heimaHja ? leikur.heimaStig : leikur.gestaStig;
    leikur.andstaedingsStig = heimaHja ? leikur.gestaStig : leikur.heimaStig;
    leikur.sigur = leikur.okkarStig > leikur.andstaedingsStig;
  }
  return leikur;
}

// Breytir hráum töflum í lista af leikjum, raðað eftir dagsetningu.
function toflurILeiki(toflur, okkarLidId) {
  const leikir = [];
  const sedir = new Set();
  for (const tafla of toflur) {
    for (const rod of tafla.rodir) {
      const leikur = rodILeik(rod);
      if (!leikur) continue;
      // Sami leikur getur birst í fleiri en einni töflu widgetsins
      const lykill = leikur.leikId || `${leikur.iso}|${leikur.heima}|${leikur.gestir}`;
      if (sedir.has(lykill)) continue;
      sedir.add(lykill);
      leikir.push(merkjaOkkarLid(leikur, okkarLidId));
    }
  }
  leikir.sort((a, b) => (a.iso || a.dags).localeCompare(b.iso || b.dags));
  return leikir;
}

// Keyrt inni í vafranum: les töflur widgetsins í tilteknum ramma (frame).
// Athugið: reitir innihalda <script>-klumpa (BasketHotel setur href-in með JS),
// svo textinn er lesinn af klónuðum reit þar sem script/style hefur verið fjarlægt.
function lesToflurIVafra() {
  const hreinsa = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // mbt-table eru töflur widgetsins; mbt-whitelinks er falda flakk-valmyndin
  // (listi yfir alla flokka) og inniheldur enga leiki.
  const valdar = document.querySelectorAll('table.mbt-table:not(.mbt-whitelinks)');
  const toflur = valdar.length ? valdar : document.querySelectorAll('table');

  // Fyrirsagnir widgetsins (mót og lið) eru í .mbt-headline, ekki í <h1>–<h6>.
  const fyrirsagnir = [...document.querySelectorAll('.mbt-headline')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => hreinsa(e.textContent))
    .filter(Boolean);

  return [...toflur]
    .map((tafla) => {
      const rodir = [...tafla.rows]
        .map((r) =>
          [...r.cells].map((c) => {
            const klon = c.cloneNode(true);
            klon.querySelectorAll('script, style').forEach((n) => n.remove());
            const tenglar = [...c.querySelectorAll('a')];
            const attr = (heiti) =>
              tenglar.map((a) => a.getAttribute(heiti)).find(Boolean) || null;
            const raunslod = tenglar
              .map((a) => a.href)
              .find((h) => h && !h.endsWith('#'));
            return {
              texti: hreinsa(klon.textContent),
              tengill: raunslod || null,
              leikId: attr('game_id'),
              lidId: attr('team_id'),
              feitletrad: !!c.querySelector('strong, b'),
            };
          })
        )
        .filter((reitir) => reitir.some((c) => c.texti));

      return { fyrirsagnir, rodir };
    })
    .filter((t) => t.rodir.length > 0);
}

// Keyrt inni í vafranum: stillir síur widgetsins á "Allir mánuðir"/"Allir hópar".
// Widgetið sýnir sjálfgefið bara YFIRSTANDANDI MÁNUÐ, svo án þessa fást
// aðeins örfáir leikir í stað alls tímabilsins.
function stilltuSiurIVafra() {
  let breytt = 0;
  const veldu = (vali, gildi) => {
    for (const sia of document.querySelectorAll(vali)) {
      if (![...sia.options].some((o) => o.value === gildi)) continue;
      if (sia.value === gildi) continue;
      sia.value = gildi;
      sia.dispatchEvent(new Event('change', { bubbles: true }));
      breytt++;
    }
  };
  veldu('select[id$="filter-month"]', 'all');
  veldu('select[id$="filter-group"]', '0');
  return breytt;
}

// Keyrt inni í vafranum: finnur síðutölur flettarans.
// Widgetið sýnir aðeins 20 leiki í einu og setur afganginn á síðu 2, 3 …
// Síðutenglarnir hafa id á borð við "6-200-page-2"; núverandi síða er <strong> án id.
function finnSidurIVafra() {
  const tolur = new Set();
  for (const e of document.querySelectorAll('[id]')) {
    const m = /-page-(\d+)$/.exec(e.id);
    if (m) tolur.add(Number(m[1]));
  }
  return [...tolur].sort((a, b) => a - b);
}

// Keyrt inni í vafranum: flettir á tiltekna síðu.
function faraASiduIVafra(n) {
  if (typeof window.changeScheduleAndResultsPage === 'function') {
    window.changeScheduleAndResultsPage(n);
    return true;
  }
  // Varaleið ef BasketHotel endurnefnir fallið
  const hnappur = [...document.querySelectorAll('[id]')].find((e) => e.id.endsWith(`-page-${n}`));
  if (hnappur) {
    hnappur.click();
    return true;
  }
  return false;
}

// ---------- ein liðssíða ----------

async function sokjaLid(context, lid) {
  const page = await context.newPage();
  const netsvor = [];

  // Hlera svör frá BasketHotel — vistað í debug/ til að geta síðar sótt gögnin beint
  page.on('response', async (svar) => {
    const url = svar.url();
    if (!/baskethotel|widget-service/i.test(url)) return;
    try {
      const texti = await svar.text();
      netsvor.push({ url, status: svar.status(), texti: texti.slice(0, 200_000) });
    } catch {
      /* sum svör (t.d. redirect) hafa engan body */
    }
  });

  try {
    await page.goto(lid.url, { waitUntil: 'domcontentloaded', timeout: HLEDSLA_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: TOFLU_TIMEOUT_MS }).catch(() => {});

    // Bíða eftir að einhver tafla með gögnum birtist (í aðalsíðu eða iframe)
    const lesAllaRamma = async () => {
      const safn = [];
      for (const frame of page.frames()) {
        try {
          safn.push(...(await frame.evaluate(lesToflurIVafra)));
        } catch {
          /* rammi sem ekki er hægt að lesa */
        }
      }
      return safn;
    };

    const byrjun = Date.now();
    let toflur = [];
    while (Date.now() - byrjun < TOFLU_TIMEOUT_MS) {
      toflur = await lesAllaRamma();
      if (toflur.length > 0) break;
      await sleep(1000);
    }

    // Víkka síuna úr yfirstandandi mánuði í allt tímabilið og lesa aftur.
    let breytt = 0;
    for (const frame of page.frames()) {
      try {
        breytt += await frame.evaluate(stilltuSiurIVafra);
      } catch {
        /* rammi sem ekki er hægt að lesa */
      }
    }
    if (breytt > 0) {
      await page.waitForLoadState('networkidle', { timeout: TOFLU_TIMEOUT_MS }).catch(() => {});
      await sleep(1500); // widgetið endurteiknar töfluna eftir svarið
      const vidari = await lesAllaRamma();
      if (vidari.length > 0) toflur = vidari;
    }

    // Fletta gegnum allar síður flettarans — widgetið sýnir bara 20 leiki í einu.
    const heimsottar = new Set([1]);
    for (let vorn = 0; vorn < MAX_SIDUR; vorn++) {
      let naesta = null;
      let rammi = null;
      for (const frame of page.frames()) {
        try {
          const oheimsott = (await frame.evaluate(finnSidurIVafra)).find((s) => !heimsottar.has(s));
          if (oheimsott) {
            naesta = oheimsott;
            rammi = frame;
            break;
          }
        } catch {
          /* rammi sem ekki er hægt að lesa */
        }
      }
      if (naesta === null) break;

      heimsottar.add(naesta);
      const tokst = await rammi.evaluate(faraASiduIVafra, naesta).catch(() => false);
      if (!tokst) break;

      await page.waitForLoadState('networkidle', { timeout: TOFLU_TIMEOUT_MS }).catch(() => {});
      await sleep(1200); // widgetið endurteiknar töfluna eftir svarið
      toflur.push(...(await lesAllaRamma()));
    }

    await fs.mkdir(DEBUG_DIR, { recursive: true });
    await page.screenshot({ path: path.join(DEBUG_DIR, `${lid.slug}.png`), fullPage: true }).catch(() => {});
    await fs.writeFile(
      path.join(DEBUG_DIR, `${lid.slug}-net.json`),
      JSON.stringify(netsvor, null, 2),
      'utf8'
    );

    if (toflur.length === 0) {
      const texti = await page.evaluate(() => document.body.innerText).catch(() => '');
      await fs.writeFile(path.join(DEBUG_DIR, `${lid.slug}-texti.txt`), texti, 'utf8');
      throw new Error('Engin tafla fannst á síðunni (sjá debug/)');
    }

    // team_id úr slóðinni segir hvaða lið er "okkar" í töflunni
    const okkarLidId = lid.url.match(/team_id=(\d+)/i)?.[1] || null;
    const leikir = toflurILeiki(toflur, okkarLidId);

    // Hráu töflurnar fara í debug/ en ekki í data/ — WordPress les bara leikina.
    await fs.writeFile(
      path.join(DEBUG_DIR, `${lid.slug}-toflur.json`),
      JSON.stringify(toflur, null, 2),
      'utf8'
    );

    if (leikir.length === 0) {
      throw new Error(`${toflur.length} töflur fundust en enginn leikur greindist (sjá debug/)`);
    }

    return {
      slug: lid.slug,
      nafn: lid.nafn,
      url: lid.url,
      lidId: okkarLidId,
      mot: toflur[0]?.fyrirsagnir?.[0] || null,
      leikir,
    };
  } finally {
    await page.close();
  }
}

// ---------- aðalkeyrsla ----------

async function main() {
  const stillingar = await lesJson(CONFIG);
  if (!stillingar?.lid?.length) throw new Error('Engin lið í lid.json');

  const oll = stillingar.lid.filter((l) => !EINUNGIS || l.slug === EINUNGIS);
  await fs.mkdir(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const context = await browser.newContext({
    locale: 'is-IS',
    timezoneId: 'Atlantic/Reykjavik',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  });
  // Sleppa myndum, leturgerðum og myndböndum — hraðar og léttara fyrir kki.is
  await context.route('**/*', (route) =>
    ['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue()
  );

  let tokst = 0;
  let breytt = 0;
  const villur = [];

  for (const [i, lid] of oll.entries()) {
    if (i > 0) await sleep(BID_MILLI_SIDNA_MS);
    try {
      const gogn = await sokjaLid(context, lid);
      const skrifad = await skrifaEfBreytt(path.join(DATA_DIR, `${lid.slug}.json`), gogn);
      tokst++;
      if (skrifad) breytt++;
      const leiknir = gogn.leikir.filter((l) => l.leikinn).length;
      console.log(
        `✓ ${lid.nafn}: ${gogn.leikir.length} leikir (${leiknir} leiknir)${skrifad ? ' (breytt)' : ''}`
      );
    } catch (e) {
      villur.push(`${lid.nafn}: ${e.message}`);
      // Fyrri gögn liðsins haldast óbreytt ef sókn mistekst
      console.log(`::warning::${lid.nafn} mistókst — ${e.message}`);
    }
  }

  await browser.close();

  // Sameinuð skrá með öllum liðum (úr þeim gögnum sem til eru á diski)
  if (!EINUNGIS) {
    const lidin = [];
    for (const lid of stillingar.lid) {
      const g = await lesJson(path.join(DATA_DIR, `${lid.slug}.json`));
      if (g) lidin.push(g);
    }
    const sameinad = { felag: stillingar.felag || null, timabil: stillingar.timabil || null, lid: lidin };
    await skrifaEfBreytt(path.join(DATA_DIR, 'allt.json'), sameinad);
  }

  console.log(`\nLokið: ${tokst}/${oll.length} lið sótt, ${breytt} breyttust.`);
  if (villur.length) console.log('Villur:\n  ' + villur.join('\n  '));
  if (tokst === 0) process.exit(1); // rautt í GitHub Actions ef ekkert tókst
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
