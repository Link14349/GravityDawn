/**
 * 关卡设计器 — 数据模型 + 编辑器状态管理 + 导出/导入
 *
 * designerData 结构与 levels.json 一致，便于直接导出。
 * 轨道坐标计算使用 binding.js 的 Orbit 类，与游戏逻辑完全一致。
 */

import { Orbit, createOrbits } from '../src/binding.js';

// ---- 默认空关卡 ----
function makeDefaultData() {
  return {
    name: '新关卡',
    gravity: 300,
    camera: { x: 600, y: 400, zoom: 0.75 },
    orbits: [],
    stars: [],
    planets: [],
    bullets: [],
    buildings: [],
    winCondition: { destructionThreshold: 0.2, importantTargetsAll: true, minScore: 100 },
  };
}

// ---- 唯一 ID 生成器 ----
let _nextId = 1;
function uid() { return _nextId++; }

export class DesignerData {
  constructor() {
    this.data = makeDefaultData();
    this._resetIdCounter();

    // 编辑器状态
    this.tool = 'select';       // orbit | star | planet | core | point | enemy | spring | select
    this.selected = null;       // { type:'orbit'|'star'|'planet'|'point'|'spring'|'bullet', orbitIdx?, bodyIdx?, bldIdx?, ptIdx?, spIdx?, bulletIdx? }
    this._springFirst = null;   // { bldIdx, ptIdx } - 弹簧模式第一选中点
  }

  _resetIdCounter() {
    // 计算已用到的最大 id（用于 undo/redo 时保持一致）
    _nextId = 1;
    // 实际上我们不需要全局 id，用数组索引即可
  }

  // ========================
  // 轨道
  // ========================
  addOrbit(type = 'fixed', x = 0, y = 0, extra = {}) {
    const def = { type, x, y, ...extra };
    if (type === 'circular') { def.radius = extra.radius ?? 150; def.period = extra.period ?? 20; def.phase = extra.phase ?? 0; }
    if (type === 'elliptical') { def.rx = extra.rx ?? 200; def.ry = extra.ry ?? 120; def.period = extra.period ?? 20; def.phase = extra.phase ?? 0; }
    if (extra.parent != null) def.parent = extra.parent;
    this.data.orbits.push(def);
    this._invalidateOrbitsCache();
    return this.data.orbits.length - 1;
  }

  updateOrbit(idx, props) {
    Object.assign(this.data.orbits[idx], props);
    this._invalidateOrbitsCache();
  }

  removeOrbit(idx) {
    this._invalidateOrbitsCache();
    // 移除引用该轨道的星体/行星/核心点
    this.data.stars = this.data.stars.filter(s => s.orbit !== idx);
    this.data.planets = this.data.planets.filter(p => p.orbit !== idx);
    for (const bld of this.data.buildings) {
      for (const pt of bld.points) {
        if (pt.orbit === idx) pt.orbit = null;
      }
    }
    this.data.orbits.splice(idx, 1);
    // 修正所有引用：>= idx 的索引减 1
    this._fixOrbitRefs(idx, -1);
  }

  _fixOrbitRefs(removedIdx, delta) {
    for (const orb of this.data.orbits) {
      if (orb.parent != null && orb.parent >= removedIdx) orb.parent += delta;
    }
    for (const s of this.data.stars) { if (s.orbit >= removedIdx) s.orbit += delta; }
    for (const p of this.data.planets) { if (p.orbit >= removedIdx) p.orbit += delta; }
    for (const bld of this.data.buildings) {
      for (const pt of bld.points) {
        if (pt.orbit != null && pt.orbit >= removedIdx) pt.orbit += delta;
      }
    }
  }

  // ========================
  // 星体
  // ========================
  addStar(orbitIdx, overrides = {}) {
    const s = {
      orbit: orbitIdx,
      mass: overrides.mass ?? 5000,
      radius: overrides.radius ?? 45,
      collisionRadius: overrides.collisionRadius ?? 40,
      color: overrides.color ?? '#ffbb33',
      label: overrides.label ?? '恒星',
      ...overrides,
    };
    this.data.stars.push(s);
    return this.data.stars.length - 1;
  }

