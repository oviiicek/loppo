import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Enemy } from './entities';
import { D } from './fx';
import { Item, Slot } from '../data/types';
import { generateItem, generateSetItem, itemColor, RARITIES, itemIcon, BASE_BY_ID, BaseType, salvageResult, isTwoHanded } from '../data/items';
import { SET_MIN_FLOOR } from '../data/sets';
import { addToInventory, Materials, maxStat, bumpStat, derive, equipItem, SaveData, addGem } from '../systems/state';
import { gemIcon, gemName, parseGem, randomGem } from '../data/gems';
import { sfx, settings } from '../systems/audio';
import { bus } from '../systems/events';
import { iconURL } from '../gfx/textures';

export type MatKey = keyof Materials;

export const MAT_INFO: Record<MatKey, { name: string; icon: string; color: string }> = {
  hpPotion: { name: 'Lektvar zdraví', icon: 'ic_hpPotion', color: '#ff6060' },
  mpPotion: { name: 'Lektvar many', icon: 'ic_mpPotion', color: '#60a0ff' },
  lockpick: { name: 'Paklíč', icon: 'ic_lockpick', color: '#e9d27a' },
  stone: { name: 'Kámen vylepšení', icon: 'ic_stone', color: '#7cc8ff' },
  dust: { name: 'Magický prach', icon: 'ic_dust', color: '#c8a8ff' },
};

export interface Ground {
  kind: 'item' | 'gold' | 'mat' | 'gem';
  item?: Item;
  mat?: MatKey;
  gem?: string;
  amount: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  beam?: Phaser.GameObjects.Image;
  ready: number;
  dead: boolean;
  warned?: boolean;
}

