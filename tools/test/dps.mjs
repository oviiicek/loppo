// Damage meter: a hero geared for a floor (the dev bot plays it) fights a pack of the floor's monsters – six
// regular ones and a champion – that cannot die, for a stretch of game time; the hero cannot die either (every
// blow's health comes back at once). It measures the damage the hero deals (by its source: weapon, spells,
// allies, damage over time, other), the share of the hero's health the pack takes per second (`taken`, on
// normal) and the pack's real health, so that the time a real pack lasts can be worked out.
//   node tools/test/dps.mjs <out.jsonl> [classes] [floors] [profile] [seconds] [heroes] [shard/of]
//   e.g. node tools/test/dps.mjs /tmp/dw/balance/dps.jsonl warrior,mage 3,15,35 median 20 2 0/2
import { appendFileSync } from 'fs';
import { launch, openGame, startGeared, sleep } from './lib.mjs';

const [out = '/tmp/dw/balance/dps.jsonl', clsArg = 'warrior,mage,ranger,necro', floorArg = '3,8,15,25,35,45,61,81,101,151,201,245', profile = 'median', secArg = '20', heroArg = '2', shardArg = '0/1'] = process.argv.slice(2);
const [shard, shards] = shardArg.split('/').map(Number);
const configs = [];
for (const c of clsArg.split(',')) for (const f of floorArg.split(',')) for (let h = 0; h < +heroArg; h++) configs.push({ cls: c, floor: +f, hero: h });
const mine = configs.filter((_, i) => i % shards === shard);
const SECS = +secArg;

const { browser, page, errs } = await launch({ width: 640, height: 296, gfx: 0 });

