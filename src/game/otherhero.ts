// Another player's hero, drawn from what its game sends fifteen times a second: where it stands, the frame of
// its animation and how its weapons sit. In the host's game a guest's hero is also a target for the monsters:
// blows that land on it go over to that guest's game, which applies its own armour, dodge and thorns.
import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { Actor, Enemy } from './entities';
import type { Player } from './player';
import { D } from './fx';
import { Net, PeerInfo, SLOT_COLORS, SLOT_CSS } from '../net/net';
import type { Element } from '../data/types';

/** a weapon in hand: texture, offset from the hero, rotation, origin, depth offset, scale, flip and alpha */
export type WeaponSnap = [string, number, number, number, number, number, number, number, number, number, number];

export interface HeroSnap {
  x: number;
  y: number;
  /** frame of the hero strip, flipped, alpha, texture */
  f: number;
  fl: number;
  a: number;
  k: string;
  w: WeaponSnap | 0;
  o: WeaponSnap | 0;
  hp: number;
  mhp: number;
  lvl: number;
  dead: number;
  /** the trail it wears (bought with pearls; each game draws it by itself) */
  tr?: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function weaponSnap(img: Phaser.GameObjects.Image, p: Player, depth: number): WeaponSnap | 0 {
  if (!img.visible) return 0;
  return [img.texture.key, r1(img.x - p.x), r1(img.y - p.y), r2(img.rotation), r2(img.originX), r2(img.originY), r2(img.depth - depth), r2(img.scaleX), r2(img.scaleY), img.flipX ? 1 : 0, r2(img.alpha)];
}

/** what this game's hero looks like right now (sent to the other game) */
export function heroSnap(p: Player): HeroSnap {
  const s = p.sprite;
  const n = s.frame?.name as unknown;
  const f = typeof n === 'number' ? n : parseInt(String(n), 10) || 0;
  return {
    x: r1(p.x),
    y: r1(p.y),
    f,
    fl: s.flipX ? 1 : 0,
    a: r2(s.alpha),
    k: s.texture.key,
    w: p.weapon ? weaponSnap(p.weapon, p, s.depth) : 0,
    o: p.offhand ? weaponSnap(p.offhand, p, s.depth) : 0,
    hp: Math.round(p.hp),
    mhp: Math.round(p.d.maxHp),
    lvl: p.save.level,
    dead: p.dead ? 1 : 0,
    tr: p.save.pearl?.trail ?? undefined,
  };
}

export class OtherHero extends Actor {
  info: PeerInfo;
  /** the player's place (0 the host): its colour and where its blows go */
  slot: number;
  /** where the other game says the hero stands (the sprite glides there) */
  tx: number;
  ty: number;
  lvl = 1;
  /** seconds since the other game last told where the hero is */
  quietT = 0;
  /** its speed from the last two words (it keeps walking between them) */
  private nvx = 0;
  private nvy = 0;
  /** the latest word from its game (the host passes it on to the other guests) */
  last: HeroSnap | null = null;
  private weapon: Phaser.GameObjects.Image | null = null;
  private offhand: Phaser.GameObjects.Image | null = null;
  private label: Phaser.GameObjects.Text;
  private ring: Phaser.GameObjects.Image;
  private bar: Phaser.GameObjects.Graphics;

  constructor(scene: GameScene, info: PeerInfo, slot: number, x: number, y: number) {
    super(scene, x, y, 'pl_' + info.cls);
    this.info = info;
    this.slot = slot;
    this.tx = x;
    this.ty = y;
    this.r = 4;
    this.maxHp = this.hp = 1;
    this.sprite.anims.stop();
    // a ring on the floor and the name above in the player's colour tell the heroes apart
    this.ring = scene.add.image(x, y + 3, 'ring').setTint(SLOT_COLORS[slot] ?? SLOT_COLORS[1]).setAlpha(0.75).setScale(16 / 256, 8 / 256).setDepth(D.floorDeco + 2);
    this.label = scene.fx.label(x, y - 22, info.name, SLOT_CSS[slot] ?? SLOT_CSS[1], 6);
    this.bar = scene.add.graphics().setDepth(D.bright + 5);
  }

