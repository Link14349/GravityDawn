/**
 * 建筑与目标系统 — 弹簧质点模型、飞船目标
 *
 * - MassPoint: 质点（碰撞箱 + 分值 + 爆炸属性 + 核心点支持）
 * - Spring: 弹簧连接（张力超阈值断裂）
 * - Ship: 飞船（质点目标，冲量足够即摧毁）
 * - Building: 弹簧质点物理模拟 + 重力 + 碰撞 + 爆炸毁伤
 */

import { VAPOR_RATIO, calcExplosionImpulse } from './explosion.js';

/** 质点-质点碰撞爆炸速度阈值 */
export const PP_COLLISION_THRESHOLD = 80;
/** 质点-星体碰撞爆炸速度阈值 */
export const PS_COLLISION_THRESHOLD = 120;
/** 敌人碰撞阈值（更高，不易误爆） */
export const ENEMY_PP_THRESHOLD = 150;
export const ENEMY_PS_THRESHOLD = 200;
/** 质点离游戏中心超过此距离则消失记分 */
// 初始缩放比下超出屏幕30%即消失: 1200/2*1.3=780
export const DESPAWN_RADIUS = 800;

// ========================
// 工具函数
// ========================

export function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) {
    const d = Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    return { dist: d, x: ax, y: ay };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return { dist: Math.sqrt((px - cx) ** 2 + (py - cy) ** 2), x: cx, y: cy };
}

// ========================
// MassPoint
// ========================
export class MassPoint {
  /**
   * @param {Object} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} [options.mass=10]
   * @param {number} [options.radius=8]
   * @param {number} [options.score=10]
   * @param {boolean} [options.important=false]
   * @param {boolean} [options.fixed=false] - 是否不受物理力（旧参数，建议用 isCore）
   * @param {boolean} [options.isCore=false] - 是否为核心质点（走参数方程，不感受重力）
   * @param {Function} [options.orbitFn] - 核心点的参数方程轨道 (t) => {x, y}
   * @param {number} [options.explosionRadius=0] - 自身爆炸半径
   * @param {number} [options.explosionImpulse=0] - 自身爆炸冲量
   * @param {string} [options.color='#888']
   * @param {number} [options.renderRadius]
   */
  constructor({ x, y, mass = 10, radius = 8, score = 10, important = false, fixed = false, isCore = false, isEnemy = false, hp = 100, orbitFn = null, explosionRadius = 0, explosionImpulse = 0, color = '#888', renderRadius }) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.mass = mass;
    this.radius = radius;
    this.renderRadius = renderRadius ?? radius;
    this.score = score;
    this.important = important;
    this.fixed = fixed;
    this.isCore = isCore || fixed;
    this.isEnemy = isEnemy || false;
    this.hp = hp;
    this.maxHp = hp;
    this.orbitFn = orbitFn || (() => ({ x: this._initX ?? x, y: this._initY ?? y }));
    this._initX = x;
    this._initY = y;
    this.explosionRadius = explosionRadius;
    this.explosionImpulse = explosionImpulse;
    this.color = color;
    this.alive = true;
    this.detached = false;
    this._orbitTime = 0;
  }
}

// ========================
// Spring
// ========================
export class Spring {
  /**
   * @param {Object} options
   * @param {MassPoint} options.a
   * @param {MassPoint} options.b
   * @param {number} [options.stiffness=200]
   * @param {number} [options.damping=5]
   * @param {number} [options.breakTension=500]
   */
  constructor({ a, b, stiffness = 200, damping = 15, breakTension = 800, restLength }) {
    this.a = a; this.b = b;
    if (restLength != null) {
      this.restLength = restLength;
    } else {
      const dx = b.x - a.x, dy = b.y - a.y;
      this.restLength = Math.sqrt(dx * dx + dy * dy);
    }
    this.stiffness = stiffness;
    this.damping = damping;
    this.breakTension = breakTension;
    this.alive = true;
  }
  get length() {
    const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  get tension() {
    return Math.abs(this.length - this.restLength) * this.stiffness;
  }
}

// ========================
// Ship
// ========================
export class Ship {
  constructor({ x, y, mass = 20, radius = 12, requiredImpulse = 100, score = 50, important = true, color = '#ff8844' }) {
    this.x = x; this.y = y;
    this.mass = mass;
    this.radius = radius;
    this.requiredImpulse = requiredImpulse;
    this.score = score;
    this.important = important;
    this.color = color;
    this.alive = true;
  }
}

// ========================
// Building
// ========================
export class Building {
  constructor() {
    /** @type {MassPoint[]} */
    this.points = [];
    /** @type {Spring[]} */
    this.springs = [];
    /** 累计得分 */
    this.score = 0;
  }