for (const c of mine) {
  const t0 = Date.now();
  try {
    await openGame(page);
    const info = await startGeared(page, c.cls, c.floor, { quality: profile, difficulty: 1 });
    await sleep(3000);
    const prep = await page.evaluate(() => {
      const sc = window.__scene;
      sc.ui.closeOverlay?.(false, true);
      for (const e of sc.enemies) {
        e.dead = true;
        e.destroyVisuals?.();
      }
      sc.enemies.length = 0;
      for (const it of sc.interactables.filter((i) => i.kind === 'stairs')) it.sprite?.setVisible?.(false);
      sc.interactables = sc.interactables.filter((i) => i.kind !== 'stairs');
      if (sc.rival) (sc.rival.dead = true), sc.rival.destroyVisuals?.(), (sc.rival = null);
      if (sc.merc) sc.merc.setVisible?.(false), (sc.merc = null);
      if (sc.pet) sc.pet.sprite?.setVisible(false), (sc.pet = null);
      const p = sc.player;
      sc.save.mats.hpPotion = 5;
      sc.save.mats.mpPotion = 5;
      p.mp = p.d.maxMp;
      const pool = sc.enc.floorPool();
      const foes = [];
      for (let i = 0; i < 7; i++) {
        let q = null;
        for (let k = 0; k < 30 && !q; k++) {
          const cc = sc.map.randomFloorNear(p.x, p.y, 110);
          if (cc && Math.hypot(cc[0] - p.x, cc[1] - p.y) >= 45 && !sc.map.collides(cc[0], cc[1], 6)) q = cc;
        }
        if (!q) continue;
        const e = sc.spawnEnemy(pool[Math.floor(Math.random() * pool.length)], q[0], q[1], i === 6, -1);
        e.aggro = true;
        foes.push(e);
      }
      // the pack's own health on normal (before toughening), then health that never runs out
      const natural = foes.map((e) => ({ hp: Math.round(e.maxHp), elite: !!e.elite, id: e.def.id }));
      for (const e of foes) e.maxHp = e.hp = 1e15;
      const m = { weapon: 0, spell: 0, ally: 0, dot: 0, other: 0, hits: 0, hitSum: 0, per: new Map() };
      const orig = sc.combat.landHit.bind(sc.combat);
      sc.combat.landHit = (e, dmg, o, ...rest) => {
        const r = orig(e, dmg, o, ...rest);
        if (r > 0 && foes.includes(e)) {
          const k = o.fromAlly ? 'ally' : o.dot ? 'dot' : o.isAttack ? 'weapon' : o.spell ? 'spell' : 'other';
          m[k] += r;
          m.per.set(e, (m.per.get(e) ?? 0) + r);
          if (!o.dot && !o.fromAlly && !o.thorns) (m.hits++, (m.hitSum += r));
        }
        // keep them alive whatever lands
        if (foes.includes(e) && e.hp < 1e14) e.hp = 1e15;
        return r;
      };
      // the hero is hit as usual (knocked back, slowed, stunned …) but gets the health back at once: what the
      // blows took is counted instead
      m.taken = 0;
      const dp = sc.combat.damagePlayer.bind(sc.combat);
      sc.combat.damagePlayer = (...a) => {
        const before = p.hp;
        const r = dp(...a);
        if (p.hp < before) {
          m.taken += before - p.hp;
          p.hp = before;
          p.dead = false;
        }
        return r;
      };
      window.__meter = { foes, natural, m, t0: sc.simT, scene: sc };
      return { natural };
    });
    await page.evaluate(() => window.__dev.bot(true));
    const wall = Date.now();
    let t = 0,
      last = -1,
      still = Date.now(),
      stalls = 0;
    while (Date.now() - wall < SECS * 6000) {
      await sleep(250);
      t = await page.evaluate(() => (window.__scene === window.__meter.scene ? window.__scene.simT - window.__meter.t0 : -1));
      if (t < 0) break;
      if (t >= SECS) break;
      // the game stands still (a dialog the bot does not close): note what is on the screen and close it
      if (t !== last) (last = t), (still = Date.now());
      else if (Date.now() - still > 3000) {
        const why = await page.evaluate(() => ({ paused: window.__scene.paused, active: window.__scene.sys.isActive(), overlay: [...document.querySelectorAll('.overlay')].map((o) => (o.className + ': ' + o.textContent).slice(0, 160)) }));
        appendFileSync(out, JSON.stringify({ ...c, stall: why }) + '\n');
        if (stalls++ < 2) await page.screenshot({ path: out.replace(/\.jsonl$/, '') + `_stall_${c.cls}_${c.floor}_${stalls}.png` });
        await page.evaluate(() => {
          window.__scene.ui.closeOverlay?.(false, true);
          document.querySelectorAll('.overlay').forEach((o) => o.remove());
          if (!window.__scene.sys.isActive()) window.__scene.game.scene.resume('Game');
        });
        still = Date.now();
      }
    }
    await page.evaluate(() => window.__dev.bot(false));
    if (t < 0) throw new Error('the scene changed during the measure');
    const res = await page.evaluate(() => {
      const sc = window.__meter.scene;
      const { m, foes, t0 } = window.__meter;
      const t = sc.simT - t0;
      const d = sc.player.d;
      const per = foes.map((e) => Math.round((m.per.get(e) ?? 0) / t));
      return { t, taken: m.taken / t / d.maxHp, weapon: m.weapon / t, spell: m.spell / t, ally: m.ally / t, dot: m.dot / t, other: m.other / t, avgHit: m.hits ? m.hitSum / m.hits : 0, per, stats: { maxHp: d.maxHp, dmg: `${d.dmgMin}-${d.dmgMax}`, aps: Math.round(d.aps * 100) / 100, spellMult: Math.round(d.spellMult * 100) / 100, crit: Math.round(d.crit), specials: [...d.specials], procs: [sc.save.equip.main?.spell, sc.save.equip.off?.spell].filter(Boolean) }, level: sc.save.level, loadout: sc.save.loadout.filter(Boolean) };
    });
    const total = res.weapon + res.spell + res.ally + res.dot + res.other;
    const natural = prep.natural;
    const r2 = (x) => Math.round(x * 100) / 100;
    const line = { ...c, profile, level: res.level, t: r2(res.t), dps: Math.round(total), taken: Math.round(res.taken * 1000) / 1000, split: { weapon: Math.round(res.weapon), spell: Math.round(res.spell), ally: Math.round(res.ally), dot: Math.round(res.dot), other: Math.round(res.other) }, avgHit: Math.round(res.avgHit), per: res.per, packHp: natural.reduce((a, x) => a + x.hp, 0), foes: natural.map((x) => x.id + (x.elite ? '*' : '')), stats: res.stats, loadout: res.loadout, wall: Math.round((Date.now() - t0) / 1000) };
    appendFileSync(out, JSON.stringify(line) + '\n');
    console.log(JSON.stringify({ cls: c.cls, floor: c.floor, lv: line.level, dps: line.dps, taken: line.taken, split: line.split, packHp: line.packHp, clear: r2(line.packHp / Math.max(1, total)) }));
  } catch (e) {
    appendFileSync(out, JSON.stringify({ ...c, profile, error: String(e).slice(0, 200) }) + '\n');
    console.log('error', c, String(e).slice(0, 200));
  }
  if (errs.length) appendFileSync(out, JSON.stringify({ ...c, pageErrors: errs.splice(0).slice(0, 5) }) + '\n');
}
await browser.close();
