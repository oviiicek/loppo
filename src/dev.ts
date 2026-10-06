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
  if (!sc || !sc.player || !sc.sys.isActive()) return;
  const s = sc.save;
  const p = sc.player;
  const now = performance.now();
  if (botState.lastFloor !== sc.floor) {
    botLog.push({ floor: sc.floor, level: s.level, t: Math.round((now - botState.started) / 1000), deaths: botState.deaths, gold: s.gold, hp: p.d.maxHp, dmg: p.d.dmgMin + '-' + p.d.dmgMax, armor: p.d.armor, kills: s.kills });
    botState.lastFloor = sc.floor;
    botState.floorStart = now;
  }
  if (p.dead) {
    if (!(botState as any).deadSince) (botState as any).deadSince = now;
    if (now - (botState as any).deadSince > 1500) {
      (botState as any).deadSince = 0;
      botState.deaths++;
      UI.closeOverlay(false);
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
  // target
  const enemies = sc.enemies.filter((e) => !e.dead && !(e.def.behavior === 'mimic' && !e.aggro));
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
