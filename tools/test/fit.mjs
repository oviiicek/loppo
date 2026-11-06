// Does everything fit? Opens the game's screens and panels at the sizes of common phones (landscape), tablets
// and computers and looks for what does not: text cut off in a box that does not scroll, pictures bigger than
// their frame, elements sticking out of their panel or the screen. A screenshot of every screen goes to the
// output folder and the findings to fit.json there.
//   node tools/test/fit.mjs [out dir] [sizes, e.g. 844x390,1280x720]
import { writeFileSync, mkdirSync } from 'fs';
import { launch, openGame, startGeared, skip, until, sleep } from './lib.mjs';

const out = process.argv[2] || '/tmp/dw/fit';
const sizes = (process.argv[3] || '640x360,667x375,740x360,844x390,932x430,1024x768,1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
mkdirSync(out, { recursive: true });

/** what does not fit inside the element (the open overlay or the whole UI) */
const inspect = (root) => {
  const r0 = document.querySelector(root);
  if (!r0) return [];
  const vw = innerWidth,
    vh = innerHeight;
  const found = [];
  const name = (e) => {
    const c = typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return e.tagName.toLowerCase() + c;
  };
  const scrolls = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return p;
    }
    return null;
  };
  for (const e of r0.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const st = getComputedStyle(e);
    if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue;
    const txt = (e.innerText || e.alt || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    // text cut off: a box that clips (no scroll) holding more than it shows
    const clips = /(hidden|clip)/.test(st.overflowX + st.overflowY) && !/(auto|scroll)/.test(st.overflowX + st.overflowY);
    if (clips && e.childElementCount <= 3 && txt && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 3) && st.textOverflow !== 'ellipsis') found.push({ k: 'cut', el: name(e), txt, w: Math.round(e.clientWidth), sw: e.scrollWidth, h: Math.round(e.clientHeight), sh: e.scrollHeight });
    // off the screen (and not inside something that scrolls to it)
    if ((r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) && !scrolls(e)) found.push({ k: 'offscreen', el: name(e), txt, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
    // a picture bigger than its frame
    if (e.tagName === 'IMG' && e.parentElement) {
      const pr = e.parentElement.getBoundingClientRect();
      if (r.width > pr.width + 1 || r.height > pr.height + 1) found.push({ k: 'img', el: name(e.parentElement), w: Math.round(r.width), pw: Math.round(pr.width) });
    }
    // a child sticking out of a box that clips it
    const p = e.parentElement;
    if (p && p !== r0) {
      const ps = getComputedStyle(p);
      if (/(hidden|clip)/.test(ps.overflowX + ps.overflowY) && !/(auto|scroll)/.test(ps.overflowX + ps.overflowY)) {
        const pr = p.getBoundingClientRect();
        if ((r.right > pr.right + 2 || r.bottom > pr.bottom + 2) && !scrolls(p) && txt) found.push({ k: 'clipped', el: name(e), in: name(p), txt });
      }
    }
  }
  // one line per distinct finding
  const seen = new Set();
  return found.filter((f) => {
    const key = f.k + f.el + (f.txt ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const report = {};
for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  const { browser, page, errs } = await launch({ width: w, height: h, scale: 1 });
  const check = async (screen, root = '#ui') => {
    await sleep(450);
    const f = await page.evaluate(inspect, root);
    if (f.length) (report[tag] ??= {})[screen] = f;
    await page.screenshot({ path: `${out}/${tag}_${screen}.png` });
  };
  // everything open goes away (panels, dialogs over them), and the game runs again
  const close = () =>
    page.evaluate(() => {
      const ui = window.__scene?.ui;
      ui?.closeOverlay?.(true, true);
      document.querySelectorAll('#ui .overlay').forEach((o) => o.remove());
      if (ui) ui.panel = null;
      ui?.resumeGame?.();
    });
  try {
    await openGame(page);
    await check('menu');
    await page.evaluate(() => document.querySelector('[data-a=new]')?.click());
    await sleep(500);
    await check('classes');
    await startGeared(page, 'warrior', 30, { quality: 'good' });
    await page.evaluate(() => window.__dev.fillInv(['sword', 'halberd', 'longbow', 'scythe', 'crossbow', 'staff', 'greataxe', 'spear', 'helmet', 'ring', 'amulet', 'boots']));
    await check('hud');
    for (const p of ['inventory', 'character', 'spells', 'pets', 'gems', 'merc']) {
      await page.evaluate((p) => window.__scene.ui.openPanel(p), p);
      await check(p, '.overlay');
      await close();
    }
    // the first item picked in the bag (its detail and comparison)
    await page.evaluate(() => window.__scene.ui.openPanel('inventory'));
    await sleep(300);
    await page.evaluate(() => document.querySelector('.grid .slot img')?.closest('.slot')?.click());
    await check('item', '.overlay');
    await close();
    for (const t of ['today', 'season', 'shop', 'looks', 'get']) {
      await page.evaluate((t) => window.__scene.ui.pearls.open(t), t);
      await check('pearls_' + t, '.overlay');
      await close();
    }
    await page.evaluate(() => window.__scene.ui.quests.log());
    await check('quests', '.overlay');
    await close();
    await page.evaluate(() => window.__scene.ui.togglePause());
    await check('pause', '.overlay');
    await close();
    for (const t of ['ach', 'stats', 'codex', 'beast', 'weapons']) {
      await page.evaluate((t) => window.__scene.ui.menus.achievements(t), t);
      await check('book_' + t, '.overlay');
      await close();
    }
    // the village: the gate and the buildings
    await page.evaluate(() => window.__dev.village());
    await until(page, () => window.__scene?.inVillage && !window.__scene.cinematic);
    await skip(page, 6);
    await page.evaluate(() => window.__scene.ui.expedition('bands'));
    await check('gate', '.overlay');
    await close();
    for (const b of ['stash', 'smithy', 'shop', 'board', 'lab', 'tower', 'trainer', 'temple']) {
      await page.evaluate((b) => window.__scene.ui.buildings.open(b), b);
      await check('b_' + b, '.overlay');
      await close();
    }
    await page.evaluate(() => window.__scene.ui.buildings.fountain());
    await check('fountain', '.overlay');
    await close();
    // the death screen
    await page.evaluate(() => {
      const sc = window.__scene;
      sc.player.hp = 0;
      sc.onPlayerDeath();
    });
    await until(page, () => !!document.querySelector('[data-a=retry]'), null, 15000);
    await check('death', '.overlay');
  } catch (e) {
    (report[tag] ??= {}).error = String(e).slice(0, 300);
  }
  if (errs.length) (report[tag] ??= {}).pageErrors = errs.slice(0, 5);
  await browser.close();
  const n = Object.values(report[tag] ?? {}).reduce((a, v) => a + (Array.isArray(v) ? v.length : 1), 0);
  console.log(tag, n ? `${n} findings` : 'all fits');
}
writeFileSync(`${out}/fit.json`, JSON.stringify(report, null, 1));
