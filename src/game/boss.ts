import type { GameScene } from '../scenes/GameScene';
import { Enemy } from './entities';
import { EL_COLOR } from './fx';
import { sfx } from '../systems/audio';

export class BossAI {
  scene: GameScene;
  constructor(scene: GameScene) {
    this.scene = scene;
  }

  update(b: Enemy, dt: number) {
    const sc = this.scene;
    const p = sc.player;
    const dx = p.x - b.x,
      dy = p.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (!b.aggro) {
      if (dist < 150 && sc.map.los(b.x, b.y, p.x, p.y)) {
        b.aggro = true;
        sc.onBossAggro(b);
      } else {
        b.syncSprite(false);
        return;
      }
    }
    // story guardians only rage in their last stage
    if (!b.enraged && b.hp < b.maxHp * 0.5 && (!b.story || b.phase === b.phaseCount - 1)) {
      b.enraged = true;
      sc.ui.toast(`${b.name} zuří!`, '#ff5050');
      sc.fx.ring(b.x, b.y - 10, 60, 0xff3030, 500);
      sfx('boss');
    }
    b.facing = dx >= 0 ? 1 : -1;
    if (b.charging > 0) {
      b.charging -= dt;
      const sp = b.speed * 4.2;
      const [nx, ny, hit] = sc.map.move(b.x, b.y, b.chargeDir[0] * sp * dt, b.chargeDir[1] * sp * dt, b.r);
      b.x = nx;
      b.y = ny;
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 8 && b.atkT <= 0) {
        sc.combat.damagePlayer(b.dmg * 1.6, b);
        p.knockX += b.chargeDir[0] * 200;
        p.knockY += b.chargeDir[1] * 200;
        b.atkT = 0.8;
      }
      if (hit) {
        b.charging = 0;
        sc.fx.shake(0.008, 200);
        b.st.stunT = 0.8;
      }
      b.atkT -= dt;
      b.syncSprite(true);
      return;
    }
    if (b.windup > 0) {
      b.windup -= dt;
      b.syncSprite(false);
      return;
    }
    b.patternT -= dt * (b.enraged ? 1.4 : 1);
    b.atkT -= dt;
    // melee contact
    if (dist < b.r + 10 && b.atkT <= 0) {
      b.atkT = 1.1;
      sc.fx.slash(b.x + (dx / dist) * 10, b.y - 8 + (dy / dist) * 10, Math.atan2(dy, dx), 18, 0xffcccc, 120);
      sc.combat.damagePlayer(b.dmg, b);
    }
    // chase
    let moving = false;
    if (dist > b.r + 8) {
      let dir: [number, number] | null = sc.map.los(b.x, b.y, p.x, p.y) ? [dx / dist, dy / dist] : sc.map.flowDir(b.x, b.y);
      if (dir) {
        const [nx, ny] = sc.map.move(b.x, b.y, dir[0] * b.speed * b.speedMult * dt, dir[1] * b.speed * b.speedMult * dt, b.r);
        moving = Math.abs(nx - b.x) + Math.abs(ny - b.y) > 0.01;
        b.x = nx;
        b.y = ny;
      }
    }
    if (b.patternT <= 0) {
      const pats = b.boss!.patterns;
      const pat = pats[b.patternIdx % pats.length];
      b.patternIdx++;
      b.patternT = b.story ? b.story.phases[b.phase].cadence + Math.random() * 0.7 : 3.2 + Math.random() * 1.2;
      this.run(b, pat);
    }
    b.syncSprite(moving);
  }

  shoot(b: Enemy, angle: number, speed = 110, dmgMult = 0.7) {
    const def = b.boss!;
    this.scene.spawnEnemyProjectile(b.x, b.y - 10 * b.baseScale * 0.5, angle, def.proj, b.dmg * dmgMult, def.el, speed);
  }

  run(b: Enemy, pat: string) {
    const sc = this.scene;
    const p = sc.player;
    const def = b.boss!;
    const col = EL_COLOR[def.el] ?? 0xffffff;
    const aim = () => Math.atan2(p.y - 6 - b.y, p.x - b.x);
    const extra = b.enraged ? 1.4 : 1;
    switch (pat) {
      case 'summon': {
        const n = Math.round((2 + b.bossTier) * extra) + 1;
        b.windup = 0.6;
        sc.fx.ring(b.x, b.y - 8, 40, 0xb07dff, 500);
        for (let i = 0; i < n; i++) {
          const pos = sc.map.randomFloorNear(b.x, b.y, 50);
          if (!pos) continue;
          sc.fx.telegraph(pos[0], pos[1], 10, 600, 0xb07dff);
          sc.time.delayedCall(600, () => {
            if (b.dead || b.invuln) return;
            const m = sc.spawnEnemy(def.summon, pos[0], pos[1], false, b.roomId);
            m.aggro = true;
            m.isMinion = true;
            m.xp = Math.round(m.xp * 0.3);
          });
        }
        break;
      }
      case 'radial': {
        b.windup = 0.5;
        const waves = b.enraged ? 2 : 1;
        for (let w = 0; w < waves; w++) {
          sc.time.delayedCall(500 + w * 450, () => {
            if (b.dead || b.invuln) return;
            const n = 14 + b.bossTier * 2;
            const off = Math.random() * Math.PI;
            for (let i = 0; i < n; i++) this.shoot(b, off + (i / n) * Math.PI * 2, 95);
            sc.fx.ring(b.x, b.y - 8, 30, col, 300);
          });
        }
        break;
      }
      case 'volley': {
        b.windup = 0.4;
        const reps = b.enraged ? 4 : 3;
        for (let r = 0; r < reps; r++) {
          sc.time.delayedCall(400 + r * 350, () => {
            if (b.dead || b.invuln) return;
            const a = aim();
            for (let i = -2; i <= 2; i++) this.shoot(b, a + i * 0.18, 140);
          });
        }
        break;
      }
      case 'charge': {
        b.windup = 0.7;
        b.sprite.setTint(0xff6060);
        b.hitFlash = 0.7;
        const a = aim();
        b.chargeDir = [Math.cos(a), Math.sin(a)];
        // telegraph line
        for (let i = 1; i <= 6; i++) sc.fx.telegraph(b.x + Math.cos(a) * i * 22, b.y + Math.sin(a) * i * 22, 10, 700);
        sc.time.delayedCall(700, () => {
          if (!b.dead && !b.stunned) b.charging = 0.9;
        });
        break;
      }
      case 'slam': {
        b.windup = 1.0;
        const tx = p.x,
          ty = p.y;
        const r = 52 + b.bossTier * 6;
        sc.fx.telegraph(tx, ty, r, 900);
        sc.tweens.add({ targets: b.sprite, y: b.sprite.y - 30, duration: 450, yoyo: true, ease: 'Quad.easeOut' });
        sc.time.delayedCall(450, () => {
          if (b.dead || b.invuln) return;
          if (!sc.map.collides(tx, ty, b.r)) {
            b.x = tx;
            b.y = ty;
          }
        });
        sc.time.delayedCall(900, () => {
          if (b.dead || b.invuln) return;
          sfx('explosion');
          sc.fx.shake(0.012, 250);
          sc.fx.ring(tx, ty, r, 0xc98b4a, 400);
          sc.fx.burst(tx, ty, 0xc98b4a, 30, 'puff');
          if (Math.hypot(p.x - tx, p.y - ty) < r) sc.combat.damagePlayer(b.dmg * 2, b);
          if (b.enraged) for (let i = 0; i < 10; i++) this.shoot(b, (i / 10) * Math.PI * 2, 100, 0.5);
        });
        break;
      }
      case 'meteors': {
        b.windup = 0.5;
        const n = Math.round((6 + b.bossTier * 2) * extra);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2,
            rr = Math.random() * 70;
          const x = p.x + Math.cos(a) * rr,
            y = p.y + Math.sin(a) * rr;
          const delay = 200 + i * 120;
          sc.time.delayedCall(delay, () => sc.fx.telegraph(x, y, 26, 900, col));
          sc.time.delayedCall(delay + 900, () => {
            if (b.dead || b.invuln) return;
            sc.fx.disc(x, y, 26, col, 300);
            sc.fx.burst(x, y, col, 10);
            if (Math.hypot(p.x - x, p.y - y) < 26) sc.combat.damagePlayer(b.dmg * 1.2, null, def.el);
          });
        }
        break;
      }
      case 'breath': {
        b.windup = 1.4;
        const a0 = aim();
        for (let i = 0; i < 16; i++) {
          sc.time.delayedCall(300 + i * 60, () => {
            if (b.dead || b.invuln) return;
            this.shoot(b, a0 + (Math.random() - 0.5) * 0.9, 120 + Math.random() * 40, 0.5);
          });
        }
        break;
      }
      case 'teleport': {
        b.windup = 0.8;
        sc.fx.burst(b.x, b.y - 8, 0xb07dff, 20, 'puff');
        b.sprite.setAlpha(0.2);
        sc.time.delayedCall(400, () => {
          if (b.dead || b.invuln) return;
          const pos = sc.map.randomFloorNear(p.x, p.y, 70);
          if (pos && Math.hypot(pos[0] - p.x, pos[1] - p.y) > 30) {
            b.x = pos[0];
            b.y = pos[1];
          }
          b.sprite.setAlpha(1);
          sc.fx.burst(b.x, b.y - 8, 0xb07dff, 20, 'puff');
          const n = 10;
          for (let i = 0; i < n; i++) this.shoot(b, (i / n) * Math.PI * 2, 100, 0.6);
        });
        break;
      }
      // ------------------------------------------------ story guardians
      case 'sweep': {
        // a huge swing of the axe in front of the guardian
        b.windup = 0.95;
        const a = aim();
        for (let k = -2; k <= 2; k++) for (const d of [18, 36]) sc.fx.telegraph(b.x + Math.cos(a + k * 0.42) * d, b.y + Math.sin(a + k * 0.42) * d, 11, 850);
        sc.time.delayedCall(850, () => {
          if (b.dead || b.invuln) return;
          sc.fx.slash(b.x + Math.cos(a) * 18, b.y - 6 + Math.sin(a) * 18, a, 44, 0xffd0a0, 170);
          sc.fx.shake(0.008, 180);
          sfx('explosion');
          const dx = p.x - b.x,
            dy = p.y - b.y,
            d = Math.hypot(dx, dy) || 1;
          let da = Math.abs(Math.atan2(dy, dx) - a);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (d < 52 && da < 1.15) {
            sc.combat.damagePlayer(b.dmg * 1.8, b);
            p.knockX += (dx / d) * 230;
            p.knockY += (dy / d) * 230;
          }
        });
        break;
      }
      case 'chains': {
        // a hooked chain thrown at the player drags them in
        b.windup = 0.75;
        const a = aim();
        const len = 150;
        for (let i = 1; i <= 7; i++) sc.fx.telegraph(b.x + Math.cos(a) * i * 21, b.y + Math.sin(a) * i * 21, 7, 650, 0xc8c8d8);
        sc.time.delayedCall(650, () => {
          if (b.dead || b.invuln) return;
          sc.fx.beam(b.x, b.y - 8, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len - 4, 0xb8b8c8, 3, 300);
          const t = Math.max(0, Math.min(len, (p.x - b.x) * Math.cos(a) + (p.y - b.y) * Math.sin(a)));
          if (Math.hypot(p.x - (b.x + Math.cos(a) * t), p.y - (b.y + Math.sin(a) * t)) < 11) {
            sc.combat.damagePlayer(b.dmg * 0.9, b);
            p.knockX -= Math.cos(a) * 340;
            p.knockY -= Math.sin(a) * 340;
          }
        });
        break;
      }
      case 'spores':
      case 'voidZones': {
        // lingering clouds that hurt while you stand in them
        const spore = pat === 'spores';
        const color = spore ? 0x5fe08a : 0x9a4aff;
        const r = spore ? 22 : 26;
        b.windup = 0.6;
        sc.fx.ring(b.x, b.y - 8, 50, color, 500);
        const n = Math.round((3 + b.bossTier) * extra);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2,
            rr = i === 0 ? 0 : 28 + Math.random() * 60;
          const x = p.x + Math.cos(ang) * rr,
            y = p.y + Math.sin(ang) * rr;
          if (sc.map.collides(x, y, 2)) continue;
          sc.fx.telegraph(x, y, r, 800, color);
          sc.time.delayedCall(800, () => {
            if (!b.dead && !b.invuln) sc.addHazard(x, y, r, b.dmg * (spore ? 0.5 : 0.6), spore ? 'poison' : 'shadow', spore ? 5 : 6, color);
          });
        }
        break;
      }
      case 'roots': {
        // lines of roots bursting from the ground towards the player
        b.windup = 0.5;
        const lines = b.enraged ? 3 : 2;
        const a0 = aim();
        for (let l = 0; l < lines; l++) {
          const a = a0 + (l - (lines - 1) / 2) * 0.45;
          for (let i = 1; i <= 9; i++) {
            const x = b.x + Math.cos(a) * i * 16,
              y = b.y + Math.sin(a) * i * 16;
            if (sc.map.collides(x, y, 2)) break;
            const delay = i * 90;
            sc.time.delayedCall(delay, () => sc.fx.telegraph(x, y, 10, 600, 0x8a6a3a));
            sc.time.delayedCall(delay + 600, () => {
              if (b.dead || b.invuln) return;
              sc.fx.burst(x, y, 0x6a4a2a, 6, 'puff');
              if (Math.hypot(p.x - x, p.y - y) < 12) sc.combat.damagePlayer(b.dmg * 1.1, b);
            });
          }
        }
        break;
      }
      case 'shardRain': {
        b.windup = 0.5;
        const n = Math.round((8 + b.bossTier * 2) * extra);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2,
            rr = Math.random() * 80;
          const x = p.x + Math.cos(a) * rr,
            y = p.y + Math.sin(a) * rr;
          const delay = 150 + i * 90;
          sc.time.delayedCall(delay, () => sc.fx.telegraph(x, y, 16, 800, 0x8fdcff));
          sc.time.delayedCall(delay + 800, () => {
            if (b.dead || b.invuln) return;
            sc.fx.disc(x, y, 16, 0xbfe9ff, 300);
            sc.fx.burst(x, y, 0xe8f8ff, 8);
            if (Math.hypot(p.x - x, p.y - y) < 16) {
              sc.combat.damagePlayer(b.dmg * 1.1, null, 'ice');
              p.chill(1.5);
            }
          });
        }
        break;
      }
      case 'icePrison': {
        // the ice closes around the spot where the player stands
        b.windup = 0.4;
        const x = p.x,
          y = p.y;
        sc.fx.telegraph(x, y, 26, 1300, 0x8fdcff);
        sc.time.delayedCall(1300, () => {
          if (b.dead || b.invuln) return;
          sc.fx.disc(x, y, 26, 0xbfe9ff, 500);
          sc.fx.burst(x, y, 0xe8f8ff, 18);
          sfx('magic');
          if (Math.hypot(p.x - x, p.y - y) < 26) {
            sc.combat.damagePlayer(b.dmg * 1.5, null, 'ice');
            p.chill(2.5);
          }
        });
        break;
      }
      case 'clones': {
        // shadow sisters appear and she slips away among them
        b.windup = 0.7;
        const n = b.enraged ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const pos = sc.map.randomFloorNear(b.x, b.y, 70);
          if (!pos) continue;
          sc.fx.burst(pos[0], pos[1], 0xb07dff, 16, 'puff');
          const m = sc.spawnEnemy('shadowClone', pos[0], pos[1], false, b.roomId);
          m.aggro = true;
          m.isMinion = true;
          m.maxHp = m.hp = Math.round(b.maxHp * 0.07);
          m.dmg = b.dmg * 0.45;
          m.setScale(1.1);
          m.sprite.setAlpha(0.75);
          m.baseTint = 0xc090ff;
          m.sprite.setTint(0xc090ff);
        }
        sc.time.delayedCall(350, () => {
          if (b.dead || b.invuln) return;
          const pos = sc.map.randomFloorNear(p.x, p.y, 90);
          if (pos && Math.hypot(pos[0] - p.x, pos[1] - p.y) > 40) {
            sc.fx.burst(b.x, b.y - 8, 0xb07dff, 18, 'puff');
            b.x = pos[0];
            b.y = pos[1];
            sc.fx.burst(b.x, b.y - 8, 0xb07dff, 18, 'puff');
          }
        });
        break;
      }
      case 'darkNova': {
        b.windup = 0.7;
        for (let w = 0; w < 3; w++)
          sc.time.delayedCall(400 + w * 380, () => {
            if (b.dead || b.invuln) return;
            const n = 16 + b.bossTier * 2;
            for (let i = 0; i < n; i++) this.shoot(b, w * 0.21 + (i / n) * Math.PI * 2, 82 + w * 16, 0.55);
            sc.fx.ring(b.x, b.y - 8, 40, 0xb07dff, 350);
          });
        break;
      }
      case 'hands': {
        // hands of darkness slam down where the player is going
        b.windup = 0.5;
        const n = Math.round((4 + b.bossTier) * extra);
        for (let i = 0; i < n; i++) {
          sc.time.delayedCall(150 + i * 260, () => {
            if (b.dead || b.invuln) return;
            const x = p.x + (Math.random() - 0.5) * 30,
              y = p.y + (Math.random() - 0.5) * 30;
            sc.fx.telegraph(x, y, 20, 700, 0x9a4aff);
            sc.time.delayedCall(700, () => {
              if (b.dead || b.invuln) return;
              sc.fx.burst(x, y, 0x3a1448, 14, 'puff');
              sc.fx.ring(x, y, 20, 0xb07dff, 300);
              sc.fx.shake(0.004, 100);
              if (Math.hypot(p.x - x, p.y - y) < 20) sc.combat.damagePlayer(b.dmg * 1.3, null, 'shadow');
            });
          });
        }
        break;
      }
      case 'lasers': {
        // beams from the eye: one aimed at the player, the others spread around
        b.windup = 1.1;
        const n = b.enraged ? 5 : 3;
        const a0 = aim();
        const len = 230;
        const angs = Array.from({ length: n }, (_, i) => a0 + (i * Math.PI * 2) / n);
        for (const a of angs) for (let i = 1; i <= 10; i++) sc.fx.telegraph(b.x + Math.cos(a) * i * 22, b.y + Math.sin(a) * i * 22, 6, 950, 0xd070ff);
        sc.time.delayedCall(950, () => {
          if (b.dead || b.invuln) return;
          sfx('spell');
          sc.fx.shake(0.006, 200);
          for (const a of angs) {
            sc.fx.beam(b.x, b.y - 10, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len - 4, 0xd070ff, 5, 380);
            const t = Math.max(0, Math.min(len, (p.x - b.x) * Math.cos(a) + (p.y - b.y) * Math.sin(a)));
            if (Math.hypot(p.x - (b.x + Math.cos(a) * t), p.y - (b.y + Math.sin(a) * t)) < 9) sc.combat.damagePlayer(b.dmg * 1.6, null, 'shadow');
          }
        });
        break;
      }
      case 'spiral': {
        b.windup = 2.2;
        let ang = Math.random() * Math.PI * 2;
        for (let i = 0; i < 24; i++) {
          sc.time.delayedCall(i * 85, () => {
            if (b.dead || b.invuln) return;
            ang += 0.42;
            this.shoot(b, ang, 100, 0.5);
            this.shoot(b, ang + Math.PI, 100, 0.5);
          });
        }
        break;
      }
    }
  }
}
