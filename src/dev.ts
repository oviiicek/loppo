// Developer helpers (only bundled in dev mode) – used for automated testing.
import { newCharacter, game as G, saveGame, autoLoadout } from './systems/state';
import { spellsForClass, SPELLS } from './data/spells';
import { generateItem } from './data/items';
import { UI } from './ui/ui';
import { ClassId } from './data/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dev = {
  startNormal(cls: ClassId) {
    const s = newCharacter(cls);
    G.save = s;
    saveGame(s);
    UI.startGame();
    return true;
  },
  start(cls: ClassId, level = 1, floor = 1) {
    const s = newCharacter(cls);
    s.level = level;
    s.floor = floor;
    s.maxFloor = floor;
    s.attrPoints = (level - 1) * 3;
    s.spellPoints = level - 1;
    s.gold = 100000;
    s.mats = { hpPotion: 20, mpPotion: 20, lockpick: 10, stone: 50, dust: 50 };
    autoLoadout(s);
    for (let i = 0; i < 10; i++) s.inventory[i] = generateItem(floor, { rarity: i % 6 });
    G.save = s;
    saveGame(s);
    UI.startGame();
    return true;
  },
  scene() {
    return (window as any).__scene;
  },
  async castAll(cls?: ClassId) {
    const sc = (window as any).__scene;
    const list = cls ? spellsForClass(cls) : SPELLS;
    const errors: string[] = [];
    for (const sp of list) {
      try {
        sc.save.loadout[0] = sp.id;
        sc.player.cds[0] = 0;
        sc.player.mp = sc.player.d.maxMp;
        sc.player.hp = sc.player.d.maxHp;
        sc.player.invulnT = 99;
        const ok = sc.spells.tryCast(0);
        if (!ok) errors.push('not cast: ' + sp.id);
        await sleep(120);
      } catch (e: any) {
        errors.push(sp.id + ': ' + e.message);
      }
    }
    await sleep(1500);
    return { cast: list.length, errors, enemies: sc.enemies.length, allies: sc.allies.length, projectiles: sc.projectiles.length };
  },
  teleportToNearestEnemy() {
    const sc = (window as any).__scene;
    const p = sc.player;
    const e = sc.enemies.filter((x: any) => !x.dead).sort((a: any, b: any) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!e) return null;
    p.x = e.x - 24;
    p.y = e.y;
    return e.def.id;
  },
  teleport(kind: string) {
    const sc = (window as any).__scene;
    const it = sc.interactables.find((i: any) => i.kind === kind && !i.used);
    if (!it) return null;
    sc.player.x = it.x;
    sc.player.y = it.y + 10;
    return [it.x, it.y];
  },
  god(on = true) {
    (window as any).__scene.godMode = on;
  },
};

(window as any).__dev = dev;

// ---------------------------------------------------------------------------
// Simple autoplay bot used to sanity-check balance (dev only)
// ---------------------------------------------------------------------------
import { GameScene } from './scenes/GameScene';
import { derive, equipItem, canInvest } from './systems/state';
import { BASE_BY_ID } from './data/items';
import { TS } from './game/map';

let botTimer: any = null;
export const botLog: any[] = [];
const botState = { deaths: 0, floorStart: 0, lastPos: [0, 0], stuckT: 0, wander: [0, 0], wanderT: 0, lastFloor: 0, path: [] as number[], pathT: 0, started: 0 };

function bfsPath(sc: GameScene, fx: number, fy: number, tx: number, ty: number): number[] {
  const m = sc.map;
  const W = m.w,
    H = m.h;
  const start = fy * W + fx,
    goal = ty * W + tx;
  const prev = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let h = 0,
    t = 0;
  q[t++] = start;
  prev[start] = start;
  while (h < t) {
    const c = q[h++];
    if (c === goal) break;
    const cx = c % W,
      cy = (c / W) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (prev[ni] >= 0 || (m.solid[ni] && ni !== goal)) continue;
      prev[ni] = c;
      q[t++] = ni;
    }
  }
  if (prev[goal] < 0) return [];
  const path: number[] = [];
  let c = goal;
  while (c !== start) {
    path.push(c);
    c = prev[c];
  }
  return path.reverse();
}

function itemScore(it: any) {
  return it.rarity * 12 + it.ilvl * 1.5 + it.upgrade * 3;
}

