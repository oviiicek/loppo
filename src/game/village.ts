import Phaser from 'phaser';
import type { GameScene, Interactable, MerchantStock } from '../scenes/GameScene';
import { TS } from './map';
import { D } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { sfx } from '../systems/audio';
import { BUILDINGS, BuildingDef, BuildingId, BUILDING_BY_ID, PLOTS, VILLAGE_GATE, VILLAGE_WELL, buildingLevel, villageOf, villagerDue, shopSize, activeBlessing, BLESSING_BY_ID } from '../data/village';
import { generateItem } from '../data/items';

// The village of Loppo above the dungeon: the hero's home between the descents. The houses of the
// villagers the hero brought back stand around the square; the others are still ruins.

export const ROMAN = ['', 'I', 'II', 'III'];

/** what the villagers say when the hero walks by */
const CHATTER: Record<BuildingId, string[]> = {
  stash: [],
  smithy: ['Ocel se kuje, dokud je žhavá!', 'Přines kámen, udělám z toho zázrak.', 'Ten meč by chtěl nabrousit…'],
  shop: ['Čerstvé zboží, čerstvě vykopané!', 'Pro tebe zvláštní cena. Skoro.', 'Kdo nekoupí, ten neví, o co přišel!'],
  board: ['Na nástěnce je nová práce!', 'Lidé v Loppu potřebují pomoc.', 'Stopy vedou dolů. Vždycky dolů.'],
  lab: ['Nedotýkej se té zelené baňky!', 'Pět za jedno – to je alchymie.', 'Cítíš to? To je pokrok. Nebo síra.'],
  tower: ['Runy šeptají, když se jim naslouchá.', 'Hmm? Ach, to jsi ty.', 'Hvězdy dnes stojí příznivě. Asi.'],
  trainer: ['Kryt nahoru! Nohy pevně!', 'Každá kapka potu je ušetřená kapka krve.', 'Tvůj žoldák by potřeboval trénink.'],
  temple: ['Světlo tě provází.', 'I ve tmě se dá najít naděje.', 'Kletba je jen zkouška víry.'],
};

/** what Ilda says (besides news of the village) */
const ILDA_LINES = [
  'Pečeť drží, dokud ji někdo drží. Teď jsi to ty.',
  'Elara byla vždycky odvážnější než moudrá. Doufám, že ty máš obojí.',
  'Dole se čas chová divně. Nezapomeň, kde je domov.',
  'Lucerna, kterou nosíš, svítila mému otci i dědovi. Ať svítí i tobě.',
  'Když Nyx\'thar šeptá, neposlouchej. Mluví hezky, ale lže.',
  'Pětice spoutala zlo, ale nezabila ho. Tohle je jejich dluh – a teď i náš.',
];

export class Village {
  sc: GameScene;
  /** the shop's goods for this visit */
  shop: MerchantStock | null = null;
  /** the houses, their labels and their keepers (to refresh after an upgrade) */
  houses = new Map<BuildingId, { label: Phaser.GameObjects.Text; npc?: Phaser.GameObjects.Sprite; it: Interactable }>();
  private chatT = 5;
  private smokeT = 0;

  constructor(sc: GameScene) {
    this.sc = sc;
  }