  addPoint(options) {
    const p = new MassPoint(options);
    this.points.push(p);
    return p;
  }
  addSpring(options) {
    const s = new Spring(options);
    this.springs.push(s);
    return s;
  }

  /**
   * 物理模拟一步
   * @param {number} dt
   * @param {import('./physics.js').PhysicsEngine} physics
   * @param {import('./celestial.js').CelestialBody[]} bodies
   * @param {number} [subSteps=4]
   * @returns {{ explosions: Array }} 本帧发生的爆炸事件
   */
  step(dt, physics, bodies, subSteps = 4) {
    const subDt = dt / subSteps;
    const explosions = [];

    for (let s = 0; s < subSteps; s++) {
      // 1. 核心点更新
      for (const p of this.points) {
        if (!p.alive || !p.isCore) continue;
        p._orbitTime += subDt;
        const pos = p.orbitFn(p._orbitTime);
        p.x = pos.x;
        p.y = pos.y;
      }

      // 2. 重力
      for (const p of this.points) {
        if (!p.alive || p.isCore) continue;
        const { ax, ay } = physics.calcGravityAccel(p.x, p.y);
        p.vx += ax * subDt;
        p.vy += ay * subDt;
      }

      // 3. 弹簧力（端点死亡则弹簧无效）
      const forces = this.points.map(() => ({ fx: 0, fy: 0 }));
      for (const sp of this.springs) {
        if (!sp.alive || !sp.a.alive || !sp.b.alive) continue;
        const dx = sp.b.x - sp.a.x, dy = sp.b.y - sp.a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) continue;
        const nx = dx / len, ny = dy / len;
        const extension = len - sp.restLength;
        const springForce = sp.stiffness * extension;
        const relVn = (sp.b.vx - sp.a.vx) * nx + (sp.b.vy - sp.a.vy) * ny;
        const dampForce = sp.damping * relVn;
        const totalForce = springForce + dampForce;
        const ia = this.points.indexOf(sp.a), ib = this.points.indexOf(sp.b);
        forces[ia].fx += totalForce * nx;
        forces[ia].fy += totalForce * ny;
        forces[ib].fx -= totalForce * nx;
        forces[ib].fy -= totalForce * ny;
      }

      // 4. 半隐式欧拉 + 速度阻尼
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        if (!p.alive || p.isCore) continue;
        p.vx += (forces[i].fx / p.mass) * subDt;
        p.vy += (forces[i].fy / p.mass) * subDt;
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
      }

      // 5. 子步内星体碰撞检测（增量修正，防止速度累积）
      this._resolveStarCollisions(bodies, explosions, subDt);

      // 6. 弹簧断裂
      for (const sp of this.springs) {
        if (!sp.alive) continue;
        if (sp.tension > sp.breakTension) {
          sp.alive = false;
        }
      }
    }

    this._checkPointCollisions(explosions);
    this._checkPointSpringCollisions(explosions);

    // 质点飞太远→消失记分
    for (const p of this.points) {
      if (!p.alive) continue;
      if (Math.abs(p.x) > DESPAWN_RADIUS || Math.abs(p.y) > DESPAWN_RADIUS) {
        p.alive = false; // 直接消失不触发连锁反应
        this.score += p.score;
      }
    }