function botTick() {
  const sc: GameScene | undefined = (window as any).__scene;
  // (the death screen pauses the scene, so a dead player is handled before the active check)
  if (!sc || !sc.player || (!sc.sys.isActive() && !sc.player.dead)) return;
  const s = sc.save;
  const p = sc.player;
  const now = performance.now();
  if (botState.lastFloor !== sc.floor) {
    botLog.push({ floor: sc.floor, level: s.level, t: Math.round((now - botState.started) / 1000), deaths: botState.deaths, gold: s.gold, hp: p.d.maxHp, dmg: p.d.dmgMin + '-' + p.d.dmgMax, armor: p.d.armor, kills: s.kills, minHp: Math.round((botState as any).minHp * 100), pots: s.mats.hpPotion });
    (botState as any).minHp = 1;
    botState.lastFloor = sc.floor;
    botState.floorStart = now;
  }
  (botState as any).minHp = Math.min((botState as any).minHp ?? 1, p.hp / p.d.maxHp);
  if (p.dead) {
    if (!(botState as any).deadSince) (botState as any).deadSince = now;
    if (now - (botState as any).deadSince > 1500) {
      (botState as any).deadSince = 0;
      botState.deaths++;
      UI.closeOverlay(false, true);
      sc.game.scene.resume('Game');
      sc.respawn();
    }
    return;
  }
  if (sc.paused) {
    UI.closeOverlay();
    return;
  }
  // points
  const kind = p.d.attack;
  const prim = kind === 'melee' ? 'str' : kind === 'ranged' ? 'dex' : 'int';
  while (s.attrPoints > 0) {
    const k = s.attrPoints % 3 === 0 ? 'vit' : prim;
    s.attrs[k as 'str']++;
    s.attrPoints--;
    p.recalc();
  }
  for (let guard = 0; guard < 20 && s.spellPoints > 0; guard++) {
    const id = s.loadout.find((x) => x && canInvest(s, x));
    if (!id) break;
    s.spellRanks[id] = (s.spellRanks[id] ?? 0) + 1;
    s.spellPoints--;
  }
  // gear
  s.inventory.forEach((it, i) => {
    if (!it) return;
    const base = BASE_BY_ID[it.base];
    let slot: any = base.cat;
    if (base.cat.startsWith('weapon')) {
      const cur = s.equip.main ? BASE_BY_ID[s.equip.main.base] : null;
      if (cur && base.attack !== cur.attack) return;
      slot = 'main';
    } else if (base.cat === 'shield' || base.cat === 'offhand') {
      if (s.equip.main && BASE_BY_ID[s.equip.main.base].cat === 'weapon2h') return;
      slot = 'off';
    } else if (base.cat === 'ring') slot = !s.equip.ring1 ? 'ring1' : !s.equip.ring2 ? 'ring2' : itemScore(s.equip.ring1) < itemScore(s.equip.ring2!) ? 'ring1' : 'ring2';
    const cur = (s.equip as any)[slot];
    if (!cur || itemScore(it) > itemScore(cur) + 2) {
      equipItem(s, i, slot);
      p.recalc();
    } else if (it.rarity <= 2) {
      s.gold += 5;
      s.inventory[i] = null;
    }
  });
  // potions
  if (p.hp < p.d.maxHp * 0.4) sc.usePotion('hpPotion');
  if (p.mp < p.d.maxMp * 0.15) sc.usePotion('mpPotion');
  // target (enemies the bot could not path to are skipped for a while, e.g. inside an unopened secret room)
  const ign: Map<number, number> = ((botState as any).ignore ??= new Map());
  const enemies = sc.enemies.filter((e) => !e.dead && !(e.def.behavior === 'mimic' && !e.aggro) && !((ign.get(e.id) ?? 0) > now));
  let target: any = null;
  let bd = 1e9;
  for (const e of enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) {
      bd = d;
      target = e;
    }
  }
  if (target && bd < 130) {
    for (let i = 0; i < 5; i++) {
      const id = s.loadout[i];
      if (!id) continue;
      if (i === 4 && p.hp > p.d.maxHp * 0.6 && id === 'universal_1') continue;
      sc.castSlot(i);
    }
  }
  let gx: number, gy: number;
  const stairs = sc.interactables.find((i) => i.kind === 'stairs' && !i.used);
  const floorTime = (now - botState.floorStart) / 1000;
  const goStairs = stairs && (enemies.length < 6 || floorTime > 120 || !target || bd > 500);
  if (goStairs && stairs) {
    gx = stairs.x;
    gy = stairs.y;
    if (Math.hypot(gx - p.x, gy - p.y) < 14) {
      // the bot walks through a random door (so every kind of floor gets visited)
      const next = sc.floor + 1;
      if (!sc.rift && next % 10 !== 0 && next % 10 !== 5) sc.nextKind = (['normal', 'normal', 'danger', 'merchant', 'unknown'] as const)[Math.floor(Math.random() * 5)];
      sc.nextFloor();
      return;
    }
  } else if (target) {
    gx = target.x;
    gy = target.y;
    const keep = kind === 'melee' ? 8 : 70;
    if (bd < keep + 6 && sc.map.los(p.x, p.y, target.x, target.y)) {
      UI.joy = [0, 0];
      return;
    }
  } else {
    UI.joy = [0, 0];
    return;
  }
  // path
  botState.pathT -= 0.1;
  const ptx = Math.floor(p.x / TS),
    pty = Math.floor(p.y / TS);
  if (botState.pathT <= 0 || !botState.path.length) {
    botState.pathT = 0.5;
    botState.path = bfsPath(sc, ptx, pty, Math.floor(gx / TS), Math.floor(gy / TS));
    if (!botState.path.length && target && !goStairs && bd > 40) ign.set(target.id, now + 15000);
  }
  while (botState.path.length && botState.path[0] === pty * sc.map.w + ptx) botState.path.shift();
  let dir: [number, number] = [gx - p.x, gy - p.y];
  if (botState.path.length) {
    const n = botState.path[0];
    dir = [(n % sc.map.w) * TS + 8 - p.x, Math.floor(n / sc.map.w) * TS + 10 - p.y];
  }
  // stuck handling
  const moved = Math.hypot(p.x - botState.lastPos[0], p.y - botState.lastPos[1]);
  botState.lastPos = [p.x, p.y];
  if (moved < 0.3) botState.stuckT += 0.1;
  else botState.stuckT = 0;
  if (botState.stuckT > 2) {
    botState.wander = [Math.random() - 0.5, Math.random() - 0.5];
    botState.wanderT = 0.6;
    botState.stuckT = 0;
    botState.path = [];
  }
  if (botState.wanderT > 0) {
    botState.wanderT -= 0.1;
    dir = botState.wander as [number, number];
  }
  const l = Math.hypot(dir[0], dir[1]) || 1;
  UI.joy = [dir[0] / l, dir[1] / l];
}

