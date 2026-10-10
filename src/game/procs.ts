// The bonus spells of the hero's weapons (see data/weaponspells.ts): counts kills and hits for each weapon
// in hand, watches crits, blows taken, low health, spells, dodges and the time spent fighting, and casts the
// weapon's spell when its moment comes.
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './entities';
import type { Item } from '../data/types';
import { parseWeaponSpell, ProcEffect, ProcTrigger } from '../data/weaponspells';
import { sfx } from '../systems/audio';

interface Active {
  item: Item;
  eff: ProcEffect;
  trig: ProcTrigger;
}

export class Procs {
  scene: GameScene;
  /** kills, hits and seconds counted for each weapon ("uid|trigger") */
  private count = new Map<string, number>();
  /** when each weapon's spell may cast again (scene time in ms) */
  private ready = new Map<string, number>();

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  /** the bonus spells of the weapons in the hero's hands */
  private active(): Active[] {
    const eq = this.scene.player?.save.equip;
    if (!eq) return [];
    const out: Active[] = [];
    for (const it of [eq.main, eq.off]) {
      const ws = it && parseWeaponSpell(it.spell);
      if (ws) out.push({ item: it!, ...ws });
    }
    return out;
  }

  /** counts one more of something; true when the count reaches n (and starts over) */
  private tally(a: Active, n: number, by = 1) {
    const k = a.item.uid + '|' + a.trig.id;
    const c = (this.count.get(k) ?? 0) + by;
    if (c >= n) {
      this.count.set(k, c - n);
      return true;
    }
    this.count.set(k, c);
    return false;
  }

  /** a chance with a pause after it */
  private roll(a: Active, chance: number, cdMs: number) {
    const k = a.item.uid + '|' + a.trig.id;
    const now = this.scene.time.now;
    if ((this.ready.get(k) ?? 0) > now || Math.random() >= chance) return false;
    this.ready.set(k, now + cdMs);
    return true;
  }

  private each(trig: string, test: (a: Active) => boolean, target?: Enemy) {
    for (const a of this.active()) if (a.trig.id === trig && test(a)) this.cast(a.eff, a.trig.power, target);
  }

  onKill(e: Enemy) {
    this.each('kill5', (a) => this.tally(a, 5), e);
    this.each('kill12', (a) => this.tally(a, 12), e);
    if (e.elite || e.boss) this.each('elite', () => true, e);
  }
  onHit(e: Enemy) {
    this.each('hit15', (a) => this.tally(a, 15), e);
  }
  onCrit(e: Enemy) {
    this.each('crit', (a) => this.roll(a, 0.25, 2000), e);
  }
  onHurt() {
    const p = this.scene.player;
    this.each('hurt', (a) => this.roll(a, 0.2, 3000));
    if (p.hp > 0 && p.hp < p.d.maxHp * 0.35) this.each('lowhp', (a) => this.roll(a, 1, 25000));
  }
  onCast() {
    this.each('cast', (a) => this.roll(a, 0.3, 500));
  }
  onDodge() {
    this.each('dodge', (a) => this.roll(a, 1, 2000));
  }
  /** seconds of fighting */
  tick(dt: number, fighting: boolean) {
    if (fighting) this.each('timer', (a) => this.tally(a, 10, dt));
  }

