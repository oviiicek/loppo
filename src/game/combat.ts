import type { GameScene } from '../scenes/GameScene';
import { Actor, Enemy } from './entities';
import { EL_COLOR } from './fx';
import { Element } from '../data/types';
import { bumpStat } from '../systems/state';
import { sfx, vibrate } from '../systems/audio';
import { bus } from '../systems/events';

export interface HitOpts {
  el?: Element;
  spell?: boolean;
  crit?: boolean; // force crit
  noCrit?: boolean;
  isAttack?: boolean;
  dot?: boolean;
  lifesteal?: number; // extra % lifesteal for this hit
  fromAlly?: boolean;
  kx?: number;
  ky?: number;
  silent?: boolean;
  execute?: boolean;
}

const EL_TEXT: Record<string, string> = {
  phys: '#ffffff',
  fire: '#ffa860',
  ice: '#9fe6ff',
  lightning: '#fff27a',
  poison: '#9dff7a',
  holy: '#fff6c0',
  shadow: '#d0a8ff',
};

export class Combat {
  scene: GameScene;
  constructor(scene: GameScene) {
    this.scene = scene;
  }

  // Player basic attack hitting an enemy (applies weapon damage + on-hit effects)
  attackHit(e: Enemy, kx = 0, ky = 0) {
    const p = this.scene.player;
    const d = p.d;
    const dmg = d.dmgMin + Math.random() * (d.dmgMax - d.dmgMin);
    this.damageEnemy(e, dmg, { el: 'phys', isAttack: true, kx, ky });
    // elemental flat damage
    const el = d.elem;
    if (el.fire > 0) {
      e.st.burnT = 3;
      e.st.burnDps = Math.max(e.st.burnDps, el.fire * 0.6);
      this.damageEnemy(e, el.fire, { el: 'fire', silent: true, noCrit: true });
    }
    if (el.ice > 0) {
      this.damageEnemy(e, el.ice, { el: 'ice', silent: true, noCrit: true });
      if (Math.random() < 0.25) {
        e.st.slowT = 2;
        e.st.slowMult = 0.6;
      }
    }
    if (el.lightning > 0) this.damageEnemy(e, el.lightning * (0.5 + Math.random() * 1.0), { el: 'lightning', silent: true, noCrit: true });
    if (el.poison > 0) {
      e.st.poisonT = 4;
      e.st.poisonDps = Math.max(e.st.poisonDps, el.poison * 0.8);
    }
  }

  onHitProcs(e: Enemy, dmg: number) {
    const sc = this.scene;
    const p = sc.player;
    const s = p.d.specials;
    if (s.has('chainOnHit') && Math.random() < 0.15) sc.spells.chain(e.x, e.y, 3, dmg * 0.6, 'lightning', new Set([e.id]));
    if (s.has('frostOnHit') && Math.random() < 0.1) {
      e.st.stunT = Math.max(e.st.stunT, 1.2);
      sc.fx.burst(e.x, e.y - 6, 0x9fe6ff, 6);
    }
    if (s.has('burnOnHit')) {
      e.st.burnT = 3;
      e.st.burnDps = Math.max(e.st.burnDps, dmg * 0.2);
    }
    for (const b of p.buffs) {
      if (b.mods.onHitPoison) {
        e.st.poisonT = 4;
        e.st.poisonDps = Math.max(e.st.poisonDps, dmg * 0.3);
      }
      if (b.mods.onHitFire) {
        e.st.burnT = 3;
        e.st.burnDps = Math.max(e.st.burnDps, dmg * 0.25);
      }
      if (b.mods.onHitChain && Math.random() < 0.6) sc.spells.chain(e.x, e.y, 3, dmg * 0.5, 'lightning', new Set([e.id]));
    }
  }