Object.assign(dev, {
  bot(on = true) {
    clearInterval(botTimer);
    if (on) {
      botState.started = performance.now();
      botState.lastFloor = 0;
      botTimer = setInterval(botTick, 100);
    }
    return on;
  },
  botLog() {
    return botLog;
  },
  botDeaths() {
    return botState.deaths;
  },
  speed(n: number) {
    const proto = GameScene.prototype as any;
    if (!proto._origUpdate) proto._origUpdate = proto.update;
    proto.update = function (t: number, d: number) {
      for (let i = 0; i < n; i++) proto._origUpdate.call(this, t, d);
    };
  },
  derive,
});

// Renders an app icon from the generated sprites (used once to create public/icons/*.png)
import { getCanvas } from './gfx/textures';
Object.assign(dev, {
  makeIcon(size: number) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(size / 2, size * 0.45, size * 0.05, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#5a3a1a');
    g.addColorStop(0.5, '#24160c');
    g.addColorStop(1, '#0b0a10');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    x.imageSmoothingEnabled = false;
    const hero = getCanvas('pl_warrior')!;
    const s = Math.floor(size / 26);
    // hero frame 0 (drawn at 32x40, shown at 16x20)
    x.drawImage(hero, 0, 0, 32, 40, size / 2 - 8 * s - s * 2, size / 2 - 10 * s + s, 16 * s, 20 * s);
    const sword = getCanvas('wp_sword')!;
    x.save();
    x.translate(size / 2 + 6 * s, size / 2 + 2 * s);
    x.rotate(0.5);
    x.drawImage(sword, -sword.width * s / 2, -sword.height * s * 0.85, sword.width * s, sword.height * s);
    x.restore();
    const shield = getCanvas('wp_shield')!;
    x.drawImage(shield, size / 2 - 13 * s, size / 2 - 1 * s, shield.width * s * 0.8, shield.height * s * 0.8);
    return c.toDataURL('image/png');
  },
});

Object.assign(dev, {
  // fills the inventory with items across all material tiers (for checking icons)
  /** inventory filled with items of the given bases (for checking the inventory panel) */
  fillInv(bases: string[]) {
    const sc = (window as any).__scene;
    const s = sc.save;
    bases.forEach((b, i) => (s.inventory[i] = generateItem(Math.max(1, sc.floor), { base: b, rarity: 1 + (i % 5) })));
    return true;
  },
  giveTierItems() {
    const s = (window as any).__scene.save;
    const bases = ['sword', 'greataxe', 'helmet', 'chest', 'shield', 'bow'];
    for (let i = 0; i < 30; i++) s.inventory[i] = generateItem(1 + (i % 8) * 8, { base: bases[Math.floor(i / 8) % bases.length], rarity: i % 6 });
    return true;
  },
});

// Contact sheet of generated textures (visual checks in automated tests)
Object.assign(dev, {
  sheet(keys: string[], scale = 2, perRow = 8) {
    const cs = keys.map((k) => [k, getCanvas(k)] as const).filter(([, c]) => !!c) as [string, HTMLCanvasElement][];
    const cell = Math.max(...cs.map(([, c]) => Math.max(c.width, c.height))) * scale + 8;
    const rows = Math.ceil(cs.length / perRow);
    const out = document.createElement('canvas');
    out.width = Math.min(perRow, cs.length) * cell;
    out.height = rows * (cell + 12);
    const x = out.getContext('2d')!;
    x.fillStyle = '#2a2830';
    x.fillRect(0, 0, out.width, out.height);
    x.imageSmoothingEnabled = false;
    cs.forEach(([k, c], i) => {
      const cx = (i % perRow) * cell,
        cy = Math.floor(i / perRow) * (cell + 12);
      x.drawImage(c, cx + 4, cy + 4, c.width * scale, c.height * scale);
      x.fillStyle = '#ccc';
      x.font = '10px sans-serif';
      x.fillText(k, cx + 4, cy + cell + 8);
    });
    return out.toDataURL();
  },
});

// Weapon in hand / put away and idle fidgets on demand (screenshots)
Object.assign(dev, {
  arm(on = true) {
    const p = (window as any).__scene.player;
    p.armed = on;
    p.armT = on ? 1 : 0;
    p.calmT = on ? 0 : 99;
    p.sheatheAfter = on ? 9999 : 7;
    return true;
  },
  heroAnim(name: string) {
    const p = (window as any).__scene.player;
    p.idleT = 0;
    p.fidgetAt = 9999;
    p.sprite.play(p.spriteKey + '_' + name);
    return true;
  },
});

