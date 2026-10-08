import Phaser from 'phaser';
import type { GameScene, Interactable } from '../scenes/GameScene';
import { Enemy } from './entities';
import { TS } from './map';
import { D } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { bumpStat, saveGame, xpForLevel } from '../systems/state';
import { T_FLOOR, T_WALL, Room } from '../systems/dungeon';
import { ENEMY_BY_ID, BOSSES, isBossFloor, isStoryBossFloor } from '../data/enemies';
import { generateItem } from '../data/items';
import { BuildingDef, BUILDING_BY_ID, villageOf, villagerDue } from '../data/village';
import { LoreEntry, pickLore, GHOSTS, GhostDef } from '../data/lore';
import { FATES, FATE_BY_ID, FateDef, Fate, FATE_LINES, WISHES, fateDueIn } from '../data/fates';
import { biomeForFloor } from '../data/biomes';
import type { Quest } from '../data/quests';

// Random things that happen on a floor: a villager held captive, altars that ask for a price, a ghost
// with a story, a portal into a rift, monsters at war with each other, a blood arena, people whose fate
// the hero decides, lore on the walls and the dead – and very rarely something nobody believes.

export type EvType =
  | 'captive'
  | 'altarBlood'
  | 'altarGift'
  | 'altarFate'
  | 'ghost'
  | 'portal'
  | 'brawl'
  | 'arena'
  | 'fate'
  | 'cards'
  | 'corpse'
  | 'runes'
  | 'golden'
  | 'dragon'
  | 'dream'
  | 'rain';

export type RiftKind = 'rift' | 'dream';

/** state of one event on the floor (kept in its interactable's data) */
export interface EvState {
  type: EvType;
  /** the action button's label */
  act: string;
  /** colour of its dot on the minimap */
  mark?: string;
  [k: string]: any;
}

/** strangers who may be held captive (villagers of Loppo come first while some are missing) */
const STRANGERS = [
  { name: 'Kartograf Emil', key: 'npc_villager', gift: 'map', line: 'Díky! Než mě chytili, prolezl jsem tohle patro křížem krážem. Zakreslím ti ho celé.' },
  { name: 'Poutnice Hana', key: 'npc_villager2', gift: 'potions', line: 'Světlo ti žehnej! Moc toho nemám, ale vezmi si moje lektvary. Mně stačí, že žiju.' },
  { name: 'Kupec Vojtěch', key: 'npc_villager', gift: 'gold', line: 'Zachráněn! Za mou svobodu ti patří tohle zlato – a moje vděčnost k tomu.' },
  { name: 'Učenec Tadeáš', key: 'npc_villager2', gift: 'xp', line: 'Děkuji. Poslouchej, co jsem se tu dole naučil o nestvůrách. Bude se ti to hodit.' },
  { name: 'Panoš Kuba', key: 'npc_villager', gift: 'item', line: 'Můj pán padl, ale jeho výzbroj nemusí ležet ladem. Vezmi si ji, ať pomstí jeho i mě.' },
  { name: 'Stopařka Lída', key: 'npc_villager2', gift: 'scout', line: 'Díky! Za tu laskavost ti prozradím, kde se na tomhle patře skrývá tajná skrýš.' },
];