    return { explosions };
  }

  /** 子步内星体碰撞修正（增量处理，防止速度累积到爆炸阈值） */
  _resolveStarCollisions(bodies, explosions, subDt) {
    for (const p of this.points) {
      if (!p.alive || p.isCore) continue;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const bp = body.getPosition();
        const dx = p.x - bp.x, dy = p.y - bp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const colR = body.collisionRadius || body.radius;
        if (dist < colR + p.radius) {
          const bv = body.getVelocity ? body.getVelocity() : { vx: 0, vy: 0 };
          const relVx = p.vx - bv.vx;
          const relVy = p.vy - bv.vy;
          const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
          const starThresh = p.isEnemy ? ENEMY_PS_THRESHOLD : PS_COLLISION_THRESHOLD;
          if (relSpeed > starThresh) {
            if (p.isEnemy) {
              this._damageEnemy(p, relSpeed * 0.8);
            } else {
              explosions.push({ x: p.x, y: p.y, radius: p.explosionRadius, impulse: p.explosionImpulse });
              this._triggerPointExplosion(p, p.explosionImpulse, p.explosionRadius);
              p.alive = false;
              if (p.important) this.score += p.score;
              else this.score += p.score * 0.7;
            }
          } else {
            // 完全非弹性碰撞：法向归零 + 切向摩擦衰减 0.95
            const nx = dx / dist, ny = dy / dist;
            p.x = bp.x + (colR + p.radius) * nx;
            p.y = bp.y + (colR + p.radius) * ny;
            const rvx = p.vx - bv.vx;
            const rvy = p.vy - bv.vy;
            const relVn = rvx * nx + rvy * ny;
            p.vx -= relVn * nx; // 清零法向
            p.vy -= relVn * ny;
            // 切向摩擦
            p.vx = bv.vx + (p.vx - bv.vx) * 0.85;
            p.vy = bv.vy + (p.vy - bv.vy) * 0.85;
          }
        }
      }
    }
  }

  /** 质点间碰撞 */
  _checkPointCollisions(explosions) {
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.points.length; j++) {
        const b = this.points[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;
        if (dist >= minDist || dist < 0.001) continue;

        const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
        const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

        const ppThresh = (a.isEnemy || b.isEnemy) ? ENEMY_PP_THRESHOLD : PP_COLLISION_THRESHOLD;
        if (relSpeed > ppThresh) {
          if (a.isEnemy) { this._damageEnemy(a, relSpeed * 0.5); }
          else if (b.isEnemy) { this._damageEnemy(b, relSpeed * 0.5); }
          else {
            // 普通质点高速碰撞→爆炸
            const combinedImpulse = a.explosionImpulse + b.explosionImpulse;
            const maxRadius = Math.max(a.explosionRadius, b.explosionRadius);
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            explosions.push({ x: midX, y: midY, radius: maxRadius, impulse: combinedImpulse });
            this._triggerPointExplosion(a, combinedImpulse, maxRadius);
            this._triggerPointExplosion(b, combinedImpulse, maxRadius);
            if (a.alive) { a.alive = false; this.score += a.score; }
            if (b.alive) { b.alive = false; this.score += b.score; }
          }
        } else {
          // 低速→非弹性碰撞
          const totalMass = a.mass + b.mass;
          const cmVx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
          const cmVy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
          const nx = dx / dist, ny = dy / dist;
          // 分离重叠
          const overlap = minDist - dist;
          a.x -= nx * overlap * (b.mass / totalMass);
          a.y -= ny * overlap * (b.mass / totalMass);
          b.x += nx * overlap * (a.mass / totalMass);
          b.y += ny * overlap * (a.mass / totalMass);
          if (!a.isCore) { a.vx = cmVx; a.vy = cmVy; }
          if (!b.isCore) { b.vx = cmVx; b.vy = cmVy; }
        }
      }
    }
  }

  /** 质点-弹簧碰撞检测 */
  _checkPointSpringCollisions(explosions) {
    const springThickness = 2;
    for (const p of this.points) {
      if (!p.alive || p.isCore) continue;
      for (const sp of this.springs) {
        if (!sp.alive) continue;
        // 跳过与自身相连的弹簧（已由弹簧力处理）
        if (sp.a === p || sp.b === p) continue;
        const { dist, x: cx, y: cy } = pointToSegmentDist(p.x, p.y, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
        const minDist = p.radius + springThickness;
        if (dist >= minDist) continue;

        // 相对速度（质点在弹簧最近点处的速度 vs 弹簧中点速度）
        const midVx = (sp.a.vx + sp.b.vx) / 2;
        const midVy = (sp.a.vy + sp.b.vy) / 2;
        const relSpeed = Math.sqrt((p.vx - midVx) ** 2 + (p.vy - midVy) ** 2);

        if (p.isEnemy) {
          if (relSpeed > ENEMY_PP_THRESHOLD) {
            this._damageEnemy(p, relSpeed * 0.8);
          } else {
            // 低速→完全非弹性碰撞
            const nx = (cx - p.x) / dist, ny = (cy - p.y) / dist;
            p.x -= nx * (minDist - dist);
            p.y -= ny * (minDist - dist);
            p.vx = midVx; p.vy = midVy;
          }
        } else {
          if (relSpeed > PS_COLLISION_THRESHOLD) {
            // 高速(>120)→质点爆炸+弹簧断裂
            const combinedImpulse = p.explosionImpulse;
            const maxRadius = p.explosionRadius;
            explosions.push({ x: cx, y: cy, radius: maxRadius, impulse: combinedImpulse });
            this._triggerPointExplosion(p, combinedImpulse, maxRadius);
            this._killPoint(p);
            this.score += p.score;
            sp.alive = false;
          } else if (relSpeed > PP_COLLISION_THRESHOLD) {
            // 中速(80-120)→切断弹簧+传递冲量
            this.cutSpringAndTransferImpulse(sp, p.explosionImpulse || 200);
            const nx = (cx - p.x) / dist, ny = (cy - p.y) / dist;
            p.x -= nx * (minDist - dist);
            p.y -= ny * (minDist - dist);
          } else {
            // 低速(≤80)→完全非弹性碰撞，不切断弹簧
            const nx = (cx - p.x) / dist, ny = (cy - p.y) / dist;
            p.x -= nx * (minDist - dist);
            p.y -= ny * (minDist - dist);
            p.vx = midVx; p.vy = midVy;
          }
        }
      }
    }
  }

  /** 杀死质点并断裂所有连接弹簧 */
  _killPoint(p) {
    if (!p.alive) return;
    p.alive = false;
    for (const sp of this.springs) {
      if (sp.alive && (sp.a === p || sp.b === p)) sp.alive = false;
    }
  }

  /**
   * 对敌人造成碰撞伤害
   * @returns {boolean} 敌人是否死亡
   */
  _damageEnemy(enemy, damage) {
    if (!enemy.isEnemy) return false;
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      this.score += enemy.score;
      return true;
    }
    return false;
  }

  /** 触发单点爆炸，影响周围质点和弹簧 */
  _triggerPointExplosion(point, impulse, radius) {
    if (radius <= 0) return;

    // 爆炸半径 1/2 内的敌人直接死亡
    const instaKillR = radius * 0.5;
    for (const p of this.points) {
      if (!p.alive || !p.isEnemy) continue;
      const dx = p.x - point.x, dy = p.y - point.y;
      if (Math.sqrt(dx * dx + dy * dy) < instaKillR) {
        p.hp = 0;
        p.alive = false;
        this.score += p.score;
      }
    }

    // 与该点相连的所有弹簧断裂，并传递爆炸冲量给连接点
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      if (sp.a === point || sp.b === point) {
        sp.alive = false;
        const other = sp.a === point ? sp.b : sp.a;
        if (other.alive && !other.isCore) {
          const dx = other.x - point.x;
          const dy = other.y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.001) {
            const nx = dx / dist;
            const ny = dy / dist;
            other.vx += (impulse * nx) / other.mass;
            other.vy += (impulse * ny) / other.mass;
          }
        }
      }
    }

    const vapR = radius * VAPOR_RATIO;
    for (const p of this.points) {
      if (p === point || !p.alive) continue;
      const dx = p.x - point.x, dy = p.y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < vapR) {
        this._killPoint(p);
        this.score += p.score;
        continue;
      }
      if (dist < radius && !p.isCore) {
        const pVal = calcExplosionImpulse(dist, impulse, radius);
        const nx = dx / dist, ny = dy / dist;
        p.vx += pVal * nx / p.mass;
        p.vy += pVal * ny / p.mass;
      }
    }
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const mx = (sp.a.x + sp.b.x) / 2, my = (sp.a.y + sp.b.y) / 2;
      const dx = mx - point.x, dy = my - point.y;
      if (Math.sqrt(dx * dx + dy * dy) < vapR) sp.alive = false;
    }
  }

  cutSpringAndTransferImpulse(spring, impulse) {
    if (!spring.alive) return;
    spring.alive = false;
    const dx = spring.b.x - spring.a.x, dy = spring.b.y - spring.a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    const nx = dx / len, ny = dy / len;
    // 爆炸冲量沿弹簧向外推开两端质点
    if (!spring.a.isCore && spring.a.alive) {
      spring.a.vx -= (impulse * nx) / spring.a.mass;
      spring.a.vy -= (impulse * ny) / spring.a.mass;
    }
    if (!spring.b.isCore && spring.b.alive) {
      spring.b.vx += (impulse * nx) / spring.b.mass;
      spring.b.vy += (impulse * ny) / spring.b.mass;
    }
  }

  /**
   * 处理子弹撞击（碰撞检测 + 爆炸 + 弹簧切断 + 记分）
   * @param {number} bx - 子弹 x
   * @param {number} by - 子弹 y
   * @param {number} br - 子弹半径
   * @param {number} bulletImpulse - 子弹爆炸冲量 P0
   * @param {number} bulletRadius - 子弹爆炸半径 r0
   * @returns {{ hit: boolean, explosion: {x:number,y:number,radius:number,impulse:number}|null }}
   */
  handleBulletImpact(bx, by, br, bulletImpulse, bulletRadius) {
    // 检测质点碰撞
    const hitPoint = this.checkBulletCollision(bx, by, br);
    const hitSpring = hitPoint ? null : this.checkSpringCollision(bx, by, br);

    if (!hitPoint && !hitSpring) return { hit: false, explosion: null };

    let combinedR = bulletRadius;
    let combinedP = bulletImpulse;

    if (hitPoint) {
      // 子弹+质点爆炸属性叠加
      combinedP += hitPoint.explosionImpulse;
      combinedR = Math.max(combinedR, hitPoint.explosionRadius);
      this._triggerPointExplosion(hitPoint, combinedP, combinedR);
      this._killPoint(hitPoint);
      this.score += hitPoint.score;
    } else if (hitSpring) {
      this.cutSpringAndTransferImpulse(hitSpring, bulletImpulse);
    }

    // 区域爆炸效果
    this.applyExplosion(bx, by, combinedR, combinedP);

    return { hit: true, explosion: { x: bx, y: by, radius: combinedR, impulse: combinedP } };
  }

  checkBulletCollision(bx, by, br) {
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - bx, dy = p.y - by;
      if (Math.sqrt(dx * dx + dy * dy) < p.radius + br) return p;
    }
    return null;
  }

  checkSpringCollision(bx, by, br) {
    const springThickness = 2;
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const { dist } = pointToSegmentDist(bx, by, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
      if (dist < springThickness + br) return sp;
    }
    return null;
  }

  checkCollisionAt(x, y, r) {
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - x, dy = p.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < p.radius + r) {
        return { type: 'point', point: p, x, y };
      }
    }
    const st = 2;
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const { dist, x: cx, y: cy } = pointToSegmentDist(x, y, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
      if (dist < st + r) return { type: 'spring', spring: sp, x: cx, y: cy };
    }
    return null;
  }

  applyExplosion(ex, ey, radius, impulse) {
    const vaporizedPoints = [], detachedPoints = [], destroyedSprings = [];
    let totalScore = 0;
    if (radius <= 0) return { vaporizedPoints, detachedPoints, destroyedSprings, totalScore };

    // 爆炸半径 1/2 内的敌人直接死亡
    const instaKillR = radius * 0.5;
    for (const p of this.points) {
      if (!p.alive || !p.isEnemy) continue;
      const dx = p.x - ex, dy = p.y - ey;
      if (Math.sqrt(dx * dx + dy * dy) < instaKillR) {
        p.hp = 0; p.alive = false;
        this.score += p.score;
        vaporizedPoints.push(p);
      }
    }

    const vapR = radius * VAPOR_RATIO;
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - ex, dy = p.y - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < vapR) {
        this._killPoint(p); vaporizedPoints.push(p);
        totalScore += p.score;
      } else if (dist < radius && !p.isCore) {
        const pVal = calcExplosionImpulse(dist, impulse, radius);
        const nx = dx / dist, ny = dy / dist;
        p.vx += pVal * nx / p.mass;
        p.vy += pVal * ny / p.mass;
      }
    }
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const mx = (sp.a.x + sp.b.x) / 2, my = (sp.a.y + sp.b.y) / 2;
      const dx = mx - ex, dy = my - ey;
      if (Math.sqrt(dx * dx + dy * dy) < vapR) {
        sp.alive = false; destroyedSprings.push(sp);
      }
    }
    for (const p of this.points) {
      if (!p.alive || p.isCore) continue;
      const dx = p.x - ex, dy = p.y - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= vapR && dist < radius && !vaporizedPoints.includes(p)) {
        let connected = false;
        for (const sp of this.springs) {
          if (!sp.alive) continue;
          if ((sp.a === p && sp.b.alive) || (sp.b === p && sp.a.alive)) { connected = true; break; }
        }
        if (!connected) { p.detached = true; detachedPoints.push(p); totalScore += p.score * 0.7; }
      }
    }
    return { vaporizedPoints, detachedPoints, destroyedSprings, totalScore };
  }

  get alivePointCount() { return this.points.filter(p => p.alive).length; }
  get aliveSpringCount() { return this.springs.filter(s => s.alive).length; }

  /** 获取所有存活质点的 AABB 包围盒 */
  getAABB() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (!p.alive) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  /**
   * 跨建筑碰撞检测（AABB 粗筛 + 精细检测）
   * @param {Building[]} buildings
   * @param {Array} explosions
   */
  static checkCrossCollisions(buildings, explosions) {
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const a = buildings[i], b = buildings[j];
        const bbA = a.getAABB(), bbB = b.getAABB();
        // AABB 粗筛
        if (bbA.maxX < bbB.minX || bbA.minX > bbB.maxX ||
            bbA.maxY < bbB.minY || bbA.minY > bbB.maxY) continue;
        // 精细：质点-质点
        for (const pa of a.points) {
          if (!pa.alive) continue;
          for (const pb of b.points) {
            if (!pb.alive) continue;
            const dx = pb.x - pa.x, dy = pb.y - pa.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = pa.radius + pb.radius;
            if (dist >= minDist || dist < 0.001) continue;
            const relSpeed = Math.sqrt((pb.vx - pa.vx) ** 2 + (pb.vy - pa.vy) ** 2);
            const thresh = (pa.isEnemy || pb.isEnemy) ? ENEMY_PP_THRESHOLD : PP_COLLISION_THRESHOLD;
            if (relSpeed > thresh) {
              const combinedImpulse = pa.explosionImpulse + pb.explosionImpulse;
              const maxRadius = Math.max(pa.explosionRadius, pb.explosionRadius);
              explosions.push({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, radius: maxRadius, impulse: combinedImpulse });
              if (pa.isEnemy) { a._damageEnemy(pa, relSpeed * 0.5); }
              else { a._triggerPointExplosion(pa, combinedImpulse, maxRadius); a._killPoint(pa); a.score += pa.score; }
              if (pb.isEnemy) { b._damageEnemy(pb, relSpeed * 0.5); }
              else { b._triggerPointExplosion(pb, combinedImpulse, maxRadius); b._killPoint(pb); b.score += pb.score; }
            } else {
              const totalMass = pa.mass + pb.mass;
              const cmVx = (pa.vx * pa.mass + pb.vx * pb.mass) / totalMass;
              const cmVy = (pa.vy * pa.mass + pb.vy * pb.mass) / totalMass;
              const nx = dx / dist, ny = dy / dist;
              const overlap = minDist - dist;
              pa.x -= nx * overlap * (pb.mass / totalMass);
              pa.y -= ny * overlap * (pb.mass / totalMass);
              pb.x += nx * overlap * (pa.mass / totalMass);
              pb.y += ny * overlap * (pa.mass / totalMass);
              if (!pa.isCore) { pa.vx = cmVx; pa.vy = cmVy; }
              if (!pb.isCore) { pb.vx = cmVx; pb.vy = cmVy; }
            }
          }
        }
        // 精细：质点-弹簧（a的质点 vs b的弹簧）
        for (const pa of a.points) {
          if (!pa.alive || pa.isCore) continue;
          for (const sp of b.springs) {
            if (!sp.alive || !sp.a.alive || !sp.b.alive) continue;
            if (sp.a === pa || sp.b === pa) continue;
            const { dist, x: cx, y: cy } = pointToSegmentDist(pa.x, pa.y, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
            const minDist = pa.radius + 2;
            if (dist >= minDist) continue;
            const midVx = (sp.a.vx + sp.b.vx) / 2, midVy = (sp.a.vy + sp.b.vy) / 2;
            const relSpeed = Math.sqrt((pa.vx - midVx) ** 2 + (pa.vy - midVy) ** 2);
            if (pa.isEnemy) {
              if (relSpeed > ENEMY_PP_THRESHOLD) { a._damageEnemy(pa, relSpeed * 0.5); }
              else { const nx = (cx - pa.x) / dist, ny = (cy - pa.y) / dist; pa.x -= nx * (minDist - dist); pa.y -= ny * (minDist - dist); pa.vx = midVx; pa.vy = midVy; }
            } else {
              if (relSpeed > PS_COLLISION_THRESHOLD) {
                a._triggerPointExplosion(pa, pa.explosionImpulse, pa.explosionRadius); a._killPoint(pa); a.score += pa.score; sp.alive = false;
              } else if (relSpeed > PP_COLLISION_THRESHOLD) {
                b.cutSpringAndTransferImpulse(sp, pa.explosionImpulse || 200); const nx = (cx - pa.x) / dist, ny = (cy - pa.y) / dist; pa.x -= nx * (minDist - dist); pa.y -= ny * (minDist - dist);
              } else {
                const nx = (cx - pa.x) / dist, ny = (cy - pa.y) / dist; pa.x -= nx * (minDist - dist); pa.y -= ny * (minDist - dist); pa.vx = midVx; pa.vy = midVy;
              }
            }
          }
        }
        // 对称：b的质点 vs a的弹簧
        for (const pb of b.points) {
          if (!pb.alive || pb.isCore) continue;
          for (const sp of a.springs) {
            if (!sp.alive || !sp.a.alive || !sp.b.alive) continue;
            if (sp.a === pb || sp.b === pb) continue;
            const { dist, x: cx, y: cy } = pointToSegmentDist(pb.x, pb.y, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
            const minDist = pb.radius + 2;
            if (dist >= minDist) continue;
            const midVx = (sp.a.vx + sp.b.vx) / 2, midVy = (sp.a.vy + sp.b.vy) / 2;
            const relSpeed = Math.sqrt((pb.vx - midVx) ** 2 + (pb.vy - midVy) ** 2);
            if (pb.isEnemy) {
              if (relSpeed > ENEMY_PP_THRESHOLD) { b._damageEnemy(pb, relSpeed * 0.5); }
              else { const nx = (cx - pb.x) / dist, ny = (cy - pb.y) / dist; pb.x -= nx * (minDist - dist); pb.y -= ny * (minDist - dist); pb.vx = midVx; pb.vy = midVy; }
            } else {
              if (relSpeed > PS_COLLISION_THRESHOLD) {
                b._triggerPointExplosion(pb, pb.explosionImpulse, pb.explosionRadius); b._killPoint(pb); b.score += pb.score; sp.alive = false;
              } else if (relSpeed > PP_COLLISION_THRESHOLD) {
                a.cutSpringAndTransferImpulse(sp, pb.explosionImpulse || 200); const nx = (cx - pb.x) / dist, ny = (cy - pb.y) / dist; pb.x -= nx * (minDist - dist); pb.y -= ny * (minDist - dist);
              } else {
                const nx = (cx - pb.x) / dist, ny = (cy - pb.y) / dist; pb.x -= nx * (minDist - dist); pb.y -= ny * (minDist - dist); pb.vx = midVx; pb.vy = midVy;
              }
            }
          }
        }
      }
    }
  }
}
