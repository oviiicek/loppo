// The hired companion in the dungeon: follows the hero, fights by its order (attack / defend / follow),
// uses its role's skill (taunt, heals, a volley of arrows, a frost wave), can be hurt by monsters and is
// knocked out at zero health (it gets up again after a while, or on the next floor).
import Phaser from 'phaser';
import { mercTraining } from '../data/village';
import type { GameScene } from '../scenes/GameScene';
import { Actor, Enemy } from './entities';
import { D, EL_COLOR } from './fx';
import { ACTOR_SCALE } from '../gfx/textures';
import { heroHand, heroHandB } from '../gfx/heroes';
import { MercState, MercDef, MERC_BY_ROLE, mercStats, MercStats, mercLook } from '../data/mercs';
import { BASE_BY_ID, itemTier } from '../data/items';
import { sfx } from '../systems/audio';

const DOWN_TIME = 35;

export class Mercenary extends Actor {
  state: MercState;
  def: MercDef;
  s!: MercStats;
  atkT = 0.5;
  skillT = 5;
  healT = 0;
  bigHealT = 0;
  /** seconds since it was last hurt (it heals up out of combat) */
  calmT = 0;
  /** knocked out: seconds until it gets up */
  downT = 0;
  target: Enemy | null = null;
  private lookT = 0;
  private stuckT = 0;
  private weapon: Phaser.GameObjects.Image | null = null;
  private shieldImg: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Image;
  private swingT = 0;
  private aim = 0;
  private slot: [number, number] = [0, 0];
  private slotT = 0;
  private side = Math.random() < 0.5 ? -1 : 1;
  private recalcT = 1;
  /** a wandering adventurer: walks from room to room on its own and fights what it meets */
  roam = false;
  private path: [number, number][] = [];
  private pathT = 0;
  /** set when it leaves the floor (an adventurer knocked out or going away) */
  gone = false;
  /** a seasoned adventurer has more health and shrugs off part of every blow */
  hpMult = 1;
  dmgTaken = 1;
  /** rarity of the gift a companion of one floor leaves at the stairs (random when missing) */
  giftRarity?: number;
  private roamTime = 0;

  constructor(scene: GameScene, st: MercState, x: number, y: number) {
    const def = MERC_BY_ROLE[st.role];
    super(scene, x, y, 'pl_' + (st.look ?? mercLook(def, scene.save.cls)));
    this.state = st;
    this.def = def;
    this.r = 4;
    // a ring of its colour on the floor tells it apart from the hero
    this.ring = scene.add.image(x, y + 3, 'ring').setTint(Phaser.Display.Color.HexStringToColor(def.color).color).setAlpha(0.5).setScale(16 / 256, 8 / 256).setDepth(D.floorDeco + 2);
    this.recalc(true);
    this.makeWeapons();
    this.sprite.play(this.spriteKey + '_idleA');
  }

  /** stats from the role, the hero and the gear (full health on request) */
  recalc(full = false) {
    const p = this.scene.player;
    const frac = this.maxHp > 1 ? this.hp / this.maxHp : 1;
    this.s = mercStats(this.state, p.save.level, p.d.maxHp);
    // the hired mercenary trains at Loppo's training ground (wandering adventurers do not)
    if (!this.state.temp) {
      const t = mercTraining(p.save);
      this.s.dmg *= t;
      this.s.maxHp = Math.round(this.s.maxHp * t);
    }
    this.maxHp = Math.round(this.s.maxHp * this.hpMult);
    this.hp = full ? this.maxHp : Math.max(1, Math.round(this.maxHp * frac));
  }

  /** the weapon (and the tank's shield) it holds: its own, or a plain one of its role */
  makeWeapons() {
    this.weapon?.destroy();
    this.shieldImg?.destroy();
    const w = this.state.equip.weapon;
    const base = w ? w.base : this.def.weapon;
    this.weapon = this.scene.add.image(this.x, this.y, `wp_${base}_t${w ? itemTier(w) : 0}`).setOrigin(0.5, 0.85).setScale(ACTOR_SCALE);
    if (this.def.shield) {
      const a = this.state.equip.armor;
      const tier = a && a.base === 'shield' ? itemTier(a) : 0;
      this.shieldImg = this.scene.add.image(this.x, this.y, `wp_shield_t${tier}`).setScale(0.8 * ACTOR_SCALE);
    }
  }