  /** casts a bonus spell; power: how strong the moment makes it */
  cast(eff: ProcEffect, power: number, target?: Enemy) {
    const sc = this.scene;
    const p = sc.player;
    if (!p || p.dead) return;
    const base = p.powerHit() * power;
    const near = (r: number) => (target && !target.dead && Math.hypot(target.x - p.x, target.y - p.y) < r ? target : sc.nearestEnemy(p.x, p.y, r, true));
    sc.fx.number(p.x, p.y - 26, eff.name, eff.color, true);
    switch (eff.id) {
      case 'meteor': {
        const t = near(170);
        if (!t) break;
        const x = t.x,
          y = t.y;
        sc.spells.fallingMeteor(x, y, 380);
        sc.time.delayedCall(380, () => sc.spells.explosion(x, y, 34, base * 2.2, 'fire', {}));
        break;
      }
      case 'chain':
        sfx('thunder');
        sc.spells.chain(p.x, p.y, 5, base * 1.0, 'lightning', new Set(), near(150) ?? undefined);
        break;
      case 'frostnova':
        sfx('spell');
        sc.spells.nova(p.x, p.y, 60, base * 0.9, 'ice', { freeze: 1.2 });
        break;
      case 'firering':
        sfx('spell');
        sc.spells.nova(p.x, p.y, 55, base * 1.0, 'fire', {});
        sc.spells.addField(p.x, p.y, 40, base * 0.5, 'fire', 3, false, { t: 'field' } as never);
        break;
      case 'poison': {
        const t = near(150);
        const [x, y] = t ? [t.x, t.y] : [p.x, p.y];
        sc.spells.addField(x, y, 40, base * 0.7, 'poison', 4, false, { t: 'field' } as never);
        break;
      }
      case 'holy':
        sfx('heal');
        p.heal(p.d.maxHp * 0.12 * Math.min(1.5, power));
        sc.spells.nova(p.x, p.y, 50, base * 0.8, 'holy', {});
        break;
      case 'arrows': {
        const t = near(170);
        const cx = t ? t.x : p.x + Math.cos(p.aim) * 50,
          cy = t ? t.y : p.y + Math.sin(p.aim) * 50;
        for (let i = 0; i < 6; i++)
          sc.time.delayedCall(i * 90, () => {
            if (!p.dead) sc.spells.rainStrike(cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 44, { r: 22 } as never, base * 0.6, 'phys', 0xe8d8b0);
          });
        break;
      }
      case 'blades':
        for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 300, () => !p.dead && sc.spells.nova(p.x, p.y, 45, base * 0.6, 'phys', { knock: 20 }, 0xe8e0d0));
        sfx('swing');
        break;
      case 'skeletons':
        sfx('summon');
        for (const dx of [-12, 12]) sc.addAlly('skeleton', p.x + dx, p.y + 4, p.d.maxHp * 0.3, base * 0.6, 15);
        break;
      case 'wolves':
        sfx('summon');
        for (const dx of [-12, 12]) sc.addAlly('spiritWolf', p.x + dx, p.y + 4, p.d.maxHp * 0.3, base * 0.5, 15);
        break;
      case 'warcry':
        sfx('shout');
        p.addBuff('wspell_warcry', 'Bojový pokřik', { atkSpdPct: 30, dmgPct: 20 }, 6, 0xff8a5a);
        sc.fx.ring(p.x, p.y - 6, 40, 0xff8a5a, 400);
        break;
      case 'stoneshield':
        p.addShield(p.d.maxHp * 0.2 * Math.min(1.5, power), 10);
        sc.fx.ring(p.x, p.y - 6, 22, 0xc8c0b0, 400);
        break;
      case 'quake':
        sc.fx.shake(0.006, 220);
        sc.spells.nova(p.x, p.y, 70, base * 0.9, 'phys', { stun: 1 }, 0xd8b080);
        break;
      case 'bloodwave': {
        const hit = sc.enemiesNear(p.x, p.y, 60).length;
        sc.spells.nova(p.x, p.y, 60, base * 0.8, 'shadow', {}, 0xff5a7a);
        if (hit) p.heal(p.d.maxHp * Math.min(0.12, 0.02 * hit));
        break;
      }
      case 'shards':
        sfx('spell');
        for (let i = 0; i < 8; i++)
          sc.spawnSpellProjectile({ x: p.x, y: p.y - 6, angle: (i / 8) * Math.PI * 2, speed: 260, sprite: 'pr_ice', dmg: base * 0.5, el: 'ice', owner: 'player', spell: true, range: 160, slow: 0.3 });
        break;
      case 'fireballs': {
        sfx('spell');
        const foes = sc.enemiesNear(p.x, p.y, 170).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        for (let i = 0; i < 3; i++) {
          const t = foes[i % Math.max(1, foes.length)];
          const a = t ? Math.atan2(t.y - 6 - (p.y - 6), t.x - p.x) : p.aim + (i - 1) * 0.4;
          sc.spawnSpellProjectile({ x: p.x, y: p.y - 6, angle: a + (i - 1) * 0.15, speed: 220, sprite: 'pr_fire', dmg: base * 0.9, el: 'fire', owner: 'player', spell: true, explode: 26, homing: true, range: 200 });
        }
        break;
      }
      case 'smite': {
        const foes = sc.enemiesNear(p.x, p.y, 160);
        const t = foes.sort((a, b) => b.hp - a.hp)[0];
        if (!t) break;
        sfx('thunder');
        sc.fx.lightning(t.x + (Math.random() - 0.5) * 10, t.y - 120, t.x, t.y - 6, 0xfff7a0);
        sc.combat.damageEnemy(t, base * 3, { el: 'lightning', spell: true });
        t.st.stunT = Math.max(t.st.stunT, 0.5);
        break;
      }
      case 'spiritblade':
        sfx('summon');
        sc.addAlly('spiritSword', p.x, p.y - 10, p.d.maxHp * 0.4, base * 0.8, 12);
        break;
      case 'haste':
        p.addBuff('wspell_haste', 'Vítr v zádech', { move: 35, dodge: 15 }, 5, 0xb8f0ff);
        sc.fx.burst(p.x, p.y - 6, 0xb8f0ff, 10);
        break;
      case 'mana':
        p.mp = Math.min(p.d.maxMp, p.mp + p.d.maxMp * 0.2);
        p.cds = p.cds.map((c) => Math.max(0, c - 1));
        sc.fx.burst(p.x, p.y - 6, 0x7ab8ff, 12);
        break;
    }
  }
}
