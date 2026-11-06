// The daily features end to end: the gift of the day and a candle over a missed day, the newcomer's path, the
// tasks of the day, the season's path with the pearl track, looks, a code, the daily depth (a clear with its
// result and share text, a fall with nothing lost) and the main menu's line.
//   node tools/test/live.mjs [out dir for screenshots]
import { launch, openGame, startGeared, skip, until, toasts, log, sleep } from './lib.mjs';

const out = process.argv[2] || '/tmp/dw/shots';
const { browser, ctx, page, errs } = await launch();
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${process.env.PORT || 4177}` });
const shot = (n) => page.screenshot({ path: `${out}/live_${n}.png` });
await openGame(page);
await startGeared(page, 'ranger', 14, { quality: 'good' });
await page.evaluate(() => (window.__scene.save.pearls = 400));
// the tasks of the day done through the counters, claimed, the bonus
await page.evaluate(() => {
  const s = window.__scene.save;
  const map = { elites: 'elites', chests: 'chests', items: 'items', boss: 'bosses', secret: 'secrets', events: 'events', locks: 'locks', bounty: 'bounties', potions: 'potions', gold: 'goldEarned' };
  for (const k of s.pearl.tasks.list) {
    if (k.id === 'delve') s.pearl.delves = (s.pearl.delves ?? 0) + 1;
    else if (k.id === 'kills') s.kills += k.n;
    else if (k.id === 'time') s.playTime += k.n * 60;
    else (s.stats ??= {})[map[k.id]] = (s.stats[map[k.id]] ?? 0) + k.n;
  }
});
await sleep(1600);
await page.evaluate(() => window.__scene.ui.pearls.open('today'));
await sleep(400);
await shot('today');
await page.evaluate(() => document.querySelector('[data-a=welcome]')?.click());
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => document.querySelector('[data-task]')?.click());
  await sleep(200);
}
await page.evaluate(() => document.querySelector('[data-a=bonus]')?.click());
await sleep(300);
log('tasks', await page.evaluate(() => ({ paid: window.__scene.save.pearl.tasks.list.map((k) => !!k.paid), bonus: !!window.__scene.save.pearl.tasks.bonus, welcome: window.__scene.save.pearl.welcome, sparks: window.__scene.save.pearl.season.sparks })));
// the season: the pearl track, a step bought, rewards taken
await page.evaluate(() => document.querySelector('.tab[data-tab=season]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('[data-a=premium]')?.click());
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('.overlay button')].find((x) => x.dataset.a === 'yes')?.click());
await sleep(300);
await page.evaluate(() => document.querySelector('[data-a=step]')?.click());
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => (document.querySelector('[data-free]') ?? document.querySelector('[data-prem]'))?.click());
  await sleep(200);
}
log('season', await page.evaluate(() => window.__scene.save.pearl.season));
await shot('season');
// looks and a code
await page.evaluate(() => document.querySelector('.tab[data-tab=looks]').click());
await sleep(300);
for (const k of ['aura:frost', 'title:terror', 'trail:embers']) {
  await page.evaluate((k) => document.querySelector(`[data-get="${k}"]`)?.click(), k);
  await sleep(200);
}
log('looks', await page.evaluate(() => ({ aura: window.__scene.save.pearl.aura, title: window.__scene.save.pearl.title, trail: window.__scene.save.pearl.trail })));
await page.evaluate(() => document.querySelector('.tab[data-tab=get]').click());
await sleep(300);
await page.fill('.pcode input', 'deepwick');
await page.evaluate(() => document.querySelector('[data-a=code]').click());
await sleep(300);
log('code', { codes: await page.evaluate(() => window.__scene.save.pearl.codes?.length ?? 0), toast: (await toasts(page)).slice(-1)[0] });
await page.evaluate(() => window.__scene.ui.closeOverlay());
// a streak of 6 days that missed yesterday, with a candle: on the next arrival the candle burns and the streak
// goes on to 7
await page.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const st = (window.__scene.save.pearl ??= {});
  st.day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  st.streak = 6;
  st.candles = 1;
});
// the daily depth from the village's gate
await page.evaluate(() => window.__dev.village());
await until(page, () => window.__scene?.inVillage && !window.__scene.cinematic);
await skip(page, 6);
await sleep(3500);
const g = await page.evaluate(() => ({ streak: window.__scene.save.pearl.streak, candles: window.__scene.save.pearl.candles }));
log('gift', { ...g, ok: g.streak === 7 && g.candles === 0 });
await page.evaluate(() => window.__scene.ui.expedition('bands'));
await sleep(500);
await shot('gate');
await page.evaluate(() => document.querySelector('[data-a=delve]').click());
await sleep(300);
await page.evaluate(() => [...document.querySelectorAll('.overlay button')].find((x) => x.dataset.a === 'yes')?.click());
await until(page, () => window.__scene?.daily && !window.__scene.cinematic);
await skip(page, 4);
const d1 = await page.evaluate(() => ({ n: window.__scene.daily.n, w: window.__scene.dungeon.w, start: window.__scene.dungeon.start, foes: window.__scene.enemies.slice(0, 5).map((e) => e.def?.id), need: window.__scene.enc.rift.need }));
log('delve', d1);
await page.evaluate(() => (window.__scene.godMode = true));
for (let k = 0; k < 60; k++) {
  const left = await page.evaluate(() => {
    const sc = window.__scene;
    const r = sc.enc.rift;
    if (!r || r.guard) return -1;
    const e = sc.enemies.find((x) => !x.dead && !x.isMinion);
    if (e) sc.combat.killEnemy(e);
    return r.need - r.kills;
  });
  if (left <= 0) break;
  await sleep(200);
}
await sleep(1500);
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const sc = window.__scene;
    const g = sc.enc.rift?.guard;
    if (g && !g.dead) sc.combat.killEnemy(g);
  });
  await sleep(300);
}
await sleep(2200);
await shot('result');
log('result', await page.evaluate(() => ({ day: window.__scene.save.pearl.delve, card: !!document.querySelector('.delveres') })));
await page.evaluate(() => document.querySelector('.delveres [data-a=copy]')?.click());
await sleep(500);
log('share', await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e)));
await page.evaluate(() => document.querySelector('.delveres [data-a=ok]')?.click());
await page.evaluate(() => {
  const sc = window.__scene;
  const it = sc.interactables.find((i) => i.kind === 'stairs' && i.data.home);
  if (it) {
    sc.player.x = it.x;
    sc.player.y = it.y + 4;
    sc.interact(it);
  }
});
log('home', { ok: await until(page, () => window.__scene?.inVillage && !window.__scene.cinematic) });
await skip(page, 4);
// the same layout on the second try; a fall costs nothing
await page.evaluate(() => window.__scene.startDelve());
await until(page, () => window.__scene?.daily && !window.__scene.cinematic);
await skip(page, 4);
const d2 = await page.evaluate(() => ({ w: window.__scene.dungeon.w, start: window.__scene.dungeon.start, foes: window.__scene.enemies.slice(0, 5).map((e) => e.def?.id) }));
log('same layout', { ok: JSON.stringify(d2.start) === JSON.stringify(d1.start) && d2.w === d1.w && d2.foes.join() === d1.foes.join() });
const gold0 = await page.evaluate(() => window.__scene.save.gold);
await page.evaluate(() => {
  const sc = window.__scene;
  sc.godMode = false;
  sc.player.hp = 0;
  sc.onPlayerDeath();
});
await until(page, () => !!document.querySelector('[data-a=retry]'), null, 15000);
await shot('death');
await page.evaluate(() => document.querySelector('[data-a=retry]').click());
await until(page, () => window.__scene?.inVillage && !window.__scene.cinematic);
log('fall', await page.evaluate((g0) => ({ village: window.__scene.inVillage, goldKept: window.__scene.save.gold === g0, tries: window.__scene.save.pearl.delve.tries }), gold0));
await page.evaluate(() => window.__scene.ui.showMainMenu());
await sleep(700);
log('menu line', await page.evaluate(() => document.querySelector('.todayline')?.textContent));
await shot('menu');
log('errors', errs.slice(0, 10));
await browser.close();
