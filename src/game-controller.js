/**
 * 游戏控制器 — 输入处理 + 状态机
 *
 * 核心交互：
 *   鼠标悬停子弹 → 时间暂停
 *   点击拖拽子弹 → Delta-V 矢量（方向=拖动方向，大小=拖动长度）
 *   松开鼠标 → 发射（应用 Delta-V）
 */

// 游戏状态
export const GameState = Object.freeze({
  PLAYING: 'playing',     // 正常运行
  AIMING: 'aiming',       // 悬停/拖拽瞄准中（时间暂停）
  LAUNCHED: 'launched',   // 子弹已发射飞行中
  SETTLING: 'settling',   // 等待结算
});

// 缩放因子：鼠标拖动像素 → Delta-V 单位
const DRAG_TO_DV_SCALE = 0.5;

// 子弹悬停检测半径（像素）
const HOVER_RADIUS = 40;

export class GameController {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {import('./physics.js').PhysicsEngine} options.physics
   * @param {import('./bullet.js').Bullet[]} options.bullets
   * @param {import('./camera.js').Camera} options.camera
   * @param {() => number} [options.getTime] - 获取当前物理时间
   * @param {import('./building.js').Building[]} [options.buildings] - 建筑列表（用于碰撞预测）
   */
  constructor(canvas, { physics, bullets, camera, getTime, buildings }) {
    this.canvas = canvas;
    this.physics = physics;
    this.bullets = bullets;
    this.camera = camera;
    this._getTime = getTime || (() => 0);
    this._buildings = buildings || [];

    this.state = GameState.PLAYING;
    this.paused = false;

    // 鼠标状态
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseInCanvas = false;

    // 拖拽状态
    this.dragging = false;
    this.dragBullet = null;       // 正在拖拽的子弹
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;

    // 预测轨迹缓存
    this.predictedPath = [];
    this.predictedCollision = null; // { x, y, sourceIndex } | null

    this._bindEvents();
  }

