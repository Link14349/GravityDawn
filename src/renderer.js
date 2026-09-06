/**
 * Canvas 渲染器 — 星空背景 + 星体 + 粒子轨迹
 *
 * 美术风格：扁平、鲜艳的色彩，明亮活泼
 */

// 扁平鲜艳的调色板
const PALETTE = {
  space: '#171e1b',
  star: '#ffffff',
  orbitLine: 'rgba(94, 234, 219, 0.1)',
  predictionDash: 'rgba(94, 234, 219, 0.5)',
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
    this.stars = this._generateStars(55);
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

    ctx.strokeStyle = 'rgba(183, 201, 178, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < this.width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
    for (let y = 0; y < this.height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
    ctx.stroke();
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(211, 221, 202, ${s.alpha * .28})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }

  /** Restrained map symbols keep collision boundaries legible. */
  drawCelestialBody(body) {
    const ctx = this.ctx, { x, y } = body.getPosition(), r = body.radius;
    ctx.fillStyle = '#35473a';
    ctx.strokeStyle = '#96a28b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#75876c';
    ctx.beginPath(); ctx.ellipse(x, y, r * .45, r, -.45, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .35, -.45, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(183,201,178,.25)';
    ctx.beginPath(); ctx.arc(x, y, r + 15, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (body.label) {
      ctx.fillStyle = '#b8c2ae'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(body.label.toUpperCase(), x, y - r - 33);
      ctx.fillStyle = '#889680'; ctx.font = '9px monospace';
      ctx.fillText(`M = ${body.mass}`, x, y - r - 20);
    }
  }

  /** Show real target orbit tracks; trajectory prediction remains a separate line. */
  drawTargetOrbits(buildings) {
    const ctx = this.ctx;
    ctx.save(); ctx.strokeStyle = 'rgba(219,164,129,.24)'; ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    for (const building of buildings) for (const p of building.points) {
      const orbit = building.frameOrbit || p._orbit;
      if (!p.alive || !p.important || !orbit || orbit.type === 'fixed') continue;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const at = orbit.getWorldPosition(i / 80 * orbit._period, p._orbits);
        if (!i) ctx.moveTo(at.x, at.y); else ctx.lineTo(at.x, at.y);
      }
      ctx.stroke();
      if (building.frameOrbit) break;
    }
    ctx.restore();
  }

  /** First experiment: show the actual pull direction, without automatic firing. */
  drawFirstShotGuide(probe, target, vector) {
    const ctx = this.ctx;
    ctx.save(); ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#dbe6c7';
    ctx.fillText('① 悬停此弹体', probe.x, probe.y - 32);
    ctx.fillStyle = '#dba481'; ctx.fillText('③ 爆心覆盖内舱', target.x, target.y - 74);
    const endX = probe.x - vector.dvx * 2, endY = probe.y - vector.dvy * 2;
    ctx.strokeStyle = '#dbe6c7'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(probe.x - 20, probe.y); ctx.lineTo(endX, endY); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(endX + 8, endY - 5); ctx.lineTo(endX, endY); ctx.lineTo(endX + 8, endY + 5); ctx.stroke();
    ctx.fillStyle = '#aebba3'; ctx.fillText('② 向左拖到这里，再松手', (probe.x + endX) / 2, endY + 32);
    ctx.restore();
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

    const orbitPeriod = body.orbit._period || 10;
    const first = body.getPositionAtTime(body.t);
    ctx.moveTo(first.x, first.y);

    const dt = orbitPeriod / pointCount;
    for (let i = 1; i <= pointCount; i++) {
      const pos = body.getPositionAtTime(body.t + i * dt);
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
  drawBullet(x, y, vx, vy, radius, launched, hovered, color = '#44ccff', canManeuver = true) {
    const ctx = this.ctx;
    // 悬停光环（可机动=白色，不可机动=黄色）
    if (hovered) {
      ctx.strokeStyle = canManeuver ? '#fff' : '#dba481';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, radius + 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = launched ? '#dba481' : '#dbe6c7';
    ctx.beginPath(); ctx.arc(x, y, radius * .7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a4b392'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, Math.PI * 2); ctx.stroke();
    // 未发射有描边，已发射无描边
    if (!launched) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, radius + 1, 0, Math.PI * 2); ctx.stroke();
    }
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
      this.drawPredictionPath(pred, 'rgba(212, 226, 181, 0.85)');
    }

    // 预测碰撞点 + 轮廓
    const predCol = ctrl.getPredictedCollision();
    if (predCol) {
      const burn = ctrl.getBurnPreview();
      if (predCol.buildingCollision && burn && burn.explosionRadius > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(219,164,129,.7)'; ctx.fillStyle = 'rgba(219,164,129,.07)';
        ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(predCol.x, predCol.y, burn.explosionRadius / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]); ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#dba481';
        ctx.fillText('内舱清除范围 / 预估', predCol.x, predCol.y - burn.explosionRadius / 2 - 14);
        ctx.restore();
      }
      // 橙色碰撞点
      ctx.fillStyle = '#dfaa83';
      ctx.beginPath(); ctx.arc(predCol.x, predCol.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#dfaa83'; ctx.lineWidth = 2;
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
        const cp = colBody.getPositionAtTime(predCol.time);
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
      ctx.strokeStyle = '#c3d7a6'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = '#c3d7a6';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 7 * Math.cos(dvAng - 0.6), tipY - 7 * Math.sin(dvAng - 0.6));
      ctx.lineTo(tipX - 7 * Math.cos(dvAng + 0.6), tipY - 7 * Math.sin(dvAng + 0.6));
      ctx.closePath(); ctx.fill();
      // Delta-V 数值标注
      const labelX = tipX + 14 * Math.cos(dvAng);
      const labelY = tipY + 14 * Math.sin(dvAng);
      ctx.fillStyle = '#c3d7a6'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`ΔV ${dv.magnitude.toFixed(0)} m/s`, labelX, labelY);
    }
  }

  /**
   * 绘制建筑（弹簧质点结构）
   * @param {import('./building.js').Building} building
   */
  drawBuilding(building) {
    const ctx = this.ctx;
    if (building.name) {
      const alive = building.points.filter(p => p.alive && !p.detached);
      if (alive.length) {
        ctx.fillStyle = '#a9b4a0'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(building.name, Math.min(...alive.map(p => p.x)), Math.min(...alive.map(p => p.y)) - 17);
      }
    }
    // 弹簧（端点死亡则跳过）
    for (const sp of building.springs) {
      if (!sp.alive || !sp.a.alive || !sp.b.alive) continue;
      ctx.strokeStyle = 'rgba(180, 200, 220, 0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sp.a.x, sp.a.y);
      ctx.lineTo(sp.b.x, sp.b.y);
      ctx.stroke();
    }
    // 质点
    for (const p of building.points) {
      if (!p.alive) continue;
      ctx.fillStyle = p.important ? '#dba481' : '#9aa992';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius, 0, Math.PI * 2); ctx.fill();
      if (building.frameOrbit && p.fixed && !p.important) {
        ctx.strokeStyle = '#71846d'; ctx.lineWidth = 1;
        ctx.strokeRect(p.x - p.renderRadius - 2, p.y - p.renderRadius - 2, (p.renderRadius + 2) * 2, (p.renderRadius + 2) * 2);
      }
      // 敌人：血量>2/3绿色，≤2/3紫色
      if (p.isEnemy) {
        const hpRatio = p.hp / p.maxHp;
        const ringColor = hpRatio > 2/3 ? '#b8c68c' : '#db9b83';
        ctx.strokeStyle = ringColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#dba481'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius + 1, 0, Math.PI * 2); ctx.stroke();
      } else if (p.isCore && p.important) {
        ctx.strokeStyle = '#dba481'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.renderRadius + 3, 0, Math.PI * 2); ctx.stroke();
      } else if (p.important) {
        ctx.strokeStyle = '#dba481'; ctx.lineWidth = 1.5;
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
    // 橙色冲击波环
    ctx.strokeStyle = `rgba(255, 160, 40, ${alpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255, 200, 80, ${alpha * 0.2})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // 白色十字（爆心标记）
    const crossLen = 4;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - crossLen, y); ctx.lineTo(x + crossLen, y);
    ctx.moveTo(x, y - crossLen); ctx.lineTo(x, y + crossLen);
    ctx.stroke();
    return false;
  }

  /**
   * 绘制引力弹的临时引力源（脉动紫色光环）
   * @param {number} x
   * @param {number} y
   * @param {number} elapsed — 已存在时间（秒）
   * @param {number} duration — 总持续时间（秒）
   * @param {number} mass — 引力质量
   */
  drawGravityWell(x, y, elapsed, duration, mass) {
    const ctx = this.ctx;
    if (elapsed >= duration) return;
    const remaining = 1 - elapsed / duration;
    const pulse = Math.sin(elapsed * 4) * 0.3 + 0.7; // 脉动
    const r = (20 + mass * 0.06) * pulse;

    // 外层光晕
    const glowGrad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.8);
    glowGrad.addColorStop(0, `rgba(180, 120, 255, ${0.6 * remaining})`);
    glowGrad.addColorStop(0.5, `rgba(140, 80, 220, ${0.3 * remaining})`);
    glowGrad.addColorStop(1, `rgba(100, 40, 180, 0)`);
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 内环
    ctx.strokeStyle = `rgba(200, 160, 255, ${0.7 * remaining * pulse})`;
    ctx.lineWidth = 2.5 * remaining;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中心十字
    const cs = 6 * pulse;
    ctx.strokeStyle = `rgba(255, 220, 255, ${0.8 * remaining})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - cs, y); ctx.lineTo(x + cs, y);
    ctx.moveTo(x, y - cs); ctx.lineTo(x, y + cs);
    ctx.stroke();
  }

  /**
   * 绘制燃烧弹灼烧效果（弹簧上的火焰粒子）
   * @param {import('./building.js').Spring} spring
   */
  drawBurnEffect(spring) {
    if (!spring.alive || !spring._burnTimer || spring._burnTimer <= 0) return;
    const ctx = this.ctx;
    const t = spring._burnTimer;
    const a = spring.a, b = spring.b;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    // 沿弹簧分布火焰粒子
    const nx = dx / len, ny = dy / len;
    const particleCount = Math.floor(len / 15);
    const seed = (spring._burnTimer * 100) % 1000;

    for (let i = 0; i < particleCount; i++) {
      const frac = (i / particleCount + seed * 0.01) % 1;
      const px = a.x + dx * frac + (Math.sin(seed + i * 7) * 4);
      const py = a.y + dy * frac + (Math.cos(seed + i * 5) * 4);
      const alpha = 0.4 + Math.random() * 0.4;
      const r = 1.5 + Math.random() * 2.5;
      const hue = Math.random() > 0.5 ? '255, 160, 40' : '255, 200, 60';

      ctx.fillStyle = `rgba(${hue}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
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