/** monsters that fight in close combat (they make good guards and brawlers) */
const MELEE = new Set(['melee', 'charger', 'splitter']);

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export class Encounters {
  sc: GameScene;
  /** the brawl on this floor (two packs of monsters at war) */
  brawl: { ids: [string, string]; members: Enemy[]; started: boolean; done: boolean; x: number; y: number } | null = null;
  /** the blood arena in progress */
  arena: { it: Interactable; room: Room; sealed: number[]; walls: Phaser.GameObjects.GameObject[]; wave: number; alive: Enemy[]; total: number; pending: boolean } | null = null;
  /** the golden room of this floor (found or not) */
  golden: { room: number; found: boolean } | null = null;
  /** the secret guardian of this floor */
  secret: Enemy | null = null;
  /** seconds until the sky rains gold (a rare floor) */
  rainT = 0;
  rainLeft = 0;
  /** what a fate brought onto this floor (help on the first fight, a foe that waits, a debt collector) */
  fateNow: { fate: Fate; kind: string; t: number; foe?: Enemy | null; done?: boolean } | null = null;
  /** rift state: kind, monsters to kill, time, the guardian */
  rift: { kind: RiftKind; need: number; kills: number; t: number; total: number; guard: Enemy | null; cleared: boolean } | null = null;
  private callT = 0;
  private labelT = 0;
  /** a villager of Loppo already waits on this floor (a second captive is a stranger) */
  private villagerHere = false;

  constructor(sc: GameScene) {
    this.sc = sc;
  }

  // ================================================================== placement
  /** decides what happens on this floor */
  place() {
    const sc = this.sc;
    const f = sc.floor;
    const forced = (window as any).__forceEvent as string | undefined; // dev testing hook
    this.placeFates(!!forced);
    if (forced) {
      this.placeKind(forced);
      return;
    }
    if (f < 2) return;
    if (isBossFloor(f)) {
      // guardian floors keep their focus: at most a dead adventurer's letter
      if (Math.random() < 0.4) this.placeCorpse();
      return;
    }
    // a villager of Loppo waits for rescue (likelier the longer they wait)
    const due = villagerDue(sc.save, f);
    const v = villageOf(sc.save);
    if (due) {
      if (Math.random() < 0.4 + v.pity * 0.2 && this.placeCaptive(due)) v.pity = 0;
      else v.pity++;
    }
    // one or two random events
    const n = Math.random() < 0.15 ? 0 : Math.random() < 0.72 ? 1 : 2;
    const pool: [string, number][] = [
      ['captive', f >= 3 ? 10 : 0],
      ['altarBlood', f >= 3 ? 8 : 0],
      ['altarGift', f >= 4 ? 7 : 0],
      ['altarFate', f >= 5 ? 7 : 0],
      ['ghost', f >= 3 ? 9 : 0],
      ['portal', f >= 6 ? 6 : 0],
      ['brawl', f >= 4 ? 9 : 0],
      ['arena', f >= 5 ? 8 : 0],
      ['fate', f >= 4 ? 7 : 0],
      ['cards', f >= 5 ? 4 : 0],
    ];
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const opts = pool.filter(([k, w]) => w > 0 && !used.has(k));
      const total = opts.reduce((a, [, w]) => a + w, 0);
      let x = Math.random() * total;
      for (const [k, w] of opts) {
        x -= w;
        if (x <= 0) {
          used.add(k);
          this.placeKind(k);
          break;
        }
      }
    }
    // lore: the dead and the walls
    if (Math.random() < 0.5) this.placeCorpse();
    if (Math.random() < 0.35) this.placeRunes();
    // very rarely, something nobody will believe
    if (f >= 6) {
      const r = Math.random();
      if (r < 1 / 140) this.placeKind('golden');
      else if (r < 1 / 140 + 1 / 200 && f >= 10) this.placeKind('dragon');
      else if (r < 1 / 140 + 1 / 200 + 1 / 170) this.placeKind('dream');
      else if (r < 1 / 140 + 1 / 200 + 1 / 170 + 1 / 110) this.placeKind('rain');
    }
  }

  placeKind(k: string) {
    switch (k) {
      case 'captive':
        return this.placeCaptive(this.villagerHere ? null : villagerDue(this.sc.save, this.sc.floor));
      case 'stranger':
        return this.placeCaptive(null);
      case 'altarBlood':
      case 'altarGift':
      case 'altarFate':
        return this.placeAltar(k);
      case 'ghost':
        return this.placeGhost();
      case 'portal':
        return this.placePortal('rift');
      case 'dream':
        return this.placePortal('dream');
      case 'brawl':
        return this.placeBrawl();
      case 'arena':
        return this.placeArena();
      case 'fate':
      case 'necro':
      case 'knight':
      case 'bottle':
        return this.placeFateNpc(k === 'fate' ? undefined : FATE_BY_ID[k as 'necro']);
      case 'cards':
        return this.placeCards();
      case 'corpse':
        return this.placeCorpse();
      case 'runes':
        return this.placeRunes();
      case 'golden':
        return this.placeGolden();
      case 'dragon':
        return this.placeDragon();
      case 'rain':
        this.rainT = 20 + Math.random() * 40;
        return true;
    }
    return false;
  }

  /** an event's interactable */
  private add(x: number, y: number, ev: EvState, sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): Interactable {
    const it: Interactable = { kind: 'ev', x, y, tx: Math.floor(x / TS), ty: Math.floor(y / TS), sprite, data: { ev } };
    this.sc.interactables.push(it);
    bumpStat(this.sc.save, 'events');
    return it;
  }

  /** a person standing on the floor: the sprite, its shadow and a name over the head */
  private person(key: string, x: number, y: number, name: string, color: string) {
    const sc = this.sc;
    const s = sc.add.sprite(x, y + 6, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 6);
    if (sc.anims.exists(key + '_idle')) s.play(key + '_idle');
    const sh = sc.add.image(x, y + 6, 'shadow').setDepth(D.floorDeco + 2);
    const t = sc.fx.label(x, y - 15, name, color, 6);
    t.setDepth(99980).setVisible(false);
    return { s, sh, t };
  }

  /** a furniture-like image of the events (drawn at double detail) */
  private prop(key: string, x: number, y: number, oy = 1) {
    return this.sc.add.image(x, y, key).setOrigin(0.5, oy).setScale(ACTOR_SCALE).setDepth(D.entityBase + y);
  }

  private glow(x: number, y: number, color: number, scale = 0.8, alpha = 0.3) {
    const sc = this.sc;
    const g = sc.add.image(x, y, 'glow').setTint(color).setAlpha(alpha).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    sc.trackGlow(g, Math.floor(x / TS), Math.floor(y / TS));
    return g;
  }

  /** a short line spoken over someone's head */
  say(x: number, y: number, text: string, color = '#f0e6d0', ms = 2600) {
    const sc = this.sc;
    const t = sc.fx.label(x, y, text, color, 6, true);
    t.setDepth(99985);
    sc.tweens.add({ targets: t, y: y - 6, alpha: { from: 1, to: 0 }, delay: ms - 500, duration: 500, onComplete: () => t.destroy() });
  }

  /** a free spot in some room of the floor (none near the start) */
  private spot(minDist = 10) {
    return this.sc.freeSpot(minDist) ?? this.sc.freeSpot(5);
  }

  /** monster kinds of this floor (no goblins with gold, no mimics) */
  private floorPool(melee = false) {
    const ids = [...new Set(this.sc.dungeon.spawns.map((s) => s.id))].filter((id) => {
      const d = ENEMY_BY_ID[id];
      return d && d.behavior !== 'thief' && d.behavior !== 'mimic' && (!melee || MELEE.has(d.behavior));
    });
    if (ids.length) return ids;
    return melee ? ['skeleton'] : ['skeleton', 'skelArcher'];
  }

  /** a pack around a point (they wait there until the hero comes) */
  private pack(x: number, y: number, room: number, n: number, eliteChance: number, tag: string, minR = 16, maxR = 48): Enemy[] {
    const sc = this.sc;
    const pool = this.floorPool();
    const out: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      let s: [number, number] | null = null;
      for (let k = 0; k < 14 && !s; k++) {
        const q = sc.map.randomFloorNear(x, y, maxR);
        if (q && Math.hypot(q[0] - x, q[1] - y) >= minR) s = q;
      }
      if (!s) continue;
      const e = sc.spawnEnemy(pick(pool), s[0], s[1], Math.random() < eliteChance, room);
      e.tag = tag;
      out.push(e);
    }
    return out;
  }

  // ================================================================== captives
  /** the lost adventurer of a quest, held captive somewhere on this floor */
  placeLost(q: Quest) {
    if (this.sc.interactables.some((i) => i.kind === 'ev' && i.data.ev.questId === q.id && !i.used)) return false;
    return this.placeCaptive(null, q);
  }

  /** a villager of Loppo (or a stranger, or someone a quest is looking for) tied up, with monsters around */
  placeCaptive(villager: BuildingDef | null, quest?: Quest) {
    const sc = this.sc;
    const c = this.spot(villager ? 8 : 10);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const who = villager?.who;
    const stranger = who
      ? null
      : quest
        ? { name: quest.name ?? 'Ztracený dobrodruh', key: quest.fem ? 'npc_villager2' : 'npc_villager', gift: 'quest', line: 'Někdo mě hledá? Doma na mě čekají? Díky za záchranu! Hned se vracím do Loppa.' }
        : pick(STRANGERS);
    const key = who ? who.key : stranger!.key;
    const name = who ? `${who.name} (${who.trade})` : stranger!.name;
    const n = this.person(key + '_tied', x, y, name, '#ffd76a');
    const f = sc.floor;
    const guards = this.pack(x, y, c.room, Math.min(6, 3 + Math.floor(f / 25) + (Math.random() < 0.5 ? 1 : 0)), f >= 6 ? 0.18 : 0, 'guard');
    if (villager) this.villagerHere = true;
    const ev: EvState = {
      type: 'captive',
      act: 'Osvobodit',
      mark: '#ffd76a',
      villager: villager?.id ?? null,
      stranger,
      guards,
      n,
      // now and then a "captive" is a shapeshifter waiting for a fool
      trap: !villager && !quest && f >= 10 && Math.random() < 0.1,
      questId: quest?.id,
    };
    if (quest) ev.mark = '#9dff7a';
    this.add(x, y + 4, ev, n.s);
    sc.lamps.push({ x, y, r: 50, flicker: 1 });
    return true;
  }

  private freeCaptive(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const near = (ev.guards as Enemy[]).filter((e) => !e.dead && Math.hypot(e.x - it.x, e.y - it.y) < 140);
    if (near.length) {
      this.say(it.x, it.y - 18, 'Pozor, stráže! Nejdřív je zažeň!', '#ffd76a');
      sc.ui.toast(`Nejdřív poraz stráže (${near.length})`, '#ffb070');
      for (const e of near) e.aggro = true;
      return;
    }
    it.used = true;
    const n = ev.n as { s: Phaser.GameObjects.Sprite; sh: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text };
    n.t.destroy();
    if (ev.trap) return this.shapeshifter(it, n);
    // untied: the ropes fall, the person stands up
    const key = ev.villager ? BUILDING_BY_ID[ev.villager as 'smithy'].who!.key : ev.stranger.key;
    n.s.setTexture(key, 0).play(key + '_idle');
    sfx('chest');
    sc.fx.burst(it.x, it.y - 8, 0xc8a060, 12, 'pix');
    const leave = () => {
      sc.fx.burst(n.s.x, n.s.y - 8, 0xffffff, 12, 'puff');
      sc.tweens.add({ targets: [n.s, n.sh], alpha: 0, duration: 600, onComplete: () => (n.s.destroy(), n.sh.destroy()) });
    };
    bumpStat(sc.save, 'rescued');
    if (ev.villager) {
      const b = BUILDING_BY_ID[ev.villager as 'smithy'];
      const v = villageOf(sc.save);
      v.lv[b.id] = Math.max(1, v.lv[b.id] ?? 0);
      saveGame(sc.save);
      sc.ui.panels.talk({ title: `${b.who!.name}, ${b.who!.trade}`, portrait: b.who!.key, line: b.who!.thanks, choices: [{ id: 'ok', label: 'Šťastnou cestu domů', cls: 'green' }] }, () => {
        leave();
        sfx('levelup');
        sc.ui.banner(`🏠 ${b.name}`, `${b.who!.name} se ${b.who!.fem ? 'vrátila' : 'vrátil'} do Loppa`);
        sc.ui.toast(`V osadě Loppo se otevřela budova: ${b.name}. Do osady se dostaneš z pauzy.`, b.color);
        sc.gainXp(Math.round(xpForLevel(sc.save.level) * 0.05));
      });
      return;
    }
    const st = ev.stranger;
    sc.ui.panels.talk({ title: st.name, portrait: st.key, line: st.line, choices: [{ id: 'ok', label: 'Ať se ti daří', cls: 'green' }] }, () => {
      leave();
      if (ev.questId) sc.quests.completeById(ev.questId);
      else this.strangerGift(it, st.gift);
    });
  }

  private strangerGift(it: Interactable, gift: string) {
    const sc = this.sc;
    const p = sc.player;
    const f = sc.floor;
    switch (gift) {
      case 'map':
        sc.map.revealAll();
        sc.updateGlowVisibility();
        sc.ui.toast('Celé patro je zakreslené na mapě', '#c8e0ff');
        break;
      case 'potions':
        sc.loot.dropMat('hpPotion', 2, it.x, it.y);
        sc.loot.dropMat('mpPotion', 1, it.x, it.y);
        break;
      case 'gold':
        for (let i = 0; i < 6; i++) sc.loot.dropGold(sc.loot.goldAmount(1.5), it.x, it.y);
        break;
      case 'xp':
        sc.gainXp(Math.round(xpForLevel(sc.save.level) * 0.12));
        sc.fx.ring(p.x, p.y - 6, 30, 0xc77dff, 500);
        break;
      case 'item':
        sc.loot.dropItem(generateItem(f + 1, { rarity: Math.random() < 0.3 ? 4 : 3, filter: sc.loot.bias() }), it.x, it.y);
        break;
      case 'scout': {
        if (!this.hintSecret()) {
          sc.map.revealAll();
          sc.updateGlowVisibility();
          sc.ui.toast('Tajnou skrýš tu nikdo nemá – aspoň celé patro je na mapě', '#c8e0ff');
        }
        break;
      }
    }
  }

  /** a hidden passage of the floor shows on the map (false when there is none left) */
  hintSecret() {
    const sc = this.sc;
    const sec = sc.interactables.find((i) => i.kind === 'secret' && !i.used && !i.data.hinted);
    if (!sec) return false;
    sec.data.hinted = true;
    sc.map.revealAround(sec.x, sec.y + 8, 3);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = sc.map.idx(sec.tx + dx, sec.ty + dy);
      if (!sc.map.explored[i] && !sc.map.isHidden(sec.tx + dx, sec.ty + dy)) {
        sc.map.explored[i] = 1;
        sc.map.clearFog(sec.tx + dx, sec.ty + dy);
      }
    }
    // the crack glows for whoever comes near
    const g = this.glow(sec.x, sec.y - 6, 0xffd76a, 0.7, 0.4);
    g.setVisible(true);
    sc.tweens.add({ targets: g, alpha: 0.12, yoyo: true, repeat: -1, duration: 700 });
    sec.data.hintGlow = g;
    sc.ui.toast('Tajný průchod je vyznačený na mapě (zlatá značka)', '#ffd76a');
    return true;
  }

  /** the captive was no captive at all */
  private shapeshifter(it: Interactable, n: { s: Phaser.GameObjects.Sprite; sh: Phaser.GameObjects.Image }) {
    const sc = this.sc;
    this.say(it.x, it.y - 18, 'Hahaha! Tak snadno?', '#ff6a5a', 2000);
    sc.fx.shake(0.006, 300);
    sfx('boss');
    sc.time.delayedCall(500, () => {
      sc.fx.burst(n.s.x, n.s.y - 8, 0x9a5aff, 24, 'puff');
      n.s.destroy();
      n.sh.destroy();
      const pool = this.floorPool(true);
      const e = sc.spawnEnemy(pick(pool), it.x, it.y - 2, true, sc.dungeon.roomId[sc.map.idx(it.tx, it.ty)] ?? -1, 'en_shade', 'teleportér');
      e.name = 'Převtělenec';
      e.maxHp = e.hp = Math.round(e.maxHp * 2.2);
      e.dmg *= 1.2;
      e.xp = Math.round(e.xp * 2);
      e.aggro = true;
      e.tag = 'shifter';
      e.nameLabel = sc.fx.label(e.x, e.y - 20, '☠ Převtělenec', '#c8a8ff', 6);
      e.nameLabel.setDepth(99980);
      sc.ui.toast('Zajatec byl převtělenec! Poraz ho – nosí kořist svých obětí.', '#c8a8ff');
    });
  }

  // ================================================================== altars
  placeAltar(kind: 'altarBlood' | 'altarGift' | 'altarFate') {
    const sc = this.sc;
    const c = this.spot(8);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const key = kind === 'altarBlood' ? 'ev_altar_blood' : kind === 'altarGift' ? 'ev_altar_gift' : 'ev_altar_fate';
    const col = kind === 'altarBlood' ? 0xff3a4a : kind === 'altarGift' ? 0xffd76a : 0xc77dff;
    const s = this.prop(key, x, y + 8);
    const g = this.glow(x, y - 2, col, 0.9, 0.32);
    sc.tweens.add({ targets: g, alpha: 0.12, yoyo: true, repeat: -1, duration: 1000 });
    const name = kind === 'altarBlood' ? 'Krvavý oltář' : kind === 'altarGift' ? 'Oltář proměny' : 'Oltář osudu';
    const t = sc.fx.label(x, y - 11, name, '#' + col.toString(16).padStart(6, '0'), 6);
    t.setDepth(99980).setVisible(false);
    this.add(x, y + 4, { type: kind, act: name, mark: '#' + col.toString(16).padStart(6, '0'), glow: g, label: t }, s);
    sc.lamps.push({ x, y, r: 46, flicker: 2 });
    return true;
  }

  private spendAltar(it: Interactable) {
    it.used = true;
    (it.sprite as Phaser.GameObjects.Image).setTexture('ev_altar_used');
    it.data.ev.glow?.destroy();
    it.data.ev.label?.destroy();
  }

  private bloodAltar(it: Interactable) {
    const sc = this.sc;
    sc.ui.confirm(
      'Krvavý oltář',
      'Obětuj třetinu svého zdraví. Za to dostaneš až do konce patra +30 % poškození a +10 % šance na kritický zásah.',
      () => {
        const p = sc.player;
        if (p.dead) return;
        this.spendAltar(it);
        p.hp = Math.max(1, p.hp - p.d.maxHp * 0.33);
        sc.shrineBuffs.push({ id: 'blood', name: 'Krvavá přísaha', mods: { dmgPct: 30, crit: 10 }, t: 99999, total: 99999, color: 0xc81a2a });
        p.recalc();
        sfx('hurt');
        sc.fx.burst(p.x, p.y - 8, 0xc81a2a, 24, 'pix');
        sc.fx.ring(it.x, it.y - 8, 40, 0xff3a4a, 600);
        sc.fx.shake(0.005, 200);
        sc.ui.toast('Krev přijata. Síla proudí tvými žilami.', '#ff6a7a');
        bus.emit('buffs');
        bus.emit('stats');
      },
      'Obětovat krev',
      'Odejít',
    );
  }

  private giftAltar(it: Interactable) {
    const sc = this.sc;
    sc.ui.panels.offerItem('Oltář proměny', 'Polož na oltář předmět. Polovina obětí se vrátí o stupeň vzácnější, jiné se jen promění – a některé si oltář nechá.', (idx) => {
      const s = sc.save;
      const old = s.inventory[idx];
      if (!old) return;
      this.spendAltar(it);
      s.inventory[idx] = null;
      const f = sc.floor;
      const r = Math.random();
      sc.fx.ring(it.x, it.y - 10, 36, 0xffd76a, 700);
      sc.fx.burst(it.x, it.y - 12, 0xffd76a, 20);
      if (r < 0.5) {
        const up = Math.min(5, old.rarity + 1);
        const it2 = generateItem(Math.max(old.ilvl, f) + 1, { rarity: up, base: old.base });
        sc.loot.dropItem(it2, it.x, it.y);
        sfx('levelup');
        sc.ui.toast(`Oltář proměnil oběť ve vzácnější předmět!`, '#ffd76a');
      } else if (r < 0.85) {
        const it2 = generateItem(Math.max(old.ilvl, f), { rarity: old.rarity, base: old.base });
        sc.loot.dropItem(it2, it.x, it.y);
        sfx('chest');
        sc.ui.toast('Oltář předmět proměnil.', '#e8d8b0');
      } else {
        sc.loot.dropMat('dust', 1 + old.rarity, it.x, it.y);
        for (let i = 0; i < 2; i++) sc.loot.dropGold(sc.loot.goldAmount(1 + old.rarity * 0.5), it.x, it.y);
        sfx('lockFail');
        sc.ui.toast('Oltář si oběť nechal… a nechal po ní jen prach a zlato.', '#a8a0b8');
      }
      saveGame(s);
      bus.emit('stats');
    });
  }

  fatePrice() {
    return Math.round(120 * (1 + 0.2 * this.sc.floor));
  }

  private fateAltar(it: Interactable) {
    const sc = this.sc;
    const price = this.fatePrice();
    if (sc.save.gold < price) {
      sc.ui.toast(`Oltář osudu žádá ${price.toLocaleString('cs-CZ')} zlata`, '#ff8a7a');
      return;
    }
    sc.ui.confirm(
      'Oltář osudu',
      `Hoď kostky osudu za ${price.toLocaleString('cs-CZ')} zlata. Osud může dát požehnání, poklad, nebo zkoušku. Kdo nic neriskuje…`,
      () => {
        const s = sc.save;
        if (s.gold < price) return;
        s.gold -= price;
        this.spendAltar(it);
        const p = sc.player;
        const r = Math.random();
        sc.fx.ring(it.x, it.y - 10, 40, 0xc77dff, 700);
        if (r < 0.3) {
          sc.shrineBuffs.push({ id: 'fate', name: 'Přízeň osudu', mods: { dmgPct: 20, atkSpdPct: 15, move: 10 }, xp: 0.5, mf: 100, t: 240, total: 240, color: 0xc77dff });
          p.recalc();
          bus.emit('buffs');
          sfx('levelup');
          sc.ui.toast('Osud se usmál: požehnání na 4 minuty (síla, rychlost, štěstí)', '#d8a8ff');
        } else if (r < 0.55) {
          for (let i = 0; i < 2; i++) sc.loot.dropRandomGem(it.x, it.y, 1);
          sc.loot.dropRandomRune(it.x, it.y, 1);
          sfx('chest');
          sc.ui.toast('Osud dal drahokamy a runu', '#ff9ab0');
        } else if (r < 0.75) {
          sc.loot.dropItem(generateItem(sc.floor + 1, { rarity: Math.random() < 0.35 ? 4 : 3, filter: sc.loot.bias() }), it.x, it.y);
          sfx('chest');
          sc.ui.toast('Osud dal vzácný předmět', '#bc6ff1');
        } else if (r < 0.85) {
          sc.loot.dropItem(generateItem(sc.floor + 2, { rarity: Math.random() < 0.2 ? 5 : 4 }), it.x, it.y);
          for (let i = 0; i < 8; i++) sc.loot.dropGold(sc.loot.goldAmount(1.5), it.x, it.y);
          sfx('levelup');
          sc.fx.shake(0.006, 300);
          sc.ui.banner('Jackpot!', 'Osud ti vrátil všechno i s úroky');
        } else {
          // the dice say: prove yourself
          sfx('boss');
          sc.fx.shake(0.006, 300);
          const pack = this.pack(it.x, it.y, sc.dungeon.roomId[sc.map.idx(it.tx, it.ty)] ?? -1, 4 + Math.floor(sc.floor / 30), 0.5, 'fate', 30, 70);
          for (const e of pack) {
            e.aggro = true;
            sc.fx.burst(e.x, e.y - 6, 0xc77dff, 10, 'puff');
          }
          sc.ui.toast('Osud tě zkouší! Poraz jeho posly.', '#ff8a7a');
        }
        bus.emit('stats');
      },
      'Hodit kostkami',
      'Odejít',
    );
  }

  // ================================================================== ghost
  placeGhost() {
    const sc = this.sc;
    const c = this.spot(10);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const g = pick(GHOSTS);
    const n = this.person('npc_ghost', x, y, g.name, '#bfe4ff');
    n.s.setAlpha(0.72).setBlendMode(Phaser.BlendModes.SCREEN);
    n.sh.setAlpha(0.3);
    sc.tweens.add({ targets: n.s, y: n.s.y - 3, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });
    const gl = this.glow(x, y - 6, 0x9fd8ff, 0.7, 0.28);
    this.add(x, y + 4, { type: 'ghost', act: 'Promluvit s duchem', mark: '#9fd8ff', ghost: g, n, gl }, n.s);
    sc.lamps.push({ x, y, r: 44, flicker: 3 });
    return true;
  }

  private talkGhost(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const g = ev.ghost as GhostDef;
    if (ev.murderer) {
      // already promised: it waits
      this.say(it.x, it.y - 20, 'Najdi mého vraha… prosím.', '#bfe4ff');
      return;
    }
    sc.ui.panels.talk(
      {
        title: g.name,
        sub: 'neklidný duch',
        portrait: 'npc_ghost',
        line: g.story,
        choices: [
          { id: 'revenge', label: 'Pomstím tě', cls: 'red' },
          { id: 'treasure', label: 'Kde je tvůj poklad?', cls: 'gold' },
          { id: 'peace', label: 'Odpočívej v pokoji', cls: 'green' },
        ],
      },
      (id) => {
        if (id === 'revenge') this.ghostRevenge(it, ev);
        else if (id === 'treasure') this.ghostTreasure(it, ev);
        else this.ghostPeace(it, ev, 'peace');
      },
    );
  }

  private ghostRevenge(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const g = ev.ghost as GhostDef;
    // the murderer waits in a room further away
    const c = this.farSpot(it.x, it.y, 12);
    if (!c) return this.ghostPeace(it, ev, 'peace');
    const e = sc.spawnEnemy(pick(this.floorPool(true)), c.x * TS + 8, c.y * TS + 10, true, c.room);
    e.name = `Vrah ${g.gen}`;
    e.maxHp = e.hp = Math.round(e.maxHp * 2.2);
    e.dmg *= 1.25;
    e.xp = Math.round(e.xp * 2);
    e.tag = 'murderer';
    e.nameLabel = sc.fx.label(e.x, e.y - 20, `☠ Vrah ${g.gen}`, '#ff8a7a', 6);
    e.nameLabel.setDepth(99980);
    ev.murderer = e;
    ev.act = 'Duch čeká na pomstu';
    const room = sc.dungeon.rooms.find((r) => r.id === c.room);
    if (room) sc.map.revealRoom(room.cells);
    sc.updateGlowVisibility();
    (ev.n.t as Phaser.GameObjects.Text).setText(`${g.name} · čeká`);
    sc.ui.toast(`Vrah ${g.gen} je vyznačený na mapě. Až padne, duch najde klid.`, '#ff8a7a');
  }

  private ghostTreasure(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const c = this.farSpot(it.x, it.y, 10);
    if (!c) return this.ghostPeace(it, ev, 'peace');
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const s = sc.add.image(x, y + 8, 'chest_gold').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8);
    sc.addSparkle(s);
    sc.interactables.push({ kind: 'chest', x, y: y + 4, tx: c.x, ty: c.y, sprite: s, data: { tier: 'gold', locked: false, ghost: true } });
    const room = sc.dungeon.rooms.find((r) => r.id === c.room);
    if (room) sc.map.revealRoom(room.cells);
    sc.updateGlowVisibility();
    sc.lamps.push({ x, y, r: 40, flicker: 0 });
    this.ghostPeace(it, ev, 'treasure');
    sc.ui.toast('Duch prozradil svou skrýš – truhla je vyznačená na mapě', '#ffd76a');
  }

  /** the ghost finds its peace and fades into light */
  private ghostPeace(it: Interactable, ev: EvState, why: 'peace' | 'treasure' | 'revenge') {
    const sc = this.sc;
    it.used = true;
    const n = ev.n as { s: Phaser.GameObjects.Sprite; sh: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text };
    n.t.destroy();
    ev.gl?.destroy();
    sc.tweens.add({ targets: n.s, alpha: 0, y: n.s.y - 14, duration: 1400, onComplete: () => n.s.destroy() });
    sc.tweens.add({ targets: n.sh, alpha: 0, duration: 800, onComplete: () => n.sh.destroy() });
    sc.fx.burst(it.x, it.y - 10, 0xbfe4ff, 18);
    sc.fx.ring(it.x, it.y - 8, 30, 0xbfe4ff, 800);
    sfx('heal');
    if (why === 'peace') {
      sc.gainXp(Math.round(xpForLevel(sc.save.level) * 0.06));
      sc.ui.toast(`${(ev.ghost as GhostDef).name} odchází v pokoji. Cítíš se moudřejší.`, '#bfe4ff');
    }
  }

  /** a free spot at least this many tiles away from a point */
  private farSpot(x: number, y: number, tiles: number) {
    for (let k = 0; k < 12; k++) {
      const c = this.sc.freeSpot(6);
      if (c && Math.hypot(c.x * TS - x, c.y * TS - y) > tiles * TS) return c;
    }
    return this.sc.freeSpot(6);
  }

  // ================================================================== portals
  placePortal(kind: RiftKind, questId?: number) {
    const sc = this.sc;
    if (questId && sc.interactables.some((i) => i.kind === 'ev' && i.data.ev.questId === questId)) return false;
    const c = this.spot(10);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const key = kind === 'dream' ? 'ev_portal_gold' : 'ev_portal';
    const s = sc.add.sprite(x, y + 8, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8).play(key + '_loop');
    const col = kind === 'dream' ? 0xffd23a : 0xb07dff;
    const g = this.glow(x, y - 4, col, 1.3, 0.35);
    sc.tweens.add({ targets: g, alpha: 0.15, scale: 1.1, yoyo: true, repeat: -1, duration: 900 });
    const name = kind === 'dream' ? 'Zlatý portál' : 'Trhlina';
    const t = sc.fx.label(x, y - 18, name, kind === 'dream' ? '#ffd23a' : '#d0a8ff', 6);
    t.setDepth(99980).setVisible(false);
    this.add(x, y + 4, { type: kind === 'dream' ? 'dream' : 'portal', act: kind === 'dream' ? 'Vstoupit do zlatého portálu' : 'Vstoupit do trhliny', mark: kind === 'dream' ? '#ffd23a' : '#b07dff', label: t, questId }, s);
    sc.lamps.push({ x, y, r: 64, flicker: 1 });
    return true;
  }

  private enterPortal(ev: EvState) {
    const sc = this.sc;
    const dream = ev.type === 'dream';
    sc.ui.confirm(
      dream ? 'Zlatý portál' : 'Trhlina',
      dream
        ? 'Za portálem se třpytí cosi jako sen. Kdo ví, kam vede… Zbytek tohoto patra opustíš a ze snu se probudíš o patro hlouběji.'
        : `Trhlina vede do zkřiveného světa plného nestvůr. Poraz jich dost, přivolej strážce trhliny a zabij ho – dostaneš bohatou kořist a portál tě vynese do patra ${sc.floor + 1}. Zbytek tohoto patra opustíš.`,
      () => sc.enterRift(dream ? 'dream' : 'rift'),
      'Vstoupit',
      'Zůstat',
    );
  }

  // ================================================================== brawl
  /** two packs of monsters at war: they fight each other when the hero comes near */
  placeBrawl() {
    const sc = this.sc;
    const pool = this.floorPool(true);
    const all = Object.values(ENEMY_BY_ID).filter((d) => MELEE.has(d.behavior) && d.minFloor <= sc.floor && d.weight > 0).map((d) => d.id);
    const a = pick(pool);
    const others = all.filter((id) => id !== a);
    if (!others.length) return false;
    const b = pick(others);
    let c = null as ReturnType<GameScene['freeSpot']>;
    for (let k = 0; k < 8 && !c; k++) {
      const q = sc.freeSpot(12);
      const room = q && sc.dungeon.rooms.find((r) => r.id === q.room);
      if (room && room.cells.length >= 36) c = q;
    }
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 10;
    const members: Enemy[] = [];
    const n = Math.min(5, 3 + Math.floor(sc.floor / 30));
    for (const [side, id] of [
      [-1, a],
      [1, b],
    ] as [number, string][]) {
      for (let i = 0; i < n; i++) {
        let s: [number, number] | null = null;
        for (let k = 0; k < 12 && !s; k++) {
          const q = sc.map.randomFloorNear(x + side * 30, y, 22);
          if (q && Math.sign(q[0] - x) === side) s = q;
        }
        if (!s) continue;
        const e = sc.spawnEnemy(id, s[0], s[1], i === 0 && Math.random() < 0.5, c.room);
        e.faction = side < 0 ? 1 : 2;
        e.facing = side < 0 ? 1 : -1;
        e.tag = 'brawl';
        members.push(e);
      }
    }
    this.brawl = { ids: [a, b], members, started: false, done: false, x, y };
    return true;
  }

  /** whom a brawler goes for: the nearest of the other side (the hero once the hero hits it) */
  brawlTarget(e: Enemy): Enemy | null {
    const br = this.brawl;
    if (!br || !br.started || br.done || e.heroHit) return null;
    let best: Enemy | null = null,
      bd = 220;
    for (const o of br.members) {
      if (o.dead || !o.faction || o.faction === e.faction) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  private updateBrawl() {
    const br = this.brawl!;
    const sc = this.sc;
    const p = sc.player;
    if (!br.started) {
      if (Math.hypot(p.x - br.x, p.y - br.y) < 175 && sc.map.explored[sc.map.idx(Math.floor(br.x / TS), Math.floor(br.y / TS))]) {
        br.started = true;
        for (const e of br.members) if (!e.dead) e.aggro = true;
        sfx('boss');
        bumpStat(sc.save, 'brawls');
        sc.ui.toast(`Rvačka! ${ENEMY_BY_ID[br.ids[0]].name} proti: ${ENEMY_BY_ID[br.ids[1]].name}. Počkej, až se oslabí…`, '#ffb070');
      }
      return;
    }
    if (br.done) return;
    const a = br.members.filter((e) => !e.dead && e.faction === 1);
    const b = br.members.filter((e) => !e.dead && e.faction === 2);
    if (a.length && b.length) return;
    br.done = true;
    const win = a.length ? a : b;
    for (const e of br.members) e.faction = 0;
    if (!win.length) return;
    // the winners are hurt but proud: they carry the spoils of the losers
    for (const e of win) {
      e.tag = 'winner';
      e.aggro = true;
      sc.fx.burst(e.x, e.y - 10, 0xffd23a, 8);
    }
    sc.ui.toast(`Rvačku vyhráli: ${win[0].def.name}. Teď jdou po tobě – a nesou kořist poražených!`, '#ffd76a');
  }

  // ================================================================== blood arena
  /** a blood obelisk in a big room: the room seals and waves of strong monsters come; then a chest */
  placeArena() {
    const sc = this.sc;
    const d = sc.dungeon;
    const s0 = d.start;
    const rooms = d.rooms.filter((r) => r.type === 'normal' && r.cells.length >= 42 && Math.hypot(r.cx - s0.x, r.cy - s0.y) > 12 && !sc.map.isHidden(r.cx, r.cy));
    Phaser.Utils.Array.Shuffle(rooms);
    const busy = new Set(sc.interactables.map((i) => i.ty * d.w + i.tx));
    for (const r of rooms) {
      // the obelisk stands in the middle, with room to fight around it
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (d.grid[(r.cy + dy) * d.w + r.cx + dx] !== T_FLOOR || busy.has((r.cy + dy) * d.w + r.cx + dx)) ok = false;
      // no merchant, shrine or other event shares the arena (crates and chests may stay)
      const important = new Set(['merchant', 'shrine', 'fountain', 'anvil', 'cage', 'cursed', 'alchemist', 'ev', 'stairs', 'page']);
      if (!ok || sc.interactables.some((i) => important.has(i.kind) && d.roomId[i.ty * d.w + i.tx] === r.id)) continue;
      const x = r.cx * TS + 8,
        y = r.cy * TS + 8;
      const s = this.prop('ev_obelisk', x, y + 8);
      const g = this.glow(x, y - 8, 0xff3a4a, 1, 0.3);
      sc.tweens.add({ targets: g, alpha: 0.1, yoyo: true, repeat: -1, duration: 800 });
      const t = sc.fx.label(x, y - 16, 'Krvavá výzva', '#ff6a7a', 6);
      t.setDepth(99980).setVisible(false);
      this.add(x, y + 4, { type: 'arena', act: 'Krvavá výzva', mark: '#ff3a4a', room: r, glow: g, label: t }, s);
      sc.lamps.push({ x, y, r: 56, flicker: 2 });
      return true;
    }
    return false;
  }

  private startArena(it: Interactable) {
    const sc = this.sc;
    sc.ui.confirm(
      'Krvavá výzva',
      'Místnost se uzavře a vyrojí se dvě vlny silných nestvůr (víc zdraví, větší poškození, polovina šampionů). Kdo přežije, otevře krvavou truhlu: +300 % šance na legendární kořist.',
      () => {
        if (this.arena || it.used) return;
        it.used = true;
        const ev = it.data.ev as EvState;
        ev.label?.destroy();
        this.seal(it, ev.room as Room);
      },
      'Přijmout výzvu',
      'Raději ne',
    );
  }

  /** red light closes every way out of the room */
  private seal(it: Interactable, room: Room) {
    const sc = this.sc;
    const d = sc.dungeon;
    const m = sc.map;
    const inRoom = new Set(room.cells);
    const sealed: number[] = [];
    const walls: Phaser.GameObjects.GameObject[] = [];
    for (const c of room.cells) {
      const x = c % d.w,
        y = Math.floor(c / d.w);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = (y + dy) * d.w + x + dx;
        if (inRoom.has(n) || d.grid[n] !== T_FLOOR || m.solid[n] || sealed.includes(n)) continue;
        sealed.push(n);
      }
    }
    // nobody of the hero's party gets shut outside
    const p = sc.player;
    const keepIn = (a: { x: number; y: number; setVisible?: (v: boolean) => unknown } | null) => {
      if (!a) return;
      const i = m.idx(Math.floor(a.x / TS), Math.floor(a.y / TS));
      if (!inRoom.has(i)) {
        const q = m.randomFloorNear(p.x, p.y, 16);
        if (q) [a.x, a.y] = q;
      }
    };
    keepIn(sc.pet);
    keepIn(sc.merc);
    for (const n of sealed) {
      m.solid[n] = 1;
      const x = (n % d.w) * TS + 8,
        y = Math.floor(n / d.w) * TS + 8;
      const b = sc.add.sprite(x, y + 8, 'ev_barrier', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.entityBase + y + 8).play('ev_barrier_loop');
      b.setAlpha(0);
      sc.tweens.add({ targets: b, alpha: 0.9, duration: 300 });
      walls.push(b);
      sc.lamps.push({ x, y, r: 26, flicker: 4 });
    }
    sfx('boss');
    sc.fx.shake(0.008, 400);
    sc.fx.ring(it.x, it.y - 10, 80, 0xff3a4a, 700);
    bumpStat(sc.save, 'arenas');
    this.arena = { it, room, sealed, walls, wave: 0, alive: [], total: 0, pending: true };
    sc.ui.banner('Krvavá výzva', 'Přežij dvě vlny!');
    sc.time.delayedCall(900, () => this.arenaWave());
  }

  private arenaWave() {
    const a = this.arena;
    const sc = this.sc;
    if (!a || sc.player.dead) return;
    a.wave++;
    a.pending = false;
    const f = sc.floor;
    const n = a.wave === 1 ? Math.min(10, 6 + Math.floor(f / 15)) : Math.min(8, 5 + Math.floor(f / 20));
    const pool = this.floorPool();
    const cells = a.room.cells.filter((c) => !sc.map.solid[c]);
    const p = sc.player;
    a.alive = [];
    for (let i = 0; i < n; i++) {
      let s: [number, number] | null = null;
      for (let k = 0; k < 16 && !s; k++) {
        const c = pick(cells);
        const x = (c % sc.dungeon.w) * TS + 8,
          y = Math.floor(c / sc.dungeon.w) * TS + 10;
        if (Math.hypot(x - p.x, y - p.y) > 40) s = [x, y];
      }
      if (!s) continue;
      const elite = a.wave === 2 ? i < 2 || Math.random() < 0.3 : Math.random() < 0.3;
      const e = sc.spawnEnemy(pick(pool), s[0], s[1], elite, a.room.id);
      e.maxHp = e.hp = Math.round(e.maxHp * 1.6);
      e.dmg *= 1.35;
      e.xp = Math.round(e.xp * 1.5);
      e.aggro = true;
      e.tag = 'arena';
      a.alive.push(e);
      sc.fx.burst(s[0], s[1] - 6, 0xff3a4a, 12, 'puff');
      sc.fx.ring(s[0], s[1], 18, 0xff3a4a, 400);
    }
    a.total = a.alive.length;
    sfx('summon');
    sc.ui.toast(`Vlna ${a.wave} ze 2!`, '#ff6a7a');
  }

  private updateArena() {
    const a = this.arena!;
    const sc = this.sc;
    const left = a.alive.filter((e) => !e.dead).length;
    sc.ui.eventBar(`🩸 Krvavá výzva · vlna ${Math.max(1, a.wave)}/2 · zbývá ${left}`, a.total ? left / a.total : 1);
    if (a.pending || left > 0) return;
    if (a.wave < 2) {
      // a breath between the waves
      a.pending = true;
      sc.time.delayedCall(1300, () => this.arenaWave());
      return;
    }
    this.endArena();
  }

  /** the blood is paid: the light falls and the chest opens */
  private endArena() {
    const a = this.arena!;
    const sc = this.sc;
    this.arena = null;
    sc.ui.hideEventBar();
    for (const n of a.sealed) sc.map.solid[n] = 0;
    for (const w of a.walls) sc.tweens.add({ targets: w, alpha: 0, duration: 400, onComplete: () => w.destroy() });
    const it = a.it;
    (it.sprite as Phaser.GameObjects.Image).setTexture('ev_obelisk_off');
    (it.data.ev as EvState).glow?.destroy();
    const x = it.x,
      y = it.y + 14;
    const chest = sc.add.image(x, y + 4, 'chest_gold').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 4).setTint(0xff8a8a);
    sc.fx.burst(x, y - 6, 0xff3a4a, 24, 'puff');
    sfx('levelup');
    sc.ui.banner('Výzva splněna!', 'Krvavá truhla je tvoje');
    sc.time.delayedCall(700, () => {
      chest.setTexture('chest_gold_open');
      sfx('chest');
      const f = sc.floor;
      const mf = sc.loot.mf + 300;
      for (let i = 0; i < 3; i++) sc.loot.dropItem(generateItem(f + 2, { magicFind: mf, rarityBonus: 1, filter: sc.loot.bias() }), x, y);
      sc.loot.dropItem(generateItem(f + 2, { rarity: Math.random() < 0.35 ? 4 : 3 }), x, y);
      for (let i = 0; i < 5; i++) sc.loot.dropGold(sc.loot.goldAmount(2), x, y);
      sc.loot.dropRandomGem(x, y, 1);
      sc.loot.dropRandomRune(x, y);
      sc.loot.dropMat('stone', 2, x, y);
      bus.emit('stats');
    });
  }

  // ================================================================== choices with consequences
  placeFateNpc(def?: FateDef) {
    const sc = this.sc;
    const s = sc.save;
    const busy = new Set((s.fates ?? []).map((f) => f.id));
    const pool = FATES.filter((f) => f.minFloor <= sc.floor && !busy.has(f.id));
    const fd = def ?? (pool.length ? pick(pool) : null);
    if (!fd) return false;
    const c = this.spot(8);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    let n: { s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; sh?: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text };
    if (fd.id === 'bottle') {
      const b = sc.add.sprite(x, y + 8, 'ev_bottle', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8).play('ev_bottle_loop');
      const t = sc.fx.label(x, y - 8, 'Lahev s démonem', '#ff8a5a', 6);
      t.setDepth(99980).setVisible(false);
      n = { s: b, t };
      this.glow(x, y - 2, 0xff5a2a, 0.6, 0.3);
    } else {
      const p = this.person(fd.id === 'necro' ? 'npc_necro_tied' : 'npc_knight', x, y, `${fd.name}, ${fd.title}`, fd.id === 'necro' ? '#7dffb0' : '#c8d8ff');
      if (fd.id === 'knight') p.s.setTint(0xd8c8c8);
      n = p;
    }
    this.add(x, y + 4, { type: 'fate', act: fd.id === 'bottle' ? 'Prohlédnout lahev' : `Promluvit: ${fd.name}`, mark: '#ff9ab0', def: fd, n }, n.s);
    sc.lamps.push({ x, y, r: 46, flicker: 1 });
    return true;
  }

  private talkFate(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const fd = ev.def as FateDef;
    const s = sc.save;
    const choices = fd.choices.map((c) => ({ ...c, disabled: fd.id === 'knight' && c.id === 'give' && s.mats.hpPotion <= 0 }));
    sc.ui.panels.talk({ title: fd.name, sub: fd.title, portrait: fd.key === 'demonbottle' ? 'ev_bottle' : fd.key, line: fd.intro, choices }, (id) => this.decide(it, ev, id));
  }

  /** the hero chose: what happens now, and what will come of it later */
  private decide(it: Interactable, ev: EvState, choice: string) {
    const sc = this.sc;
    const fd = ev.def as FateDef;
    const s = sc.save;
    const n = ev.n as { s: Phaser.GameObjects.Sprite; sh?: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text };
    const remember = () => {
      const [a, b] = fateDueIn(fd.id);
      (s.fates ??= []).push({ id: fd.id, choice, at: sc.floor, due: sc.floor + rnd(a, b) });
      saveGame(s);
    };
    const vanish = (color: number) => {
      it.used = true;
      n.t.destroy();
      sc.fx.burst(n.s.x, n.s.y - 8, color, 18, 'puff');
      sc.tweens.add({ targets: [n.s, n.sh].filter(Boolean), alpha: 0, duration: 700, onComplete: () => (n.s.destroy(), n.sh?.destroy()) });
    };
    if (choice === 'leave') {
      it.used = true;
      n.t.setColor('#8a8a8a');
      if (fd.id === 'knight') remember();
      this.say(it.x, it.y - 20, fd.id === 'knight' ? '…chápu. Ať se ti daří.' : fd.id === 'necro' ? 'Pošetilče. Budeš litovat.' : 'Hloupý! Mohl jsi mít všechno!', '#c8c8c8');
      return;
    }
    if (fd.id === 'necro' && choice === 'free') {
      remember();
      this.say(it.x, it.y - 20, 'Nezapomenu na to. Nikdy.', '#7dffb0');
      sc.time.delayedCall(900, () => vanish(0x5dff9a));
      sfx('summon');
      return;
    }
    if (fd.id === 'necro' && choice === 'kill') {
      remember();
      vanish(0x5dff9a);
      sc.fx.shake(0.005, 200);
      sfx('enemyDie');
      sc.loot.dropSpellRune(it.x, it.y);
      for (let i = 0; i < 3; i++) sc.loot.dropGold(sc.loot.goldAmount(1.5), it.x, it.y);
      sc.ui.toast('Nekromant je mrtvý. Jeho grimoár ti zůstal… a jeho kletba visí ve vzduchu.', '#9dff9d');
      return;
    }
    if (fd.id === 'knight' && choice === 'give') {
      if (s.mats.hpPotion <= 0) return;
      s.mats.hpPotion--;
      remember();
      sc.fx.burst(it.x, it.y - 8, 0x52ff8f, 16);
      sfx('heal');
      (n.s as Phaser.GameObjects.Sprite).clearTint();
      this.say(it.x, it.y - 20, 'Díky! Rytíř dluhy splácí.', '#c8d8ff');
      sc.time.delayedCall(1300, () => vanish(0xffffff));
      bus.emit('stats');
      return;
    }
    if (fd.id === 'bottle' && choice === 'break') {
      sc.ui.panels.talk(
        { title: 'Démon', sub: 'jedno přání', portrait: 'ev_bottle', line: '„Svoboda! Tak co si přeješ, můj osvoboditeli? Ale rychle, než si to rozmyslím.“', choices: WISHES.map((w) => ({ id: w.id, label: `${w.label} (${w.desc})`, cls: 'gold' })) },
        (wish) => {
          remember();
          vanish(0xff5a2a);
          sfx('explosion');
          sc.fx.ring(it.x, it.y - 6, 36, 0xff5a2a, 500);
          const f = sc.floor;
          if (wish === 'gold') for (let i = 0; i < 14; i++) sc.loot.dropGold(sc.loot.goldAmount(2), it.x, it.y);
          else if (wish === 'power') sc.loot.dropItem(generateItem(f + 2, { rarity: 4 }), it.x, it.y);
          else {
            s.attrPoints += 3;
            sc.ui.toast('+3 body atributů', '#ffd76a');
            bus.emit('stats');
          }
          sc.ui.toast('Démon se zachechtal a zmizel. „Uvidíme se, až přijde čas splatit dluh…“', '#ff8a5a');
        },
      );
    }
  }

  /** consequences of earlier choices that come due on this floor */
  private placeFates(forcedEvent: boolean) {
    const sc = this.sc;
    const s = sc.save;
    const list = s.fates ?? [];
    if (!list.length || isStoryBossFloor(sc.floor)) return;
    const forced = (window as any).__forceFate as boolean | undefined; // dev testing hook
    const f = list.find((x) => x.due <= sc.floor || forced);
    if (!f || (forcedEvent && !forced)) return;
    s.fates = list.filter((x) => x !== f);
    if (f.id === 'necro' && f.choice === 'free') {
      f.outcome = Math.random() < 0.55 ? 'help' : 'betray';
      if ((window as any).__forceOutcome) f.outcome = (window as any).__forceOutcome;
      if (f.outcome === 'help') this.fateNow = { fate: f, kind: 'necroHelp', t: 0 };
      else this.fateFoe(f, 'necroBetray');
    } else if (f.id === 'necro' && f.choice === 'kill') this.fateFoe(f, 'necroGhost');
    else if (f.id === 'knight' && f.choice === 'give') this.fateNow = { fate: f, kind: 'knightHelp', t: 0 };
    else if (f.id === 'knight' && f.choice === 'leave') this.knightCorpse();
    else if (f.id === 'bottle') this.fateNow = { fate: f, kind: 'demonBack', t: 0 };
    saveGame(s);
  }

  /** an enemy born of a choice waits somewhere on the floor */
  private fateFoe(f: Fate, kind: 'necroBetray' | 'necroGhost' | 'demonFight', at?: { x: number; y: number }) {
    const sc = this.sc;
    const c = at ? null : this.spot(10);
    if (!c && !at) return;
    const x = at ? at.x : c!.x * TS + 8,
      y = at ? at.y : c!.y * TS + 10;
    const room = c ? c.room : sc.dungeon.roomId[sc.map.idx(Math.floor(x / TS), Math.floor(y / TS))] ?? -1;
    let e: Enemy;
    if (kind === 'necroBetray') {
      e = sc.spawnEnemy('darkMage', x, y, true, room, 'npc_necro', 'vyvolávač');
      e.name = 'Morvan Zrádce';
      e.maxHp = e.hp = Math.round(e.maxHp * 7);
      e.dmg *= 1.6;
    } else if (kind === 'necroGhost') {
      e = sc.spawnEnemy(sc.floor >= 201 ? 'shade' : 'ghost', x, y, true, room, 'npc_necro', 'teleportér');
      e.name = 'Morvanův stín';
      e.maxHp = e.hp = Math.round(e.maxHp * 5);
      e.dmg *= 1.4;
      e.sprite.setAlpha(0.75);
      e.baseTint = 0x8a7aba;
      e.sprite.setTint(0x8a7aba);
    } else {
      e = sc.spawnEnemy('orc', x, y, true, room, 'en_demon', 'ohnivý');
      e.name = 'Výběrčí dluhů';
      e.maxHp = e.hp = Math.round(e.maxHp * 5);
      e.dmg *= 1.5;
      e.aggro = true;
    }
    e.setScale(1);
    e.xp = Math.round(e.xp * 4);
    e.tag = 'fate:' + kind;
    e.nameLabel = sc.fx.label(e.x, e.y - 20, `☠ ${e.name}`, kind === 'demonFight' ? '#ff8a5a' : '#9dff9d', 6);
    e.nameLabel.setDepth(99980);
    this.fateNow = { fate: f, kind, t: 0, foe: e };
  }

  /** Bertram was left behind: what remains of him lies on this floor */
  private knightCorpse() {
    const sc = this.sc;
    const c = this.spot(6);
    if (!c) return;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const s = this.prop('ev_corpse', x, y + 5);
    s.setTint(0xc8d0e0);
    this.add(x, y + 2, { type: 'corpse', act: 'Prohledat ostatky', mark: '#c8c8c8', knight: true, lore: { id: 'fate_knight', kind: 'note', title: 'Bertramův vzkaz', text: FATE_LINES.knightDead } }, s);
  }

  /** what a fate does on its floor over time (help on the first fight, the debt collector, foes) */
  private updateFate(dt: number) {
    const fn = this.fateNow!;
    const sc = this.sc;
    const p = sc.player;
    if (fn.done || p.dead) return;
    fn.t += dt;
    if (fn.foe) {
      const e = fn.foe;
      if (e.dead) {
        fn.done = true;
        return;
      }
      if (e.nameLabel) {
        e.nameLabel.setPosition(Math.round(e.x), Math.round(e.y - 15 * e.baseScale));
        e.nameLabel.setVisible(Math.hypot(p.x - e.x, p.y - e.y) < 230);
      }
      if (!e.spotted && Math.hypot(p.x - e.x, p.y - e.y) < 140 && sc.map.los(e.x, e.y, p.x, p.y)) {
        e.spotted = true;
        e.aggro = true;
        sfx('boss');
        sc.fx.shake(0.006, 300);
        sc.ui.banner(`☠ ${e.name}`, FATE_LINES[fn.kind] ?? '');
      }
      return;
    }
    if (fn.kind === 'necroHelp') {
      // he comes when the first fight begins (or after a while anyway)
      const fight = sc.enemies.some((e) => !e.dead && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 140);
      if (!fight && fn.t < 40) return;
      fn.done = true;
      const q = sc.map.randomFloorNear(p.x, p.y, 26) ?? [p.x, p.y];
      const n = this.person('npc_necro', q[0], q[1], 'Morvan', '#7dffb0');
      n.t.setVisible(true);
      sc.fx.burst(q[0], q[1] - 6, 0x5dff9a, 18, 'puff');
      sfx('summon');
      this.say(q[0], q[1] - 22, FATE_LINES.necroHelp, '#7dffb0', 3600);
      const hp = p.d.maxHp * 0.45,
        dmg = Math.max(p.weaponHit(), p.spellBase()) * 0.55;
      for (let i = 0; i < 5; i++) {
        const s = sc.map.randomFloorNear(q[0], q[1], 30);
        if (!s) continue;
        const a = sc.addAlly(i === 0 ? 'boneGolem' : i < 3 ? 'skeleton' : 'skelMage', s[0], s[1], hp * (i === 0 ? 2 : 1), dmg, 75);
        sc.fx.burst(s[0], s[1] - 6, 0x5dff9a, 10, 'puff');
        void a;
      }
      sc.loot.dropSpellRune(q[0], q[1]);
      sc.time.delayedCall(4200, () => {
        sc.fx.burst(n.s.x, n.s.y - 8, 0x5dff9a, 16, 'puff');
        n.s.destroy();
        n.sh.destroy();
        n.t.destroy();
      });
      return;
    }
    if (fn.kind === 'knightHelp') {
      if (fn.t < 1.5 || sc.cinematic) return;
      fn.done = true;
      sc.joinCompanion('Bertram', 'paladin', 'tank', FATE_LINES.knightHelp, 4);
      return;
    }
    if (fn.kind === 'demonBack') {
      if (fn.t < 12 || sc.ui.panel) return;
      fn.done = true;
      const q = sc.map.randomFloorNear(p.x, p.y, 30) ?? [p.x + 20, p.y];
      const d = sc.add.sprite(q[0], q[1] + 3, 'en_demon', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + q[1]);
      if (sc.anims.exists('en_demon_idle')) d.play('en_demon_idle');
      sc.fx.burst(q[0], q[1] - 6, 0xff5a2a, 20, 'puff');
      sfx('boss');
      const price = Math.round(sc.save.gold / 3);
      sc.ui.panels.talk(
        {
          title: 'Démon z lahve',
          sub: 'výběrčí dluhů',
          portrait: 'en_demon',
          line: FATE_LINES.demonBack,
          choices: [
            { id: 'pay', label: `Zaplatit ${price.toLocaleString('cs-CZ')} zlata`, cls: 'gold' },
            { id: 'fight', label: 'Bojovat!', cls: 'red' },
          ],
        },
        (id) => {
          if (id === 'pay') {
            sc.save.gold -= price;
            sfx('coin');
            sc.fx.burst(d.x, d.y - 8, 0xff5a2a, 16, 'puff');
            d.destroy();
            sc.ui.toast('Démon shrábl zlato a s chechtotem zmizel. Dluh je splacen.', '#ff8a5a');
            bus.emit('stats');
          } else {
            const at = { x: d.x, y: d.y - 3 };
            d.destroy();
            this.fateFoe(fn.fate, 'demonFight', at);
            const e = this.fateNow?.foe;
            if (e) {
              e.spotted = true;
              sc.ui.banner('☠ Výběrčí dluhů', 'Tak tvoji kůži!');
            }
          }
        },
      );
    }
  }

  // ================================================================== skeletons playing cards
  placeCards() {
    const sc = this.sc;
    const c = this.spot(8);
    if (!c) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const table = this.prop('table', x, y + 8);
    this.prop('ev_cards', x, y - 1, 0.5).setDepth(D.entityBase + y + 9);
    const l = sc.add.sprite(x - 12, y + 8, 'en_skeleton', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 7);
    const r = sc.add.sprite(x + 12, y + 8, 'en_skeleton', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 7).setFlipX(true);
    if (sc.anims.exists('en_skeleton_idle')) {
      l.play('en_skeleton_idle');
      r.play('en_skeleton_idle');
    }
    const t = sc.fx.label(x, y - 14, 'Kostlivci u karet', '#e8e2cf', 6);
    t.setDepth(99980).setVisible(false);
    this.add(x, y + 10, { type: 'cards', act: 'Přisednout ke hře', mark: '#e8e2cf', games: 0, won: 0, l, r, label: t }, table);
    sc.lamps.push({ x, y, r: 50, flicker: 5 });
    return true;
  }

  private playCards(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const s = sc.save;
    const small = Math.max(10, Math.round(sc.loot.goldAmount(3) / sc.loot.goldMult));
    const big = small * 4;
    sc.ui.panels.talk(
      {
        title: 'Kostlivci u karet',
        sub: `hra ${ev.games + 1} ze 3`,
        portrait: 'en_skeleton',
        line: ev.games === 0 ? '„Hej, živej! Přisedni si. Hrajem o zlato – kdo vyhraje, bere dvojnásobek. Kosti nelžou… většinou.“' : '„Ještě jednu? Kosti se dneska točej!“',
        choices: [
          { id: 'small', label: `Vsadit ${small.toLocaleString('cs-CZ')} zl.`, cls: 'gold', disabled: s.gold < small },
          { id: 'big', label: `Vsadit ${big.toLocaleString('cs-CZ')} zl.`, cls: 'red', disabled: s.gold < big },
          { id: 'no', label: 'Odejít' },
        ],
      },
      (id) => {
        if (id === 'no') return;
        const bet = id === 'big' ? big : small;
        if (s.gold < bet) return;
        ev.games++;
        const win = Math.random() < 0.48;
        if (win) {
          s.gold += bet;
          ev.won++;
          sfx('coin');
          sc.fx.burst(it.x, it.y - 12, 0xffd23a, 14);
          this.say(it.x, it.y - 20, 'Cože?! Zase?!', '#e8e2cf');
          sc.ui.toast(`Výhra! +${bet.toLocaleString('cs-CZ')} zlata`, '#ffd76a');
        } else {
          s.gold -= bet;
          sfx('lockFail');
          this.say(it.x, it.y - 20, 'Chrastí chrastí, zlato je naše!', '#e8e2cf');
          sc.ui.toast(`Prohra… −${bet.toLocaleString('cs-CZ')} zlata`, '#ff8a7a');
        }
        bus.emit('stats');
        if (ev.games >= 3) {
          it.used = true;
          ev.label?.destroy();
          // three losses: the skeletons feel sorry and give a little something
          if (ev.won === 0) {
            sc.loot.dropMat('lockpick', 2, it.x, it.y);
            this.say(it.x, it.y - 26, 'Na, chudáku. Na útěchu.', '#e8e2cf');
          } else this.say(it.x, it.y - 26, 'Dost! Jdem spát.', '#e8e2cf');
        }
      },
    );
  }

  // ================================================================== lore
  placeCorpse() {
    const sc = this.sc;
    const c = this.spot(6);
    if (!c) return false;
    const lore = pickLore(sc.save.lore ?? [], biomeForFloor(sc.floor), 'note');
    if (!lore) return false;
    const x = c.x * TS + 8,
      y = c.y * TS + 8;
    const s = this.prop('ev_corpse', x, y + 5);
    this.add(x, y + 2, { type: 'corpse', act: 'Prohledat ostatky', mark: '#c8c8c8', lore }, s);
    return true;
  }

  /** words cut into the face of a wall in some room */
  placeRunes() {
    const sc = this.sc;
    const d = sc.dungeon;
    const s0 = d.start;
    const hasSecret = sc.interactables.some((i) => i.kind === 'secret' && !i.used);
    const lore = pickLore(sc.save.lore ?? [], biomeForFloor(sc.floor), 'wall', hasSecret);
    if (!lore) return false;
    const busy = new Set(d.objects.map((o) => o.y * d.w + o.x));
    for (const it of sc.interactables) busy.add(it.ty * d.w + it.tx);
    const cand: [number, number][] = [];
    for (let y = 2; y < d.h - 2; y++)
      for (let x = 2; x < d.w - 2; x++) {
        const i = y * d.w + x;
        if (d.grid[i] !== T_WALL || d.grid[i + d.w] !== T_FLOOR || busy.has(i) || busy.has(i + d.w)) continue;
        const rid = d.roomId[i + d.w];
        if (rid < 0 || sc.map.isHidden(x, y + 1) || d.secretWalls.some((sw) => sw.x === x && sw.y === y)) continue;
        if (Math.hypot(x - s0.x, y - s0.y) < 8) continue;
        cand.push([x, y]);
      }
    if (!cand.length) return false;
    const [tx, ty] = pick(cand);
    const x = tx * TS + 8,
      y = ty * TS + 9;
    const s = sc.add.image(x, y, 'ev_runes').setScale(ACTOR_SCALE).setDepth(D.wallDeco + 1);
    const g = this.glow(x, y, 0xffd76a, 0.5, 0.25);
    sc.tweens.add({ targets: g, alpha: 0.08, yoyo: true, repeat: -1, duration: 1400 });
    this.add(x, (ty + 1) * TS + 6, { type: 'runes', act: 'Přečíst nápis', mark: '#ffd76a', lore, glow: g }, s);
    return true;
  }

  private readLore(it: Interactable, ev: EvState) {
    const sc = this.sc;
    const s = sc.save;
    const lore = ev.lore as LoreEntry;
    it.used = true;
    const fresh = !(s.lore ?? []).includes(lore.id);
    if (fresh && !lore.id.startsWith('fate_')) {
      (s.lore ??= []).push(lore.id);
      bumpStat(s, 'lore');
    }
    sfx('pickup');
    sc.ui.panels.note(lore.title, lore.text, ev.type === 'runes' ? 'wall' : 'note', () => {
      if (ev.type === 'runes') {
        ev.glow?.destroy();
        (it.sprite as Phaser.GameObjects.Image).setAlpha(0.6);
        if (lore.secret && !this.hintSecret()) sc.ui.toast('Ten průchod už někdo našel…', '#c8c8c8');
      } else {
        (it.sprite as Phaser.GameObjects.Image).setTexture('ev_corpse_done');
        const f = sc.floor;
        for (let i = 0; i < 2; i++) sc.loot.dropGold(sc.loot.goldAmount(1), it.x, it.y);
        if (ev.knight) sc.loot.dropItem(generateItem(f + 1, { rarity: 3, filter: (b) => b.cat === 'weapon1h' || b.cat === 'weapon2h' }), it.x, it.y);
        else {
          if (Math.random() < 0.4) sc.loot.dropMat(Math.random() < 0.6 ? 'hpPotion' : 'mpPotion', 1, it.x, it.y);
          if (Math.random() < 0.3) sc.loot.dropItem(sc.loot.item(f, 0), it.x, it.y);
          if (Math.random() < 0.1) sc.loot.dropRandomGem(it.x, it.y);
        }
      }
      if (fresh) sc.ui.toast('Zápis uložen do Kroniky (pauza)', '#e8d8b0');
      saveGame(s);
    });
  }

  // ================================================================== the rarest things
  /** a room full of gold */
  placeGolden() {
    const sc = this.sc;
    const d = sc.dungeon;
    const s0 = d.start;
    const rooms = d.rooms.filter((r) => r.type === 'normal' && r.cells.length >= 30 && Math.hypot(r.cx - s0.x, r.cy - s0.y) > 10 && !sc.map.isHidden(r.cx, r.cy));
    if (!rooms.length) return false;
    const room = pick(rooms);
    const busy = new Set(sc.interactables.map((i) => i.ty * d.w + i.tx));
    for (const o of d.objects) busy.add(o.y * d.w + o.x);
    const cells = Phaser.Utils.Array.Shuffle(room.cells.filter((c) => d.grid[c] === T_FLOOR && !busy.has(c)));
    let piles = 0;
    for (const c of cells) {
      const tx = c % d.w,
        ty = Math.floor(c / d.w);
      const x = tx * TS + 8,
        y = ty * TS + 8;
      if (piles < 2) {
        const s = sc.add.image(x, y + 8, 'chest_gold').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8);
        sc.addSparkle(s);
        sc.interactables.push({ kind: 'chest', x, y: y + 4, tx, ty, sprite: s, data: { tier: 'gold', locked: false } });
      } else {
        const s = sc.add.image(x, y, 'goldpile').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 1);
        sc.interactables.push({ kind: 'goldpile', x, y, tx, ty, sprite: s, data: {} });
      }
      if (++piles >= 16) break;
    }
    for (let k = 0; k < 3; k++) {
      const c = pick(room.cells);
      sc.lamps.push({ x: (c % d.w) * TS + 8, y: Math.floor(c / d.w) * TS + 8, r: 70, flicker: 2 });
    }
    this.golden = { room: room.id, found: false };
    return true;
  }

  /** a golden dragon sleeps in a far room */
  placeDragon() {
    const sc = this.sc;
    if (sc.boss) return false;
    const d = sc.dungeon;
    const s0 = d.start;
    const rooms = d.rooms.filter((r) => r.type === 'normal' && r.cells.length >= 48 && Math.hypot(r.cx - s0.x, r.cy - s0.y) > 14 && !sc.map.isHidden(r.cx, r.cy));
    if (!rooms.length) return false;
    const room = pick(rooms);
    const def = { ...BOSSES.find((b) => b.id === 'dragon')!, name: 'Aurex, Zlatý drak', tint: 0xffd23a };
    const e = sc.spawnEnemy('skeleton', room.cx * TS + 8, room.cy * TS + 8, false, room.id, def.sprite);
    e.makeBoss(def, 1, sc.floor + 5);
    e.maxHp = e.hp = Math.round(e.maxHp * 1.2);
    e.name = def.name;
    e.tag = 'secret';
    sc.boss = e;
    this.secret = e;
    return true;
  }

  secretAggro(b: Enemy) {
    const sc = this.sc;
    sfx('boss');
    sc.ui.showBoss(b);
    sc.ui.banner('✦ Aurex, Zlatý drak ✦', 'Tajný strážce – o kterém se jen šeptá');
    sc.fx.shake(0.01, 500);
    bumpStat(sc.save, 'wtf');
  }

  secretKilled(b: Enemy) {
    const sc = this.sc;
    sc.bossDefeated = true;
    sc.ui.hideBoss();
    sc.fx.shake(0.012, 600);
    sc.ui.banner('Zlatý drak padl!', 'Jeho poklad je tvůj');
    const f = sc.floor;
    for (let i = 0; i < 3; i++) sc.loot.dropItem(generateItem(f + 4, { rarity: Math.random() < 0.15 ? 6 : Math.random() < 0.4 ? 5 : 4 }), b.x, b.y);
    for (let i = 0; i < 20; i++) sc.loot.dropGold(sc.loot.goldAmount(3), b.x, b.y);
    for (let i = 0; i < 3; i++) sc.loot.dropRandomGem(b.x, b.y, 2);
    sc.loot.dropRandomRune(b.x, b.y, 2);
    sc.loot.dropSpellRune(b.x, b.y);
    this.secret = null;
    if (sc.boss === b) sc.boss = null;
    for (const e of sc.enemies) if (!e.dead && e.isMinion) sc.combat.killEnemy(e);
    bus.emit('stats');
  }

  private updateRain(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    if (this.rainLeft > 0) {
      this.rainLeft -= dt;
      this.rainTick -= dt;
      if (this.rainTick <= 0) {
        this.rainTick = 0.14;
        const q = sc.map.randomFloorNear(p.x, p.y, 70);
        if (q) {
          sc.loot.dropGold(sc.loot.goldAmount(0.35), q[0], q[1]);
          sc.fx.burst(q[0], q[1] - 30, 0xffd23a, 3);
        }
      }
      return;
    }
    if (this.rainT <= 0) return;
    if (sc.cinematic || sc.ui.panel) return;
    this.rainT -= dt;
    if (this.rainT > 0) return;
    this.rainLeft = 6;
    this.rainTick = 0;
    sfx('coin');
    sc.fx.shake(0.004, 300);
    bumpStat(sc.save, 'wtf');
    sc.ui.banner('✦ Zlatý déšť ✦', 'Ze stropu prší zlato! Sbírej!');
  }

  private rainTick = 0;

  // ================================================================== rifts
  /** the rift floor: monsters to kill, then the guardian; the dream: treasure until you wake up */
  setupRift(kind: RiftKind) {
    const sc = this.sc;
    const d = sc.dungeon;
    if (kind === 'rift') {
      const need = Math.max(12, Math.round(sc.enemies.length * 0.7));
      this.rift = { kind, need, kills: 0, t: 0, total: 150, guard: null, cleared: false };
      return;
    }
    // the dream: golden goblins, chests and gold in every room, a portal home on the far side
    this.rift = { kind, need: 0, kills: 0, t: 75, total: 75, guard: null, cleared: true };
    const s0 = d.start;
    const rooms = d.rooms.filter((r) => Math.hypot(r.cx - s0.x, r.cy - s0.y) > 4);
    const busy = new Set<number>();
    for (const r of rooms) {
      const cells = Phaser.Utils.Array.Shuffle(r.cells.filter((c) => d.grid[c] === T_FLOOR && !sc.map.solid[c]));
      let k = 0;
      for (const c of cells) {
        if (busy.has(c)) continue;
        busy.add(c);
        const tx = c % d.w,
          ty = Math.floor(c / d.w);
        const x = tx * TS + 8,
          y = ty * TS + 8;
        if (k === 0) {
          const tier = Math.random() < 0.35 ? 'gold' : 'iron';
          const s = sc.add.image(x, y + 8, 'chest_' + tier).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8);
          if (tier === 'gold') sc.addSparkle(s);
          sc.interactables.push({ kind: 'chest', x, y: y + 4, tx, ty, sprite: s, data: { tier, locked: false } });
        } else {
          const s = sc.add.image(x, y, 'goldpile').setScale(ACTOR_SCALE).setDepth(D.floorDeco + 1);
          sc.interactables.push({ kind: 'goldpile', x, y, tx, ty, sprite: s, data: {} });
        }
        if (++k >= 4) break;
      }
      if (Math.random() < 0.6) {
        const c = pick(r.cells);
        const e = sc.spawnEnemy('thief', (c % d.w) * TS + 8, Math.floor(c / d.w) * TS + 10, false, r.id);
        void e;
      }
    }
    // the way out
    const far = [...d.rooms].sort((a, b) => Math.hypot(b.cx - s0.x, b.cy - s0.y) - Math.hypot(a.cx - s0.x, a.cy - s0.y))[0];
    if (far) this.exitPortal(far.cx * TS + 8, far.cy * TS + 8, true);
  }

  /** a portal out of the rift (it takes the hero one floor deeper) */
  exitPortal(x: number, y: number, gold: boolean) {
    const sc = this.sc;
    const key = gold ? 'ev_portal_gold' : 'ev_portal';
    const s = sc.add.sprite(x, y + 8, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8).play(key + '_loop');
    s.setAlpha(0);
    sc.tweens.add({ targets: s, alpha: 1, duration: 700 });
    const g = sc.add.image(x, y - 4, 'glow').setTint(gold ? 0xffd23a : 0xb07dff).setAlpha(0.35).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    sc.tweens.add({ targets: g, alpha: 0.15, yoyo: true, repeat: -1, duration: 900 });
    const it: Interactable = { kind: 'stairs', x, y: y + 2, tx: Math.floor(x / TS), ty: Math.floor(y / TS), sprite: s, data: { portal: true } };
    sc.interactables.push(it);
    sc.stairsObj = it;
    sc.lamps.push({ x, y, r: 70, flicker: 1 });
    return it;
  }

  private updateRift(dt: number) {
    const r = this.rift!;
    const sc = this.sc;
    const p = sc.player;
    if (p.dead || sc.cinematic) return;
    if (r.kind === 'dream') {
      r.t -= dt;
      sc.ui.eventBar(`✨ Snový svět · probudíš se za ${Math.max(0, Math.ceil(r.t))} s`, Math.max(0, r.t / r.total));
      if (r.t <= 0 && !sc.descending) {
        sc.ui.hideEventBar();
        sc.cameras.main.flash(500, 255, 240, 200);
        sc.ui.toast('Probouzíš se… o patro hlouběji, s kapsami plnými zlata', '#ffd76a');
        const ex = sc.stairsObj;
        if (ex) {
          p.x = ex.x;
          p.y = ex.y + 8;
        }
        sc.nextFloor();
      }
      return;
    }
    r.t += dt;
    if (r.cleared) return;
    if (!r.guard) {
      const pct = Math.min(1, r.kills / r.need);
      const left = Math.max(0, r.total - r.t);
      sc.ui.eventBar(`🌀 Trhlina · ${Math.round(pct * 100)} %${left > 0 ? ` · bonus za rychlost ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : ''}`, pct);
      if (pct >= 1) this.summonGuard();
    } else sc.ui.eventBar('🌀 Strážce trhliny přichází!', 1);
  }

  private summonGuard() {
    const r = this.rift!;
    const sc = this.sc;
    const p = sc.player;
    let s: [number, number] | null = null;
    for (let k = 0; k < 20 && !s; k++) {
      const q = sc.map.randomFloorNear(p.x, p.y, 70);
      if (q && Math.hypot(q[0] - p.x, q[1] - p.y) > 40 && sc.map.los(p.x, p.y, q[0], q[1]) && !sc.map.collides(q[0], q[1], 10)) s = q;
    }
    s ??= sc.map.randomFloorNear(p.x, p.y, 40) ?? [p.x, p.y - 30];
    const def = pick(BOSSES.filter((b) => b.id !== 'dragon'));
    const e = sc.spawnEnemy('skeleton', s[0], s[1], false, -1, def.sprite);
    e.makeBoss(def, Math.floor(sc.floor / 50), sc.floor);
    e.maxHp = e.hp = Math.round(e.maxHp * 0.7);
    e.name = 'Strážce trhliny';
    e.tag = 'riftGuard';
    r.guard = e;
    sc.boss = e;
    sc.fx.burst(s[0], s[1] - 10, 0xb07dff, 40, 'puff');
    sc.fx.ring(s[0], s[1] - 6, 60, 0xb07dff, 700);
    sc.fx.shake(0.008, 400);
    sfx('boss');
    for (const m of sc.enemies) if (!m.dead && !m.boss && Math.hypot(m.x - p.x, m.y - p.y) > 200) m.aggro = false;
  }

  /** the guardian of the rift is down: rewards and the way out */
  riftCleared(b: Enemy) {
    const r = this.rift!;
    const sc = this.sc;
    r.cleared = true;
    sc.bossDefeated = true;
    sc.ui.hideBoss();
    sc.ui.hideEventBar();
    bumpStat(sc.save, 'rifts');
    const fast = r.t <= r.total;
    sc.ui.banner('Trhlina uzavřena!', fast ? 'Bonus za rychlost: kořist navíc!' : 'Portál tě vynese o patro hlouběji');
    const f = sc.floor;
    const x = b.x,
      y = b.y;
    for (let i = 0; i < 2; i++) sc.loot.dropItem(generateItem(f + 2, { magicFind: sc.loot.mf + 100, rarityBonus: 1, filter: sc.loot.bias() }), x, y);
    sc.loot.dropItem(generateItem(f + 2, { rarity: Math.random() < 0.3 ? 4 : 3 }), x, y);
    if (fast) sc.loot.dropItem(generateItem(f + 3, { rarity: Math.random() < 0.15 ? 5 : 4 }), x, y);
    for (let i = 0; i < 8; i++) sc.loot.dropGold(sc.loot.goldAmount(2), x, y);
    sc.loot.dropRandomGem(x, y, 1);
    sc.loot.dropRandomRune(x, y, 1);
    if (Math.random() < 0.4) sc.loot.dropSpellRune(x, y);
    for (const e of sc.enemies) if (!e.dead && e.isMinion) sc.combat.killEnemy(e);
    let at: [number, number] = [x, y - 20];
    if (sc.map.collides(at[0], at[1], 6)) at = sc.map.randomFloorNear(x, y, 30) ?? [x, y];
    this.exitPortal(at[0], at[1], false);
    bus.emit('stats');
  }

  // ================================================================== runtime
  label(it: Interactable): string {
    return (it.data.ev as EvState).act;
  }

  interact(it: Interactable) {
    const ev = it.data.ev as EvState;
    switch (ev.type) {
      case 'captive':
        return this.freeCaptive(it, ev);
      case 'altarBlood':
        return this.bloodAltar(it);
      case 'altarGift':
        return this.giftAltar(it);
      case 'altarFate':
        return this.fateAltar(it);
      case 'ghost':
        return this.talkGhost(it, ev);
      case 'portal':
      case 'dream':
        return this.enterPortal(ev);
      case 'arena':
        return this.startArena(it);
      case 'fate':
        return this.talkFate(it, ev);
      case 'cards':
        return this.playCards(it, ev);
      case 'corpse':
      case 'runes':
        return this.readLore(it, ev);
    }
  }

  onKill(e: Enemy) {
    const sc = this.sc;
    if (this.rift && this.rift.kind === 'rift' && !e.isMinion) this.rift.kills++;
    if (e.tag === 'murderer') {
      // the ghost waiting for revenge finds its peace
      const it = sc.interactables.find((i) => i.kind === 'ev' && i.data.ev.type === 'ghost' && i.data.ev.murderer === e);
      sc.loot.dropItem(generateItem(sc.floor + 1, { rarity: Math.random() < 0.3 ? 4 : 3, filter: sc.loot.bias() }), e.x, e.y);
      sc.shrineBuffs.push({ id: 'ghost', name: 'Požehnání ducha', mods: { dmgPct: 15, move: 10 }, t: 180, total: 180, color: 0x9fd8ff });
      sc.player.recalc();
      bus.emit('buffs');
      if (it) this.ghostPeace(it, it.data.ev, 'revenge');
      sc.ui.toast('Pomsta je dokonána. Duch odchází v pokoji a jeho požehnání tě provází.', '#bfe4ff');
    } else if (e.tag === 'winner' || e.tag === 'shifter') {
      sc.loot.dropItem(sc.loot.item(sc.floor + 1, 1), e.x, e.y);
      if (e.tag === 'shifter') sc.loot.dropItem(sc.loot.item(sc.floor + 1, 1), e.x, e.y);
    } else if (e.tag?.startsWith('fate:')) {
      const f = sc.floor;
      const kind = e.tag.slice(5);
      sfx('levelup');
      sc.ui.banner(kind === 'demonFight' ? 'Dluh smazán!' : 'Osud naplněn', `${e.name} padl`);
      sc.loot.dropItem(generateItem(f + 2, { rarity: Math.random() < (kind === 'necroBetray' ? 0.5 : 0.4) ? 4 : 3 }), e.x, e.y);
      sc.loot.dropItem(sc.loot.item(f + 1, 1), e.x, e.y);
      for (let i = 0; i < 4; i++) sc.loot.dropGold(sc.loot.goldAmount(2), e.x, e.y);
      if (kind !== 'demonFight') sc.loot.dropSpellRune(e.x, e.y);
    }
  }

  update(dt: number) {
    const sc = this.sc;
    if (this.brawl && !this.brawl.done) this.updateBrawl();
    if (this.arena) this.updateArena();
    if (this.fateNow && !this.fateNow.done) this.updateFate(dt);
    if (this.rift) this.updateRift(dt);
    if (this.rainT > 0 || this.rainLeft > 0) this.updateRain(dt);
    // names over the event monsters follow them
    for (const e of sc.enemies) if (e.tag && e.nameLabel && !e.dead) e.nameLabel.setPosition(Math.round(e.x), Math.round(e.y - 15 * e.baseScale));
    // the golden room is found the moment the hero steps in
    const g = this.golden;
    if (g && !g.found) {
      const p = sc.player;
      if (sc.dungeon.roomId[sc.map.idx(Math.floor(p.x / TS), Math.floor(p.y / TS))] === g.room) {
        g.found = true;
        sfx('levelup');
        sc.fx.shake(0.005, 300);
        bumpStat(sc.save, 'wtf');
        sc.ui.banner('✦ Zlatá komnata ✦', 'Tohle ti doma nikdo neuvěří');
      }
    }
    // names over the events show once their spot is explored; captives call for help
    this.labelT -= dt;
    if (this.labelT <= 0) {
      this.labelT = 0.4;
      for (const it of sc.interactables) {
        if (it.kind !== 'ev' || it.used) continue;
        const ev = it.data.ev as EvState;
        const lab = (ev.label ?? ev.n?.t) as Phaser.GameObjects.Text | undefined;
        if (lab?.active && !lab.visible && sc.map.explored[sc.map.idx(it.tx, it.ty)]) lab.setVisible(true);
      }
    }
    this.callT -= dt;
    if (this.callT <= 0) {
      this.callT = 2.8;
      const p = sc.player;
      for (const it of sc.interactables) {
        if (it.kind !== 'ev' || it.used || it.data.ev.type !== 'captive') continue;
        if (!sc.map.explored[sc.map.idx(it.tx, it.ty)] || Math.hypot(p.x - it.x, p.y - it.y) > 170) continue;
        this.say(it.x, it.y - 20, pick(['Pomoc!', 'Tady! Pomoc!', 'Zachraň mě!', 'Prosím!']), '#ffd76a', 1800);
        // a shapeshifter's eyes flash red now and then
        if (it.data.ev.trap && Math.random() < 0.35) sc.fx.flash(it.data.ev.n.s, 0xff3030, 120);
      }
    }
  }

  /** a brawler hit by the hero turns on the hero */
  onHeroHit(e: Enemy) {
    if (e.faction) e.heroHit = true;
  }
}
