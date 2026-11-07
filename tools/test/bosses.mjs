// Guardian probe: a hero geared for a guardian's floor (the dev bot plays it) fights the guardian on a difficulty
// until it falls, the hero has fallen three times or the time runs out. One JSON line per fight: how long it took
// (game time), the hero's deaths, the lowest health and the potions drunk. A run cut short goes on where it stopped.
//   node tools/test/bosses.mjs <out.jsonl> [classes] [floors] [difficulties] [profile] [shard/of]
//   e.g. node tools/test/bosses.mjs /tmp/dw/balance/bosses.jsonl warrior,mage 20,70,140 1,3 median 0/2
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { launch, openGame, startGeared, skip, sleep } from './lib.mjs';

const [out = '/tmp/dw/balance/bosses.jsonl', clsArg = 'warrior,mage,ranger,necro', floorArg = '20,70,140,230', difArg = '1', profile = 'median', shardArg = '0/1'] = process.argv.slice(2);
const [shard, shards] = shardArg.split('/').map(Number);
const configs = [];
for (const c of clsArg.split(',')) for (const f of floorArg.split(',')) for (const d of difArg.split(',')) configs.push({ cls: c, floor: +f, dif: +d });
const done = new Set();
if (existsSync(out))
  for (const l of readFileSync(out, 'utf8').split('\n'))
    try {
      const r = JSON.parse(l);
      if (r.t !== undefined) done.add(`${r.cls}|${r.floor}|${r.dif}`);
    } catch {}
const mine = configs.filter((c, i) => i % shards === shard && !done.has(`${c.cls}|${c.floor}|${c.dif}`));
// game seconds a fight may take before it counts as unfinished
const LIMIT = 600;

let { browser, page, errs } = await launch({ width: 640, height: 296, gfx: 0 });

for (const c of mine) {
  const t0 = Date.now();
  try {
    await openGame(page);
    await startGeared(page, c.cls, c.floor, { quality: profile, difficulty: c.dif });
    await sleep(2500);
    const info = await page.evaluate(() => {
      const sc = window.__scene;
      sc.ui.closeOverlay?.(false, true);
      sc.save.mats.hpPotion = 10;
      sc.save.mats.mpPotion = 10;
      if (sc.merc) sc.merc.setVisible?.(false), (sc.merc = null);
      if (sc.pet) sc.pet.sprite?.setVisible(false), (sc.pet = null);
      window.__bf = { t0: null, deaths: 0, wasDead: false, minHp: 1, pots: sc.save.stats?.potions ?? 0 };
      return window.__dev.toBoss();
    });
    if (!info) throw new Error('no guardian on this floor');
    await skip(page, 10);
    await page.evaluate(() => window.__dev.bot(true));
    const wall = Date.now();
    let res = null;
    while (Date.now() - wall < LIMIT * 4000) {
      await sleep(500);
      res = await page.evaluate(() => {
        const sc = window.__scene;
        const bf = window.__bf;
        const b = sc.boss;
        const p = sc.player;
        if (!b) return { gone: true };
        // the fight starts when the guardian notices the hero
        if (bf.t0 === null && b.aggro) bf.t0 = sc.simT;
        const was = bf.wasDead;
        if (p.dead && !was) {
          bf.deaths++;
          // what landed the last blow (the guardian, its servants, the arena …)
          if (sc.lastHit) (bf.killers ??= []).push(`${sc.lastHit.who} (${sc.lastHit.kind}, ${sc.lastHit.amount} of ${Math.round(p.d.maxHp)})`);
        }
        // after a death the hero wakes in the room before the arena: back to the guardian
        if (!p.dead && was && !b.dead) window.__dev.toBoss();
        bf.wasDead = p.dead;
        if (!p.dead && bf.t0 !== null) bf.minHp = Math.min(bf.minHp, p.hp / p.d.maxHp);
        const dlg = document.querySelector('.cs-skip');
        if (dlg) window.__dev.skipCutscene();
        return { dead: b.dead, deaths: bf.deaths, killers: bf.killers, t: bf.t0 === null ? 0 : sc.simT - bf.t0, minHp: bf.minHp, pots: (sc.save.stats?.potions ?? 0) - bf.pots, boss: b.name, hpLeft: Math.round((b.hp / b.maxHp) * 100) / 100, phase: b.phase ?? 0 };
      });
      if (res.gone || res.dead || res.deaths >= 3 || res.t >= LIMIT) break;
    }
    await page.evaluate(() => window.__dev.bot(false));
    const line = { ...c, profile, ...res, won: !!res?.dead, wall: Math.round((Date.now() - t0) / 1000) };
    appendFileSync(out, JSON.stringify(line) + '\n');
    console.log(JSON.stringify(line));
  } catch (e) {
    appendFileSync(out, JSON.stringify({ ...c, profile, error: String(e).slice(0, 200) }) + '\n');
    console.log('error', c, String(e).slice(0, 200));
    if (/closed|crash/i.test(String(e))) {
      await browser.close().catch(() => {});
      ({ browser, page, errs } = await launch({ width: 640, height: 296, gfx: 0 }));
    }
  }
  if (errs.length) appendFileSync(out, JSON.stringify({ ...c, pageErrors: errs.splice(0).slice(0, 5) }) + '\n');
}
await browser.close();
