/**
 * 星体类 — 质量 + 碰撞半径 + Orbit 轨道
 *
 * 轨道计算委托给 binding.Orbit，支持递归 parent 链。
 */

export class CelestialBody {
  /**
   * @param {Object} options
   * @param {number} options.mass - 引力质量
   * @param {import('./binding.js').Orbit} options.orbit - Orbit 实例
   * @param {import('./binding.js').Orbit[]} options.orbits - 全局 orbits 数组
   * @param {number} [options.radius=35] - 渲染半径
   * @param {number} [options.collisionRadius] - 碰撞半径（默认等于渲染半径）
   * @param {string} [options.color='#ff9933'] - 主体颜色
   * @param {string} [options.label=''] - 标签名
   */
  constructor({ mass, orbit, orbits, radius = 35, collisionRadius, color = '#ff9933', label = '' }) {
    this.mass = mass;
    this.orbit = orbit;
    this._orbits = orbits;
    this.radius = radius;
    this.collisionRadius = collisionRadius ?? radius;
    this.color = color;
    this.label = label;
    this.t = 0; // 当前轨道时间
  }

  /** 获取当前世界坐标 */
  getPosition() {
    return this.orbit.getWorldPosition(this.t, this._orbits);
  }

  /** 获取指定时间的世界坐标 */
  getPositionAtTime(t) {
    return this.orbit.getWorldPosition(t, this._orbits);
  }

  /** 获取当前世界速度 */
  getVelocity(eps = 0.001) {
    return this.orbit.getWorldVelocity(this.t, this._orbits, eps);
  }

  /** 推进轨道时间 */
  update(dt) {
    this.t += dt;
  }
}
