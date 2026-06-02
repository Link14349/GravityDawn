import { G, DT, SUB_STEPS, MIN_DISTANCE, PREDICTION_STEPS, PREDICTION_DT } from './constants.js';

/**
 * 物理引擎 — 半隐式欧拉积分器 + 万有引力计算
 *
 * 半隐式欧拉法：
 *   v(t+dt) = v(t) + a(t) * dt
 *   x(t+dt) = x(t) + v(t+dt) * dt
 */
export class PhysicsEngine {
  constructor(options = {}) {
    this.G = options.G ?? G;
    this.dt = options.dt ?? DT;
    this.subSteps = options.subSteps ?? SUB_STEPS;

    /** @type {{ x: number, y: number, mass: number }[]} */
    this.gravitySources = [];

    /** @type {{ x: number, y: number, vx: number, vy: number, mass: number, ax: number, ay: number }[]} */
    this.particles = [];
  }

  /** 添加引力源（星体），可选碰撞半径 */
  addGravitySource(x, y, mass, collisionRadius = 0) {
    this.gravitySources.push({ x, y, mass, collisionRadius });
  }

  /**
   * 更新引力源位置（用于移动的星体）
   * @param {number} index
   * @param {number} x
   * @param {number} y
   */
  updateSourcePosition(index, x, y) {
    if (index < this.gravitySources.length) {
      this.gravitySources[index].x = x;
      this.gravitySources[index].y = y;
    }
  }

  /**
   * 检测某点是否与引力源碰撞
   * @returns {{ index: number, source: object } | null}
   */
  checkSourceCollision(px, py, objectRadius = 0) {
    for (let i = 0; i < this.gravitySources.length; i++) {
      const src = this.gravitySources[i];
      if (src.collisionRadius <= 0) continue;
      const dx = src.x - px;
      const dy = src.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < src.collisionRadius + objectRadius) {
        return { index: i, source: src };
      }
    }
    return null;
  }

  /** 移除引力源 */
  removeGravitySource(index) {
    this.gravitySources.splice(index, 1);
  }

  /** 清空所有引力源 */
  clearGravitySources() {
    this.gravitySources.length = 0;
  }

  /** 添加粒子 */
  addParticle(x, y, vx, vy, mass = 1) {
    this.particles.push({ x, y, vx, vy, mass, ax: 0, ay: 0 });
    return this.particles.length - 1;
  }

  /** 移除粒子 */
  removeParticle(index) {
    this.particles.splice(index, 1);
  }

  /** 清空所有粒子 */
  clearParticles() {
    this.particles.length = 0;
  }

  /**
   * 计算单个粒子受到的总引力加速度
   * F = G * M * m / r^2
   * a = F / m = G * M / r^2  (方向指向引力源)
   * @returns {{ ax: number, ay: number }}
   */
  calcGravityAccel(px, py) {
    let ax = 0;
    let ay = 0;

    for (const src of this.gravitySources) {
      const dx = src.x - px;
      const dy = src.y - py;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      const r = Math.max(dist, MIN_DISTANCE);

      // a = G * M / r^2，分解到 x, y 方向
      const aMag = this.G * src.mass / (r * r);
      // 单位方向向量 (dx/dist, dy/dist)，指向引力源
      const ux = dx / dist;
      const uy = dy / dist;

      ax += aMag * ux;
      ay += aMag * uy;
    }

    return { ax, ay };
  }

  /** 推进一个时间步（半隐式欧拉 + 子步细分） */
  step() {
    const subDt = this.dt / this.subSteps;

    for (let s = 0; s < this.subSteps; s++) {
      for (const p of this.particles) {
        const { ax, ay } = this.calcGravityAccel(p.x, p.y);

        // 半隐式欧拉：先用当前加速度更新速度，再用新速度更新位置
        p.vx += ax * subDt;
        p.vy += ay * subDt;
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
        p.ax = ax;
        p.ay = ay;
      }
    }
  }

  /**
   * 推进单个外部粒子一帧（直接修改传入对象的 x, y, vx, vy）
   * 供 Demo 等场景使用，避免在 HTML 中重写物理积分
   * @param {{ x: number, y: number, vx: number, vy: number }} p
   * @param {number} [dtOverride] - 可选的时间步长覆盖
   */
  stepParticle(p, dtOverride) {
    const dt = dtOverride ?? this.dt;
    const subDt = dt / this.subSteps;
    for (let s = 0; s < this.subSteps; s++) {
      const { ax, ay } = this.calcGravityAccel(p.x, p.y);
      p.vx += ax * subDt;
      p.vy += ay * subDt;
      p.x += p.vx * subDt;
      p.y += p.vy * subDt;
    }
  }

  /** 推进多步 */
  stepN(n) {
    for (let i = 0; i < n; i++) {
      this.step();
    }
  }

  /**
   * 预测粒子未来轨迹（不改变实际状态）
   * @param {{ x, y, vx, vy, mass }} initialState
   * @param {number} steps - 预测步数
   * @param {number} predDt - 预测步长
   * @returns {{ x: number, y: number }[]}
   */
  predictTrajectory(initialState, steps = PREDICTION_STEPS, predDt = PREDICTION_DT) {
    const path = [];
    let x = initialState.x;
    let y = initialState.y;
    let vx = initialState.vx;
    let vy = initialState.vy;

    for (let i = 0; i < steps; i++) {
      const { ax, ay } = this.calcGravityAccel(x, y);

      // 半隐式欧拉
      vx += ax * predDt;
      vy += ay * predDt;
      x += vx * predDt;
      y += vy * predDt;

      path.push({ x, y });
    }

    return path;
  }

  /** 获取当前所有引力源 */
  getSources() {
    return this.gravitySources;
  }

  /** 获取当前所有粒子 */
  getParticles() {
    return this.particles;
  }
}