  place() {
    const sc = this.sc;
    for (const b of BUILDINGS) this.placeBuilding(b);
    // the gate down into the dungeon
    const g = VILLAGE_GATE;
    const gx = g.x * TS + 8,
      gy = (g.y - 1) * TS + 8;
    const st = sc.add.image(gx, gy, 'stairs').setScale(ACTOR_SCALE).setDepth(D.floorDeco);
    const gate: Interactable = { kind: 'stairs', x: gx, y: gy + 4, tx: g.x, ty: g.y - 1, sprite: st, data: { village: true } };
    sc.interactables.push(gate);
    sc.stairsObj = gate;
    sc.lamps.push({ x: gx, y: gy, r: 70, flicker: 0 });
    // the well and Ilda beside it
    const w = VILLAGE_WELL;
    const wx = w.x * TS + 16,
      wy = (w.y + 1) * TS;
    sc.add.image(wx, wy, 'vh_well').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + wy);
    this.solid(w.x, w.y, w.x + 1, w.y);
    sc.interactables.push({ kind: 'vwell', x: wx, y: wy + 6, tx: w.x, ty: w.y + 1, data: {} });
    const ix = (w.x + 3) * TS + 8,
      iy = (w.y + 1) * TS + 8;
    const ilda = sc.add.sprite(ix, iy + 6, 'npc_ilda', 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + iy + 6).play('npc_ilda_idle');
    ilda.setFlipX(true);
    sc.add.image(ix, iy + 6, 'shadow').setDepth(D.floorDeco + 2);
    const il = sc.fx.label(ix, iy - 15, 'Ilda', '#ffd76a', 6);
    il.setDepth(99980);
    sc.interactables.push({ kind: 'vilda', x: ix, y: iy + 6, tx: w.x + 3, ty: w.y + 1, sprite: ilda, data: {} });
    sc.lamps.push({ x: ix, y: iy, r: 46, flicker: 3 });
    // trees in the corners, lanterns along the main way
    for (const [tx, ty] of [
      [5, 6],
      [40, 6],
      [4, 15],
      [41, 15],
      [5, 27],
      [40, 27],
      [22, 27],
    ]) {
      if (sc.map.tileAt(tx, ty) !== 1) continue;
      sc.add.image(tx * TS + 8, (ty + 1) * TS, 'vh_tree').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + (ty + 1) * TS);
      this.solid(tx, ty, tx, ty);
    }
    for (const [tx, ty] of [
      [19, 7],
      [25, 7],
      [19, 19],
      [26, 19],
      [11, 15],
      [34, 15],
    ]) {
      const x = tx * TS + 8,
        y = (ty + 1) * TS;
      sc.add.image(x, y, 'vh_lamp').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y);
      const glow = sc.add.image(x, y - 22, 'glow').setTint(0xffc060).setAlpha(0.3).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.lamps.push({ x, y: y - 12, r: 64, flicker: tx, glow });
    }
    // the whole square is known at once
    sc.map.revealAll();
    this.shop = this.makeShop();
    // the notice board offers new work on every visit
    villageOf(sc.save).offers = [];
  }

  /** tiles nobody can walk through (houses, the well, tree trunks) */
  private solid(x0: number, y0: number, x1: number, y1: number) {
    const m = this.sc.map;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.solid[m.idx(x, y)] = 1;
  }

  private placeBuilding(b: BuildingDef) {
    const sc = this.sc;
    const p = PLOTS[b.id];
    const lv = buildingLevel(sc.save, b.id);
    const x = p.x * TS + 8,
      y = (p.y + 1) * TS;
    this.solid(p.x - 1, p.y - 1, p.x + 1, p.y);
    if (lv <= 0) {
      sc.add.image(x, y, 'vh_ruins').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y);
      const label = sc.fx.label(x, y - 34, `${b.name} · v troskách`, '#9a94a8', 6);
      label.setDepth(99980);
      const it: Interactable = { kind: 'vb', x, y: y + 6, tx: p.x, ty: p.y + 1, data: { id: b.id, ruined: true } };
      sc.interactables.push(it);
      this.houses.set(b.id, { label, it });
      return;
    }
    const house = sc.add.image(x, y, 'vh_house_' + b.id).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y);
    const top = y - house.displayHeight;
    const label = sc.fx.label(x, top + 2, `${b.name} ${ROMAN[lv]}`, b.color, 6);
    label.setDepth(99980);
    // warm light from the windows
    sc.lamps.push({ x, y: y - 14, r: 58, flicker: p.x });
    const nx = x + 22,
      ny = y + 9;
    let npc: Phaser.GameObjects.Sprite | undefined;
    if (b.who) {
      npc = sc.add.sprite(nx, ny + 6, b.who.key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + ny + 6).play(b.who.key + '_idle');
      npc.setFlipX(true);
      sc.add.image(nx, ny + 6, 'shadow').setDepth(D.floorDeco + 2);
      const nl = sc.fx.label(nx, ny - 15, b.who.name, '#f0e6d0', 6);
      nl.setDepth(99980);
    }
    // what stands by each house
    if (b.id === 'smithy') {
      sc.add.image(x - 22, y + 10, 'anvil').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 10);
      const glow = sc.add.image(x, y - 8, 'glow').setTint(0xff7a1a).setAlpha(0.35).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.tweens.add({ targets: glow, alpha: 0.18, yoyo: true, repeat: -1, duration: 400 });
    } else if (b.id === 'lab') {
      sc.add.image(x - 22, y + 10, 'cauldron').setOrigin(0.5, 1).setDepth(D.entityBase + y + 10);
      sc.add.image(x - 22, y + 4, 'glow').setTint(0x5dff9a).setAlpha(0.3).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    } else if (b.id === 'board') {
      sc.add.image(x - 24, y + 8, 'vh_board').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8);
    } else if (b.id === 'trainer') {
      for (const dx of [-26, -36]) sc.add.image(x + dx, y + 12, 'vh_dummy').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 12);
    } else if (b.id === 'tower') {
      const glow = sc.add.image(x, y - 46, 'glow').setTint(0xc77dff).setAlpha(0.3).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      sc.tweens.add({ targets: glow, alpha: 0.12, yoyo: true, repeat: -1, duration: 1200 });
    } else if (b.id === 'temple') {
      sc.add.image(x, y - 30, 'glow').setTint(0xfff2a8).setAlpha(0.22).setScale(1).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
    } else if (b.id === 'stash') {
      sc.add.image(x + 22, y + 8, 'chest_iron').setOrigin(0.5, 1).setScale(ACTOR_SCALE).setDepth(D.entityBase + y + 8);
    }
    const it: Interactable = { kind: 'vb', x: b.who ? nx : x + 22, y: (b.who ? ny : y + 8) + 6, tx: p.x + 1, ty: p.y + 1, sprite: npc, data: { id: b.id } };
    sc.interactables.push(it);
    this.houses.set(b.id, { label, npc, it });
  }

  /** a building grew: its sign shows the new level */
  refresh(id: BuildingId) {
    const h = this.houses.get(id);
    const b = BUILDING_BY_ID[id];
    if (!h) return;
    const lv = buildingLevel(this.sc.save, id);
    h.label.setText(`${b.name} ${ROMAN[lv]}`);
    const sc = this.sc;
    sc.fx.ring(h.it.x - 22, h.it.y - 30, 50, 0xffd23a, 700);
    sc.fx.burst(h.it.x - 22, h.it.y - 30, 0xffd23a, 30);
    sfx('levelup');
  }

  /** the shop's goods: more and better as it grows */
  makeShop(): MerchantStock {
    const sc = this.sc;
    const st = sc.makeStock();
    const lv = buildingLevel(sc.save, 'shop');
    const f = sc.floor;
    st.items = [];
    for (let i = 0; i < shopSize(sc.save); i++) {
      const legendary = lv >= 3 && Math.random() < 0.1;
      st.items.push(
        generateItem(f + Math.floor(Math.random() * 3), {
          magicFind: 30 + lv * 20,
          rarity: legendary ? 4 : undefined,
          rarityBonus: lv >= 2 && Math.random() < 0.4 ? 1 : Math.random() < 0.25 ? 1 : 0,
          filter: i < 4 ? sc.loot.bias() : undefined,
        }),
      );
    }
    return st;
  }

  label(it: Interactable): string {
    if (it.kind === 'vilda') return 'Promluvit s Ildou';
    if (it.kind === 'vwell') return 'Napít se ze studny';
    const b = BUILDING_BY_ID[it.data.id as BuildingId];
    if (it.data.ruined) return `${b.name} (v troskách)`;
    return b.who ? `${b.name}: ${b.who.name}` : b.name;
  }

  interact(it: Interactable) {
    const sc = this.sc;
    if (it.kind === 'vwell') {
      const p = sc.player;
      p.hp = p.d.maxHp;
      p.mp = p.d.maxMp;
      sfx('heal');
      sc.fx.burst(p.x, p.y - 6, 0x7cc8ff, 18);
      sc.ui.toast('Voda z Loppa chutná jako domov. Zdraví i mana jsou plné.', '#7cc8ff');
      return;
    }
    if (it.kind === 'vilda') return this.talkIlda();
    sc.ui.buildings.open(it.data.id as BuildingId);
  }

  /** Ilda tells how the village is doing and who is still missing */
  talkIlda() {
    const sc = this.sc;
    const s = sc.save;
    const v = villageOf(s);
    const home = BUILDINGS.filter((b) => b.who && (v.lv[b.id] ?? 0) > 0).length;
    const all = BUILDINGS.filter((b) => b.who).length;
    const due = villagerDue(s, s.maxFloor);
    const next = BUILDINGS.find((b) => b.who && !v.lv[b.id]);
    let news: string;
    if (home >= all) news = 'Všichni jsou doma. Loppo zase žije – a to díky tobě.';
    else if (due) news = `${due.who!.name} (${due.who!.trade}) je pořád dole. Prý ${due.who!.fem ? 'ji' : 'ho'} drží nestvůry někde od ${due.rescue}. patra.`;
    else if (next) news = `Někde hlouběji, od ${next.rescue}. patra, prý drží ${next.who!.fem ? 'naši' : 'našeho'} ${next.who!.trade === 'kupkyně' ? 'kupkyni' : next.who!.trade} ${next.who!.name}.`;
    else news = '';
    const bl = activeBlessing(s);
    const line = `Zachránění: ${home} z ${all}. ${news} ${bl ? `Požehnání chrámu (${BLESSING_BY_ID[bl.id].name}) tě chrání do ${bl.until}. patra.` : ''}`.trim();
    sc.ui.panels.talk(
      { title: 'Ilda', sub: 'strážkyně pečeti', portrait: 'npc_ilda', line: `${line} ${ILDA_LINES[Math.floor(Math.random() * ILDA_LINES.length)]}`, choices: [{ id: 'ok', label: 'Díky, Ildo', cls: 'green' }] },
      () => {},
    );
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    // smoke from the smithy's chimney
    this.smokeT -= dt;
    if (this.smokeT <= 0 && buildingLevel(sc.save, 'smithy') > 0) {
      this.smokeT = 0.5;
      const pl = PLOTS.smithy;
      sc.fx.burst(pl.x * TS + 8 + 13, (pl.y + 1) * TS - 46, 0x8a8a96, 1, 'puff');
    }
    // the villagers talk to the hero walking by
    this.chatT -= dt;
    if (this.chatT > 0 || sc.ui.panel) return;
    this.chatT = 4 + Math.random() * 3;
    for (const [id, h] of this.houses) {
      const lines = CHATTER[id];
      if (!h.npc || !lines.length || Math.hypot(p.x - h.npc.x, p.y - h.npc.y) > 80) continue;
      const t = sc.fx.label(h.npc.x, h.npc.y - 26, lines[Math.floor(Math.random() * lines.length)], '#f0e6d0', 6, true);
      t.setDepth(99985);
      sc.tweens.add({ targets: t, y: t.y - 6, alpha: { from: 1, to: 0 }, delay: 2400, duration: 500, onComplete: () => t.destroy() });
      break;
    }
  }
}
