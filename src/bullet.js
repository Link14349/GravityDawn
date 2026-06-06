/**
 * 子弹系统 — 类型字典 + 齐奥尔科夫斯基火箭公式 + 特殊效果
 *
 * 从 levels.json 只需指定 type + orbitAround，其余属性从字典读取。
 * ve 由 Δv 和载荷/燃料质量自动推导，不再作为外部参数。
 */

// ---- 子弹类型字典 ----
export const BULLET_TYPES = {
  normal: {
    name: '普通弹',
    payloadMass: 5, fuelMass: 8, deltaV: 300, ignitionCount: 2,
    explosionRadius: 30, explosionImpulse: 1500,
    color: '#ff4444', renderRadius: 8,
  },
  explosive: {
    name: '爆炸弹',
    payloadMass: 10, fuelMass: 18, deltaV: 300, ignitionCount: 2,
    explosionRadius: 200, explosionImpulse: 4000,
    color: '#4488ff', renderRadius: 14,
    onImpact: 'explode',
  },
  kinetic: {
    name: '动能弹',
    payloadMass: 20, fuelMass: 12, deltaV: 220, ignitionCount: 2,
    explosionRadius: 0, explosionImpulse: 0,
    color: '#ff4444', renderRadius: 16, hp: 300,
  },
  agile: {
    name: '机动弹',
    payloadMass: 3, fuelMass: 8, deltaV: 1000, ignitionCount: 10,
    explosionRadius: 30, explosionImpulse: 2000,
    color: '#ffdd44', renderRadius: 8,
  },
  cluster: {
    name: '分裂弹',
    payloadMass: 5, fuelMass: 10, deltaV: 280, ignitionCount: 2,
    explosionRadius: 25, explosionImpulse: 1000,
    color: '#44ff88', renderRadius: 8,
    onImpact: 'split',
  },
  gravity: {
    name: '引力弹',
    payloadMass: 8, fuelMass: 10, deltaV: 260, ignitionCount: 2,
    explosionRadius: 40, explosionImpulse: 500,
    color: '#cc88ff', renderRadius: 10,
    onImpact: 'gravity_well',
  },
  incendiary: {
    name: '燃烧弹',
    payloadMass: 6, fuelMass: 10, deltaV: 300, ignitionCount: 2,
    explosionRadius: 0, explosionImpulse: 0,
    color: '#ff6644', renderRadius: 9,
    onImpact: 'incendiary',
  },
};

// ---- 内部用：根据质量参数推导排气速度 ----
function deriveVe(payloadMass, fuelMass, deltaV) {
  const m0 = payloadMass + fuelMass;
  // ve = Δv / ln(m₀ / m_payload)
  return deltaV / Math.log(m0 / payloadMass);
}

export class Bullet {
  /**
   * @param {Object} options
   * @param {string} [options.type='normal'] — 子弹类型 key
   * @param {number} [options.payloadMass] — 覆盖字典中的载荷质量
   * @param {number} [options.fuelMass] — 覆盖字典中的燃料质量
   * @param {number} [options.deltaV] — 覆盖字典中的 Δv
   * @param {number} [options.ignitionCount] — 覆盖点火次数
   * @param {number} [options.explosionRadius=0]
   * @param {number} [options.explosionImpulse=0]
   * @param {string} [options.color]
   * @param {number} [options.renderRadius]
   * @param {number} [options.hp=0]
   */
  constructor(options = {}) {
    // 从字典读取默认值，允许覆盖
    const typeKey = options.type || 'normal';
    const def = BULLET_TYPES[typeKey] || BULLET_TYPES.normal;
    this.type = typeKey;
    this.typeName = def.name;

    this.payloadMass = options.payloadMass ?? def.payloadMass;
    this.fuelMass = options.fuelMass ?? def.fuelMass;
    this.initialFuelMass = this.fuelMass;

    // ve: 优先用旧格式的显式值，否则从 deltaV 推导
    if (options.ve != null) {
      this.ve = options.ve;
    } else {
      const deltaV = options.deltaV ?? def.deltaV;
      this.ve = deriveVe(this.payloadMass, this.fuelMass, deltaV);
    }

    this.ignitionCount = options.ignitionCount ?? def.ignitionCount;
    this.color = options.color ?? def.color ?? '#44ccff';
    this.renderRadius = options.renderRadius ?? def.renderRadius ?? 8;
    this.hp = options.hp ?? def.hp ?? 0;
    this.maxHp = this.hp;
    this.onImpact = def.onImpact || null;

    // Delta-V 预算
    this.maxDeltaV = this.ve * Math.log((this.payloadMass + this.fuelMass) / this.payloadMass);
    this.remainingDeltaV = this.maxDeltaV;

    this.remainingIgnitions = this.ignitionCount;

    this.explosionRadius = options.explosionRadius ?? def.explosionRadius ?? 0;
    this.explosionImpulse = options.explosionImpulse ?? def.explosionImpulse ?? 0;

    // 运动状态
    this.x = options.x ?? 0; this.y = options.y ?? 0;
    this.vx = options.vx ?? 0; this.vy = options.vy ?? 0;

    // 状态标记
    this.launched = options.launched ?? false;
    this.launchTime = options.launchTime ?? 0;
    this.alive = true;

    this.ax = 0; this.ay = 0;

    // 燃烧弹：记录已点燃过的建筑（避免重复灼烧）
    this._burnedBuildings = new Set();
  }

