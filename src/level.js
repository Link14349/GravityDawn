/**
 * 关卡系统 — 数据格式定义 + 加载器 + 结算判定
 */

import { CelestialBody } from './celestial.js';
import { Bullet } from './bullet.js';
import { Building } from './building.js';
import { PhysicsEngine } from './physics.js';
import { Orbit, createOrbits } from './binding.js';

/**
 * 加载关卡数据，返回游戏对象
 * @param {Object} levelData
 * @returns {{ orbits: Orbit[], stars: CelestialBody[], planets: CelestialBody[], allBodies: CelestialBody[], bullets: Bullet[], buildings: Building[], physics: PhysicsEngine, camera: {x,y,zoom} }}
 */
export class LevelManager {
  static load(levelData) {
    const G = levelData.gravity ?? 300;

    // 1. 构建全局 orbits 数组
    const orbits = createOrbits(levelData.orbits || []);

    // 2. 星体
    const stars = (levelData.stars || []).map(d => {
      const orb = orbits[d.orbit];
      if (!orb) throw new Error(`Star orbit ${d.orbit} not found in orbits array (length=${orbits.length})`);
      return new CelestialBody({ ...d, orbit: orb, orbits });
    });
    const planets = (levelData.planets || []).map(d => {
      const orb = orbits[d.orbit];
      if (!orb) throw new Error(`Planet orbit ${d.orbit} not found in orbits array (length=${orbits.length})`);
      return new CelestialBody({ ...d, orbit: orb, orbits });
    });
    const allBodies = [...stars, ...planets];

    // 3. 物理引擎
    const physics = new PhysicsEngine({ G });
    for (const b of allBodies) {
      const p = b.getPosition();
      physics.addGravitySource(p.x, p.y, b.mass, b.collisionRadius, (t) => b.orbit.getWorldPosition(t, orbits));
    }

    // 4. 子弹
    const bullets = (levelData.bullets || []).map(d => new Bullet(d));
    for (let i = 0; i < bullets.length; i++) {
      const bd = levelData.bullets[i];
      if (bd.orbitAround != null) {
        const host = allBodies[bd.orbitAround.bodyIndex];
        bullets[i].bindOrbit(host, bd.orbitAround.altitude, host.radius, bd.orbitAround.phase || 0, G);
      }
    }

    // 5. 建筑
    const buildings = (levelData.buildings || []).map(def => {
      const b = new Building();
      b.name = def.name || '';
      b.frameOrbit = def.orbit == null ? null : orbits[def.orbit];
      b.orbits = orbits;
      let coreWorldX = 0, coreWorldY = 0, initVx, initVy;

      // A building frame gives every anchor its own offset, including moving forts.
      if (b.frameOrbit) {
        const wp = b.frameOrbit.getWorldPosition(0, orbits);
        const wv = b.frameOrbit.getWorldVelocity(0, orbits);
        coreWorldX = wp.x; coreWorldY = wp.y;
        initVx = wv.vx; initVy = wv.vy;
      }

      // 第一遍：找出核心点（或建筑绑定）的世界位置和速度
      for (const pd of def.points) {
        if (!b.frameOrbit && pd.isCore && pd.orbit != null) {
          const orb = orbits[pd.orbit];
          const wp = orb.getWorldPosition(0, orbits);
          const wv = orb.getWorldVelocity(0, orbits);
          coreWorldX = wp.x; coreWorldY = wp.y;
          initVx = wv.vx; initVy = wv.vy;
        }
      }
      // 如果建筑没有核心但有 bindToBody，用该星体的位置和速度
      if (initVx === undefined && def.bindToBody != null) {
        const host = allBodies[def.bindToBody];
        const hp = host.getPosition();
        const hv = host.getVelocity();
        coreWorldX = hp.x; coreWorldY = hp.y;
        initVx = hv.vx; initVy = hv.vy;
      }

      // 第二遍：创建质点
      const pts = [];
      for (const pd of def.points) {
        const pt = { ...def.pointDefaults, ...pd };
        if (b.frameOrbit) {
          pt.x = (pd.x || 0) + coreWorldX;
          pt.y = (pd.y || 0) + coreWorldY;
          pt.vx = initVx; pt.vy = initVy;
          if (pd.fixed || pd.isCore) {
            pt.orbit = new Orbit({ type: 'fixed', x: pd.x || 0, y: pd.y || 0, parent: def.orbit });
            pt.orbits = orbits;
          }
        } else if (pd.isCore) {
          if (pd.orbit != null) {
            pt.orbit = orbits[pd.orbit];
            pt.orbits = orbits;
            const wp = pt.orbit.getWorldPosition(0, orbits);
            pt.x = wp.x; pt.y = wp.y;
          } else {
            pt.x = pd.x ?? coreWorldX;
            pt.y = pd.y ?? coreWorldY;
          }
        } else {
          pt.x = (pd.x || 0) + coreWorldX;
          pt.y = (pd.y || 0) + coreWorldY;
          if (initVx !== undefined) { pt.vx = initVx; pt.vy = initVy; }
        }
        pts.push(b.addPoint(pt));
      }

      for (const sd of (def.springs || [])) {
        b.addSpring({ ...def.springDefaults, ...sd, a: pts[sd.a], b: pts[sd.b] });
      }
      return b;
    });

    return {
      orbits, stars, planets, allBodies, bullets, buildings, physics,
      camera: levelData.camera || { x: 600, y: 400, zoom: 0.85 },
    };
  }

  /**
   * 判定通关结果
   */
  static checkResult(buildings, winCondition, performance = null) {
    let totalPoints = 0, alivePoints = 0;
    let importantTotal = 0, importantAlive = 0;
    let totalScore = 0;

    for (const b of buildings) {
      totalScore += b.score;
      for (const p of b.points) {
        totalPoints++;
        if (p.alive) alivePoints++;
        if (p.important) {
          importantTotal++;
          if (p.alive) importantAlive++;
        }
      }
    }

    const destructionRate = totalPoints > 0 ? (totalPoints - alivePoints) / totalPoints : 0;
    const destructionOk = destructionRate >= (winCondition.destructionThreshold || 0);
    const importantOk = !winCondition.importantTargetsAll || (importantTotal > 0 && importantAlive === 0);
    const scoreOk = totalScore >= (winCondition.minScore || 0);
    const passed = destructionOk && importantOk && scoreOk;

    let maxScore = 0;
    for (const b of buildings) for (const p of b.points) maxScore += p.score;

    let stars = 0;
    if (passed) {
      stars = 1;
      if (performance && winCondition.parShots != null) {
        if (performance.shotsUsed <= winCondition.parShots) {
          stars = 2;
          if (performance.deltaVSpent <= winCondition.parDeltaV) stars = 3;
        }
      } else {
        if (totalScore >= (winCondition.minScore || 0) * 1.5) stars = 2;
        if (maxScore > 0 && totalScore >= maxScore * 0.8) stars = 3;
      }
    }

    return {
      passed, stars, totalScore, destructionRate,
      importantRemaining: importantAlive,
    };
  }
}