  get down() {
    return this.downT > 0;
  }

  /** a monster's blow (or an arrow) */
  takeDamage(amount: number) {
    if (this.down || this.dead) return;
    const sc = this.scene;
    let dmg = amount * sc.diff.enemyDmg;
    if (this.s.block > 0 && Math.random() * 100 < this.s.block) {
      dmg *= 0.25;
      sc.fx.burst(this.x + this.facing * 4, this.y - 6, 0xc8d0d8, 4);
    }
    dmg *= 1 - this.s.armor / (this.s.armor + 50 + 12 * sc.floor);
    // the tank shrugs off a part of every blow
    if (this.def.role === 'tank') dmg *= 0.8;
    dmg *= this.dmgTaken;
    this.hp -= dmg;
    this.calmT = 0;
    sc.fx.flash(this.sprite, 0xff6060, 60);
    if (this.hp <= 0) this.knockOut();
  }

  heal(amount: number, show = true) {
    if (this.down || amount <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (show && got >= 1) this.scene.fx.number(this.x, this.y - 18, '+' + got, '#5dff8a');
  }

  private knockOut() {
    const sc = this.scene;
    if (this.state.temp) {
      // an adventurer met in the dungeon does not lie there: they drink a potion and leave through a portal
      sc.ui.toast(`${this.state.name} ${this.state.fem ? 'utekla' : 'utekl'} portálem z boje`, '#c8a8ff');
      this.leave();
      return;
    }
    this.hp = 0;
    this.downT = DOWN_TIME;
    this.target = null;
    this.state.downs = (this.state.downs ?? 0) + 1;
    sc.fx.burst(this.x, this.y - 6, 0xcccccc, 12, 'puff');
    this.sprite.anims.stop();
    this.sprite.setAngle(90 * this.facing).setAlpha(0.55);
    this.weapon?.setVisible(false);
    this.shieldImg?.setVisible(false);
    sc.ui.toast(`${this.state.name} padl${this.def.role === 'healer' && /a$/.test(this.state.name) ? 'a' : ''} – za chvíli se zvedne`, '#ff9a8a');
  }

  private getUp() {
    const sc = this.scene;
    this.downT = 0;
    this.hp = this.maxHp * 0.5;
    this.sprite.setAngle(0).setAlpha(1);
    this.weapon?.setVisible(true);
    this.shieldImg?.setVisible(true);
    const p = sc.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) > 120) this.blink();
    sc.fx.burst(this.x, this.y - 6, 0x6dff7a, 10);
  }

  /** goes away through a portal (gone from the floor) */
  leave() {
    if (this.gone) return;
    this.gone = true;
    const sc = this.scene;
    sc.fx.burst(this.x, this.y - 6, 0xb07dff, 18, 'puff');
    sc.fx.ring(this.x, this.y - 4, 20, 0xb07dff, 400);
    sfx('stairs');
    this.dead = true;
    this.destroyVisuals();
  }

  /** jumps to the hero (stuck, or left far behind) */
  private blink() {
    const p = this.scene.player;
    const spot = this.scene.map.randomFloorNear(p.x - p.facing * 14, p.y + 3, 16) ?? [p.x, p.y];
    this.scene.fx.burst(this.x, this.y - 6, 0xcfd6dc, 6, 'puff');
    [this.x, this.y] = spot;
    this.scene.fx.burst(this.x, this.y - 6, 0xffffff, 6, 'puff');
    this.stuckT = 0;
  }

  update(dt: number) {
    if (this.dead) return;
    const sc = this.scene;
    const p = sc.player;
    if (this.down) {
      this.downT -= dt;
      if (this.downT <= 0) this.getUp();
      this.sync(false);
      return;
    }
    this.updateStatus(dt);
    this.atkT -= dt;
    this.skillT -= dt;
    this.healT -= dt;
    this.bigHealT -= dt;
    this.lookT -= dt;
    this.calmT += dt;
    if (this.swingT > 0) this.swingT -= dt;
    // the hero's level and health change: so do its numbers
    this.recalcT -= dt;
    if (this.recalcT <= 0) {
      this.recalcT = 1;
      this.recalc();
    }
    // health: its regeneration, and much faster out of combat
    const regen = this.s.regen + (this.calmT > 4 ? this.maxHp * 0.04 : 0);
    if (regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    const dHero = Math.hypot(p.x - this.x, p.y - this.y);
    if (dHero > 260 && !this.roam) this.blink();
    // knockback
    if (Math.abs(this.knockX) + Math.abs(this.knockY) > 0.5) {
      [this.x, this.y] = sc.map.move(this.x, this.y, this.knockX * dt, this.knockY * dt, this.r);
      this.knockX *= 0.82;
      this.knockY *= 0.82;
    }
    if (this.stunned || p.dead) {
      this.sync(false);
      return;
    }
    // the healer looks after the hero first
    if (this.def.role === 'healer') this.healing();
    if (this.lookT <= 0) {
      this.lookT = 0.35;
      this.target = this.pickTarget();
    }
    let goal: [number, number] | null = null;
    let speed = Math.max(this.s.move, p.d.move * 1.15);
    const t = this.target;
    if (t && !t.dead) {
      const dx = t.x - this.x,
        dy = t.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.aim = Math.atan2(t.y - 6 - (this.y - 6), dx);
      this.facing = dx >= 0 ? 1 : -1;
      const reach = this.def.range + t.r * t.baseScale;
      const sees = sc.map.los(this.x, this.y, t.x, t.y);
      if (d > reach || !sees) goal = [t.x, t.y];
      else {
        // shooters keep their distance
        if (this.def.range > 40 && d < 40) {
          const bx = this.x - (dx / d) * 30,
            by = this.y - (dy / d) * 30;
          if (!sc.map.collides(bx, by, 4)) {
            goal = [bx, by];
            speed *= 0.8;
          }
        }
        if (this.atkT <= 0) this.attack(t);
        if (this.skillT <= 0) this.skill(t);
      }
    }
    if (!goal && (!t || t.dead) && this.roam) {
      // wandering: from room to room
      goal = this.roamStep(dt);
      speed = this.s.move * 0.8;
    } else if (!goal && (!t || t.dead)) {
      // follow: a spot next to the hero
      if (this.slotT <= 0) this.slot = this.pickSlot();
      this.slotT -= dt;
      const dSlot = Math.hypot(this.slot[0] - this.x, this.slot[1] - this.y);
      if (dSlot > 14) goal = this.slot;
      if (dSlot < 40) speed = Math.min(speed, Math.max(30, dSlot * 3));
      if (Math.abs(p.x - this.x) > 4 && dSlot <= 14) this.facing = p.x > this.x ? 1 : -1;
    }
    let moving = false;
    if (goal) moving = this.moveTo(goal[0], goal[1], speed, dt);
    this.sync(moving);
  }

  /** the next point of its walk through the floor (a new room when it gets there) */
  private roamStep(dt: number): [number, number] | null {
    const sc = this.scene;
    this.pathT -= dt;
    this.roamTime += dt;
    while (this.path.length && Math.hypot(this.path[0][0] - this.x, this.path[0][1] - this.y) < 6) this.path.shift();
    if (!this.path.length || this.pathT <= 0) {
      this.pathT = 12;
      // after a while it comes looking for the hero (so the two do meet)
      if (this.roamTime > 30 && Math.random() < 0.6) {
        const p = sc.player;
        this.path = sc.map.findPath(this.x, this.y, p.x, p.y) || [];
      } else {
        const rooms = sc.dungeon.rooms.filter((r) => r.type !== 'secret' && Math.hypot(r.cx * 16 - this.x, r.cy * 16 - this.y) > 60);
        const r = rooms[Math.floor(Math.random() * rooms.length)];
        this.path = (r && sc.map.findPath(this.x, this.y, r.cx * 16 + 8, r.cy * 16 + 8)) || [];
      }
      if (!this.path.length) return null;
    }
    return this.path[0];
  }

  /** whom to fight, by its order */
  private pickTarget(): Enemy | null {
    const sc = this.scene;
    const p = this.roam ? this : sc.player;
    const order = this.state.order;
    if (order === 'follow') return null;
    const cur = this.target;
    const radius = order === 'attack' ? 150 : 80;
    const near = (e: Enemy) => !e.dead && e.def.behavior !== 'thief' && Math.hypot(e.x - p.x, e.y - p.y) < radius && (e.aggro || order === 'attack');
    if (cur && near(cur) && Math.hypot(cur.x - p.x, cur.y - p.y) < radius + 30) return cur;
    let best: Enemy | null = null,
      bd = Infinity;
    for (const e of sc.enemies) {
      if (!near(e)) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bd && (sc.map.los(this.x, this.y, e.x, e.y) || d < 30)) {
        bd = d;
        best = e;
      }
    }
    // a treasure goblin the hero has caught (stunned) is fair game too
    return best;
  }

  private hit(e: Enemy, mult = 1) {
    const sc = this.scene;
    let dmg = this.s.dmg * mult * (0.85 + Math.random() * 0.3);
    const crit = Math.random() * 100 < this.s.crit;
    if (crit) dmg *= this.s.critDmg / 100;
    const dealt = sc.combat.damageEnemy(e, dmg, { el: this.def.el, fromAlly: true });
    if (this.s.lifesteal > 0 && dealt > 0) this.heal((dealt * this.s.lifesteal) / 100, false);
    return dealt;
  }

  private attack(t: Enemy) {
    const sc = this.scene;
    this.atkT = this.s.atkCd * (0.9 + Math.random() * 0.2);
    this.swingT = 0.18;
    const role = this.def.role;
    if (role === 'tank') {
      const a = this.aim;
      sc.fx.slash(this.x + Math.cos(a) * 7, this.y - 5 + Math.sin(a) * 7, a, 11, 0xffffff, 100);
      this.hit(t);
      sfx('hit');
      return;
    }
    // shooters: an arrow, a fire bolt, a ray of holy light
    const y0 = this.y - 7;
    const a = Math.atan2(t.y - 6 - y0, t.x - this.x);
    if (role === 'mage') this.fireball(t, a);
    else sc.spawnAllyProjectile(this.x + Math.cos(a) * 5, y0, a, this.def.proj!, this.s.dmg * (0.85 + Math.random() * 0.3), this.def.el);
  }

  /** the mage's fire bolt bursts on the target and singes what stands around it */
  private fireball(t: Enemy, a: number) {
    const sc = this.scene;
    const y0 = this.y - 7;
    const img = sc.add.image(this.x, y0, 'pr_fire').setScale(ACTOR_SCALE).setRotation(a).setDepth(D.bright).setBlendMode(Phaser.BlendModes.ADD);
    const d = Math.hypot(t.x - this.x, t.y - 6 - y0);
    sc.tweens.add({
      targets: img,
      x: t.x,
      y: t.y - 6,
      duration: Math.max(80, (d / 210) * 1000),
      onComplete: () => {
        img.destroy();
        if (this.dead) return;
        sc.fx.burst(t.x, t.y - 6, EL_COLOR.fire, 10);
        sc.fx.ring(t.x, t.y - 4, 20, EL_COLOR.fire, 260);
        if (!t.dead) this.hit(t);
        for (const o of sc.enemiesNear(t.x, t.y, 20)) if (o !== t && !o.dead) this.hit(o, 0.5);
      },
    });
  }

  /** the role's skill, every few seconds in a fight */
  private skill(t: Enemy) {
    const sc = this.scene;
    switch (this.def.role) {
      case 'tank': {
        // taunt: the monsters around turn on it
        this.skillT = 9;
        let n = 0;
        for (const e of sc.enemiesNear(this.x, this.y, 80)) {
          if (e.boss || e.dead) continue;
          e.tauntT = 4;
          e.aggro = true;
          n++;
        }
        if (n) {
          sc.fx.ring(this.x, this.y - 6, 80, 0x8fb8ff, 450);
          sc.fx.number(this.x, this.y - 22, 'Sem!', '#8fb8ff');
          sfx('shout');
        }
        break;
      }
      case 'archer': {
        this.skillT = 8;
        const y0 = this.y - 7;
        const a = Math.atan2(t.y - 6 - y0, t.x - this.x);
        for (let i = -2; i <= 2; i++) sc.spawnAllyProjectile(this.x, y0, a + i * 0.16, 'pr_arrow', this.s.dmg * 0.8, 'phys');
        sfx('bow');
        break;
      }
      case 'mage': {
        // frost wave around the target: hurts and slows
        this.skillT = 10;
        sc.fx.disc(t.x, t.y, 40, EL_COLOR.ice, 400);
        sc.fx.burst(t.x, t.y - 4, 0xe8f8ff, 14);
        for (const o of sc.enemiesNear(t.x, t.y, 40)) {
          if (o.dead) continue;
          this.hit(o, 1.2);
          o.st.slowT = Math.max(o.st.slowT, 2.5);
          o.st.slowMult = Math.min(o.st.slowMult, 0.5);
        }
        sfx('magic');
        break;
      }
      default:
        this.skillT = 99;
    }
  }

  /** the healer's care: a heal for a hurt hero (or itself), a healing circle in need */
  private healing() {
    const sc = this.scene;
    const p = sc.player;
    if (p.dead) return;
    const pf = p.hp / p.d.maxHp;
    const near = Math.hypot(p.x - this.x, p.y - this.y) < 170;
    if (near && pf < 0.45 && this.bigHealT <= 0) {
      this.bigHealT = 16;
      this.healT = Math.max(this.healT, 2);
      sc.fx.ring(p.x, p.y - 6, 50, 0x6dff7a, 600);
      sc.fx.burst(p.x, p.y - 8, 0x9dff9d, 16);
      p.heal(this.s.heal * 1.8);
      this.heal(this.s.heal);
      sfx('heal');
      return;
    }
    if (this.healT > 0) return;
    if (near && pf < 0.7) {
      this.healT = 6;
      sc.fx.beam(this.x, this.y - 10, p.x, p.y - 8, 0x9dff9d, 2, 300);
      sc.fx.burst(p.x, p.y - 8, 0x9dff9d, 8);
      p.heal(this.s.heal);
      sfx('heal');
    } else if (this.hp < this.maxHp * 0.5) {
      this.healT = 6;
      sc.fx.burst(this.x, this.y - 8, 0x9dff9d, 8);
      this.heal(this.s.heal * 0.8);
    }
  }

  /** a free spot next to the hero (the other side than the pet likes) */
  private pickSlot(): [number, number] {
    const sc = this.scene;
    const p = sc.player;
    const f = p.facing;
    this.slotT = 0.6;
    // shooters and healers keep a step further back
    const back = this.def.range > 40 ? 22 : 16;
    const tries: [number, number][] = [
      [-f * back, -this.side * 8],
      [-f * back, this.side * 10],
      [0, -this.side * 14],
      [-f * 8, 14],
      [f * 14, -8],
    ];
    for (const [dx, dy] of tries) {
      const x = p.x + dx,
        y = p.y + dy;
      if (!sc.map.collides(x, y, 4) && sc.map.los(p.x, p.y, x, y)) return [x, y];
    }
    return [p.x - f * 10, p.y - 4];
  }

  private moveTo(gx: number, gy: number, speed: number, dt: number) {
    const sc = this.scene;
    const dx = gx - this.x,
      dy = gy - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return false;
    const step = Math.min(d, speed * this.speedMult * dt);
    if (!this.target) this.facing = dx >= 0 ? 1 : -1;
    let dir: [number, number] = [dx / d, dy / d];
    // around corners the way to the hero is known (the monsters' flow field); a wanderer follows its path
    if (!this.roam && !sc.map.los(this.x, this.y, gx, gy)) {
      const f = sc.map.flowDir(this.x, this.y);
      if (f) dir = f;
    }
    const [nx, ny] = sc.map.move(this.x, this.y, dir[0] * step, dir[1] * step, this.r);
    const moved = Math.abs(nx - this.x) + Math.abs(ny - this.y) > 0.05;
    this.x = nx;
    this.y = ny;
    this.stuckT = moved ? 0 : this.stuckT + dt;
    if (this.stuckT > 2.5) {
      this.target = null;
      if (this.roam) {
        this.path = [];
        this.stuckT = 0;
      } else this.blink();
    }
    return moved;
  }

  private sync(moving: boolean) {
    this.syncSprite(false);
    if (!this.down) {
      const want = this.spriteKey + (moving ? '_walkA' : '_idleA');
      if (this.sprite.anims.currentAnim?.key !== want) this.sprite.play(want, true);
    }
    this.ring.setPosition(Math.round(this.x), Math.round(this.y + 3)).setVisible(this.sprite.visible);
    this.placeWeapons();
  }

  private placeWeapons() {
    const f = this.facing;
    const n = this.sprite.frame?.name as unknown;
    const fr = typeof n === 'number' ? n : parseInt(String(n), 10) || 0;
    const [fhx, fhy] = heroHand(fr);
    const [bhx, bhy] = heroHandB(fr);
    const ax = this.sprite.x,
      ay = this.sprite.y;
    const depth = this.sprite.depth;
    if (this.weapon) {
      const base = this.state.equip.weapon?.base ?? this.def.weapon;
      const kind = BASE_BY_ID[base]?.attack ?? 'melee';
      let x = ax + fhx * ACTOR_SCALE * f,
        y = ay + fhy * ACTOR_SCALE + 2,
        rot = 0.5 * f,
        ox = 0.5,
        oy = 0.85;
      if (kind === 'ranged') {
        const a = this.target ? this.aim : f > 0 ? 0 : Math.PI;
        rot = base === 'crossbow' ? a + Math.PI / 2 : a;
        ox = 0.3;
        oy = 0.5;
        x = this.x + Math.cos(a) * 4;
        y = this.y - 6 + Math.sin(a) * 3;
      } else if (kind === 'magic') {
        rot = this.swingT > 0 ? this.aim + Math.PI / 2 : 0.25 * f;
      } else if (this.swingT > 0) {
        const pr = 1 - this.swingT / 0.18;
        const start = this.aim - 0.95,
          end = this.aim + 0.95;
        const a = f > 0 ? start + (end - start) * pr : end - (end - start) * pr;
        rot = a + Math.PI / 2;
        x = this.x + Math.cos(this.aim) * 2;
        y = this.y - 5 + Math.sin(this.aim) * 2;
      }
      this.weapon.setOrigin(ox, oy).setPosition(x, y).setRotation(rot).setDepth(depth + (f > 0 ? 0.5 : -0.5) + (this.swingT > 0 ? 1 : 0));
    }
    if (this.shieldImg) this.shieldImg.setPosition(ax + bhx * ACTOR_SCALE * f, ay + bhy * ACTOR_SCALE).setDepth(depth + 0.6);
  }

  setVisible(on: boolean) {
    this.sprite.setVisible(on);
    this.shadow.setVisible(on);
    this.ring.setVisible(on);
    this.weapon?.setVisible(on && !this.down);
    this.shieldImg?.setVisible(on && !this.down);
  }

  destroyVisuals() {
    super.destroyVisuals();
    this.ring.destroy();
    this.weapon?.destroy();
    this.shieldImg?.destroy();
  }
}
