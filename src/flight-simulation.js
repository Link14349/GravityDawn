/** Shared, fixed-step flight simulation used by the game and campaign verification. */
import { Building } from './building.js';
import { Bullet } from './bullet.js';

export class FlightSimulation {
  constructor(loaded) {
    Object.assign(this, loaded);
    this.initialBulletCount = loaded.bullets.length;
    this.physicsTime = 0;
    this.explosions = [];
    this.tempGravityWells = [];
    for (const b of this.bullets) b._trail = [];
  }
  getPerformance() {
    const originals = this.bullets.slice(0, this.initialBulletCount);
    return {
      shotsUsed: originals.filter(b => b.launched).length,
      deltaVSpent: originals.reduce((sum, b) => sum + b.maxDeltaV - b.remainingDeltaV, 0),
    };
  }
  _addGravityWell(gw) {
    gw.startTime = this.physicsTime;
    this.physics.addGravitySource(gw.x, gw.y, gw.mass, 0, null);
    gw._sourceObj = this.physics.gravitySources[this.physics.gravitySources.length - 1];
    this.tempGravityWells.push(gw);
  }
  step(ctrl = null) {
    const { allBodies, bullets, buildings, physics, explosions, tempGravityWells } = this;
    let physicsTime = this.physicsTime, frameHadEvent = false;
    const BULLET_R = 6;
    const _addGravityWell = gw => this._addGravityWell(gw);

    physicsTime += 1 / 60;
    for (let i = 0; i < allBodies.length; i++) {
      const b = allBodies[i];
      b.update(1 / 60);
      physics.updateSourcePosition(i, b.getPosition().x, b.getPosition().y);
    }
    for (const bld of buildings) {
      const bResult = bld.step(1 / 60, physics, allBodies);
      if (bResult.explosions.length > 0) frameHadEvent = true;
      for (const ex of bResult.explosions) explosions.push({ x: ex.x, y: ex.y, r: 0, maxR: ex.radius || 40 });
    }
    Building.checkCrossCollisions(buildings, explosions);
    for (const b of bullets) {
      if (!b.alive) continue;
      if (!b.launched) { b.updateOrbitPosition(1 / 60); }
      else {
        const col = physics.stepParticle(b, undefined, BULLET_R);
        b._trail.push({ x: b.x, y: b.y, life: 1.0 });
        if (b._trail.length > 300) b._trail.shift();
        let hitBuilding = false;
        for (const bld of buildings) {
          const colR = b.maxHp > 0 ? (b.renderRadius || BULLET_R) : BULLET_R;
          const impact = bld.handleBulletImpact(b.x, b.y, colR, b.getEffectiveExplosionImpulse(), b.getEffectiveExplosionRadius());
          if (impact.hit) {
            // 燃烧弹效果
            b.applyIncendiary(bld);
            if (b.maxHp > 0) { b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7); }
            else { b.alive = false; }
            explosions.push({ x: impact.explosion.x, y: impact.explosion.y, r: 0, maxR: impact.explosion.radius || 50 });
            frameHadEvent = true; hitBuilding = true;
            // 分裂弹
            const splits = b.getSplitBullets();
            if (splits) {
              for (const sd of splits) {
                const child = new Bullet(sd);
                child.launchTime = physicsTime;
                child._trail = [];
                bullets.push(child);
                if (ctrl) ctrl.bullets = bullets;
              }
              frameHadEvent = true;
            }
            // 引力弹
            const gw = b.getGravityWell();
            if (gw) { _addGravityWell(gw); frameHadEvent = true; }
            break;
          }
        }
        if (!hitBuilding && col) {
          explosions.push({ x: b.x, y: b.y, r: 0, maxR: b.getEffectiveExplosionRadius() || (b.maxHp > 0 ? 15 : 50) });
          if (b.maxHp > 0) b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7);
          else b.alive = false;
          frameHadEvent = true;
          // 星体碰撞也触发分裂/引力效果
          const splits = b.getSplitBullets();
          if (splits) {
            for (const sd of splits) {
              const child = new Bullet(sd);
              child.launchTime = physicsTime;
              child._trail = [];
              bullets.push(child);
              if (ctrl) ctrl.bullets = bullets;
            }
            frameHadEvent = true;
          }
          const gw = b.getGravityWell();
          if (gw) { _addGravityWell(gw); frameHadEvent = true; }
        }
      }
    }
    // 处理右键触发的子弹效果
    if (ctrl && ctrl.triggeredBullets.length > 0) {
      for (const tb of ctrl.triggeredBullets) {
        if (!tb._triggered) continue;
        tb._triggered = false;
        // 爆炸效果：对附近建筑施加爆炸伤害
        if (tb.onImpact === 'explode') {
          const er = tb.getEffectiveExplosionRadius();
          const ep = tb.getEffectiveExplosionImpulse();
          explosions.push({ x: tb.x, y: tb.y, r: 0, maxR: er || 50 });
          for (const bld of buildings) {
            const bldCenter = bld.points.length > 0 ? { x: bld.points[0].x, y: bld.points[0].y } : { x: 0, y: 0 };
            const dist = Math.sqrt((bldCenter.x - tb.x) ** 2 + (bldCenter.y - tb.y) ** 2);
            if (dist < er + 200) {
              const ar = bld.applyExplosion(tb.x, tb.y, er, ep);
              bld.score += ar.totalScore;
            }
          }
        }
        // 分裂弹
        const splits = tb.getSplitBullets();
        if (splits) {
          for (const sd of splits) {
            const child = new Bullet(sd);
            child.launchTime = physicsTime; child._trail = [];
            bullets.push(child);
          }
          if (ctrl) ctrl.bullets = bullets;
        }
        // 引力弹
        const gw = tb.getGravityWell();
        if (gw) _addGravityWell(gw);
        // 燃烧弹
        if (tb.onImpact === 'incendiary') {
          for (const bld of buildings) {
            const dist = Math.sqrt((bld.points[0]?.x - tb.x) ** 2 + (bld.points[0]?.y - tb.y) ** 2);
            if (dist < tb.getEffectiveExplosionRadius() + 100) {
              tb.applyIncendiary(bld);
            }
          }
        }
        frameHadEvent = true;
      }
      ctrl.triggeredBullets.length = 0;
    }
    // 处理临时引力源过期（用引用查找，避免索引问题）
    for (let i = tempGravityWells.length - 1; i >= 0; i--) {
      const gw = tempGravityWells[i];
      if (physicsTime - gw.startTime > gw.duration) {
        if (gw._sourceObj) {
          const idx = physics.gravitySources.indexOf(gw._sourceObj);
          if (idx >= 0) physics.removeGravitySource(idx);
        }
        tempGravityWells.splice(i, 1);
      }
    }
    for (const ex of explosions) ex.r += 4;

    this.physicsTime = physicsTime;
    // The renderer and headless verification observe the same effect lifetime.
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (explosions[i].r >= explosions[i].maxR) explosions.splice(i, 1);
    }
    return frameHadEvent;
  }
}