  addPlanet(orbitIdx, overrides = {}) {
    const p = {
      orbit: orbitIdx,
      mass: overrides.mass ?? 1500,
      radius: overrides.radius ?? 45,
      collisionRadius: overrides.collisionRadius ?? 40,
      color: overrides.color ?? '#66aaff',
      label: overrides.label ?? '行星',
      ...overrides,
    };
    this.data.planets.push(p);
    return this.data.planets.length - 1;
  }

  updateStar(idx, props) { Object.assign(this.data.stars[idx], props); }
  updatePlanet(idx, props) { Object.assign(this.data.planets[idx], props); }

  removeStar(idx) { this.data.stars.splice(idx, 1); }
  removePlanet(idx) { this.data.planets.splice(idx, 1); }

  // ========================
  // 建筑
  // ========================
  addBuilding() {
    const bld = { points: [], springs: [] };
    this.data.buildings.push(bld);
    return this.data.buildings.length - 1;
  }

  ensureBuilding(bldIdx) {
    if (bldIdx == null || bldIdx < 0 || bldIdx >= this.data.buildings.length) {
      return this.addBuilding();
    }
    return bldIdx;
  }

  /**
   * 添加质点
   * @param {number} bldIdx - 建筑索引
   * @param {Object} ptDef - 质点定义 (x, y 为世界坐标；如果是 core 则有 orbit)
   * @param {Object} [coreInfo] - 核心点信息 { coreWorldX, coreWorldY, orbit }
   * @returns {{ bldIdx: number, ptIdx: number }}
   */
  addPoint(bldIdx, ptDef, coreInfo = null) {
    bldIdx = this.ensureBuilding(bldIdx);
    const bld = this.data.buildings[bldIdx];
    const pt = { ...ptDef };

    if (pt.isCore && pt.orbit != null) {
      // 核心点：x, y 由 orbit 决定，不需要存储
      delete pt.x;
      delete pt.y;
      pt.mass = pt.mass ?? 200;
      pt.radius = pt.radius ?? 8;
      pt.score = pt.score ?? 300;
      pt.important = pt.important ?? true;
      pt.color = pt.color ?? '#ffdd44';
      pt.explosionRadius = pt.explosionRadius ?? 60;
      pt.explosionImpulse = pt.explosionImpulse ?? 3000;
    } else if (coreInfo) {
      // 普通质点：存储相对于核心的偏移
      pt.x = (ptDef.x || 0) - coreInfo.coreWorldX;
      pt.y = (ptDef.y || 0) - coreInfo.coreWorldY;
      pt.mass = pt.mass ?? 8;
      pt.radius = pt.radius ?? 5;
      pt.score = pt.score ?? 20;
      pt.color = pt.color ?? '#cccccc';
      pt.explosionRadius = pt.explosionRadius ?? 15;
      pt.explosionImpulse = pt.explosionImpulse ?? 800;
    } else {
      // 无核心的建筑（如绑定到星体的建筑）：存绝对坐标
      pt.mass = pt.mass ?? 10;
      pt.radius = pt.radius ?? 5;
      pt.score = pt.score ?? 30;
      pt.color = pt.color ?? '#ff9966';
      pt.explosionRadius = pt.explosionRadius ?? 20;
      pt.explosionImpulse = pt.explosionImpulse ?? 600;
    }

    if (pt.isEnemy) {
      pt.color = '#44ff44';
      pt.hp = pt.hp ?? 150;
      pt.renderRadius = pt.renderRadius ?? 8;
    }

    bld.points.push(pt);
    return { bldIdx, ptIdx: bld.points.length - 1 };
  }

  updatePoint(bldIdx, ptIdx, props) {
    Object.assign(this.data.buildings[bldIdx].points[ptIdx], props);
  }

