// The pet that travels with the hero: it follows, runs off to fetch loot lying around (it lands at the
// hero's feet), the dog bites and the dragonling spits fire at monsters next to the hero, and every pet
// shows a heart or a "z" now and then. Pets cannot be hurt and monsters ignore them.
import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './entities';
import type { Ground } from './loot';
import { D } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { PetDef, petLevel, petDamageShare } from '../data/pets';
import { petsOf, freeSlots } from '../systems/state';
import { settings } from '../systems/audio';

const FLY = 9;

export class PetFollower {
  scene: GameScene;
  def: PetDef;
  lvl: number;
  x: number;
  y: number;
  facing = 1;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image | null = null;
  lamp: { x: number; y: number; r: number; flicker: number } | null = null;
  private fetch: Ground | null = null;
  private skip = new Set<Ground>();
  private enemy: Enemy | null = null;
  private atkT = 0;
  private lookT = 0;
  private stuckT = 0;
  private restT = 0;
  private emoteT = 4;
  private wander: [number, number] | null = null;
  private side = Math.random() < 0.5 ? -1 : 1;
  private t = Math.random() * 10;
  private lastHero: [number, number] = [0, 0];

  constructor(scene: GameScene, def: PetDef, x: number, y: number) {
    this.scene = scene;
    this.def = def;
    this.lvl = petLevel(petsOf(scene.save), def.id);
    this.x = x;
    this.y = y;
    const key = 'pet_' + def.id;
    this.shadow = scene.add.image(x, y + 2, 'shadow').setDepth(D.floorDeco + 2).setScale(def.flying ? 0.7 : 0.85);
    this.sprite = scene.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(ACTOR_SCALE).play(key + '_idle');
    if (def.id === 'wisp') {
      this.glow = scene.add.image(x, y, 'glow').setTint(0x7ad8ff).setAlpha(0.45).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.glow);
      this.lamp = { x, y, r: 74, flicker: 0 };
      scene.lamps.push(this.lamp);
    }
    this.lastHero = [scene.player.x, scene.player.y];
    this.sync(false);
  }

  /** a little symbol above the pet's head */
  emote(text: string, color = this.def.color) {
    const sc = this.scene;
    sc.fx.number(this.x, this.y - (this.def.flying ? this.flyH : 0) - 14, text, color);
  }

  /** jumps to the hero (stuck behind a wall or left far behind) */
  private blink() {
    const p = this.scene.player;
    const spot = this.scene.map.randomFloorNear(p.x - p.facing * 12, p.y + 2, 14) ?? [p.x, p.y];
    this.scene.fx.burst(this.x, this.y - 4, 0xcfd6dc, 6, 'puff');
    [this.x, this.y] = spot;
    this.scene.fx.burst(this.x, this.y - 4, 0xffffff, 6, 'puff');
    this.fetch = null;
    this.stuckT = 0;
  }

  update(dt: number) {
    const sc = this.scene;
    const p = sc.player;
    this.t += dt;
    this.atkT -= dt;
    this.lookT -= dt;
    this.emoteT -= dt;
    const dHero = Math.hypot(p.x - this.x, p.y - this.y);
    if (dHero > 240) this.blink();
    // the hero standing still for a while: the pet settles down (and dozes off)
    const heroMoved = Math.hypot(p.x - this.lastHero[0], p.y - this.lastHero[1]) > 0.5;
    this.lastHero = [p.x, p.y];
    this.restT = heroMoved ? 0 : this.restT + dt;

    let goal: [number, number] | null = null;
    let speed = Math.max(78, p.d.move * 1.25);
    // 1. a fighting pet goes for monsters close to the hero
    if (this.def.fights && !p.dead) {
      if (this.lookT <= 0 || !this.enemy || this.enemy.dead) {
        this.enemy = sc.nearestEnemy(p.x, p.y, this.def.fights === 'fire' ? 125 : 90, true);
        if (this.enemy?.def.behavior === 'thief' && this.enemy.st.stunT <= 0 && !this.enemy.aggro) this.enemy = null;
      }
      const e = this.enemy;
      if (e && !e.dead) {
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        const reach = this.def.fights === 'fire' ? 95 : e.r * e.baseScale + 8;
        this.facing = e.x >= this.x ? 1 : -1;
        if (d > reach) goal = [e.x - this.facing * (reach - 4), e.y];
        else if (this.atkT <= 0) this.attack(e);
      }
    }
    // 2. loot lying around goes to the hero
    if (!goal) {
      if (this.lookT <= 0 && !this.fetch) this.fetch = this.findLoot();
      const g = this.fetch;
      if (g && !g.dead) {
        const d = Math.hypot(g.x - this.x, g.y - this.y);
        if (d < 7) this.grab(g);
        else {
          goal = [g.x, g.y];
          speed *= 1.15;
        }
      } else this.fetch = null;
    }
    if (this.lookT <= 0) this.lookT = 0.3;
    // 3. otherwise stay close behind the hero, or potter about when the hero rests
    if (!goal) {
      if (this.slotT <= 0 || heroMoved) this.slot = this.pickSlot();
      this.slotT -= dt;
      const slot = this.slot;
      const dSlot = Math.hypot(slot[0] - this.x, slot[1] - this.y);
      if (this.restT > 2.5 && dHero < 40) {
        if (!this.wander || Math.random() < dt * 0.15) this.wander = sc.map.randomFloorNear(p.x, p.y + 4, 26);
        if (this.wander && Math.hypot(this.wander[0] - this.x, this.wander[1] - this.y) > 3) {
          goal = this.wander;
          speed = 34;
        }
      } else {
        this.wander = null;
        if (dSlot > (heroMoved ? 6 : 18)) goal = slot;
        if (dSlot < 40) speed = Math.min(speed, Math.max(30, dSlot * 3));
      }
    }
    let moving = false;
    if (goal) moving = this.moveTo(goal[0], goal[1], speed, dt);
    else if (!this.enemy || this.enemy.dead) {
      if (Math.abs(p.x - this.x) > 4) this.facing = p.x > this.x ? 1 : -1;
    }
    // hearts and naps
    if (this.emoteT <= 0) {
      this.emoteT = 5 + Math.random() * 6;
      if (this.restT > 14) this.emote('z', '#c8d8ff');
      else if (this.restT > 3 && Math.random() < 0.35) this.emote('♥');
    }
    this.sync(moving, dt);
  }

  private slot: [number, number] = [0, 0];
  private slotT = 0;

  /** a free spot next to the hero: behind them, else beside, else in front (never inside a wall) */
  private pickSlot(): [number, number] {
    const sc = this.scene;
    const p = sc.player;
    const f = p.facing;
    this.slotT = 0.5;
    const tries: [number, number][] = [
      [-f * 13 + this.side * 3, 4 + this.side * 2],
      [-f * 10, 11],
      [-f * 10, -7],
      [0, 12],
      [f * 12, 9],
      [f * 12, -6],
    ];
    for (const [dx, dy] of tries) {
      const x = p.x + dx,
        y = p.y + dy;
      if (!sc.map.collides(x, y, 4) && sc.map.los(p.x, p.y, x, y)) return [x, y];
    }
    return [p.x - f * 8, p.y + 4];
  }

  private moveTo(gx: number, gy: number, speed: number, dt: number) {
    const sc = this.scene;
    const dx = gx - this.x,
      dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return false;
    const step = Math.min(d, speed * dt);
    this.facing = dx >= 0 ? 1 : -1;
    if (this.def.flying) {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      return true;
    }
    let dir: [number, number] = [dx / d, dy / d];
    // around corners the way to the hero is known (the monsters' flow field); other goals go straight
    if (!sc.map.los(this.x, this.y, gx, gy)) {
      const f = sc.map.flowDir(this.x, this.y);
      if (f && !this.fetch) dir = f;
    }
    const [nx, ny] = sc.map.move(this.x, this.y, dir[0] * step, dir[1] * step, 3);
    const moved = Math.abs(nx - this.x) + Math.abs(ny - this.y) > 0.05;
    this.x = nx;
    this.y = ny;
    this.stuckT = moved ? 0 : this.stuckT + dt;
    if (this.stuckT > 1) {
      // can't reach it: leave that loot and come back
      if (this.fetch) this.skip.add(this.fetch);
      this.fetch = null;
      if (this.stuckT > 2.5) this.blink();
    }
    return moved;
  }

  private findLoot(): Ground | null {
    const sc = this.scene;
    const p = sc.player;
    const now = sc.time.now;
    const full = freeSlots(p.save) === 0;
    let best: Ground | null = null,
      bd = Infinity;
    for (const g of sc.loot.ground) {
      if (g.dead || now < g.ready || this.skip.has(g)) continue;
      // gold and materials close to the hero fly to them by themselves
      const dh = Math.hypot(g.x - p.x, g.y - p.y);
      if (dh > 150 || (g.kind !== 'item' && dh < 40)) continue;
      // a full bag only takes what is salvaged on pickup
      if (g.kind === 'item' && full && !(g.item!.rarity < settings.autoSalvage && !sc.loot.isUpgrade(g.item!))) continue;
      const d = Math.hypot(g.x - this.x, g.y - this.y);
      if (d < bd && (this.def.flying || sc.map.los(this.x, this.y, g.x, g.y) || d < 40)) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  /** picks the loot up: it flies to the hero, who gets it */
  private grab(g: Ground) {
    const sc = this.scene;
    const p = sc.player;
    this.fetch = null;
    this.skip.add(g);
    sc.fx.burst(g.x, g.y - 3, 0xffffff, 4, 'pix');
    g.label?.setVisible(false);
    g.beam?.setVisible(false);
    sc.tweens.add({
      targets: g.sprite,
      x: p.x,
      y: p.y - 4,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (g.dead) return;
        sc.loot.pickup(g);
        // the bag was full after all: it stays at the hero's feet
        if (!g.dead) {
          g.label?.setVisible(true).setPosition(g.sprite.x, g.sprite.y - 7);
          g.beam?.setVisible(true).setPosition(g.sprite.x, g.sprite.y + 2);
        }
      },
    });
    if (Math.random() < 0.25) this.emote('♥');
  }

  private attack(e: Enemy) {
    const sc = this.scene;
    const p = sc.player;
    const share = petDamageShare(this.lvl);
    const dmg = ((p.d.dmgMin + p.d.dmgMax) / 2) * share * (0.85 + Math.random() * 0.3);
    if (this.def.fights === 'fire') {
      this.atkT = 1.5;
      const y0 = this.y - this.flyH - 5;
      sc.spawnAllyProjectile(this.x + this.facing * 5, y0, Math.atan2(e.y - 6 - y0, e.x - this.x), 'pr_fire', dmg * 1.15, 'fire');
    } else {
      this.atkT = 0.95;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      sc.fx.slash(this.x + Math.cos(a) * 6, this.y - 3 + Math.sin(a) * 6, a, 7, 0xffffff, 80);
      sc.combat.damageEnemy(e, dmg, { el: 'phys', fromAlly: true });
      sc.tweens.add({ targets: this.sprite, x: this.sprite.x + Math.cos(a) * 3, duration: 70, yoyo: true });
    }
  }

  /** height of a flyer above the floor (an owl or a dragonling lands when the hero rests) */
  private flyH = FLY;

  private sync(moving: boolean, dt = 0) {
    const key = 'pet_' + this.def.id;
    let fly = 0;
    let anim = moving ? '_walk' : '_idle';
    if (this.def.flying) {
      const land = this.def.id !== 'wisp' && !moving && this.restT > 6;
      this.flyH += ((land ? 0 : FLY) - this.flyH) * Math.min(1, dt * 3);
      fly = this.flyH + (this.flyH > 2 ? Math.sin(this.t * 3) * 1.5 : 0);
      // in the air the wings beat (slowly while hovering); sitting on the floor they are folded
      anim = this.flyH > 2 ? '_walk' : '_idle';
      this.sprite.anims.timeScale = this.flyH > 2 ? (moving ? 1.3 : 0.6) : 1;
    }
    const want = key + anim;
    if (this.sprite.anims.currentAnim?.key !== want) this.sprite.play(want, true);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + 2 - fly));
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setDepth(D.entityBase + this.y + (this.def.flying ? 20 : 0));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y + 2));
    if (this.glow) this.glow.setPosition(this.x, this.y - fly - 4).setAlpha(0.38 + Math.sin(this.t * 5) * 0.08);
    if (this.lamp) {
      this.lamp.x = this.x;
      this.lamp.y = this.y - fly;
    }
  }

  setVisible(on: boolean) {
    this.sprite.setVisible(on);
    this.shadow.setVisible(on);
    this.glow?.setVisible(on);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.glow?.destroy();
    if (this.lamp) this.scene.lamps = this.scene.lamps.filter((l) => l !== this.lamp);
  }
}