  /** the latest word from the other game */
  /** seconds between the last two words */
  private quietT0 = 0;
  apply(s: HeroSnap) {
    this.last = s;
    this.quietT0 = this.quietT;
    this.quietT = 0;
    // a jump (stairs, a teleport, waking up elsewhere) is not glided over
    if (Math.hypot(s.x - this.x, s.y - this.y) > 80) {
      this.x = s.x;
      this.y = s.y;
    }
    const gap = this.quietT0;
    if (gap > 0.02 && gap < 0.4) {
      const vx = (s.x - this.tx) / gap,
        vy = (s.y - this.ty) / gap;
      if (Math.hypot(vx, vy) < 320) {
        this.nvx = this.nvx * 0.35 + vx * 0.65;
        this.nvy = this.nvy * 0.35 + vy * 0.65;
      } else this.nvx = this.nvy = 0;
    } else this.nvx = this.nvy = 0;
    this.tx = s.x;
    this.ty = s.y;
    this.hp = s.hp;
    this.maxHp = Math.max(1, s.mhp);
    this.lvl = s.lvl;
    const wasDead = this.dead;
    this.dead = !!s.dead;
    if (this.dead !== wasDead) this.sprite.setAngle(this.dead ? 90 * this.facing : 0);
  }

  tick(dt: number) {
    this.quietT += dt;
    const k = Math.min(1, dt * 16);
    const age = Math.min(0.12, this.quietT);
    const dx = this.tx + this.nvx * age - this.x,
      dy = this.ty + this.nvy * age - this.y;
    this.x += dx * k;
    this.y += dy * k;
    const s = this.last;
    const sc = this.scene;
    this.sprite.setPosition(sc.snap(this.x), sc.snap(this.y + 3));
    this.shadow.setPosition(sc.snap(this.x), sc.snap(this.y + 3));
    this.sprite.setDepth(D.entityBase + this.y);
    this.ring.setPosition(this.x, this.y + 3);
    if (s) {
      if (this.sprite.texture.key !== s.k && sc.textures.exists(s.k)) this.sprite.setTexture(s.k);
      this.sprite.setFrame(s.f);
      this.sprite.setFlipX(!!s.fl);
      this.facing = s.fl ? -1 : 1;
      this.sprite.setAlpha(this.dead ? 0.5 : s.a);
      this.weapon = this.placeWeapon(this.weapon, s.w);
      this.offhand = this.placeWeapon(this.offhand, s.o);
    }
    this.ring.setAlpha(this.dead ? 0.25 : 0.75);
    const name = `${this.info.name} · ${this.lvl}`;
    if (this.label.text !== name) this.label.setText(name);
    this.label.setPosition(this.x, this.y - 21);
    if (!this.dead && s?.tr) sc.trailStep(this, s.tr);
    // a small health bar under the name
    const g = this.bar;
    g.clear();
    const w = 18,
      frac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.7).fillRect(this.x - w / 2 - 0.5, this.y - 20.5, w + 1, 3);
    g.fillStyle(this.dead ? 0x777777 : frac < 0.3 ? 0xff4a4a : 0x5dff8a, 1).fillRect(this.x - w / 2, this.y - 20, w * frac, 2);
  }

  private placeWeapon(img: Phaser.GameObjects.Image | null, w: WeaponSnap | 0) {
    if (!w || this.dead) {
      img?.setVisible(false);
      return img;
    }
    const sc = this.scene;
    if (!sc.textures.exists(w[0])) return img;
    if (!img) img = sc.add.image(0, 0, w[0]);
    else if (img.texture.key !== w[0]) img.setTexture(w[0]);
    img.setVisible(true).setPosition(this.sprite.x + w[1], this.sprite.y - 3 + w[2]).setRotation(w[3]).setOrigin(w[4], w[5]).setDepth(this.sprite.depth + w[6]).setScale(w[7], w[8]).setFlipX(!!w[9]).setAlpha(w[10]);
    return img;
  }

  /** a monster's blow lands on a guest's hero (only in the host's game): that guest's game takes it from here */
  takeDamage(amount: number, el: Element = 'phys', src?: Enemy | null, fx?: { poison?: number; chill?: number; burn?: number }) {
    if (this.dead || amount <= 0) return;
    Net.eventTo(this.slot, { k: 'hurt', d: Math.round(amount * 10) / 10, el, foe: src?.id ?? 0, n: src?.name ?? '', ...fx });
    this.scene.fx.flash(this.sprite, 0xff6060, 60);
  }

  destroyAll() {
    this.destroyVisuals();
    this.weapon?.destroy();
    this.offhand?.destroy();
    this.label.destroy();
    this.ring.destroy();
    this.bar.destroy();
  }
}