  damageEnemy(e: Enemy, amount: number, o: HitOpts = {}) {
    if (e.dead || amount <= 0 || e.invuln) return 0;
    const sc = this.scene;
    const p = sc.player;
    const el = o.el ?? 'phys';
    let dmg = amount;
    let crit = false;
    if (!o.dot && !o.noCrit && !o.fromAlly) {
      const critChance = p.d.crit + (p.stealthed ? 100 : 0);
      crit = o.crit || Math.random() * 100 < critChance;
      if (crit) dmg *= p.d.critDmg / 100;
    }
    if (o.execute && e.hp < e.maxHp * 0.35) dmg *= 2;
    if (e.st.vulnT > 0) dmg *= 1 + e.st.vuln;
    // armour only vs physical
    if (el === 'phys') dmg *= 1 - e.armor / (e.armor + 120);
    if (o.fromAlly && p.save.cls === 'necro') dmg *= 1.3;
    if (el === 'lightning' && p.save.cls === 'shaman') dmg *= 1.2;
    // a story guardian loses at most ~6.5 % of a stage per second (with a 10 % burst reserve); damage beyond
    // that is mostly absorbed, so even a very strong hero gets a real fight while weaker ones are unaffected
    if (e.story) {
      const now = sc.time.now / 1000;
      const rate = e.maxHp * 0.065;
      e.capBudget = Math.min(e.maxHp * 0.1, e.capBudget + (now - e.capT) * rate);
      e.capT = now;
      const free = Math.max(0, e.capBudget);
      if (dmg > free) dmg = free + (dmg - free) * 0.05;
      e.capBudget -= dmg;
    }
    dmg = Math.max(1, dmg);
    e.hp -= dmg;
    e.hpBarT = 3;
    if (!e.aggro) e.aggro = true;
    // knockback (bosses resist)
    if ((o.kx || o.ky) && !e.boss) {
      const l = Math.hypot(o.kx ?? 0, o.ky ?? 0) || 1;
      const k = o.isAttack ? 40 : 60;
      e.knockX += ((o.kx ?? 0) / l) * k;
      e.knockY += ((o.ky ?? 0) / l) * k;
    }
    if (!o.dot) {
      e.sprite.setTintFill(0xffffff);
      e.hitFlash = 0.07;
    }
    if (!o.silent || crit) {
      const txt = Math.round(dmg).toString();
      sc.fx.number(e.x, e.y - 14 * e.baseScale, crit ? txt + '!' : txt, crit ? '#ffd23a' : o.dot ? '#c8a8a8' : EL_TEXT[el] ?? '#fff', crit);
    }
    if (crit) sfx('crit');
    // lifesteal / mana on hit
    if (!o.fromAlly) {
      let ls = (p.d.lifesteal + (o.lifesteal ?? 0)) / 100;
      if (o.spell && !o.lifesteal) ls *= 0.35;
      if (o.dot) ls *= 0.2;
      if (ls > 0) p.heal(dmg * ls, false);
      if (o.isAttack && p.d.manaOnHit) p.mp = Math.min(p.d.maxMp, p.mp + p.d.manaOnHit);
      if (o.isAttack && !o.dot) this.onHitProcs(e, dmg);
    }
    if (e.hp <= 0) {
      // a story guardian with stages left changes instead of dying
      if (e.story && e.phase < e.phaseCount - 1) {
        e.hp = 1;
        sc.storyNextPhase(e);
      } else this.killEnemy(e);
    }
    return dmg;
  }

  killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const sc = this.scene;
    const p = sc.player;
    sfx('enemyDie');
    sc.fx.burst(e.x, e.y - 6, 0xd8d0c0, 10, 'puff');
    sc.fx.burst(e.x, e.y - 6, e.boss ? 0xffd23a : 0xff6040, e.boss ? 40 : 8);
    // death animation
    const spr = e.sprite;
    sc.tweens.add({ targets: spr, alpha: 0, scaleY: spr.scaleY * 0.2, angle: (Math.random() - 0.5) * 60, duration: 260, onComplete: () => e.destroyVisuals() });
    sc.tweens.add({ targets: e.shadow, alpha: 0, duration: 260 });
    e.nameLabel?.destroy();
    // rewards
    const xpMult = 1 + p.d.xp / 100 + sc.shrineBuffs.reduce((a, b) => a + (b.xp ?? 0), 0) + (sc.mod?.xp ?? 0);
    sc.gainXp(Math.round(e.xp * xpMult));
    p.save.kills++;
    sc.loot.enemyDrops(e);
    const s = p.d.specials;
    if (s.has('explodeOnKill')) sc.spells.explosion(e.x, e.y, 36, p.weaponHit() * 0.6, 'fire', {});
    if (s.has('healOnKill')) p.heal(p.d.maxHp * 0.04);
    if (s.has('cdrOnKill')) p.cds = p.cds.map((c) => Math.max(0, c - 0.5));
    if (e.eliteAffix === 'výbušný') {
      sc.fx.telegraph(e.x, e.y, 34, 500);
      sc.time.delayedCall(500, () => {
        sc.fx.disc(e.x, e.y, 34, 0xff7a2a);
        if (Math.hypot(p.x - e.x, p.y - e.y) < 34) this.damagePlayer(e.dmg * 1.5, null, 'fire');
      });
    }
    if (e.def.behavior === 'splitter' && !e.isMinion && e.baseScale >= 0.9 && !e.boss) {
      for (let i = 0; i < 2; i++) {
        const m = sc.spawnEnemy(e.def.id, e.x + (i ? 6 : -6), e.y, false, e.roomId);
        m.setScale(0.65);
        m.maxHp = m.hp = Math.round(e.maxHp * 0.3);
        m.isMinion = true;
        m.xp = Math.round(e.xp * 0.25);
        m.aggro = true;
      }
    }
    if (e.boss) sc.onBossKilled(e);
    if (e.def.behavior === 'thief') {
      bumpStat(p.save, 'thieves');
      sc.ui.toast('Zlatý skřet chycen!', '#ffd23a');
    }
    bus.emit('kill', e);
  }

  damagePlayer(amount: number, src: Actor | null, el: Element = 'phys', isDot = false) {
    const sc = this.scene;
    const p = sc.player;
    if (p.dead || amount <= 0 || sc.godMode) return;
    if (!isDot) p.combatPing();
    if (p.invulnT > 0) return;
    const d = p.d;
    if (!isDot) {
      if (Math.random() * 100 < d.dodge) {
        sc.fx.number(p.x, p.y - 18, 'úhyb', '#9fe6ff');
        return;
      }
      if (d.block > 0 && Math.random() * 100 < d.block) {
        sc.fx.number(p.x, p.y - 18, 'blok', '#c8d0d8');
        sc.fx.burst(p.x - 5 * p.facing, p.y - 6, 0xc8d0d8, 5);
        amount *= 0.25;
      }
    }
    let dmg = amount;
    const floor = sc.floor;
    if (el === 'phys' && !isDot) dmg *= 1 - d.armor / (d.armor + 50 + 12 * floor);
    else if (!isDot) dmg *= 1 - Math.min(0.5, d.armor / (d.armor + 200 + 25 * floor));
    // thorns
    if (src && src instanceof Enemy && !isDot) {
      const thornsPct = p.buffs.reduce((a, b) => a + (b.mods.thornsPct ?? 0), 0);
      const reflect = d.thorns + (amount * thornsPct) / 100;
      if (reflect > 0) this.damageEnemy(src, reflect, { el: 'phys', noCrit: true, silent: false });
      if (d.specials.has('thornNova') && Math.random() < 0.1) sc.spells.nova(p.x, p.y, 50, p.weaponHit() * 1.5, 'phys', {});
    }
    if (d.specials.has('ghostStep') && !isDot) {
      if (p.ghostStepT <= 0) {
        p.ghostStepT = 2;
        p.recalc();
      } else p.ghostStepT = 2;
    }
    // shield absorbs
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) sc.fx.number(p.x, p.y - 20, Math.round(absorbed).toString(), '#7fb2ff');
    }
    if (d.specials.has('manaShield') && dmg > 0) {
      const fromMana = Math.min(p.mp, dmg * 0.2);
      p.mp -= fromMana;
      dmg -= fromMana;
    }
    if (dmg <= 0) return;
    p.hp -= dmg;
    if (!isDot) {
      sfx('hurt');
      vibrate(20);
      p.hurtFlash();
      sc.fx.number(p.x, p.y - 18, Math.round(dmg).toString(), '#ff5050');
      sc.ui.hurtVignette();
    }
    if (p.hp <= 0) {
      p.hp = 0;
      sc.onPlayerDeath();
    }
  }
}

export { EL_COLOR };