// Contact sheet of the hero animation strips: one row per class, every frame
Object.assign(dev, {
  heroSheet(scale = 3, first = 0, count = 99) {
    const strips = CLASSES.map((cl) => getCanvas('pl_' + cl.id)!).filter(Boolean);
    const fw = 32,
      fh = 40;
    const n = Math.min(count, strips[0].width / fw - first);
    const out = document.createElement('canvas');
    out.width = n * (fw * scale + 4) + 4;
    out.height = strips.length * (fh * scale + 4) + 4;
    const x = out.getContext('2d')!;
    x.fillStyle = '#3a3640';
    x.fillRect(0, 0, out.width, out.height);
    x.imageSmoothingEnabled = false;
    strips.forEach((c, r) => {
      for (let i = 0; i < n; i++) {
        x.fillStyle = (i + r) % 2 ? '#34303a' : '#403c46';
        x.fillRect(4 + i * (fw * scale + 4), 4 + r * (fh * scale + 4), fw * scale, fh * scale);
        x.drawImage(c, (first + i) * fw, 0, fw, fh, 4 + i * (fw * scale + 4), 4 + r * (fh * scale + 4), fw * scale, fh * scale);
      }
    });
    return out.toDataURL();
  },
});

// ---------------------------------------------------------------------------
// Story testing: jump to any floor with a fitting character and story progress
// ---------------------------------------------------------------------------
import { storyOf, xpForLevel as xpFor } from './systems/state';
import { CHRONICLE_ORDER, storyFloor } from './data/story';
import { enemyXpScale, bossForFloor } from './data/enemies';
import { CLASS_BY_ID, CLASSES } from './data/classes';
import type { Slot } from './data/types';

Object.assign(dev, {
  /** a character about as strong as a good player on this floor (level model of the balance sim, best of many drops) */
  startGeared(cls: ClassId, floor: number, story = true, quality: 'good' | 'median' = 'good', difficulty = 1) {
    const s = newCharacter(cls, { difficulty });
    let L = 1,
      xp = 0;
    for (let f = 1; f < floor; f++) {
      xp += 0.7 * Math.min(110, 34 + 2 * f) * 15 * enemyXpScale(f) * 1.15;
      if (f % 10 === 0) xp += 600 * enemyXpScale(f) * (1 + bossForFloor(f).tier);
      while (xp >= xpFor(L)) {
        xp -= xpFor(L);
        L++;
      }
    }
    s.level = L;
    s.floor = floor;
    s.maxFloor = floor;
    const atk = BASE_BY_ID[CLASS_BY_ID[cls].weapon].attack;
    const main = atk === 'melee' ? 'str' : atk === 'ranged' ? 'dex' : 'int';
    const pts = (L - 1) * 3;
    s.attrs[main] += Math.round(pts * 0.5);
    s.attrs.vit += Math.round(pts * 0.35);
    s.attrs[main === 'int' ? 'ene' : 'dex'] += Math.round(pts * 0.15);
    s.spellPoints = L - 1;
    s.gold = 5000 * floor;
    s.mats = { hpPotion: 25, mpPotion: 20, lockpick: 10, stone: 20, dust: 20 };
    const def = CLASS_BY_ID[cls];
    const slots: [Slot, string | null][] = [
      ['main', def.weapon], ['off', def.offhand ?? null], ['helmet', 'helmet'], ['chest', 'chest'], ['pants', 'pants'], ['belt', 'belt'],
      ['boots', 'boots'], ['ring1', 'ring'], ['ring2', 'ring'], ['amulet', 'amulet'], ['bracer', 'bracer'],
    ];
    // 'good': best of 20 rare-or-better drops; 'median': best of 10 ordinary drops (mostly common to rare), less upgraded
    const rar = () => {
      const r = Math.random();
      if (quality === 'median') return r < 0.3 ? 0 : r < 0.62 ? 1 : r < 0.86 ? 2 : r < 0.97 ? 3 : 4;
      return r < 0.5 ? 2 : r < 0.85 ? 3 : r < 0.98 ? 4 : 5;
    };
    for (const [slot, base] of slots) {
      if (!base) continue;
      let best: any = null,
        bestV = -1;
      for (let k = 0; k < (quality === 'median' ? 10 : 20); k++) {
        const it = generateItem(Math.max(1, floor - Math.floor(Math.random() * (quality === 'median' ? 12 : 8))), { base, rarity: rar() });
        it.upgrade = quality === 'median' ? Math.min(6, Math.floor(floor / 15)) : Math.min(8, Math.floor(floor / 12));
        s.equip[slot] = it;
        const d = derive(s);
        const crit = 1 + (d.crit / 100) * (d.critDmg / 100 - 1);
        const v = ((d.dmgMin + d.dmgMax) / 2) * d.aps * crit + d.spellMult * 300 * crit + d.maxHp * (1 + d.armor / 300) * 0.04 * Math.sqrt(floor);
        if (v > bestV) {
          bestV = v;
          best = it;
        }
      }
      s.equip[slot] = best;
    }
    autoLoadout(s);
    const st = storyOf(s);
    if (story) {
      st.seen = CHRONICLE_ORDER.filter((id) => storyFloor(id) < floor);
      st.shards = Math.min(4, Math.floor((floor - 1) / 50));
      st.blessing = floor > 200;
    }
    G.save = s;
    saveGame(s);
    UI.startGame();
    return { level: L, hp: derive(s).maxHp };
  },
  toBoss() {
    const sc = (window as any).__scene;
    const b = sc?.boss;
    if (!b) return null;
    sc.player.x = b.x - 70;
    sc.player.y = b.y;
    return b.name;
  },
  /** damages the guardian by a share of its health through the normal damage path */
  hitBoss(frac = 0.5) {
    const sc = (window as any).__scene;
    const b = sc?.boss;
    if (!b || b.dead) return null;
    // story guardians absorb bursts: take the share off directly and let a small hit finish a stage
    if (b.story) {
      b.hp -= b.maxHp * frac;
      if (b.hp <= 0) {
        b.hp = 1;
        sc.combat.damageEnemy(b, b.maxHp * 0.01, { el: 'fire', noCrit: true });
      }
    } else sc.combat.damageEnemy(b, b.maxHp * frac, { el: 'fire', noCrit: true });
    return { hp: Math.round(b.hp), max: b.maxHp, phase: b.phase, invuln: b.invuln, dead: b.dead };
  },
  bossInfo() {
    const sc = (window as any).__scene;
    const b = sc?.boss;
    if (!b) return null;
    return { name: b.name, hp: Math.round(b.hp), max: b.maxHp, phase: b.phase, phases: b.phaseCount, invuln: b.invuln, dead: b.dead, aggro: b.aggro, sprite: b.spriteKey, dmg: Math.round(b.dmg), bphase: b.bphase, arena: b.arena, lastStand: b.lastStand, patterns: b.patterns.join(',') };
  },
  cutsceneState() {
    const c = document.querySelector('.cutscene');
    if (!c) return null;
    return { overlay: c.classList.contains('overlay'), name: c.querySelector('.cs-name')?.textContent, text: c.querySelector('.cs-text')?.textContent, title: c.querySelector('.cs-title.on b')?.textContent ?? null };
  },
  /** taps the cutscene (finishes the line or goes on) */
  tapCutscene() {
    const c = document.querySelector('.cutscene .cs-box') ?? document.querySelector('.cutscene');
    c?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    c?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return !!c;
  },
  skipCutscene() {
    const b = document.querySelector('.cs-skip');
    b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    b?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return !!b;
  },
});