export class Loot {
  scene: GameScene;
  ground: Ground[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  get mf() {
    const sc = this.scene;
    return sc.player.d.magicFind + sc.shrineBuffs.reduce((a, b) => a + (b.mf ?? 0), 0) + (sc.mod?.mf ?? 0) + sc.diff.mf;
  }

  get goldMult() {
    const sc = this.scene;
    const p = sc.player;
    return (1 + p.d.gold / 100 + (p.d.specials.has('goldRush') ? 0.6 : 0) + sc.shrineBuffs.reduce((a, b) => a + (b.mf ?? 0) / 100, 0) + (sc.mod?.gold ?? 0)) * sc.diff.gold;
  }

  // "smart loot": some drops favour the weapon type / slots the player actually uses
  bias(): ((b: BaseType) => boolean) | undefined {
    const p = this.scene.player;
    const main = p.save.equip.main ? BASE_BY_ID[p.save.equip.main.base] : null;
    const r = Math.random();
    if (main && r < 0.3) return (b) => !!b.attack && b.attack === main.attack;
    if (r < 0.45) {
      // an empty equipment slot gets priority
      const empty = (['helmet', 'chest', 'pants', 'belt', 'boots', 'amulet', 'bracer'] as const).filter((sl) => !p.save.equip[sl]);
      if (!p.save.equip.ring1 || !p.save.equip.ring2) (empty as string[]).push('ring');
      if (empty.length) {
        const pick = empty[Math.floor(Math.random() * empty.length)] as string;
        return (b) => b.cat === pick;
      }
    }
    return undefined;
  }

  item(ilvl: number, rarityBonus = 0) {
    const it = generateItem(ilvl, { magicFind: this.mf, rarityBonus, filter: this.bias() });
    // from floor 10 on, some legendary finds are pieces of an item set
    if (it.rarity >= 4 && this.scene.floor >= SET_MIN_FLOOR && Math.random() < 0.3) return generateSetItem(ilvl);
    return it;
  }

  goldAmount(mult = 1) {
    const f = this.scene.floor;
    return Math.max(1, Math.round((2 + f * 1.6 + Math.random() * (3 + f)) * mult * this.goldMult));
  }

  enemyDrops(e: Enemy) {
    const f = this.scene.floor;
    const x = e.x,
      y = e.y;
    const potMult = this.scene.player.d.specials.has('goldRush') ? 2 : 1;
    if (e.boss) {
      const n = 3 + e.bossTier;
      for (let i = 0; i < n; i++) this.dropItem(this.item(f + 1, 2), x, y);
      if (f >= SET_MIN_FLOOR && Math.random() < 0.12) this.dropItem(generateSetItem(f + 1), x, y);
      for (let i = 0; i < 2; i++) this.dropRandomGem(x, y, 1);
      for (let i = 0; i < 6; i++) this.dropGold(this.goldAmount(4), x, y);
      this.dropMat('stone', 2 + Math.floor(f / 10), x, y);
      this.dropMat('dust', 2 + Math.floor(f / 10), x, y);
      this.dropMat('hpPotion', 2, x, y);
      return;
    }
    if (e.def.behavior === 'thief') {
      for (let i = 0; i < 9; i++) this.dropGold(this.goldAmount(3), x, y);
      this.dropRandomGem(x, y);
      this.dropItem(this.item(f + 1, 2), x, y);
      if (Math.random() < 0.5) this.dropItem(this.item(f + 1, 1), x, y);
      this.dropMat('dust', 1 + Math.floor(f / 15), x, y);
      if (Math.random() < 0.5) this.dropMat('lockpick', 1, x, y);
      return;
    }
    if (e.elite) {
      this.dropItem(this.item(f, 1), x, y);
      if (Math.random() < 0.1) this.dropRandomGem(x, y);
      if (Math.random() < 0.35) this.dropItem(this.item(f), x, y);
      this.dropGold(this.goldAmount(2.5), x, y);
      if (Math.random() < 0.4) this.dropMat(Math.random() < 0.6 ? 'hpPotion' : 'mpPotion', 1, x, y);
      if (Math.random() < 0.25) this.dropMat('stone', 1, x, y);
      return;
    }
    const minion = e.isMinion ? 0.35 : 1;
    if (Math.random() < 0.11 * minion) this.dropItem(this.item(f), x, y);
    if (Math.random() < 0.4 * minion) this.dropGold(this.goldAmount(), x, y);
    if (Math.random() < 0.04 * minion * potMult) this.dropMat(Math.random() < 0.65 ? 'hpPotion' : 'mpPotion', 1, x, y);
    if (Math.random() < 0.018 * minion) this.dropMat('lockpick', 1, x, y);
    if (Math.random() < 0.03 * minion) this.dropMat('stone', 1, x, y);
    if (Math.random() < 0.02 * minion) this.dropMat('dust', 1, x, y);
    if (Math.random() < 0.01 * minion) this.dropRandomGem(x, y);
  }

  /** a beaten nemesis: a legendary (or a set piece), more items, gems and a heap of gold */
  nemesisDrops(x: number, y: number, kills: number) {
    const f = this.scene.floor;
    const set = f >= SET_MIN_FLOOR && Math.random() < 0.35;
    this.dropItem(set ? generateSetItem(f + 2) : generateItem(f + 2, { rarity: kills >= 3 && Math.random() < 0.5 ? 5 : 4, filter: this.bias() }), x, y);
    for (let i = 0; i < 1 + Math.min(3, kills); i++) this.dropItem(this.item(f + 2, 2), x, y);
    for (let i = 0; i < 2 + Math.min(2, kills - 1); i++) this.dropRandomGem(x, y, 1);
    for (let i = 0; i < 8; i++) this.dropGold(this.goldAmount(3 + kills), x, y);
    this.dropMat('dust', 2 + Math.floor(f / 12), x, y);
    this.dropMat('stone', 1 + Math.floor(f / 15), x, y);
  }

  chestDrops(tier: string, x: number, y: number) {
    const f = this.scene.floor;
    const mf = this.mf;
    const potMult = this.scene.player.d.specials.has('goldRush') ? 2 : 1;
    let nItems = 1,
      bonus = 0,
      goldMult = 2;
    if (tier === 'wood') {
      nItems = Math.random() < 0.5 ? 1 : 2;
    } else if (tier === 'iron') {
      nItems = 2 + (Math.random() < 0.3 ? 1 : 0);
      bonus = Math.random() < 0.5 ? 1 : 0;
      goldMult = 3;
    } else if (tier === 'gold') {
      nItems = 3 + (Math.random() < 0.4 ? 1 : 0);
      bonus = 1 + (Math.random() < 0.3 ? 1 : 0);
      goldMult = 6;
    } else if (tier === 'boss') {
      nItems = 3;
      bonus = 2;
      goldMult = 8;
    }
    if (this.scene.mod?.chestBonus) bonus = Math.min(3, bonus + 1);
    for (let i = 0; i < nItems; i++) {
      const it = generateItem(f + (tier === 'boss' ? 2 : 0), { magicFind: mf, rarityBonus: bonus, filter: this.bias() });
      if (tier === 'boss' && i === 0 && it.rarity < 3) {
        // boss chest guarantees an epic or better
        const better = generateItem(f + 2, { rarity: Math.random() < 0.15 ? 5 : Math.random() < 0.4 ? 4 : 3 });
        this.dropItem(better, x, y);
        continue;
      }
      this.dropItem(it, x, y);
    }
    for (let i = 0; i < 3; i++) this.dropGold(this.goldAmount(goldMult / 3), x, y);
    if (Math.random() < 0.35 * potMult) this.dropMat(Math.random() < 0.6 ? 'hpPotion' : 'mpPotion', 1, x, y);
    if (Math.random() < (tier === 'wood' ? 0.15 : 0.3)) this.dropMat('lockpick', 1, x, y);
    if (Math.random() < (tier === 'wood' ? 0.2 : 0.5)) this.dropMat('stone', tier === 'gold' || tier === 'boss' ? 2 : 1, x, y);
    if (tier !== 'wood' && Math.random() < 0.5) this.dropMat('dust', tier === 'gold' || tier === 'boss' ? 2 : 1, x, y);
    // gems: rare in wooden chests, a sure one in a guardian's chest
    if (Math.random() < ({ wood: 0.04, iron: 0.12, gold: 0.3, boss: 1 } as Record<string, number>)[tier]) this.dropRandomGem(x, y, tier === 'boss' ? 1 : 0);
  }

  private popTo(obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, x: number, y: number): [number, number] {
    const sc = this.scene;
    let tx = x,
      ty = y;
    // loot from a monster inside a wall (ghosts) falls next to the player instead
    if (sc.map.collides(x, y, 3)) {
      x = tx = sc.player.x;
      y = ty = sc.player.y;
    }
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * Math.PI * 2,
        r = 8 + Math.random() * 18;
      const nx = x + Math.cos(a) * r,
        ny = y + Math.sin(a) * r;
      if (!sc.map.collides(nx, ny, 3)) {
        tx = nx;
        ty = ny;
        break;
      }
    }
    sc.tweens.add({ targets: obj, x: tx, duration: 380, ease: 'Linear' });
    sc.tweens.add({ targets: obj, y: { from: y - 4, to: ty }, duration: 380, ease: 'Bounce.easeOut' });
    return [tx, ty];
  }

