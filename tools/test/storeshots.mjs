// Screenshots for the app stores and the web (1920×1080, landscape): a fight in the dungeon, a guardian, the
// village, the gear, the daily depth's result, the pearls' "today" tab, the class picker and the season's path.
//   node tools/test/storeshots.mjs [out dir] [lang]
import { mkdirSync } from 'fs';
import { launch, openGame, startGeared, skip, until, sleep } from './lib.mjs';

const out = process.argv[2] || '/tmp/dw/storeshots';
const lang = process.argv[3] || 'cs';
mkdirSync(out, { recursive: true });
const locale = { cs: 'cs-CZ', en: 'en-US', de: 'de-DE' }[lang] ?? lang;
const { browser, page } = await launch({ width: 960, height: 540, scale: 2, locale });
const shot = (n) => page.screenshot({ path: `${out}/${lang}_${n}.png` });
const quiet = () =>
  page.evaluate(() => {
    document.querySelectorAll('.toasts > *, .lootfeed > *').forEach((t) => t.remove());
  });

await openGame(page);
await page.evaluate(() => document.querySelector('[data-a=new]')?.click());
await sleep(800);
await shot('7_classes');

// a fight among monsters in a lit room
await startGeared(page, 'mage', 34, { quality: 'full' });
await sleep(2500);
await page.evaluate(() => {
  const sc = window.__scene;
  sc.godMode = true;
  const st = (sc.save.pearl ??= {});
  st.aura = 'arcane';
  st.trail = 'stars';
  const e = sc.enemies.filter((x) => !x.dead).sort((a, b) => Math.hypot(a.x - sc.player.x, a.y - sc.player.y) - Math.hypot(b.x - sc.player.x, b.y - sc.player.y))[0];
  if (e) {
    sc.player.x = e.x - 50;
    sc.player.y = e.y + 6;
    for (const m of sc.enemies) if (Math.hypot(m.x - e.x, m.y - e.y) < 160) m.aggro = true;
  }
  window.__dev.bot(true);
});
await sleep(2600);
await quiet();
await shot('1_fight');
await page.evaluate(() => window.__dev.bot(false));

// a guardian
await startGeared(page, 'warrior', 40, { quality: 'full' });
await sleep(1500);
await page.evaluate(() => {
  window.__scene.godMode = true;
  window.__dev.toBoss();
});
await sleep(2500);
await skip(page, 8);
await page.evaluate(() => window.__dev.bot(true));
await sleep(3500);
await quiet();
await shot('2_guardian');
await page.evaluate(() => window.__dev.bot(false));

// the gear
await page.evaluate(() => window.__scene.ui.openPanel('inventory'));
await sleep(800);
await page.evaluate(() => document.querySelector('.doll .slot, .equip .slot')?.click());
await sleep(500);
await shot('4_gear');
await page.evaluate(() => window.__scene.ui.closeOverlay());

// the village at dusk
await page.evaluate(() => window.__dev.village());
await until(page, () => window.__scene?.inVillage && !window.__scene.cinematic);
await skip(page, 6);
await sleep(2500);
await quiet();
await shot('3_village');

// the pearls' "today" tab and the season's path
await page.evaluate(() => window.__scene.ui.pearls.open('today'));
await sleep(700);
await shot('6_today');
await page.evaluate(() => {
  const se = window.__scene.save.pearl.season;
  se.sparks = 2600;
  se.premium = true;
  window.__scene.ui.pearls.refresh();
  document.querySelector('.tab[data-tab=season]').click();
});
await sleep(700);
await shot('8_season');
await page.evaluate(() => window.__scene.ui.closeOverlay());

// the daily depth's result
await page.evaluate(() => window.__scene.startDelve());
await until(page, () => window.__scene?.daily && !window.__scene.cinematic);
await skip(page, 4);
await page.evaluate(() => (window.__scene.godMode = true));
for (let k = 0; k < 80; k++) {
  const left = await page.evaluate(() => {
    const sc = window.__scene;
    const r = sc.enc.rift;
    if (!r || r.guard) return -1;
    const e = sc.enemies.find((x) => !x.dead && !x.isMinion);
    if (e) sc.combat.killEnemy(e);
    return r.need - r.kills;
  });
  if (left <= 0) break;
  await sleep(700);
}
await sleep(1500);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const g = window.__scene.enc.rift?.guard;
    if (g && !g.dead) window.__scene.combat.killEnemy(g);
  });
  await sleep(300);
}
await sleep(2500);
await quiet();
await shot('5_daily');
await browser.close();
console.log('done', out);
