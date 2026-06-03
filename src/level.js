/**
 * 关卡系统 — 数据格式定义 + 加载器 + 结算判定
 *
 * ## 关卡数据格式 (LevelData)
 * {
 *   name: string,              // 关卡名称
 *   gravity: number,           // 引力常量 G
 *   camera: { x, y, zoom },    // 初始镜头位置
 *   stars: [StarDef],          // 恒星（固定位置）
 *   planets: [PlanetDef],      // 行星（参数轨道）
 *   bullets: [BulletDef],      // 子弹配置
 *   buildings: [BuildingDef],  // 建筑配置
 *   winCondition: {            // 通关条件
 *     destructionThreshold: number,  // 质点毁伤比例 (0-1)
 *     importantTargetsAll: boolean,  // 所有重要目标必须摧毁
 *     minScore: number               // 最低分数
 *   }
 * }
 *
 * ## 轨道格式 (OrbitDef)
 *   固定:   { type: 'fixed', x, y }
 *   圆形:   { type: 'circular', cx, cy, radius, period, phase }
 *   椭圆:   { type: 'elliptical', cx, cy, rx, ry, period, phase }
 */

import { CelestialBody } from './celestial.js';
import { Bullet } from './bullet.js';
import { Building, Spring } from './building.js';
import { PhysicsEngine } from './physics.js';

/** 从轨道定义创建 CelestialBody */
function createBody(def) {
  const { mass, radius, color, label, collisionRadius, orbit } = def;
  let orbitFn;
  if (orbit.type === 'circular') {
    orbitFn = CelestialBody.circularOrbit(orbit.cx, orbit.cy, orbit.radius, orbit.period, orbit.phase);
  } else if (orbit.type === 'elliptical') {
    orbitFn = CelestialBody.ellipticalOrbit(orbit.cx, orbit.cy, orbit.rx, orbit.ry, orbit.period, orbit.phase);
  } else {
    orbitFn = CelestialBody.fixedPosition(orbit.x, orbit.y);
  }
  return new CelestialBody({ mass, radius, color, label, collisionRadius, orbit: orbitFn });
}

/** 从关卡数据构建建筑 */
function createBuilding(def, allBodies) {
  const b = new Building();
  // 计算核心偏移量（用于把相对坐标转世界坐标）
  let coreOffsetX = 0, coreOffsetY = 0, _coreInitVx, _coreInitVy;
  for (const pd of def.points) {
    if (pd.isCore && pd.coreOrbit) {
      const host = allBodies[pd.coreOrbit.bodyIndex];
      const altitude = pd.coreOrbit.altitude || 0;
      const phase = pd.coreOrbit.phase || 0;
      const hp = host.getPosition();
      coreOffsetX = hp.x + altitude * Math.cos(phase);
      coreOffsetY = hp.y + altitude * Math.sin(phase);
      // 计算行星初速度（供建筑质点继承）
      const hv = host.getVelocity();
      _coreInitVx = hv.vx;
      _coreInitVy = hv.vy;
      pd.orbitFn = (t) => {
        const hp2 = host.getPosition();
        return { x: hp2.x + altitude * Math.cos(phase), y: hp2.y + altitude * Math.sin(phase) };
      };
    }
  }
  const pts = [];
  for (const pd of def.points) {
    if (!pd.isCore) {
      pd.x = (pd.x || 0) + coreOffsetX;
      pd.y = (pd.y || 0) + coreOffsetY;
      // 非核心点继承行星速度
      if (_coreInitVx !== undefined) {
        pd.vx = _coreInitVx;
        pd.vy = _coreInitVy;
      }
    }
    pts.push(b.addPoint(pd));
  }
  for (const sd of (def.springs || [])) {
    b.addSpring({ ...sd, a: pts[sd.a], b: pts[sd.b] });
  }
  return b;
}

export class LevelManager {
  /**
   * 加载关卡数据，返回游戏对象
   * @param {Object} levelData
   * @returns {{ stars: CelestialBody[], planets: CelestialBody[], allBodies: CelestialBody[], bullets: Bullet[], buildings: Building[], physics: PhysicsEngine, camera: {x,y,zoom} }}
   */
  static load(levelData) {
    const G = levelData.gravity || 300;

    // 星体
    const stars = (levelData.stars || []).map(createBody);
    const planets = (levelData.planets || []).map(createBody);
    const allBodies = [...stars, ...planets];

    // 物理引擎
    const physics = new PhysicsEngine({ G });
    for (const b of allBodies) {
      const p = b.getPosition();
      physics.addGravitySource(p.x, p.y, b.mass, b.collisionRadius, b.orbitFn);
    }

    // 子弹
    const bullets = (levelData.bullets || []).map(d => new Bullet(d));
    for (let i = 0; i < bullets.length; i++) {
      const bd = levelData.bullets[i];
      if (bd.orbitAround != null) {
        const host = allBodies[bd.orbitAround.bodyIndex];
        bullets[i].bindOrbit(host, bd.orbitAround.altitude, host.radius, bd.orbitAround.phase || 0, G);
      }
    }

    // 建筑
    const buildings = (levelData.buildings || []).map(d => createBuilding(d, allBodies));

    return {
      stars, planets, allBodies, bullets, buildings, physics,
      camera: levelData.camera || { x: 600, y: 400, zoom: 0.85 },
    };
  }

  /**
   * 判定通关结果
   * @param {Building[]} buildings
   * @param {Object} winCondition
   * @returns {{ passed: boolean, stars: number, totalScore: number, destructionRate: number, importantRemaining: number }}
   */
  static checkResult(buildings, winCondition) {
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

    // 计算满分（所有质点分值之和）
    let maxScore = 0;
    for (const b of buildings) {
      for (const p of b.points) maxScore += p.score;
    }

    // 星级：1星→通过, 2星→score≥minScore×1.5, 3星→score≥maxScore×0.8
    let stars = 0;
    if (passed) {
      stars = 1;
      if (totalScore >= (winCondition.minScore || 0) * 1.5) stars = 2;
      if (maxScore > 0 && totalScore >= maxScore * 0.8) stars = 3;
    }

    return {
      passed,
      stars,
      totalScore,
      destructionRate,
      importantRemaining: importantAlive,
    };
  }
}