  /** 绑定 Canvas 鼠标事件 */
  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this._onMouseLeave(e));
    this.canvas.addEventListener('mouseenter', (e) => this._onMouseEnter(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (this.state === GameState.PLAYING || this.state === GameState.AIMING) {
          this._spacePaused = !this._spacePaused;
        }
      }
    });
    this._spacePaused = false;
  }

  /** 获取鼠标在 canvas 中的世界坐标 */
  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (this.camera) {
      return this.camera.screenToWorld(sx, sy);
    }
    return { x: sx, y: sy };
  }

  /** 检测鼠标是否悬停在可机动的子弹上 */
  _findBulletUnderMouse(mx, my) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      if (b.remainingIgnitions <= 0 || b.remainingDeltaV <= 0) continue;
      const dx = mx - b.x;
      const dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < HOVER_RADIUS) {
        return b;
      }
    }
    return null;
  }

  _onMouseMove(e) {
    const pos = this._getCanvasPos(e);
    this.mouseX = pos.x;
    this.mouseY = pos.y;

    if (this.dragging) {
      this.dragCurrentX = pos.x;
      this.dragCurrentY = pos.y;
      this._updatePrediction();
      return;
    }

    // 非拖拽时检测悬停
    if (this.state === GameState.PLAYING || this.state === GameState.AIMING) {
      const hovered = this._findBulletUnderMouse(pos.x, pos.y);
      if (hovered && this.state === GameState.PLAYING) {
        this.state = GameState.AIMING;
        this.paused = true;
      } else if (!hovered && this.state === GameState.AIMING && !this.dragging) {
        this.state = GameState.PLAYING;
        this.paused = false;
        this.predictedPath = [];
        this.predictedCollision = null;
      }
    }
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = this._getCanvasPos(e);
    const bullet = this._findBulletUnderMouse(pos.x, pos.y);
    if (bullet && bullet.remainingIgnitions > 0 && bullet.remainingDeltaV > 0) {
      this.dragging = true;
      this.dragBullet = bullet;
      this.dragStartX = bullet.x;
      this.dragStartY = bullet.y;
      this.dragCurrentX = pos.x;
      this.dragCurrentY = pos.y;
      this.paused = true;
      this.state = GameState.AIMING;
      this._updatePrediction();
    }
  }

  _onMouseUp(e) {
    if (!this.dragging) return;
    if (this._spacePaused) {
      this.dragging = false;
      this.dragBullet = null;
      this.predictedPath = [];
      this.predictedCollision = null;
      this.state = GameState.AIMING;
      return;
    }
    // 弹弓式：拖动方向与 Delta-V 方向相反
    const dvx = -(this.dragCurrentX - this.dragStartX) * DRAG_TO_DV_SCALE;
    const dvy = -(this.dragCurrentY - this.dragStartY) * DRAG_TO_DV_SCALE;

    this.dragBullet.applyDeltaV(dvx, dvy);
    if (!this.dragBullet._launchTimeSet) {
      this.dragBullet.launchTime = (this._getTime ? this._getTime() : 0);
      this.dragBullet._launchTimeSet = true;
    }
    this.dragging = false;
    this.dragBullet = null;
    this.predictedPath = [];
    this.predictedCollision = null;
    this.paused = false;
    // 回到 PLAYING 状态，允许再次悬停进行二次点火
    this.state = GameState.PLAYING;
  }

  _onMouseLeave() {
    this.mouseInCanvas = false;
    if (this.dragging) {
      // 拖拽中鼠标离开→取消拖拽
      this.dragging = false;
      this.dragBullet = null;
    }
    this.paused = false;
    this.state = GameState.PLAYING;
    this.predictedPath = [];
    this.predictedCollision = null;
  }

  _onMouseEnter() {
    this.mouseInCanvas = true;
  }

  /** 更新预测轨迹（拖拽时调用） */
  _updatePrediction() {
    if (!this.dragBullet) return;

    const dvx = -(this.dragCurrentX - this.dragStartX) * DRAG_TO_DV_SCALE;
    const dvy = -(this.dragCurrentY - this.dragStartY) * DRAG_TO_DV_SCALE;

    // 临时应用 Delta-V 来预测轨迹
    const simState = {
      x: this.dragBullet.x,
      y: this.dragBullet.y,
      vx: this.dragBullet.vx + dvx,
      vy: this.dragBullet.vy + dvy,
      mass: this.dragBullet.totalMass,
    };

    // 使用和实际物理相同的 dt + subSteps，保证预测精度完全一致
    const result = this.physics.predictTrajectory(simState, 800, this.physics.dt, this._getTime());
    let path = result.path;
    let collision = result.collision;

    // 检查建筑碰撞（质点和弹簧），可能比星体碰撞更早发生
    if (this._buildings.length > 0) {
      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        for (const bld of this._buildings) {
          const hit = bld.checkCollisionAt(pt.x, pt.y, 6);
          if (hit) {
            // 建筑碰撞：截断路径，设置碰撞信息
            path = path.slice(0, i + 1);
            collision = {
              x: hit.x,
              y: hit.y,
              sourceIndex: -1,
              time: this._getTime() + i * this.physics.dt,
              buildingCollision: hit,
            };
            break;
          }
        }
        if (collision && collision.buildingCollision) break;
      }
    }

    this.predictedPath = path;
    this.predictedCollision = collision;
  }

  /**
   * 获取 Delta-V 矢量信息（供渲染用）
   * @returns {{ startX: number, startY: number, endX: number, endY: number, magnitude: number } | null}
   */
  getDragVector() {
    if (!this.dragging) return null;
    // 弹弓式：拖动方向与 Delta-V 方向相反
    const dvx = -(this.dragCurrentX - this.dragStartX) * DRAG_TO_DV_SCALE;
    const dvy = -(this.dragCurrentY - this.dragStartY) * DRAG_TO_DV_SCALE;
    return {
      startX: this.dragStartX,
      startY: this.dragStartY,
      endX: this.dragCurrentX,
      endY: this.dragCurrentY,
      dvx,
      dvy,
      magnitude: Math.sqrt(dvx * dvx + dvy * dvy),
    };
  }

  /** 获取预测轨迹 */
  getPredictedPath() {
    return this.predictedPath;
  }

  /** 获取预测碰撞点 */
  getPredictedCollision() {
    return this.predictedCollision;
  }

  /** 获取当前悬停的子弹 */
  getHoveredBullet() {
    return this._findBulletUnderMouse(this.mouseX, this.mouseY);
  }

  /** 是否应该暂停物理模拟 */
  shouldPause() {
    return this.paused || this._spacePaused;
  }

  /** 是否空格暂停 */
  isSpacePaused() {
    return this._spacePaused;
  }
}
