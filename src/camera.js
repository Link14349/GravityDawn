/**
 * Camera 类 — 世界坐标 ↔ 屏幕坐标转换
 *
 * 功能：
 *   - 世界 → 屏幕坐标转换（供渲染使用）
 *   - 屏幕 → 世界坐标转换（供输入处理使用）
 *   - 平移：鼠标在空白处按住拖动
 *   - 缩放：鼠标滚轮
 *   - 对 canvas context 应用/恢复变换
 */

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.1;

export class Camera {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   * @param {() => boolean} [options.shouldBlockPan] - 返回 true 时阻止平移（如鼠标在子弹上）
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this._shouldBlockPan = options.shouldBlockPan || (() => false);
    /** 镜头中心在世界坐标中的位置 */
    this.x = 0;
    this.y = 0;
    /** 缩放级别（世界单位→像素的倍率） */
    this.zoom = 1;

    // 平移拖拽状态
    this._panning = false;
    this._panStartX = 0;
    this._panStartY = 0;
    this._panCamStartX = 0;
    this._panCamStartY = 0;

    this._bindControls();
  }

  // ========================
  // 坐标转换
  // ========================

  /** 世界坐标 → 屏幕坐标 */
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.canvas.width / 2,
      y: (wy - this.y) * this.zoom + this.canvas.height / 2,
    };
  }

  /** 屏幕坐标 → 世界坐标 */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.canvas.width / 2) / this.zoom + this.x,
      y: (sy - this.canvas.height / 2) / this.zoom + this.y,
    };
  }

  /** 世界距离 → 屏幕距离 */
  worldScale(w) {
    return w * this.zoom;
  }

  /** 屏幕距离 → 世界距离 */
  screenScale(s) {
    return s / this.zoom;
  }

  // ========================
  // Canvas 变换
  // ========================

  /** 对 canvas context 应用镜头变换（之后可直接用世界坐标绘制） */
  applyTransform(ctx) {
    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** 恢复 canvas context 变换 */
  restoreTransform(ctx) {
    ctx.restore();
  }

  // ========================
  // 平移 & 缩放控制
  // ========================

  _bindControls() {
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('mousedown', (e) => this._onPanStart(e));
    this.canvas.addEventListener('mousemove', (e) => this._onPanMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onPanEnd(e));
    this.canvas.addEventListener('mouseleave', (e) => this._onPanEnd(e));
  }

  /** 鼠标滚轮缩放 */
  _onWheel(e) {
    if (this.enabled === false) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta));

    // 以鼠标位置为中心缩放
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * this.canvas.width / rect.width;
    const sy = (e.clientY - rect.top) * this.canvas.height / rect.height;
    const worldBefore = this.screenToWorld(sx, sy);
    this.zoom = newZoom;
    const worldAfter = this.screenToWorld(sx, sy);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
  }

  /** 平移：左键在空白处按住拖动 */
  _onPanStart(e) {
    if (e.button !== 0 || this.enabled === false) return;
    // 如果鼠标在交互目标（如子弹）上，不启动平移
    if (this._shouldBlockPan()) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this._panning = true;
    this._panStartX = (e.clientX - rect.left) * this.canvas.width / rect.width;
    this._panStartY = (e.clientY - rect.top) * this.canvas.height / rect.height;
    this._panCamStartX = this.x;
    this._panCamStartY = this.y;
  }

  _onPanMove(e) {
    if (!this._panning || this.enabled === false) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * this.canvas.width / rect.width;
    const sy = (e.clientY - rect.top) * this.canvas.height / rect.height;
    const dx = sx - this._panStartX;
    const dy = sy - this._panStartY;
    this.x = this._panCamStartX - dx / this.zoom;
    this.y = this._panCamStartY - dy / this.zoom;
  }

  _onPanEnd(e) {
    this._panning = false;
  }

  /** 检查 Camera 自身是否正在处理鼠标事件（避免与其他拖拽冲突） */
  isPanning() {
    return this._panning;
  }
}
