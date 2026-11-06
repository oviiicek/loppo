// Balance probe: a hero geared for a floor (the dev bot plays it) fights packs of the floor's monsters – six
// regular ones and a champion around it – on a difficulty. For every pack: how long it took, the lowest health,
// the potions drunk and whether the hero fell. One JSON line per configuration goes to the output file.
//   node tools/test/packs.mjs <out.jsonl> [classes] [floors] [difficulties] [quality] [packs] [shard/of]
//   e.g. node tools/test/packs.mjs /tmp/dw/balance/packs.jsonl warrior,mage 3,30,90 0,1,2,3 median 3 0/2
import { appendFileSync } from 'fs';
import { launch, openGame, startGeared, sleep } from './lib.mjs';

const [out = '/tmp/dw/balance/packs.jsonl', clsArg = 'warrior,mage,ranger,necro,monk', floorArg = '3,12,28,45,70,110,160,210,245', difArg = '0,1,2,3', quality = 'median', packArg = '3', shardArg = '0/1'] = process.argv.slice(2);
const [shard, shards] = shardArg.split('/').map(Number);
const configs = [];
for (const c of clsArg.split(',')) for (const f of floorArg.split(',')) for (const d of difArg.split(',')) configs.push({ cls: c, floor: +f, dif: +d });
const mine = configs.filter((_, i) => i % shards === shard);
const PACKS = +packArg;

const { browser, page, errs } = await launch({ width: 640, height: 296, gfx: 0 });

/** a fresh hero on the floor with nothing else around (the floor's own monsters leave) */
async function setup(c) {
  await openGame(page);
  const info = await startGeared(page, c.cls, c.floor, { quality, difficulty: c.dif });
  await sleep(3500);
  await page.evaluate(() => {
    const sc = window.__scene;
    sc.ui.closeOverlay?.(false, true);
    for (const e of sc.enemies) {
      e.dead = true;
      e.destroyVisuals?.();
    }
    sc.enemies.length = 0;
    // no way down: the bot would leave for the stairs once few monsters are left
    for (const it of sc.interactables.filter((i) => i.kind === 'stairs')) it.sprite?.setVisible?.(false);
    sc.interactables = sc.interactables.filter((i) => i.kind !== 'stairs');
    // the rival, the mercenary and the pet stay out of the measure
    if (sc.rival) {
      sc.rival.dead = true;
      sc.rival.destroyVisuals?.();
      sc.rival = null;
    }
    if (sc.merc) sc.merc.setVisible?.(false), (sc.merc = null);
    if (sc.pet) (sc.pet.sprite?.setVisible(false), (sc.pet = null));
  });
  return info;
}

/** one pack: six of the floor's monsters and a champion around the hero; the bot fights until all fall, the
 *  hero falls or 90 seconds pass */
async function pack() {
  const prep = await page.evaluate(() => {
    const sc = window.__scene;
    const p = sc.player;
    p.hp = p.d.maxHp;
    p.mp = p.d.maxMp;
    sc.save.mats.hpPotion = 5;
    sc.save.mats.mpPotion = 5;
    const pool = sc.enc.floorPool();
    const ids = [];
    const foes = [];
    for (let i = 0; i < 7; i++) {
      let q = null;
      for (let k = 0; k < 30 && !q; k++) {
        const c = sc.map.randomFloorNear(p.x, p.y, 110);
        if (c && Math.hypot(c[0] - p.x, c[1] - p.y) >= 45 && !sc.map.collides(c[0], c[1], 6)) q = c;
      }
      if (!q) continue;
      const id = pool[Math.floor(Math.random() * pool.length)];
      const e = sc.spawnEnemy(id, q[0], q[1], i === 6, -1);
      e.aggro = true;
      foes.push(e);
      ids.push(id + (i === 6 ? '*' : ''));
    }
    window.__pack = { foes, t0: sc.simT, minHp: 1, pots: sc.save.stats?.potions ?? 0 };
    return { ids, hp: Math.round(p.d.maxHp), foeHp: foes.map((e) => e.maxHp), foeDmg: foes.map((e) => Math.round(e.dmg * sc.diff.enemyDmg)) };
  });
  await page.evaluate(() => window.__dev.bot(true));
  const start = Date.now();
  let res = null;
  while (Date.now() - start < 90000) {
    await sleep(150);
    res = await page.evaluate(() => {
      const sc = window.__scene;
      const pk = window.__pack;
      const p = sc.player;
      if (!pk || !p) return { gone: true };
      pk.minHp = Math.min(pk.minHp, Math.max(0, p.hp) / p.d.maxHp);
      const left = pk.foes.filter((e) => !e.dead).length;
      if (p.dead) window.__dev.bot(false);
      const killer = p.dead && sc.lastHit ? `${sc.lastHit.who} (${sc.lastHit.kind}, ${sc.lastHit.amount})` : undefined;
      return { left, dead: p.dead, t: sc.simT - pk.t0, minHp: pk.minHp, pots: (sc.save.stats?.potions ?? 0) - pk.pots, killer };
    });
    if (res.gone || res.dead || res.left === 0) break;
  }
  await page.evaluate(() => window.__dev.bot(false));
  return { ...prep, ...res, timeout: !!res && !res.dead && res.left > 0 };
}

for (const c of mine) {
  const t0 = Date.now();
  try {
    const info = await setup(c);
    const packs = [];
    for (let i = 0; i < PACKS; i++) {
      const r = await pack();
      packs.push(r);
      // a fallen hero starts again on a fresh floor
      if (r.dead || r.gone) await setup(c);
    }
    const stats = await page.evaluate(() => {
      const d = window.__scene.player.d;
      return { maxHp: Math.round(d.maxHp), dmg: `${d.dmgMin}-${d.dmgMax}`, aps: Math.round(d.aps * 100) / 100, armor: d.armor, crit: Math.round(d.crit), spell: Math.round(d.spellMult * 100), dodge: Math.round(d.dodge), block: Math.round(d.block) };
    });
    const avg = (k) => Math.round((packs.reduce((a, r) => a + (r[k] ?? 0), 0) / packs.length) * 100) / 100;
    const line = { ...c, quality, level: info.level, stats, packs: packs.length, deaths: packs.filter((r) => r.dead).length, killers: packs.filter((r) => r.killer).map((r) => r.killer), timeouts: packs.filter((r) => r.timeout).length, t: avg('t'), minHp: avg('minHp'), pots: avg('pots'), foeHp: packs[0]?.foeHp, foeDmg: packs[0]?.foeDmg, ids: packs[0]?.ids, wall: Math.round((Date.now() - t0) / 1000) };
    appendFileSync(out, JSON.stringify(line) + '\n');
    console.log(JSON.stringify({ cls: c.cls, floor: c.floor, dif: c.dif, deaths: line.deaths, t: line.t, minHp: line.minHp, pots: line.pots }));
  } catch (e) {
    appendFileSync(out, JSON.stringify({ ...c, quality, error: String(e).slice(0, 200) }) + '\n');
    console.log('error', c, String(e).slice(0, 200));
  }
  if (errs.length) {
    appendFileSync(out, JSON.stringify({ ...c, pageErrors: errs.splice(0).slice(0, 5) }) + '\n');
  }
}
await browser.close();