  removePoint(bldIdx, ptIdx) {
    const bld = this.data.buildings[bldIdx];
    // 移除关联弹簧
    bld.springs = bld.springs.filter(s => s.a !== ptIdx && s.b !== ptIdx);
    // 修正弹簧索引
    for (const sp of bld.springs) {
      if (sp.a > ptIdx) sp.a--;
      if (sp.b > ptIdx) sp.b--;
    }
    bld.points.splice(ptIdx, 1);
  }

  addSpring(bldIdx, aIdx, bIdx, overrides = {}) {
    const bld = this.data.buildings[bldIdx];
    const sp = {
      a: aIdx,
      b: bIdx,
      stiffness: overrides.stiffness ?? 2000,
      damping: overrides.damping ?? 15,
      breakTension: overrides.breakTension ?? 4000,
      ...overrides,
    };
    // 如果提供了 restLength 就保留
    bld.springs.push(sp);
    return bld.springs.length - 1;
  }

  updateSpring(bldIdx, spIdx, props) {
    Object.assign(this.data.buildings[bldIdx].springs[spIdx], props);
  }

  removeSpring(bldIdx, spIdx) {
    this.data.buildings[bldIdx].springs.splice(spIdx, 1);
  }

  removeBuilding(idx) {
    this.data.buildings.splice(idx, 1);
  }

  // ========================
  // 子弹
  // ========================
  addBullet(overrides = {}) {
    const b = {
      type: overrides.type ?? 'normal',
      ...overrides,
    };
    // orbitAround 如果指定了就保留
    if (overrides.orbitAround) b.orbitAround = { ...overrides.orbitAround };
    this.data.bullets.push(b);
    return this.data.bullets.length - 1;
  }

  updateBullet(idx, props) {
    Object.assign(this.data.bullets[idx], props);
  }

  removeBullet(idx) {
    this.data.bullets.splice(idx, 1);
  }

  // ========================
  // 获取某轨道上的星体列表（用于 UI 显示）
  // ========================
  getBodiesOnOrbit(orbitIdx) {
    const result = [];
    for (let i = 0; i < this.data.stars.length; i++) {
      if (this.data.stars[i].orbit === orbitIdx) result.push({ type: 'star', idx: i, label: this.data.stars[i].label });
    }
    for (let i = 0; i < this.data.planets.length; i++) {
      if (this.data.planets[i].orbit === orbitIdx) result.push({ type: 'planet', idx: i, label: this.data.planets[i].label });
    }
    return result;
  }

  // ========================
  // 选中
  // ========================
  select(type, indices = {}) {
    this.selected = { type, ...indices };
  }

  clearSelection() {
    this.selected = null;
    this._springFirst = null;
  }

  // ========================
  // 计算世界坐标（用于编辑模式渲染）
  // ========================

  /** 获取轨道在 t=0 时的世界坐标（轨道上的点），使用 binding.js Orbit 类 */
  getOrbitWorldPos(orbitIdx) {
    const orbits = this._buildOrbits();
    const orb = orbits[orbitIdx];
    return orb ? orb.getWorldPosition(0, orbits) : { x: 0, y: 0 };
  }

  /** 获取轨道的圆心世界坐标（直接调 binding.js Orbit 的方法） */
  getOrbitCenterWorld(orbitIdx) {
    const orbits = this._buildOrbits();
    const orb = orbits[orbitIdx];
    return orb ? orb.getCenterWorld(0, orbits) : { x: 0, y: 0 };
  }

  /** 根据 data.orbits 构建 Orbit 实例数组（带缓存） */
  _buildOrbits() {
    if (this._orbitsCache) return this._orbitsCache;
    this._orbitsCache = createOrbits(this.data.orbits);
    return this._orbitsCache;
  }

  /** 标记 orbits 缓存失效（增删改 orbit 时调用） */
  _invalidateOrbitsCache() {
    this._orbitsCache = null;
  }