  dropItem(it: Item, x: number, y: number) {
    const sc = this.scene;
    const s = sc.add.image(x, y, itemIcon(it)).setScale(0.55).setDepth(D.entityBase + y - 2);
    const [tx, ty] = this.popTo(s, x, y);
    const col = itemColor(it);
    const g: Ground = { kind: 'item', item: it, amount: 1, x: tx, y: ty, sprite: s, ready: sc.time.now + 450, dead: false };
    if (it.rarity >= 1) {
      g.beam = sc.add.image(tx, ty + 2, 'beam').setOrigin(0.5, 1).setTint(Phaser.Display.Color.HexStringToColor(col).color).setAlpha(it.rarity >= 3 ? 0.7 : 0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setScale(it.rarity >= 4 ? 1.2 : 0.8, it.rarity >= 3 ? 1 : 0.6);
      sc.tweens.add({ targets: g.beam, alpha: g.beam.alpha * 0.5, yoyo: true, repeat: -1, duration: 700 });
    }
    sc.time.delayedCall(400, () => {
      if (g.dead) return;
      g.label = sc.fx.label(tx, ty - 7, it.name, col, 6, true);
      this.unclutter(g.label);
    });
    this.ground.push(g);
  }

  // move a new label up until it does not overlap other item labels
  unclutter(t: Phaser.GameObjects.Text) {
    const others = this.ground.filter((o) => o.label && o.label !== t && !o.dead).map((o) => o.label!);
    for (let i = 0; i < 8; i++) {
      const hit = others.some((o) => Math.abs(o.x - t.x) < (o.displayWidth + t.displayWidth) / 2 + 2 && Math.abs(o.y - t.y) < t.displayHeight);
      if (!hit) break;
      t.y -= t.displayHeight;
    }
  }

  dropGold(amount: number, x: number, y: number) {
    const sc = this.scene;
    const s = sc.add.sprite(x, y, 'coin').play('coin_loop').setDepth(D.entityBase + y - 2);
    const [tx, ty] = this.popTo(s, x, y);
    this.ground.push({ kind: 'gold', amount, x: tx, y: ty, sprite: s, ready: sc.time.now + 350, dead: false });
  }

  /** a gem on the floor: a small sparkling stone (picked up into the gem pouch) */
  dropGem(key: string, x: number, y: number) {
    const sc = this.scene;
    const g = parseGem(key);
    if (!g) return;
    const s = sc.add.image(x, y, gemIcon(key)).setScale(0.6).setDepth(D.entityBase + y - 2);
    const [tx, ty] = this.popTo(s, x, y);
    const col = Phaser.Display.Color.HexStringToColor(g.def.color).color;
    const beam = sc.add.image(tx, ty + 2, 'beam').setOrigin(0.5, 1).setTint(col).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow).setScale(0.6, 0.5);
    sc.tweens.add({ targets: beam, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
    this.ground.push({ kind: 'gem', gem: key, amount: 1, x: tx, y: ty, sprite: s, beam, ready: sc.time.now + 400, dead: false });
  }

  /** a random gem fitting the depth (bonus: grades above the usual) */
  dropRandomGem(x: number, y: number, bonus = 0) {
    this.dropGem(randomGem(this.scene.floor, bonus), x, y);
  }

  dropMat(mat: MatKey, amount: number, x: number, y: number) {
    const sc = this.scene;
    const s = sc.add.image(x, y, MAT_INFO[mat].icon).setScale(0.45).setDepth(D.entityBase + y - 2);
    const [tx, ty] = this.popTo(s, x, y);
    this.ground.push({ kind: 'mat', mat, amount, x: tx, y: ty, sprite: s, ready: sc.time.now + 400, dead: false });
  }

  update(dt: number) {
    const sc = this.scene;
    const p = sc.player;
    if (p.dead) return;
    const now = sc.time.now;
    for (const g of this.ground) {
      if (g.dead || now < g.ready) continue;
      // sprite may have tweened – take its position
      g.x = g.sprite.x;
      g.y = g.sprite.y;
      const dx = p.x - g.x,
        dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (g.kind !== 'item' && d < 46) {
        // magnet
        const sp = 160 * dt;
        g.sprite.x += (dx / (d || 1)) * Math.min(sp, d);
        g.sprite.y += (dy / (d || 1)) * Math.min(sp, d);
      }
      if (d < 10) this.pickup(g);
      else if (g.kind === 'item' && d > 30) g.warned = false;
    }
    if (this.ground.some((g) => g.dead)) this.ground = this.ground.filter((g) => !g.dead);
  }

  pickup(g: Ground) {
    const sc = this.scene;
    const p = sc.player;
    if (g.kind === 'gold') {
      p.save.gold += g.amount;
      bumpStat(p.save, 'goldEarned', g.amount);
      sfx('coin');
      sc.fx.number(p.x, p.y - 20, '+' + g.amount, '#ffd23a');
    } else if (g.kind === 'gem') {
      addGem(p.save, g.gem!);
      maxStat(p.save, 'bestGem', parseGem(g.gem!)?.tier ?? 1);
      sfx('pickup');
      sc.ui.loot(gemName(g.gem!), parseGem(g.gem!)?.def.color ?? '#fff', iconURL(gemIcon(g.gem!), 32));
    } else if (g.kind === 'mat') {
      p.save.mats[g.mat!] += g.amount;
      sfx('pickup');
      sc.ui.loot(`+${g.amount} ${MAT_INFO[g.mat!].name}`, MAT_INFO[g.mat!].color, iconURL(MAT_INFO[g.mat!].icon, 32));
    } else if (g.item && g.item.rarity < settings.autoSalvage && !this.isUpgrade(g.item)) {
      // auto-salvage weak items straight into materials
      const r = salvageResult(g.item);
      p.save.gold += r.gold;
      p.save.mats.dust += r.dust;
      p.save.mats.stone += r.stones;
      sfx('coin');
      sc.fx.number(p.x, p.y - 20, '+' + r.gold, '#ffd23a');
    } else if (g.item) {
      if (!addToInventory(p.save, g.item)) {
        if (!g.warned) {
          sc.ui.toast('Inventář je plný!', '#ff6060');
          g.warned = true;
        }
        return;
      }
      sfx('pickup');
      maxStat(p.save, 'bestRarity', g.item.rarity);
      bumpStat(p.save, 'items');
      sc.onItemPicked(g.item);
      sc.ui.newItems++;
      sc.ui.loot(g.item.name + (this.isUpgrade(g.item) ? '  ▲' : ''), itemColor(g.item), iconURL(itemIcon(g.item), 32));
    }
    g.dead = true;
    g.sprite.destroy();
    g.label?.destroy();
    g.beam?.destroy();
    bus.emit('stats');
  }

  // would equipping this item raise damage output, armour or HP? (cheap estimate on a copy)
  isUpgrade(it: Item) {
    try {
      const s = this.scene.save;
      // weapons only count when they keep the current fighting style (melee / ranged / magic)
      const base = BASE_BY_ID[it.base];
      const main = s.equip.main ? BASE_BY_ID[s.equip.main.base] : null;
      if (base.attack && main?.attack && base.attack !== main.attack) return false;
      // anything beats an empty slot
      const e = s.equip;
      if (base.cat === 'ring' && (!e.ring1 || !e.ring2)) return true;
      if (['helmet', 'chest', 'pants', 'belt', 'boots', 'amulet', 'bracer'].includes(base.cat) && !e[base.cat as Slot]) return true;
      if ((base.cat === 'shield' || base.cat === 'offhand') && !e.off && !isTwoHanded(e.main)) return true;
      const inv = s.inventory.slice();
      let idx = inv.findIndex((x) => x?.uid === it.uid);
      // an item still lying on the floor is tried from an extra virtual slot
      if (idx < 0) idx = inv.push(it) - 1;
      const before = derive(s);
      // equipItem only rearranges equip/inventory, so shallow copies of those are enough
      const clone: SaveData = { ...s, equip: { ...s.equip }, inventory: inv };
      bus.muted = true;
      const err = equipItem(clone, idx);
      bus.muted = false;
      if (err) return false;
      const after = derive(clone);
      const dps = (d: typeof before) => ((d.dmgMin + d.dmgMax) / 2) * d.aps * (1 + (d.crit / 100) * (d.critDmg / 100 - 1)) * (d.attack === 'magic' ? 1 : 1);
      const score = (d: typeof before) => dps(d) / Math.max(1, dps(before)) + d.armor / Math.max(10, before.armor) * 0.35 + d.maxHp / before.maxHp * 0.35 + d.spellMult / before.spellMult * 0.3;
      return score(after) > score(before) * 1.02;
    } catch {
      bus.muted = false;
      return false;
    }
  }

  clear() {
    for (const g of this.ground) {
      g.sprite.destroy();
      g.label?.destroy();
      g.beam?.destroy();
    }
    this.ground = [];
  }
}
