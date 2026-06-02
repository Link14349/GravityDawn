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
   * 绘制子弹
   * @param {number} x
   * @param {number} y
   * @param {number} vx
   * @param {number} vy
   * @param {number} radius
   * @param {boolean} launched - 是否已发射（影响颜色）
   * @param {boolean} hovered - 是否悬停（加光环）
   */
  drawBullet(x, y, vx, vy, radius, launched, hovered) {
    const ctx = this.ctx;
    // 悬停光环
    if (hovered) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, radius + 7, 0, Math.PI * 2); ctx.stroke();
    }
    // 主体渐变
    const col = launched ? '#ff7744' : '#44ccff';
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    // 速度方向线
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + vx / sp * 12, y + vy / sp * 12);
      ctx.stroke();
    }
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

  /**
   * 绘制随时间衰减的轨迹线（含生命值衰减）
   * @param {{ x: number, y: number, life: number }[]} points - 会被直接修改
   * @param {string} color - 基础颜色（不含 alpha 的 rgb 格式）
   * @param {number} [decay=0.008] - 每帧生命衰减量
   * @param {number} [maxAlpha=0.5] - 最大透明度
   */
  drawFadingTrail(points, color = '255, 160, 80', decay = 0.008, maxAlpha = 0.5) {
    // 衰减生命值并移除死亡点
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].life -= decay;
      if (points[i].life <= 0) points.splice(i, 1);
    }
    if (points.length < 2) return;
    const ctx = this.ctx;
    // 逐段绘制，alpha 随生命值变化
    for (let i = 1; i < points.length; i++) {
      const a = points[i].life * maxAlpha;
      ctx.strokeStyle = `rgba(${color}, ${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
  }

  /**
   * 绘制瞄准叠加层：预测轨迹 + 碰撞点 + 行星虚线轮廓 + 拖拽线 + ΔV 箭头
   * @param {Object} ctrl - GameController 实例（需提供 getPredictedPath/getPredictedCollision/getDragVector）
   * @param {import('./celestial.js').CelestialBody[]} bodies - 所有星体（用于碰撞轮廓）
   */
  drawAimOverlay(ctrl, bodies = []) {
    const ctx = this.ctx;

    // 预测轨迹虚线
    const pred = ctrl.getPredictedPath();
    if (pred.length > 0) {
      this.drawPredictionPath(pred, 'rgba(255, 230, 60, 0.7)');
    }

    // 预测碰撞点 + 轮廓
    const predCol = ctrl.getPredictedCollision();
    if (predCol) {
      // 橙色碰撞点
      ctx.fillStyle = '#ff6633';
      ctx.beginPath(); ctx.arc(predCol.x, predCol.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff6633'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(predCol.x, predCol.y, 10, 0, Math.PI * 2); ctx.stroke();

      if (predCol.buildingCollision) {
        // 建筑碰撞：标记碰撞元素
        const bc = predCol.buildingCollision;
        if (bc.type === 'point') {
          ctx.strokeStyle = bc.point.color; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(bc.point.x, bc.point.y, bc.point.radius, 0, Math.PI * 2);
          ctx.stroke(); ctx.setLineDash([]);
        } else if (bc.type === 'spring') {
          ctx.strokeStyle = 'rgba(180,200,220,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(bc.spring.a.x, bc.spring.a.y);
          ctx.lineTo(bc.spring.b.x, bc.spring.b.y);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (predCol.sourceIndex >= 0 && predCol.sourceIndex < bodies.length) {
        // 星体碰撞
        const colBody = bodies[predCol.sourceIndex];
        const cp = colBody.orbitFn(predCol.time);
        ctx.strokeStyle = colBody.color; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, colBody.collisionRadius, 0, Math.PI * 2);
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // 拖拽线 + Delta-V 方向小箭头
    const dv = ctrl.getDragVector();
    if (dv) {
      // 淡色虚线连接子弹与鼠标
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(dv.startX, dv.startY); ctx.lineTo(dv.endX, dv.endY);
      ctx.stroke(); ctx.setLineDash([]);
      // Delta-V 方向绿色小箭头（背离拖拽方向）
      const dvAng = Math.atan2(dv.dvy, dv.dvx);
      const bx = dv.startX;
      const by = dv.startY;
      const arrowLen = Math.min(dv.magnitude * 0.4, 25);
      const tipX = bx + arrowLen * Math.cos(dvAng);
      const tipY = by + arrowLen * Math.sin(dvAng);
      ctx.strokeStyle = '#44ff88'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = '#44ff88';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 7 * Math.cos(dvAng - 0.6), tipY - 7 * Math.sin(dvAng - 0.6));
      ctx.lineTo(tipX - 7 * Math.cos(dvAng + 0.6), tipY - 7 * Math.sin(dvAng + 0.6));
      ctx.closePath(); ctx.fill();
      // Delta-V 数值标注
      const labelX = tipX + 14 * Math.cos(dvAng);
      const labelY = tipY + 14 * Math.sin(dvAng);
      ctx.fillStyle = '#44ff88'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`ΔV ${dv.magnitude.toFixed(0)} m/s`, labelX, labelY);
    }
  }

  /**
   * 绘制建筑（弹簧质点结构）
   * @param {import('./building.js').Building} building
   */
  drawBuilding(building) {
    const ctx = this.ctx;
    // 弹簧
    for (const sp of building.springs) {
      if (!sp.alive) continue;
      ctx.strokeStyle = 'rgba(180, 200, 220, 0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sp.a.x, sp.a.y);
      ctx.lineTo(sp.b.x, sp.b.y);
      ctx.stroke();
    }
    // 质点
    for (const p of building.points) {
      if (!p.alive) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius, 0, Math.PI * 2); ctx.fill();
      // 核心点：金色粗边框
      if (p.isCore) {
        ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius + 3, 0, Math.PI * 2); ctx.stroke();
      } else if (p.important) {
        ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius + 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /**
   * 绘制爆炸效果（膨胀光环）
   * @param {number} x
   * @param {number} y
   * @param {number} r - 当前半径
   * @param {number} maxR - 最大半径
   * @returns {boolean} 是否已完全消失（true 则可移除该爆炸）
   */
  drawExplosion(x, y, r, maxR) {
    const alpha = 1 - r / maxR;
    if (alpha <= 0) return true;
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(255, 180, 60, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255, 200, 80, ${alpha * 0.3})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    return false;
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
