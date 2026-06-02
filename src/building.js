/**
 * 建筑与目标系统 — 弹簧质点模型、飞船目标
 *
 * - MassPoint: 质点（碰撞箱 + 分值 + 渲染绑定）
 * - Spring: 弹簧连接（张力超阈值断裂）
 * - Ship: 飞船（质点目标，冲量足够即摧毁）
 * - Building: 弹簧质点物理模拟 + 爆炸毁伤
 */

/**
 * 点到线段的最短距离
 * @returns {{ dist: number, x: number, y: number }}
 */
export function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) {
    // 退化为点
    const d = Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    return { dist: d, x: ax, y: ay };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  return { dist, x: cx, y: cy };
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
   * @param {number} [options.radius=8] - 碰撞半径
   * @param {number} [options.score=10] - 分值
   * @param {boolean} [options.important=false] - 是否重要目标
   * @param {boolean} [options.fixed=false] - 是否固定（不可移动）
   * @param {string} [options.color='#888'] - 渲染颜色
   * @param {number} [options.renderRadius] - 渲染半径（默认为碰撞半径）
   */
  constructor({ x, y, mass = 10, radius = 8, score = 10, important = false, fixed = false, color = '#888', renderRadius }) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.mass = mass;
    this.radius = radius;
    this.renderRadius = renderRadius ?? radius;
    this.score = score;
    this.important = important;
    this.fixed = fixed;
    this.color = color;
    this.alive = true;
    /** 是否与主体脱离（用于计算 70% 分数） */
    this.detached = false;
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
   * @param {number} [options.stiffness=200] - 刚度系数 k
   * @param {number} [options.damping=5] - 阻尼系数
   * @param {number} [options.breakTension=500] - 断裂张力阈值
   */
  constructor({ a, b, stiffness = 200, damping = 5, breakTension = 500 }) {
    this.a = a;
    this.b = b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    this.restLength = Math.sqrt(dx * dx + dy * dy);
    this.stiffness = stiffness;
    this.damping = damping;
    this.breakTension = breakTension;
    this.alive = true;
  }

  /** 当前长度 */
  get length() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 当前张力 */
  get tension() {
    return Math.abs(this.length - this.restLength) * this.stiffness;
  }
}

// ========================
// Ship
// ========================
export class Ship {
  /**
   * @param {Object} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} [options.mass=20]
   * @param {number} [options.radius=12] - 碰撞半径
   * @param {number} [options.requiredImpulse=100] - 摧毁所需冲击量
   * @param {number} [options.score=50] - 分值
   * @param {boolean} [options.important=true]
   * @param {string} [options.color='#ff8844']
   */
  constructor({ x, y, mass = 20, radius = 12, requiredImpulse = 100, score = 50, important = true, color = '#ff8844' }) {
    this.x = x;
    this.y = y;
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
  }

  /** 添加质点 */
  addPoint(options) {
    const p = new MassPoint(options);
    this.points.push(p);
    return p;
  }

  /** 添加弹簧 */
  addSpring(options) {
    const s = new Spring(options);
    this.springs.push(s);
    return s;
  }

  /**
   * 物理模拟一步（半隐式欧拉）
   * @param {number} dt - 时间步长
   * @param {number} [subSteps=4]
   */
  step(dt, subSteps = 4) {
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      // 计算每个质点受力
      const forces = this.points.map(p => ({ fx: 0, fy: 0 }));

      // 弹簧力
      for (const sp of this.springs) {
        if (!sp.alive) continue;
        const dx = sp.b.x - sp.a.x;
        const dy = sp.b.y - sp.a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) continue;
        const nx = dx / len;
        const ny = dy / len;

        // 胡克定律：F = k * (len - restLength)
        const extension = len - sp.restLength;
        const springForce = sp.stiffness * extension;

        // 阻尼力：沿弹簧方向的相对速度分量
        const relVx = sp.b.vx - sp.a.vx;
        const relVy = sp.b.vy - sp.a.vy;
        const relVn = relVx * nx + relVy * ny;
        const dampForce = sp.damping * relVn;

        const totalForce = springForce + dampForce;

        const ia = this.points.indexOf(sp.a);
        const ib = this.points.indexOf(sp.b);
        forces[ia].fx += totalForce * nx;
        forces[ia].fy += totalForce * ny;
        forces[ib].fx -= totalForce * nx;
        forces[ib].fy -= totalForce * ny;
      }

