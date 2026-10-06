// Developer helpers (only bundled in dev mode) – used for automated testing.
import { newCharacter, game as G, saveGame, autoLoadout } from './systems/state';
import { spellsForClass, SPELLS } from './data/spells';
import { generateItem } from './data/items';
import { UI } from './ui/ui';
import { ClassId } from './data/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dev = {
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