// Contact sheets of the story illustrations and portraits
import { sceneCanvas, portraitURL, ART_W, ART_H } from './gfx/story';
import type { SceneId, SpeakerId } from './data/story';
import { AREA_SCENES } from './data/story';
Object.assign(dev, {
  sceneSheet(scale = 2, ids: SceneId[] = ['village', 'quake', 'hut', 'gate', 'seal', 'dawn', ...AREA_SCENES], cols = 3) {
    const rows = Math.ceil(ids.length / cols);
    const out = document.createElement('canvas');
    out.width = (ART_W * scale + 4) * cols;
    out.height = (ART_H * scale + 4) * rows;
    const x = out.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    ids.forEach((id, i) => x.drawImage(sceneCanvas(id), (i % cols) * (ART_W * scale + 4), Math.floor(i / cols) * (ART_H * scale + 4), ART_W * scale, ART_H * scale));
    return out.toDataURL();
  },
  async portraitSheet(scale = 3) {
    const ids: SpeakerId[] = ['ilda', 'elara', 'elaraDark', 'morgrim', 'spore', 'isolda', 'nyx', 'diary', 'smith'];
    const out = document.createElement('canvas');
    out.width = ids.length * (40 * scale + 6);
    out.height = 40 * scale;
    const x = out.getContext('2d')!;
    x.fillStyle = '#1a1622';
    x.fillRect(0, 0, out.width, out.height);
    x.imageSmoothingEnabled = false;
    for (let i = 0; i < ids.length; i++) {
      const img = new Image();
      img.src = portraitURL(ids[i]);
      await img.decode();
      x.drawImage(img, i * (40 * scale + 6), 0, 40 * scale, 40 * scale);
    }
    return out.toDataURL();
  },
});

// Pets on demand (tests and screenshots)
Object.assign(dev, {
  /** every pet freed; the given one travels along */
  pets(active: string | null = 'cat', floors = 0) {
    const sc = (window as any).__scene;
    const st = sc.save.pets ?? (sc.save.pets = { owned: [], active: null, floors: {}, pity: 0 });
    st.owned = ['cat', 'dog', 'fox', 'owl', 'turtle', 'slime', 'wisp', 'dragon'];
    for (const id of st.owned) st.floors[id] = floors;
    sc.setActivePet(active);
    return true;
  },
  petInfo() {
    const sc = (window as any).__scene;
    const pet = sc.pet;
    return pet ? { id: pet.def.id, lvl: pet.lvl, x: Math.round(pet.x), y: Math.round(pet.y), dHero: Math.round(Math.hypot(pet.x - sc.player.x, pet.y - sc.player.y)), visible: pet.sprite.visible } : null;
  },
});

// Gems on demand (tests and screenshots)
Object.assign(dev, {
  /** a few of every gem in the given grades, sockets in the equipped weapon and armour */
  gems(n = 3, tiers = [1, 2, 3, 4, 5]) {
    const s = (window as any).__scene.save;
    s.gems = s.gems ?? {};
    for (const g of ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'diamond']) for (const t of tiers) s.gems[g + t] = (s.gems[g + t] ?? 0) + n;
    for (const sl of ['main', 'chest', 'ring1', 'helmet']) if (s.equip[sl]) s.equip[sl].sockets = s.equip[sl].sockets ?? [null, null].slice(0, sl === 'ring1' ? 1 : 2);
    return s.gems;
  },
});

