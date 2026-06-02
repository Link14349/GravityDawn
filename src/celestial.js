/**
 * 星体类 — 质量 + 参数方程轨道
 *
 * 星体轨道使用显式参数方程 x(t), y(t) 以保证轨道稳定性。
 * 提供静态方法创建常见轨道类型（圆形、椭圆）。
 */

export class CelestialBody {
  /**
   * @param {Object} options
   * @param {number} options.mass - 引力质量
   * @param {Function} options.orbit - 轨道函数 (t) => { x, y }
   * @param {number} [options.radius=35] - 渲染半径（像素）
   * @param {number} [options.collisionRadius] - 碰撞半径（默认等于渲染半径）
   * @param {string} [options.color='#ff9933'] - 主体颜色
   * @param {string} [options.label=''] - 标签名
   */
  constructor({ mass, orbit, radius = 35, collisionRadius, color = '#ff9933', label = '' }) {
    this.mass = mass;
    this.orbitFn = orbit;
    this.radius = radius;
    this.collisionRadius = collisionRadius ?? radius;
    this.color = color;
    this.label = label;
    this.t = 0; // 当前轨道时间
  }

  /** 获取当前轨道位置 */
  getPosition() {
    return this.orbitFn(this.t);
  }

  /** 推进轨道时间 */
  update(dt) {
    this.t += dt;
  }

  /**
   * 创建圆形轨道
   * @param {number} cx - 圆心 x
   * @param {number} cy - 圆心 y
   * @param {number} radius - 轨道半径
   * @param {number} period - 轨道周期（秒），周期越小越快
   * @param {number} [phase=0] - 初始相位（弧度）
   * @returns {Function} 轨道函数 (t) => { x, y }
   */
  static circularOrbit(cx, cy, radius, period, phase = 0) {
    const omega = (2 * Math.PI) / period;
    return (t) => ({
      x: cx + radius * Math.cos(omega * t + phase),
      y: cy + radius * Math.sin(omega * t + phase),
    });
  }

  /**
   * 创建椭圆轨道
   * @param {number} cx - 中心 x
   * @param {number} cy - 中心 y
   * @param {number} rx - 椭圆半长轴
   * @param {number} ry - 椭圆半短轴
   * @param {number} period - 轨道周期（秒）
   * @param {number} [phase=0] - 初始相位（弧度）
   * @returns {Function} 轨道函数 (t) => { x, y }
   */
  static ellipticalOrbit(cx, cy, rx, ry, period, phase = 0) {
    const omega = (2 * Math.PI) / period;
    return (t) => ({
      x: cx + rx * Math.cos(omega * t + phase),
      y: cy + ry * Math.sin(omega * t + phase),
    });
  }

  /**
   * 创建静止位置（不动的星体，如恒星）
   * @param {number} x
   * @param {number} y
   * @returns {Function} 轨道函数
   */
  static fixedPosition(x, y) {
    return () => ({ x, y });
  }
}
