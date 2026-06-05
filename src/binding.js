/**
 * 统一轨道系统 — Orbit 类
 *
 * 所有位置/速度计算通过 Orbit 的递归 parent 链完成。
 * levels.json 中 "orbits": [] 数组定义所有轨道，id = 数组索引。
 */

export class Orbit {
  /**
   * @param {Object} def - 轨道定义
   * @param {number} def.id - 在 orbits[] 中的索引
   * @param {'fixed'|'circular'|'elliptical'} def.type
   * @param {number|null} [def.parent] - 父 Orbit id
   * @param {number} [def.x] - fixed 的 x
   * @param {number} [def.y] - fixed 的 y
   * @param {number} [def.radius] - circular 的半径
   * @param {number} [def.rx] - elliptical 的 rx
   * @param {number} [def.ry] - elliptical 的 ry
   * @param {number} [def.period] - 周期(秒)
   * @param {number} [def.phase] - 相位(弧度), 默认0
   */
  constructor(def) {
    this.id = def.id;
    this.type = def.type;
    this.parent = def.parent ?? null;
    this._x = def.x || 0;
    this._y = def.y || 0;
    this._radius = def.radius || 0;
    this._rx = def.rx || 0;
    this._ry = def.ry || 0;
    this._period = def.period || 1;
    this._phase = def.phase || 0;
  }

  /** 自身局部坐标（不含父级），x/y 为圆心偏移量。Y 取负使相位逆时针（屏幕 Y 轴朝下） */
  getLocalPosition(t) {
    if (this.type === 'circular') {
      const omega = (2 * Math.PI) / this._period;
      return {
        x: this._x + this._radius * Math.cos(omega * t + this._phase),
        y: this._y - this._radius * Math.sin(omega * t + this._phase),
      };
    }
    if (this.type === 'elliptical') {
      const omega = (2 * Math.PI) / this._period;
      return {
        x: this._x + this._rx * Math.cos(omega * t + this._phase),
        y: this._y - this._ry * Math.sin(omega * t + this._phase),
      };
    }
    // fixed
    return { x: this._x, y: this._y };
  }

  /** 自身局部速度（不含父级） */
  getLocalVelocity(t, eps = 0.001) {
    if (this.type === 'fixed') return { vx: 0, vy: 0 };
    const p0 = this.getLocalPosition(t);
    const p1 = this.getLocalPosition(t + eps);
    return { vx: (p1.x - p0.x) / eps, vy: (p1.y - p0.y) / eps };
  }

  /** 世界坐标（递归叠加 parent 链） */
  getWorldPosition(t, orbits) {
    const local = this.getLocalPosition(t);
    if (this.parent == null) return local;
    const pw = orbits[this.parent].getWorldPosition(t, orbits);
    return { x: pw.x + local.x, y: pw.y + local.y };
  }

  /** 世界速度（递归叠加 parent 链） */
  getWorldVelocity(t, orbits, eps = 0.001) {
    const localV = this.getLocalVelocity(t, eps);
    if (this.parent == null) return localV;
    const pv = orbits[this.parent].getWorldVelocity(t, orbits, eps);
    return { vx: pv.vx + localV.vx, vy: pv.vy + localV.vy };
  }
}

/**
 * 从 levels.json 的 "orbits" 数组创建 Orbit 实例
 * @param {Object[]} defs
 * @returns {Orbit[]}
 */
export function createOrbits(defs) {
  return defs.map((d, i) => new Orbit({ ...d, id: i }));
}