  /** 计算轨道世界坐标（使用 binding.js Orbit） */
  _calcOrbitWorld(orbData, t = 0) {
    const idx = this.data.orbits.indexOf(orbData);
    if (idx < 0) return { x: 0, y: 0 };
    const orbits = this._buildOrbits();
    const o = orbits[idx];
    return o ? o.getWorldPosition(t, orbits) : { x: 0, y: 0 };
  }

  /** 获取建筑核心的世界坐标（t=0） */
  getBuildingCoreWorld(bldIdx) {
    const bld = this.data.buildings[bldIdx];
    if (!bld) return { x: 0, y: 0 };
    for (const pt of bld.points) {
      if (pt.isCore && pt.orbit != null) {
        return this._calcOrbitWorld(this.data.orbits[pt.orbit]);
      }
    }
    // 无核心建筑：查看 bindToBody
    if (bld.bindToBody != null) {
      const bodyIdx = bld.bindToBody;
      const allBodies = [...this.data.stars, ...this.data.planets];
      if (bodyIdx < allBodies.length) {
        const body = allBodies[bodyIdx];
        return this._calcOrbitWorld(this.data.orbits[body.orbit]);
      }
    }
    // 无核心也无 bindToBody → 质点存的是绝对坐标，无需偏移
    return { x: 0, y: 0 };
  }

  /** 获取质点世界坐标 */
  getPointWorld(bldIdx, ptIdx) {
    const bld = this.data.buildings[bldIdx];
    if (!bld) return { x: 0, y: 0 };
    const pt = bld.points[ptIdx];
    if (!pt) return { x: 0, y: 0 };
    if (pt.isCore && pt.orbit != null) {
      return this._calcOrbitWorld(this.data.orbits[pt.orbit]);
    }
    const core = this.getBuildingCoreWorld(bldIdx);
    return { x: (pt.x || 0) + core.x, y: (pt.y || 0) + core.y };
  }

  /** 获取所有星体（stars + planets 合并）的世界坐标列表 */
  getAllBodyPositions() {
    const result = [];
    for (let i = 0; i < this.data.stars.length; i++) {
      const s = this.data.stars[i];
      const pos = this._calcOrbitWorld(this.data.orbits[s.orbit]);
      result.push({ type: 'star', idx: i, ...pos, radius: s.radius, collisionRadius: s.collisionRadius, color: s.color, label: s.label });
    }
    for (let i = 0; i < this.data.planets.length; i++) {
      const p = this.data.planets[i];
      const pos = this._calcOrbitWorld(this.data.orbits[p.orbit]);
      result.push({ type: 'planet', idx: i, ...pos, radius: p.radius, collisionRadius: p.collisionRadius, color: p.color, label: p.label });
    }
    return result;
  }

  // ========================
  // 导出 / 导入
  // ========================

  /** 导出为 levels.json 格式（单关卡对象） */
  exportLevel() {
    // 深拷贝 + 清理内部字段
    return JSON.parse(JSON.stringify(this.data));
  }

  /** 从 levels.json 格式导入 */
  importLevel(json) {
    this.data = JSON.parse(JSON.stringify(json));
    // 确保必要字段存在
    this.data.orbits = this.data.orbits || [];
    this.data.stars = this.data.stars || [];
    this.data.planets = this.data.planets || [];
    this.data.bullets = this.data.bullets || [];
    this.data.buildings = this.data.buildings || [];
    this.data.winCondition = this.data.winCondition || { destructionThreshold: 0.2, importantTargetsAll: true, minScore: 100 };
    this.data.camera = this.data.camera || { x: 600, y: 400, zoom: 0.75 };
    this.data.gravity = this.data.gravity ?? 300;
    this.data.name = this.data.name || '导入关卡';
    this.clearSelection();
  }

  /** 导出为完整的 levels.json 数组（用于直接替换文件） */
  exportLevelsArray() {
    return [this.exportLevel()];
  }

  /** 创建新关卡（重置所有数据） */
  newLevel() {
    this.data = makeDefaultData();
    this.clearSelection();
  }
}