  /** 当前总质量 */
  get totalMass() {
    return this.payloadMass + this.fuelMass;
  }

  /**
   * 应用 Delta-V 机动
   */
  applyDeltaV(dvx, dvy) {
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);
    if (dv <= 0 || this.remainingIgnitions <= 0 || this.remainingDeltaV <= 0) {
      return false;
    }

    const actualDv = Math.min(dv, this.remainingDeltaV);
    if (actualDv <= 0) return false;

    const m0 = this.totalMass;
    const mf = m0 * Math.exp(-actualDv / this.ve);
    const fuelUsed = m0 - mf;

    this.fuelMass = Math.max(0, this.fuelMass - fuelUsed);
    this.remainingDeltaV = this.ve * Math.log(this.totalMass / this.payloadMass);
    this.remainingIgnitions--;

    const ratio = actualDv / dv;
    this.vx += dvx * ratio;
    this.vy += dvy * ratio;

    this.launched = true;
    return true;
  }

  getEffectiveExplosionRadius() {
    if (this.explosionRadius <= 0) return 0;
    const fuelRatio = this.fuelMass / this.initialFuelMass;
    return this.explosionRadius * fuelRatio;
  }

  getEffectiveExplosionImpulse() {
    const fuelRatio = this.fuelMass / this.initialFuelMass;
    return this.explosionImpulse * fuelRatio;
  }

  calcExplosionImpulse(dist) {
    const r0 = this.getEffectiveExplosionRadius();
    if (r0 <= 0) return 0;
    const p0 = this.getEffectiveExplosionImpulse();
    return p0 * Math.exp(-dist / r0);
  }

  bindOrbit(homeBody, altitude, bodyRadius, phase = 0, gravConstant = null) {
    const bigG = gravConstant ?? 2000;
    this._homeBody = homeBody;
    this._orbitRadius = bodyRadius + altitude;
    this._orbitPhase = phase;
    this._orbitOmega = Math.sqrt(bigG * homeBody.mass / Math.pow(this._orbitRadius, 3));
    this._orbitG = bigG;
    this._syncOrbitState();
    this.launched = false;
  }

  _syncOrbitState() {
    const hp = this._homeBody.getPosition();
    const hv = this._homeBody.getVelocity();
    const r = this._orbitRadius;
    const ph = this._orbitPhase;
    this.x = hp.x + r * Math.cos(ph);
    this.y = hp.y - r * Math.sin(ph); // 屏幕Y朝下
    const vOrbit = Math.sqrt(this._orbitG * this._homeBody.mass / r);
    const tanAngle = ph + Math.PI / 2;
    this.vx = hv.vx + vOrbit * Math.cos(tanAngle);
    this.vy = hv.vy - vOrbit * Math.sin(tanAngle);
  }

  updateOrbitPosition(dt) {
    if (this.launched || !this._homeBody) return;
    this._orbitPhase += this._orbitOmega * dt;
    this._syncOrbitState();
  }

  takeDamage(damage) {
    if (this.maxHp <= 0) return true;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  getPosition() { return { x: this.x, y: this.y }; }
  getVelocity() { return { vx: this.vx, vy: this.vy }; }

  /**
   * 右键手动触发特殊效果（分裂/引爆/燃烧/引力）
   */
  triggerEffect() {
    this.alive = false;
    this._triggered = true;
  }

  // ========================
  // 特殊效果
  // ========================

  /**
   * 分裂弹：撞击时生成子子弹的配置列表
   * @returns {Object[]|null} 子子弹配置数组，无效果返回 null
   */
  getSplitBullets() {
    if (this.onImpact !== 'split') return null;
    const count = 3;
    const baseAngle = Math.atan2(this.vy, this.vx);
    const spread = Math.PI / 3; // 60° 扇形
    const parentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const childSpeed = parentSpeed * 0.6;

    const children = [];
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i / (count - 1) - 0.5) * spread;
      children.push({
        type: 'normal',
        payloadMass: this.payloadMass * 0.2,
        fuelMass: this.fuelMass * 0.2,
        deltaV: 0,             // 不可机动
        ignitionCount: 0,
        explosionRadius: 15,
        explosionImpulse: 500,
        color: '#88ffaa',
        renderRadius: 5,
        x: this.x, y: this.y,
        vx: childSpeed * Math.cos(angle),
        vy: childSpeed * Math.sin(angle),
        launched: true,
        launchTime: this.launchTime,
      });
    }
    return children;
  }

  /**
   * 引力弹：在撞击点生成临时引力源
   * @returns {{ x: number, y: number, mass: number, duration: number }|null}
   */
  getGravityWell() {
    if (this.onImpact !== 'gravity_well') return null;
    return {
      x: this.x,
      y: this.y,
      mass: 8000,
      duration: 3, // 秒
    };
  }

  /**
   * 燃烧弹：给建筑施加灼烧效果
   * @param {import('./building.js').Building} building
   */
  applyIncendiary(building) {
    if (this.onImpact !== 'incendiary') return;
    if (this._burnedBuildings.has(building)) return;
    this._burnedBuildings.add(building);

    // 对该建筑所有存活弹簧施加燃烧，持续 4 秒
    for (const sp of building.springs) {
      if (!sp.alive) continue;
      sp._burnTimer = 4;
      sp._burnRate = 80; // 每秒降低 breakTension
    }
  }
}
