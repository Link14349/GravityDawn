/**
 * Canvas 渲染器 — 星空背景 + 星体 + 粒子轨迹
 *
 * 美术风格：扁平、鲜艳的色彩，明亮活泼
 */

// 扁平鲜艳的调色板
const PALETTE = {
  space: '#0d1140',
  star: '#ffffff',
  orbitLine: 'rgba(255, 255, 255, 0.12)',
  predictionDash: 'rgba(255, 220, 100, 0.5)',
};

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // 预生成星星位置（保证帧间一致）
    this.stars = this._generateStars(200);
  }

  /** 生成伪随机星星 */
  _generateStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: (i * 7919 + 123) % this.width,
        y: (i * 6271 + 456) % this.height,
        r: 0.5 + ((i * 3571) % 100) / 100 * 1.5,
        alpha: 0.3 + ((i * 4813) % 100) / 100 * 0.7,
      });
    }
    return stars;
  }

  /** 清屏并绘制星空背景 */
  clear() {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.space;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 绘制星体（带光晕渐变）
   * @param {import('./celestial.js').CelestialBody} body
   */
  drawCelestialBody(body) {
    const ctx = this.ctx;
    const { x, y } = body.getPosition();
    const r = body.radius;

    // 外层光晕
    const glowGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
    glowGrad.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
    glowGrad.addColorStop(0.5, 'rgba(255, 150, 50, 0.1)');
    glowGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 主体渐变（扁平鲜艳）
    const bodyGrad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    bodyGrad.addColorStop(0, this._lighten(body.color, 0.4));
    bodyGrad.addColorStop(0.5, body.color);
    bodyGrad.addColorStop(1, this._darken(body.color, 0.3));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // 标签
    if (body.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(body.label, x, y - r - 14);
      ctx.fillText(`M=${body.mass}`, x, y - r - 2);
    }
  }

  /**
   * 绘制轨道线
   * @param {import('./celestial.js').CelestialBody} body
   * @param {number} [pointCount=200] - 采样点数
   */
  drawOrbitPath(body, pointCount = 200) {
    const ctx = this.ctx;
    ctx.strokeStyle = PALETTE.orbitLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();

    const first = body.orbitFn(body.t);
    ctx.moveTo(first.x, first.y);

    // 采样一圈轨道
    const period = 2 * Math.PI; // 假设 orbitFn 以 2π 为参数周期，此处用时间采样
    // 更通用的做法：在 t 上采样，步长用周期/pointCount
    // 由于 orbitFn 用时间参数，这里在 body.t 周围采样一个完整周期
    const dt = period / pointCount;
    for (let i = 1; i <= pointCount; i++) {
      const pos = body.orbitFn(body.t + i * dt);
      ctx.lineTo(pos.x, pos.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制预测轨迹（虚线）
   * @param {{ x: number, y: number }[]} path
   * @param {string} [color]
   */
  drawPredictionPath(path, color = PALETTE.predictionDash) {
    if (path.length < 2) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制粒子点
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} [radius=3]
   */
  drawParticle(x, y, color, radius = 3) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 绘制轨迹线
   * @param {{ x: number, y: number }[]} points
   * @param {string} color
   */
  drawTrail(points, color) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- 颜色工具 ---

  /** 调亮颜色 */
  _lighten(hex, factor) {
    const rgb = this._hexToRgb(hex);
    const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor));
    const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor));
    const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor));
    return `rgb(${r},${g},${b})`;
  }

  /** 调暗颜色 */
  _darken(hex, factor) {
    const rgb = this._hexToRgb(hex);
    const r = Math.round(rgb.r * (1 - factor));
    const g = Math.round(rgb.g * (1 - factor));
    const b = Math.round(rgb.b * (1 - factor));
    return `rgb(${r},${g},${b})`;
  }

  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 255, g: 150, b: 50 };
  }
}
