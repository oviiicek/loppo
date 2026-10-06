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
    if (!b.enraged && b.hp < b.maxHp * 0.5) {
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
      b.patternT = 3.2 + Math.random() * 1.2;
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
            if (b.dead) return;
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
            if (b.dead) return;
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
            if (b.dead) return;
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
          if (b.dead) return;
          if (!sc.map.collides(tx, ty, b.r)) {
            b.x = tx;
            b.y = ty;
          }
        });
        sc.time.delayedCall(900, () => {
          if (b.dead) return;
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
            if (b.dead) return;
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
            if (b.dead) return;
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
          if (b.dead) return;
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
      case 'spiral': {
        b.windup = 2.2;
        let ang = Math.random() * Math.PI * 2;
        for (let i = 0; i < 24; i++) {
          sc.time.delayedCall(i * 85, () => {
            if (b.dead) return;
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
