import { G } from './constants.js';

/**
 * 子弹类 — 近地轨道、Delta-V 机动、齐奥尔科夫斯基火箭公式
 *
 * 质量模型：
 *   - 载荷质量 (payloadMass)：机动中不变
 *   - 燃料质量 (fuelMass)：随 Delta-V 消耗递减
 *   - 齐奥尔科夫斯基公式：Δv = ve · ln(m₀/m_f)
 *     → m_f = m₀ · exp(-Δv/ve)
 *
 * 爆炸属性：
 *   - 爆炸半径 r0：动能武器 r0=0 时无爆炸冲击
 *   - 冲击力衰减：P(r) = P₀ · exp(-r/r₀)，r₀=0 时 P(r)=0
 *   - 剩余燃料影响爆炸半径与冲击力
 */
export class Bullet {
  /**
   * @param {Object} options
   * @param {number} options.payloadMass   - 载荷质量（不变）
   * @param {number} options.fuelMass      - 初始燃料质量
   * @param {number} options.ve            - 发动机排气速度
   * @param {number} options.ignitionCount - 可点火（机动）次数
   * @param {number} [options.explosionRadius=0]   - 爆炸半径 r₀
   * @param {number} [options.explosionImpulse=0]  - 爆炸冲击量 P₀
   */
  constructor({
    payloadMass,
    fuelMass,
    ve,
    ignitionCount,
    explosionRadius = 0,
    explosionImpulse = 0,
  }) {
    this.payloadMass = payloadMass;
    this.fuelMass = fuelMass;
    this.initialFuelMass = fuelMass;
    this.ve = ve;

    // Delta-V 预算：由燃料质量推导
    this.maxDeltaV = ve * Math.log((payloadMass + fuelMass) / payloadMass);
    this.remainingDeltaV = this.maxDeltaV;

    this.ignitionCount = ignitionCount;
    this.remainingIgnitions = ignitionCount;

    this.explosionRadius = explosionRadius;
    this.explosionImpulse = explosionImpulse;

    // 运动状态
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;

    // 状态标记
    this.launched = false;    // 是否已发射（脱离初始轨道）
    this.alive = true;        // 是否存活

    // 用于计算加速度（由物理引擎填充）
    this.ax = 0;
    this.ay = 0;
  }

  /** 当前总质量 */
  get totalMass() {
    return this.payloadMass + this.fuelMass;
  }

  /**
   * 应用 Delta-V 机动
   * @param {number} dvx - x 方向 Delta-V
   * @param {number} dvy - y 方向 Delta-V
   * @returns {boolean} 是否成功
   */
  applyDeltaV(dvx, dvy) {
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);
    if (dv <= 0 || this.remainingIgnitions <= 0 || this.remainingDeltaV <= 0) {
      return false;
    }

    const actualDv = Math.min(dv, this.remainingDeltaV);
    if (actualDv <= 0) return false;

    // 齐奥尔科夫斯基：m_f = m₀ · exp(-Δv/ve)
    const m0 = this.totalMass;
    const mf = m0 * Math.exp(-actualDv / this.ve);
    const fuelUsed = m0 - mf;

    this.fuelMass = Math.max(0, this.fuelMass - fuelUsed);
    this.remainingDeltaV = this.ve * Math.log(this.totalMass / this.payloadMass);
    this.remainingIgnitions--;

    // 应用速度变化
    const ratio = actualDv / dv;
    this.vx += dvx * ratio;
    this.vy += dvy * ratio;

    this.launched = true;
    return true;
  }

  /**
   * 获取有效爆炸半径（受剩余燃料影响）
   * 动能武器 (r₀=0) 始终为 0
   */
  getEffectiveExplosionRadius() {
    if (this.explosionRadius <= 0) return 0;
    const fuelRatio = this.fuelMass / this.initialFuelMass;
    return this.explosionRadius * fuelRatio;
  }

  /**
   * 获取有效爆炸冲击量（受剩余燃料影响）
   */
  getEffectiveExplosionImpulse() {
    const fuelRatio = this.fuelMass / this.initialFuelMass;
    return this.explosionImpulse * fuelRatio;
  }

  /**
   * 计算爆炸冲击力（距离爆心 r 处）
   * P(r) = P₀ · exp(-r/r₀)，r₀=0 时 P(r)=0
   * @param {number} dist - 到爆心的距离
   * @returns {number}
   */
  calcExplosionImpulse(dist) {
    const r0 = this.getEffectiveExplosionRadius();
    if (r0 <= 0) return 0;
    const p0 = this.getEffectiveExplosionImpulse();
    return p0 * Math.exp(-dist / r0);
  }

  /**
   * 将子弹置于某星体的圆形近地轨道
   * @param {Object} body - { x, y, mass }
   * @param {number} altitude - 轨道高度（距星体表面）
   * @param {number} bodyRadius - 星体半径
   * @param {number} [phase=0] - 初始相位角（弧度），0 = 正右方
   * @param {number} [gravConstant] - 引力常量（默认使用 constants.G）
   */
  placeInOrbit(body, altitude, bodyRadius, phase = 0, gravConstant = null) {
    const bigG = gravConstant ?? G;
    const orbitRadius = bodyRadius + altitude;
    this.x = body.x + orbitRadius * Math.cos(phase);
    this.y = body.y + orbitRadius * Math.sin(phase);

    // 圆形轨道速度：v = sqrt(G·M/r)，方向为切向（逆时针 90°）
    const vOrbit = Math.sqrt(bigG * body.mass / orbitRadius);
    const tangentAngle = phase + Math.PI / 2;
    this.vx = vOrbit * Math.cos(tangentAngle);
    this.vy = vOrbit * Math.sin(tangentAngle);

    this.launched = false;
  }

  /** 获取位置 */
  getPosition() {
    return { x: this.x, y: this.y };
  }

  /** 获取速度 */
  getVelocity() {
    return { vx: this.vx, vy: this.vy };
  }
}