// Item sets on demand (tests and screenshots)
import { generateSetItem } from './data/items';
Object.assign(dev, {
  /** every piece of a set into the bag */
  giveSet(id = 'five', ilvl = 20) {
    const s = (window as any).__scene.save;
    for (let i = 0; i < 4; i++) {
      const at = s.inventory.findIndex((x: unknown) => !x);
      if (at >= 0) s.inventory[at] = generateSetItem(ilvl, id, i);
    }
    return true;
  },
});

// Nemeses on demand (tests)
Object.assign(dev, {
  /** gives the hero a nemesis that shows up on the current floor's next load */
  nemesis(base = 'skeleton', kills = 1, affix: string | null = 'ohnivý') {
    const sc = (window as any).__scene;
    const s = sc.save;
    const list = s.nemeses ?? (s.nemeses = []);
    const n = { id: Date.now(), name: 'Grak', title: 'Zabiják ' + (s.heroName ? s.heroName + 'a' : 'paladinů'), base, affix, level: s.level + 2 + (kills - 1) * 3, kills, born: Math.max(1, sc.floor - 2), next: sc.floor };
    list.push(n);
    return n;
  },
  nemesisInfo() {
    const sc = (window as any).__scene;
    const e = sc.nemesis;
    return { list: (sc.save.nemeses ?? []).map((n: any) => `${n.name}, ${n.title} L${n.level} k${n.kills} next${n.next}`), here: e ? { name: e.name, hp: Math.round(e.hp), max: e.maxHp, spotted: e.spotted, dead: e.dead, affix: e.eliteAffix, label: e.nameLabel?.text ?? null } : null, note: sc.nemesisNote, beaten: sc.save.stats?.nemeses ?? 0 };
  },
});
Object.assign(dev, {
  /** the achievements / statistics / nemesis panel */
  openStats(tab: 'ach' | 'stats' | 'nem' = 'ach') {
    UI.menus.achievements(tab);
    return true;
  },
});
Object.assign(dev, {
  /** hires a mercenary for free */
  merc(role = 'tank') {
    const sc = (window as any).__scene;
    sc.save.gold += 1e6;
    return sc.hireMerc(role, 1e6);
  },
  mercInfo() {
    const sc = (window as any).__scene;
    const m = sc.merc;
    if (!m) return null;
    return { role: m.def.role, name: m.state.name, hp: Math.round(m.hp), max: m.maxHp, dmg: Math.round(m.s.dmg), down: m.down, target: m.target?.name ?? null, dist: Math.round(Math.hypot(m.x - sc.player.x, m.y - sc.player.y)), order: m.state.order, equip: Object.fromEntries(Object.entries(m.state.equip).map(([k, v]: any) => [k, v?.base ?? null])) };
  },
});
Object.assign(dev, {
  /** puts an item of a base, level and rarity into the bag (returns its bag index) */
  item(base = 'sword', ilvl = 10, rarity = 2) {
    const s = (window as any).__scene.save;
    const at = s.inventory.findIndex((x: unknown) => !x);
    if (at < 0) return -1;
    s.inventory[at] = generateItem(ilvl, { base, rarity });
    return at;
  },
});
Object.assign(dev, {
  /** fills the rune pouch: n of every rune in the given grades */
  runes(n = 3, tiers = [1, 2, 3, 4, 5]) {
    const s = (window as any).__scene.save;
    s.runes ??= {};
    for (const t of ['fire', 'poison', 'frost', 'storm', 'blood', 'weak', 'leech']) for (const g of tiers) s.runes[t + g] = (s.runes[t + g] ?? 0) + n;
    return Object.keys(s.runes).length;
  },
});
import { curseItem } from './data/items';
Object.assign(dev, {
  /** a cursed item of a base into the bag */
  cursed(base = 'sword', id = 'bloodpact', ilvl = 20) {
    const s = (window as any).__scene.save;
    const at = s.inventory.findIndex((x: unknown) => !x);
    if (at < 0) return -1;
    s.inventory[at] = curseItem(generateItem(ilvl, { base, rarity: 3, noCurse: true }), undefined, id);
    return at;
  },
});
Object.assign(dev, {
  /** a unique by id into the bag */
  unique(id = 'shadowthorn', ilvl = 20, rarity = 4) {
    const s = (window as any).__scene.save;
    const at = s.inventory.findIndex((x: unknown) => !x);
    if (at < 0) return -1;
    const u = UNIQUE_BY_ID[id];
    let it = generateItem(ilvl, { base: u.base, rarity, noCurse: true });
    for (let i = 0; i < 50 && it.unique !== id; i++) it = generateItem(ilvl, { base: u.base, rarity, noCurse: true });
    s.inventory[at] = it;
    return at;
  },
});
import { UNIQUE_BY_ID } from './data/uniques';
Object.assign(dev, {
  /** every spell rune into the bag */
  spellRunes(n = 1) {
    const s = (window as any).__scene.save;
    s.spellRuneBag ??= {};
    for (const id of ['echo', 'split', 'fire', 'frost', 'storm', 'venom', 'power', 'haste', 'vamp', 'pierce', 'seek', 'blast']) s.spellRuneBag[id] = (s.spellRuneBag[id] ?? 0) + n;
    return true;
  },
});
Object.assign(dev, {
  talentInfo() {
    const sc = (window as any).__scene;
    const d = sc.player.d;
    return { talents: sc.save.talents, specials: [...d.specials].join(','), armor: d.armor, hp: d.maxHp, crit: d.crit, elemPct: d.elemPct };
  },
});
Object.assign(dev, {
  /** places an event on the running floor and returns where it is */
  ev(kind: string) {
    const sc = (window as any).__scene;
    const before = sc.interactables.length;
    const ok = sc.enc.placeKind(kind);
    const it = sc.interactables.slice(before).find((i: any) => i.kind === 'ev') ?? sc.interactables[sc.interactables.length - 1];
    return { ok, x: it?.x, y: it?.y, type: it?.data?.ev?.type, n: sc.interactables.length - before };
  },
  /** the hero stands right below an event (or another interactable kind) */
  goTo(type: string) {
    const sc = (window as any).__scene;
    const it = sc.interactables.find((i: any) => !i.used && ((i.kind === 'ev' && i.data.ev.type === type) || i.kind === type));
    if (!it) return null;
    const p = sc.player;
    for (const [dx, dy] of [[0, 10], [0, 14], [10, 6], [-10, 6], [0, -10]]) {
      if (!sc.map.collides(it.x + dx, it.y + dy, p.r)) {
        p.x = it.x + dx;
        p.y = it.y + dy;
        break;
      }
    }
    sc.map.revealAround(p.x, p.y, 10);
    return { x: it.x, y: it.y, label: sc.actionLabel(it) };
  },
  /** what the events of the floor are and their state */
  evInfo() {
    const sc = (window as any).__scene;
    const enc = sc.enc;
    return {
      events: sc.interactables.filter((i: any) => i.kind === 'ev').map((i: any) => ({ type: i.data.ev.type, used: !!i.used })),
      brawl: enc.brawl ? { started: enc.brawl.started, done: enc.brawl.done, alive: enc.brawl.members.filter((e: any) => !e.dead).length, f1: enc.brawl.members.filter((e: any) => !e.dead && e.faction === 1).length, f2: enc.brawl.members.filter((e: any) => !e.dead && e.faction === 2).length } : null,
      arena: enc.arena ? { wave: enc.arena.wave, alive: enc.arena.alive.filter((e: any) => !e.dead).length, sealed: enc.arena.sealed.length } : null,
      rift: enc.rift ? { kind: enc.rift.kind, kills: enc.rift.kills, need: enc.rift.need, guard: !!enc.rift.guard, cleared: enc.rift.cleared, t: enc.rift.t } : null,
      fates: sc.save.fates,
      fateNow: enc.fateNow ? { kind: enc.fateNow.kind, done: !!enc.fateNow.done, foe: enc.fateNow.foe?.name } : null,
      village: sc.save.village,
      lore: sc.save.lore,
      golden: enc.golden,
      secret: enc.secret ? enc.secret.name : null,
      rival: sc.rival ? { name: sc.rival.state.name, ally: sc.rivalAlly } : null,
      floorRift: sc.rift,
      enemies: sc.enemies.length,
    };
  },
  /** kills every monster of a tag (or all) as if the hero did it */
  killTagged(tag?: string) {
    const sc = (window as any).__scene;
    let n = 0;
    for (const e of [...sc.enemies]) if (!e.dead && (!tag || e.tag === tag || (tag === 'brawl1' && e.faction === 1))) {
      sc.combat.killEnemy(e);
      n++;
    }
    return n;
  },
});
Object.assign(dev, {
  /** home to Loppo at once (no checks) */
  village() {
    const sc = (window as any).__scene;
    sc.goToVillage();
    return true;
  },
  /** every building of the village at a level (0 = ruins) */
  buildAll(lv = 1) {
    const sc = (window as any).__scene;
    const v = (sc.save.village ??= { lv: {}, pity: 0 });
    for (const id of ['stash', 'smithy', 'shop', 'board', 'lab', 'tower', 'trainer', 'temple']) v.lv[id] = id === 'stash' ? Math.max(1, lv) : lv;
    return v.lv;
  },
  /** the quests taken and offered */
  questInfo() {
    const sc = (window as any).__scene;
    const v = sc.save.village ?? {};
    return { quests: (v.quests ?? []).map((q: any) => `${q.type}:${q.have}/${q.goal}${q.done ? '✔' : ''}@${q.floor}`), offers: (v.offers ?? []).map((q: any) => q.type) };
  },
});
import { makeQuest, QUEST_COUNTER } from './data/quests';
import { questCounter } from './game/quests';
Object.assign(dev, {
  /** takes a quest of a type at once (as if from the board) */
  quest(type: string) {
    const sc = (window as any).__scene;
    const v = (sc.save.village ??= { lv: {}, pity: 0 });
    const q = makeQuest(type as any, sc.floor, 1);
    const key = (QUEST_COUNTER as any)[type];
    if (key) q.base = questCounter(sc.save, key);
    (v.quests ??= []).push(q);
    return { type: q.type, floor: q.floor, goal: q.goal, title: q.title };
  },
});
Object.assign(dev, {
  /** a champion with chosen traits right next to the hero */
  elite(id = 'orc', affixes: string[] = ['štítonoš'], dx = 50) {
    const sc = (window as any).__scene;
    const p = sc.player;
    const e = sc.spawnEnemy(id, p.x + dx, p.y, true, -1, undefined, affixes[0]);
    e.affixes = affixes;
    e.eliteAffix = affixes[0];
    e.name = `${e.def.name} (${affixes.join(', ')})`;
    e.aggro = true;
    return { name: e.name, hp: e.maxHp, id: e.id };
  },
});
import { royalOf, makeRoyalQuest } from './data/royal';
import { runOf } from './data/bands';
Object.assign(dev, {
  /** gives the hero the king's task of a step at once (and favour, if asked) */
  royal(step?: number, favor?: number) {
    const sc = (window as any).__scene;
    const s = sc.save;
    const r = royalOf(s);
    if (favor !== undefined) r.favor = favor;
    const q = makeRoyalQuest(step ?? r.step, s.maxFloor);
    const key = (QUEST_COUNTER as any)[q.type];
    if (key && key !== 'maxFloor') q.base = questCounter(s, key);
    r.quest = q;
    return { type: q.type, title: q.title, goal: q.goal, floor: q.floor, base: q.base, minRarity: q.minRarity };
  },
  royalInfo() {
    const r = (window as any).__scene.save.village?.royal;
    return r ? { favor: r.favor, step: r.step, quest: r.quest ? `${r.quest.type}:${r.quest.have}/${r.quest.goal}${r.quest.done ? '✔' : ''}` : null, crown: !!r.crown } : null;
  },
});
Object.assign(dev, {
  /** monsters of a kind next to the hero (awake) */
  spawn(id = 'necromancer', n = 1, dx = 60, elite = false) {
    const sc = (window as any).__scene;
    const p = sc.player;
    const out: { id: number; name: string; hp: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = sc.map.randomFloorNear(p.x + dx, p.y, 20) ?? [p.x + dx, p.y];
      const e = sc.spawnEnemy(id, s[0], s[1], elite, -1);
      e.aggro = true;
      out.push({ id: e.id, name: e.name, hp: Math.round(e.maxHp) });
    }
    return out;
  },
  /** turns the nearest monster (or a new one of a kind) into a corrupted one */
  corrupt(id?: string) {
    const sc = (window as any).__scene;
    const p = sc.player;
    let e = id ? sc.spawnEnemy(id, p.x + 70, p.y, false, -1) : sc.nearestEnemy(p.x, p.y, 400, false);
    if (!e) return null;
    e.makeCorrupt();
    return { name: e.name, hp: e.maxHp, affixes: e.affixes };
  },
  /** what lives on this floor */
  floorInfo() {
    const sc = (window as any).__scene;
    const count: Record<string, number> = {};
    for (const e of sc.enemies) if (!e.dead) count[e.def.id] = (count[e.def.id] ?? 0) + 1;
    return { floor: sc.floor, families: sc.dungeon.families, corrupt: sc.enemies.filter((e: any) => e.corrupt && !e.dead).map((e: any) => e.name), count };
  },
  /** a monster's power state (by id from spawn) */
  powerInfo(id: number) {
    const e = (window as any).__scene.enemies.find((x: any) => x.id === id);
    if (!e) return null;
    const { bat, eating, targets, ...pw } = e.pw;
    return { name: e.name, hp: Math.round(e.hp), maxHp: Math.round(e.maxHp), dead: e.dead, aggro: e.aggro, pw, bless: e.blessT, haste: e.hasteT, mshield: Math.round(e.mshield), fed: e.fed, aim: e.aimT, leap: !!e.leap, inWall: e.inWall, bat: !!bat, eating: !!eating };
  },
});
Object.assign(dev, {
  /** every piece of a set straight onto the hero */
  equipSet(id = 'thorns', ilvl = 30) {
    const sc = (window as any).__scene;
    const s = sc.save;
    for (let i = 0; i < 4; i++) {
      const it = generateSetItem(ilvl, id, i);
      const cat = BASE_BY_ID[it.base].cat;
      const slot = cat === 'shield' || cat === 'offhand' ? 'off' : cat === 'ring' ? 'ring1' : cat.startsWith('weapon') ? 'main' : cat;
      s.equip[slot] = it;
    }
    sc.player.recalc();
    const d = sc.player.d;
    return { thorns: d.thorns, thornsPct: d.thornsPct, armor: d.armor, specials: [...d.specials] };
  },
});
Object.assign(dev, {
  /** jumps to a floor of the running expedition, of a kind (camp floors are camps anyway) and with a fate */
  goto(floor: number, kind?: string, fate?: string | null) {
    const sc = (window as any).__scene;
    const s = sc.save;
    s.floor = floor;
    s.maxFloor = Math.max(s.maxFloor, floor);
    const run = runOf(s);
    run.kind = (kind ?? 'normal') as any;
    run.fate = fate === undefined ? undefined : fate;
    sc.scene.restart({ save: s });
    return { floor, kind: run.kind, fate: run.fate };
  },
  /** what the running floor is */
  floorKind() {
    const sc = (window as any).__scene;
    return { floor: sc.floor, kind: sc.kind, calm: sc.calm ?? null, fate: sc.fate?.id ?? null, mod: sc.mod?.name ?? null, enemies: sc.enemies.filter((e: any) => !e.dead).length, run: sc.save.run, inter: [...new Set(sc.interactables.map((i: any) => i.kind))].join(',') };
  },
});