      // 半隐式欧拉积分
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        if (!p.alive || p.fixed) continue;
        const ax = forces[i].fx / p.mass;
        const ay = forces[i].fy / p.mass;
        p.vx += ax * subDt;
        p.vy += ay * subDt;
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
      }

      // 检查弹簧断裂
      for (const sp of this.springs) {
        if (!sp.alive) continue;
        if (sp.tension > sp.breakTension) {
          sp.alive = false;
        }
      }
    }
  }

  /**
   * 检测与子弹的碰撞
   * @param {number} bx - 子弹 x
   * @param {number} by - 子弹 y
   * @param {number} br - 子弹半径
   * @returns {MassPoint|null}
   */
  checkBulletCollision(bx, by, br) {
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - bx;
      const dy = p.y - by;
      if (Math.sqrt(dx * dx + dy * dy) < p.radius + br) {
        return p;
      }
    }
    return null;
  }

  /**
   * 检测子弹是否碰到弹簧线（弹簧碰撞体积）
   * @param {number} bx - 子弹 x
   * @param {number} by - 子弹 y
   * @param {number} br - 子弹半径
   * @returns {Spring|null}
   */
  checkSpringCollision(bx, by, br) {
    const springThickness = 2;
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const { dist } = pointToSegmentDist(bx, by, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
      if (dist < springThickness + br) {
        return sp;
      }
    }
    return null;
  }

  /**
   * 检测点是否与建筑任意元素碰撞（质点和弹簧）
   * @param {number} x
   * @param {number} y
   * @param {number} r - 检测半径
   * @returns {{ type: 'point', point: MassPoint, x: number, y: number } | { type: 'spring', spring: Spring, x: number, y: number } | null}
   */
  checkCollisionAt(x, y, r) {
    // 质点碰撞
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < p.radius + r) {
        return { type: 'point', point: p, x, y };
      }
    }
    // 弹簧碰撞
    const springThickness = 2;
    for (const sp of this.springs) {
      if (!sp.alive) continue;
      const { dist, x: cx, y: cy } = pointToSegmentDist(x, y, sp.a.x, sp.a.y, sp.b.x, sp.b.y);
      if (dist < springThickness + r) {
        return { type: 'spring', spring: sp, x: cx, y: cy };
      }
    }
    return null;
  }

  /**
   * 应用爆炸效果
   * @param {number} ex - 爆心 x
   * @param {number} ey - 爆心 y
   * @param {number} radius - 爆炸半径 r0
   * @param {number} impulse - 爆炸冲击量 P0
   * @returns {{ vaporizedPoints: MassPoint[], detachedPoints: MassPoint[], destroyedSprings: Spring[], totalScore: number }}
   */
  applyExplosion(ex, ey, radius, impulse) {
    const vaporizedPoints = [];
    const detachedPoints = [];
    const destroyedSprings = [];
    let totalScore = 0;

    if (radius <= 0) {
      // 动能武器：只对碰撞点施加冲击
      return { vaporizedPoints, detachedPoints, destroyedSprings, totalScore };
    }

    const vaporRadius = radius / 3;

    // 处理质点
    for (const p of this.points) {
      if (!p.alive) continue;
      const dx = p.x - ex;
      const dy = p.y - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < vaporRadius) {
        // 三分之一爆炸半径内：气化
        p.alive = false;
        vaporizedPoints.push(p);
        totalScore += p.score; // 气化 = 100% 分数
      } else if (dist < radius) {
        // 爆炸半径内：施加径向冲量
        const pVal = impulse * Math.exp(-dist / radius);
        const nx = dx / dist;
        const ny = dy / dist;
        if (!p.fixed) {
          p.vx += pVal * nx / p.mass;
          p.vy += pVal * ny / p.mass;
        }
      }
    }

    // 处理弹簧
    for (const sp of this.springs) {
      if (!sp.alive) continue;

      // 检查弹簧中点是否在气化范围内
      const midX = (sp.a.x + sp.b.x) / 2;
      const midY = (sp.a.y + sp.b.y) / 2;
      const mdx = midX - ex;
      const mdy = midY - ey;
      const midDist = Math.sqrt(mdx * mdx + mdy * mdy);

      if (midDist < vaporRadius) {
        sp.alive = false;
        destroyedSprings.push(sp);
      }
    }

    // 标记脱离的质点（与固定点失去连接的）
    // 简化：气化点附近的质点标为 detached
    for (const p of this.points) {
      if (!p.alive || p.fixed) continue;
      const dx = p.x - ex;
      const dy = p.y - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= vaporRadius && dist < radius && !vaporizedPoints.includes(p)) {
        // 检查是否还与固定点或其他活点连接
        let connected = false;
        for (const sp of this.springs) {
          if (!sp.alive) continue;
          if ((sp.a === p && sp.b.alive) || (sp.b === p && sp.a.alive)) {
            connected = true;
            break;
          }
        }
        if (!connected) {
          p.detached = true;
          detachedPoints.push(p);
          totalScore += p.score * 0.7; // 脱离 = 70% 分数
        }
      }
    }

    return { vaporizedPoints, detachedPoints, destroyedSprings, totalScore };
  }

  /** 获取存活质点数 */
  get alivePointCount() {
    return this.points.filter(p => p.alive).length;
  }

  /** 获取存活弹簧数 */
  get aliveSpringCount() {
    return this.springs.filter(s => s.alive).length;
  }
}
