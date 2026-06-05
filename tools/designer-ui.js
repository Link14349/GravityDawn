/**
 * 关卡设计器 — 编辑模式渲染 + 交互
 *
 * 提供编辑模式下的：
 *   - 简易相机（平移/缩放）
 *   - 工具栏渲染
 *   - 画布渲染（轨道/星体/建筑/网格）
 *   - 属性面板渲染
 *   - 鼠标交互处理（各工具模式）
 *   - 状态栏
 */

// ---- 颜色常量 ----
const C = {
  bg: '#0a0e27',
  panel: 'rgba(10, 14, 39, 0.95)',
  accent: '#3dd6c8',
  accent2: '#6b7dff',
  text: '#d0d6e8',
  sub: '#6b7a9d',
  btn: '#3dd6c8',
  btnHover: '#5eeadb',
  btnText: '#0a1220',
  gold: '#ffd93d',
  green: '#44ff88',
  red: '#ff6b6b',
  orbitColor: 'rgba(94, 234, 219, 0.3)',
  orbitSel: 'rgba(94, 234, 219, 0.8)',
  gridColor: 'rgba(255, 255, 255, 0.04)',
  gridMajor: 'rgba(255, 255, 255, 0.08)',
};

// ---- 工具栏定义 ----
const TOOLS = [
  { id: 'orbit',   label: '轨道',  icon: '◎', shortcut: '1' },
  { id: 'body',    label: '星体',  icon: '●', shortcut: '2' },
  { id: 'core',    label: '核心',  icon: '⬡', shortcut: '3' },
  { id: 'point',   label: '质点',  icon: '·', shortcut: '4' },
  { id: 'enemy',   label: '敌人',  icon: '⬤', shortcut: '5' },
  { id: 'spring',  label: '弹簧',  icon: '⏤', shortcut: '6' },
  { id: 'select',  label: '选择',  icon: '⊡', shortcut: '0' },
];

export class EditModeUI {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./designer.js').DesignerData} designerData
   * @param {Object} callbacks - { onTest, onExport, onImport, onNew }
   */
  constructor(canvas, designerData, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.dd = designerData;
    this.cb = callbacks;

    // 编辑器相机
    this.camX = 0;
    this.camY = 0;
    this.zoom = 0.75;

    // 鼠标状态
    this.mx = 0;
    this.my = 0;
    this._panning = false;
    this._panSX = 0;
    this._panSY = 0;
    this._panCX = 0;
    this._panCY = 0;
    this._draggingOrbit = null;   // { orbitIdx, offsetX, offsetY }
    this._draggingPoint = null;   // { bldIdx, ptIdx, offsetX, offsetY }
    this._draggingBody = null;    // { type:'star'|'planet', idx }

    // 属性面板输入框引用
    this._propInputs = [];
    this._activeEdit = null;    // { key, text, cursorPos, sel } — 正在直接键盘编辑的字段
    this._editBlink = 0;        // 光标闪烁计时器
    this._dropdown = null;      // { x, y, w, options: [{label,value}], key, sel } — 下拉菜单状态

    // 右键循环选择
    this._lastRightPos = null;
    this._lastRightSel = null;

    // 自动对齐格子
    this.snapToGrid = false;

    // 消息提示
    this._toast = null;
    this._toastTimer = 0;

    // 星星预生成
    this._stars = this._genStars(150);

    // 绑定事件
    this._bindEvents();
    this._bindKeyboard();
  }

  // ========================
  // 坐标转换
  // ========================
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.camX) * this.zoom + this.w / 2,
      y: (wy - this.camY) * this.zoom + this.h / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.w / 2) / this.zoom + this.camX,
      y: (sy - this.h / 2) / this.zoom + this.camY,
    };
  }

  // ========================
  // 渲染入口
  // ========================
  render() {
    const ctx = this.ctx;
    ctx.save();

    // 背景
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this._drawGrid(ctx);
    this._drawStars(ctx);

    // 原点标记
    const o = this.worldToScreen(0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(o.x - 15, o.y); ctx.lineTo(o.x + 15, o.y);
    ctx.moveTo(o.x, o.y - 15); ctx.lineTo(o.x, o.y + 15);
    ctx.stroke();

    // 绘制轨道线
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      this._drawOrbit(ctx, i);
    }

    // 绘制星体
    const bodies = this.dd.getAllBodyPositions();
    for (const b of bodies) {
      this._drawBody(ctx, b);
    }

    // 绘制建筑
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      this._drawBuilding(ctx, bi);
    }

    // 绘制弹簧模式第一选中点
    if (this.dd._springFirst) {
      const sf = this.dd._springFirst;
      const wp = this.dd.getPointWorld(sf.bldIdx, sf.ptIdx);
      const sp = this.worldToScreen(wp.x, wp.y);
      ctx.strokeStyle = '#ffdd44';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffdd44';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('点击第二个质点', sp.x, sp.y - 18);
    }

    ctx.restore();

    // 非 Canvas 绘制：工具栏、属性面板、状态栏
    this._drawToolbar(ctx);
    this._drawPropertyPanel(ctx);
    this._drawStatusBar(ctx);
    if (this._toast) this._drawToast(ctx);
  }

  // ========================
  // 网格
  // ========================
  _drawGrid(ctx) {
    const gridSize = 100;
    // 世界坐标范围
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.w, this.h);
    const startX = Math.floor(tl.x / gridSize) * gridSize;
    const startY = Math.floor(tl.y / gridSize) * gridSize;
    const endX = br.x;
    const endY = br.y;

    for (let x = startX; x <= endX; x += gridSize) {
      const sp = this.worldToScreen(x, 0);
      ctx.strokeStyle = (x % 500 === 0) ? C.gridMajor : C.gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sp.x, 0);
      ctx.lineTo(sp.x, this.h);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const sp = this.worldToScreen(0, y);
      ctx.strokeStyle = (y % 500 === 0) ? C.gridMajor : C.gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, sp.y);
      ctx.lineTo(this.w, sp.y);
      ctx.stroke();
    }
  }

  _drawStars(ctx) {
    for (const s of this._stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _genStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        sx: (i * 7919 + 123) % this.w,
        sy: (i * 6271 + 456) % this.h,
        r: 0.5 + ((i * 3571) % 100) / 100 * 1.2,
        alpha: 0.2 + ((i * 4813) % 100) / 100 * 0.5,
      });
    }
    return stars;
  }

  // ========================
  // 轨道绘制
  // ========================
  _drawOrbit(ctx, idx) {
    const orb = this.dd.data.orbits[idx];
    if (!orb) return;

    // 圆心/固定位置（圆形/椭圆用圆心，fixed 就是坐标本身）
    const center = this.dd.getOrbitCenterWorld(idx);
    const sp = this.worldToScreen(center.x, center.y);
    const isSel = this.dd.selected && this.dd.selected.type === 'orbit' && this.dd.selected.orbitIdx === idx;

    // 圆形/椭圆轨道预览（以圆心为中心画虚线）
    if (orb.type === 'circular' && orb.radius) {
      const r = orb.radius * this.zoom;
      ctx.strokeStyle = isSel ? C.orbitSel : C.orbitColor;
      ctx.lineWidth = isSel ? 2 : 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (orb.type === 'elliptical' && orb.rx && orb.ry) {
      const rx = orb.rx * this.zoom;
      const ry = orb.ry * this.zoom;
      ctx.strokeStyle = isSel ? C.orbitSel : C.orbitColor;
      ctx.lineWidth = isSel ? 2 : 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 父轨道连线（从父轨道圆心到当前轨道圆心）
    if (orb.parent != null) {
      const pc = this.dd.getOrbitCenterWorld(orb.parent);
      const pp = this.worldToScreen(pc.x, pc.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 轨道标记
    const r = 8;
    ctx.fillStyle = isSel ? '#fff' : C.accent;
    ctx.strokeStyle = isSel ? '#fff' : C.accent;
    ctx.lineWidth = isSel ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 标签
    ctx.fillStyle = '#fff';
    ctx.font = `${isSel ? 'bold ' : ''}11px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(this._orbitLabel(idx), sp.x, sp.y - 16);
  }

  // ========================
  // 星体绘制
  // ========================
  _drawBody(ctx, b) {
    const sp = this.worldToScreen(b.x, b.y);
    const r = b.radius * this.zoom;
    const isSel = this.dd.selected
      && this.dd.selected.type === b.type
      && this.dd.selected[`${b.type}Idx`] === b.idx;

    // 光晕
    const glowGrad = ctx.createRadialGradient(sp.x, sp.y, r * 0.5, sp.x, sp.y, r * 2.2);
    glowGrad.addColorStop(0, 'rgba(255, 200, 100, 0.25)');
    glowGrad.addColorStop(0.5, 'rgba(255, 150, 50, 0.08)');
    glowGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 主体
    const bodyGrad = ctx.createRadialGradient(sp.x - r * 0.25, sp.y - r * 0.25, 0, sp.x, sp.y, r);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.4, b.color);
    bodyGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 选中高亮
    if (isSel) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 碰撞半径虚线
    if (b.collisionRadius !== b.radius) {
      const cr = b.collisionRadius * this.zoom;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, cr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 标签
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, sp.x, sp.y - r - 12);
    }
  }

  // ========================
  // 建筑绘制
  // ========================
  _drawBuilding(ctx, bldIdx) {
    const bld = this.dd.data.buildings[bldIdx];
    if (!bld) return;

    // 绘制弹簧
    for (const sp of bld.springs) {
      const a = this.dd.getPointWorld(bldIdx, sp.a);
      const b = this.dd.getPointWorld(bldIdx, sp.b);
      const sa = this.worldToScreen(a.x, a.y);
      const sb = this.worldToScreen(b.x, b.y);
      const isSel = this.dd.selected && this.dd.selected.type === 'spring'
        && this.dd.selected.bldIdx === bldIdx && this.dd.selected.spIdx === bld.springs.indexOf(sp);

      ctx.strokeStyle = isSel ? '#fff' : 'rgba(180, 200, 220, 0.5)';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();

      // 选中弹簧显示张力信息
      if (isSel) {
        const midX = (sa.x + sb.x) / 2;
        const midY = (sa.y + sb.y) / 2;
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`k=${sp.stiffness}`, midX, midY - 8);
      }
    }

    // 绘制质点
    for (let pi = 0; pi < bld.points.length; pi++) {
      const pt = bld.points[pi];
      const wp = this.dd.getPointWorld(bldIdx, pi);
      const sp = this.worldToScreen(wp.x, wp.y);
      const isSel = this.dd.selected && this.dd.selected.type === 'point'
        && this.dd.selected.bldIdx === bldIdx && this.dd.selected.ptIdx === pi;

      const rr = (pt.renderRadius || pt.radius || 5) * this.zoom;
      const minR = Math.max(rr, 4);

      // 填充
      ctx.fillStyle = pt.color || '#888';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, minR, 0, Math.PI * 2);
      ctx.fill();

      // 敌人光环
      if (pt.isEnemy) {
        ctx.strokeStyle = '#44ff44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, minR + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, minR + 1, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 核心光环
      if (pt.isCore) {
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, minR + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // important 光环
      if (pt.important && !pt.isCore && !pt.isEnemy) {
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, minR + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 选中高亮
      if (isSel) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, minR + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 核心点轨道连线
      if (pt.isCore && pt.orbit != null) {
        const op = this.dd.getOrbitWorldPos(pt.orbit);
        const os = this.worldToScreen(op.x, op.y);
        ctx.strokeStyle = 'rgba(255, 221, 68, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(os.x, os.y);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ========================
  // 工具栏（Canvas 绘制，顶部）
  // ========================
  _drawToolbar(ctx) {
    const tbY = 0;
    const tbH = 46;
    const btnW = 54;
    const gap = 4;
    const startX = 8;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, tbY, this.w, tbH);

    // 工具按钮
    let bx = startX;
    for (const tool of TOOLS) {
      const hovered = this._inRect(bx, tbY + 6, btnW, tbH - 12);
      const active = this.dd.tool === tool.id;

      ctx.fillStyle = active ? C.accent : (hovered ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)');
      this._roundRect(ctx, bx, tbY + 6, btnW, tbH - 12, 6, true);
      if (active) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, bx, tbY + 6, btnW, tbH - 12, 6, false);
      }

      ctx.fillStyle = active ? C.btnText : C.text;
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(tool.icon, bx + btnW / 2, tbY + 22);
      ctx.font = '10px Arial';
      ctx.fillText(tool.label, bx + btnW / 2, tbY + 36);

      // 记录按钮位置用于点击检测
      tool._bx = bx;
      tool._by = tbY + 6;
      tool._bw = btnW;
      tool._bh = tbH - 12;

      bx += btnW + gap;
    }

    // 右侧操作按钮
    const actBtns = [
      { id: 'test', label: '▶ 测试', primary: true },
      { id: 'export', label: '导出', primary: false },
      { id: 'import', label: '导入', primary: false },
      { id: 'new', label: '新建', primary: false },
    ];
    let ax = this.w - 12;
    const abtnW = 68;
    for (let i = actBtns.length - 1; i >= 0; i--) {
      const ab = actBtns[i];
      ax -= abtnW + gap;
      const hovered = this._inRect(ax, tbY + 8, abtnW, tbH - 16);

      ctx.fillStyle = ab.primary ? (hovered ? C.btnHover : C.accent) : (hovered ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)');
      this._roundRect(ctx, ax, tbY + 8, abtnW, tbH - 16, 6, true);
      if (!ab.primary) {
        ctx.strokeStyle = hovered ? C.accent : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        this._roundRect(ctx, ax, tbY + 8, abtnW, tbH - 16, 6, false);
      }

      ctx.fillStyle = ab.primary ? C.btnText : (hovered ? C.accent : C.text);
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(ab.label, ax + abtnW / 2, tbY + 28);

      ab._bx = ax;
      ab._by = tbY + 8;
      ab._bw = abtnW;
      ab._bh = tbH - 16;
    }

    // 自动对齐格子复选框
    const chkX = bx + 8;
    const chkY = tbY + 12;
    const chkSize = 14;
    const chkLabel = '对齐网格';
    ctx.font = '11px Arial';
    const labelW = ctx.measureText(chkLabel).width;

    const chkHovered = this._inRect(this.mx, this.my, chkX, chkY, chkSize + labelW + 6, chkSize + 2);
    ctx.fillStyle = this.snapToGrid ? C.accent : 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = chkHovered ? C.accent : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, chkX, chkY, chkSize, chkSize, 3, true);
    this._roundRect(ctx, chkX, chkY, chkSize, chkSize, 3, false);
    if (this.snapToGrid) {
      ctx.fillStyle = C.btnText;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('✓', chkX + chkSize / 2, chkY + chkSize - 2);
    }
    ctx.fillStyle = chkHovered ? C.accent : C.sub;
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(chkLabel, chkX + chkSize + 5, chkY + chkSize - 2);

    this._snapChk = { x: chkX, y: chkY, w: chkSize + labelW + 6, h: chkSize + 2 };

    // 存储按钮引用用于点击
    this._toolBtns = TOOLS;
    this._actBtns = actBtns;
  }

  // ========================
  // 属性面板（右侧）
  // ========================
  _drawPropertyPanel(ctx) {
    const pw = 220;
    const px = this.w - pw;
    const py = 46;

    // 背景
    ctx.fillStyle = C.panel;
    ctx.fillRect(px, py, pw, this.h - py - 28);

    // 边框
    ctx.strokeStyle = 'rgba(61, 214, 200, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, this.h - 28);
    ctx.stroke();

    const sel = this.dd.selected;
    if (!sel) {
      ctx.fillStyle = C.sub;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('选择一个物体以编辑属性', px + pw / 2, py + 60);
      return;
    }

    ctx.fillStyle = C.accent;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${this._selTypeLabel(sel)} 属性`, px + 12, py + 24);

    // 属性列表
    const props = this._getSelectionProps(sel);
    let iy = py + 44;
    this._propInputs = [];
    let _ddInfo = null; // 延迟渲染的下拉菜单信息

    for (const prop of props) {
      if (iy > this.h - 100) break;

      ctx.fillStyle = C.sub;
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(prop.label, px + 12, iy + 12);

      const valStr = String(prop.value ?? '');
      const inpW = pw - 100;
      const inpX = px + 90;
      const inpY = iy;
      const inpH = 20;

      const hasOptions = prop.options && prop.options.length > 0;
      const isOpen = hasOptions && this._dropdown && this._dropdown.key === prop.key;

      // 是否正在编辑此字段
      const isEditing = this._activeEdit && this._activeEdit.key === prop.key;

      if (hasOptions) {
        // ---- 下拉框 ----
        ctx.fillStyle = isOpen ? 'rgba(61,214,200,0.15)' : 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = isOpen ? C.accent : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = isOpen ? 2 : 1;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true);
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);

        // 显示当前选中值（优先用选项标签）
        const selectedOpt = prop.options.find(o => o.value === prop.value);
        const displayVal = selectedOpt ? selectedOpt.label : valStr;
        ctx.fillStyle = C.text;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(displayVal.length > 18 ? displayVal.substring(0, 17) + '…' : displayVal, inpX + 5, inpY + 14);

        // 下拉箭头
        ctx.fillStyle = C.sub;
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('▼', inpX + inpW - 5, inpY + 14);

        this._propInputs.push({
          key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH,
          label: prop.label, value: prop.value, options: prop.options, isDropdown: true,
        });

        // 记录下拉菜单信息，等所有属性画完后再画（覆盖在下方属性之上）
        if (isOpen) {
          _ddInfo = { inpX, inpY, inpH, inpW, prop };
        }

      } else if (isEditing) {
        // ---- 文本编辑 ----
        ctx.fillStyle = 'rgba(61,214,200,0.15)';
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true);
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);

        // 绘制带光标的编辑文本
        const ae = this._activeEdit;
        const cursorX = inpX + 5 + ctx.measureText(ae.text.substring(0, ae.cursorPos)).width;
        ctx.fillStyle = C.text;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ae.text, inpX + 5, inpY + 14);

        // 闪烁光标
        const showCursor = (Math.floor(this._editBlink * 1000 / 530) % 2 === 0);
        if (showCursor) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cursorX, inpY + 3);
          ctx.lineTo(cursorX, inpY + inpH - 3);
          ctx.stroke();
        }

        this._propInputs.push({
          key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH,
          label: prop.label, value: prop.value, type: prop.type || 'text',
        });
      } else {
        // ---- 普通文本 ----
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true);
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);

        ctx.fillStyle = C.text;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        const display = valStr.length > 18 ? valStr.substring(0, 17) + '…' : valStr;
        ctx.fillText(display, inpX + 5, inpY + 14);

        this._propInputs.push({
          key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH,
          label: prop.label, value: prop.value, type: prop.type || 'text',
        });
      }

      iy += 26;
    }

    // 删除按钮
    if (this._canDelete(sel)) {
      const delY = Math.max(iy + 10, this.h - 100);
      const delW = pw - 24;
      const hovered = this._inRect(px + 12, delY, delW, 28);
      ctx.fillStyle = hovered ? '#ff4444' : 'rgba(255,68,68,0.2)';
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1;
      this._roundRect(ctx, px + 12, delY, delW, 28, 6, true);
      this._roundRect(ctx, px + 12, delY, delW, 28, 6, false);
      ctx.fillStyle = hovered ? '#fff' : '#ff6b6b';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('删除', px + pw / 2, delY + 19);

      this._deleteBtn = { x: px + 12, y: delY, w: delW, h: 28 };
    } else {
      this._deleteBtn = null;
    }

    // ---- 下拉菜单（最后画，盖在下方属性文字之上） ----
    if (_ddInfo) {
      const { inpX, inpY, inpH, inpW, prop } = _ddInfo;
      // 重要：将 _dropdown.options 同步到当前帧的新选项对象（否则点击检测使用过期引用）
      this._dropdown.options = prop.options;
      const optH = 22;
      const ddH = prop.options.length * optH;
      const ddY = inpY + inpH + 2;
      const drawY = ddY + ddH > this.h - 40 ? inpY - ddH - 2 : ddY;

      // 实色背景覆盖下方内容
      ctx.fillStyle = 'rgba(20, 28, 65, 0.99)';
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1;
      this._roundRect(ctx, inpX, drawY, inpW, ddH, 4, true);
      this._roundRect(ctx, inpX, drawY, inpW, ddH, 4, false);

      for (let oi = 0; oi < prop.options.length; oi++) {
        const opt = prop.options[oi];
        const oy = drawY + oi * optH;
        const isHovered = this._inRect(this.mx, this.my, inpX, oy, inpW, optH);
        const isSel = opt.value === prop.value;

        if (isHovered) {
          ctx.fillStyle = 'rgba(61,214,200,0.2)';
          ctx.fillRect(inpX + 2, oy + 1, inpW - 4, optH - 2);
        }

        ctx.fillStyle = isSel ? C.accent : C.text;
        ctx.font = isSel ? 'bold 11px monospace' : '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(opt.label, inpX + 8, oy + 15);

        // 存储选项区域用于点击检测
        opt._oy = oy;
        opt._ox = inpX;
        opt._ow = inpW;
        opt._oh = optH;
      }
    }
  }

  // ========================
  // 状态栏
  // ========================
  _drawStatusBar(ctx) {
    const sy = this.h - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, sy, this.w, 24);

    const sel = this.dd.selected;
    const selText = sel ? this._selTypeLabel(sel) : '无选中';
    const wp = this.screenToWorld(this.mx, this.my);

    ctx.fillStyle = C.sub;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`工具: ${this.dd.tool} | 选中: ${selText} | 世界: (${wp.x.toFixed(0)}, ${wp.y.toFixed(0)}) | 缩放: ${(this.zoom * 100).toFixed(0)}%`, 10, sy + 16);
  }

  _drawToast(ctx) {
    const alpha = Math.min(1, this._toastTimer / 0.3);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
    const tw = 300, th = 36;
    const tx = (this.w - tw) / 2, ty = this.h - 80;
    this._roundRect(ctx, tx, ty, tw, th, 8, true);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this._toast, this.w / 2, ty + 23);
  }

  // ========================
  // 属性面板辅助
  // ========================
  _selTypeLabel(sel) {
    switch (sel.type) {
      case 'orbit': return this._orbitLabel(sel.orbitIdx);
      case 'star': return `恒星 ${sel.starIdx}`;
      case 'planet': return `行星 ${sel.planetIdx}`;
      case 'point': {
        const pt = this.dd.data.buildings[sel.bldIdx]?.points[sel.ptIdx];
        const tag = pt?.isCore ? '核心' : (pt?.isEnemy ? '敌人' : '质点');
        return `${tag} [B${sel.bldIdx}:${sel.ptIdx}]`;
      }
      case 'spring': return `弹簧 [B${sel.bldIdx}:${sel.spIdx}]`;
      case 'bullet': {
        const bt = this.dd.data.bullets[sel.bulletIdx];
        const typeName = bt?.type || 'unknown';
        return `子弹${sel.bulletIdx} (${typeName})`;
      }
      default: return sel.type;
    }
  }

  /** 格式化轨道标签：轨道名#id */
  _orbitLabel(idx) {
    const orb = this.dd.data.orbits[idx];
    if (!orb) return `轨道#${idx}`;
    const name = orb.name || '轨道';
    return `${name}#${idx}`;
  }

  /** 生成轨道下拉选项列表 */
  _orbitOptions(excludeIdx = -1) {
    const opts = [];
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      if (i === excludeIdx) continue;
      opts.push({ label: this._orbitLabel(i), value: i });
    }
    return opts;
  }

  _getSelectionProps(sel) {
    const dd = this.dd.data;
    switch (sel.type) {
      case 'orbit': {
        const orb = dd.orbits[sel.orbitIdx];
        if (!orb) return [];
        const base = [
          { key: 'name', label: '名称', value: orb.name || '' },
          { key: 'type', label: '类型', value: orb.type, options: [
            { label: 'fixed (固定)', value: 'fixed' },
            { label: 'circular (圆形)', value: 'circular' },
            { label: 'elliptical (椭圆)', value: 'elliptical' },
          ] },
          { key: 'parent', label: '父轨道', value: orb.parent ?? '无', options: (() => {
            const opts = [{ label: '无', value: null }];
            opts.push(...this._orbitOptions(sel.orbitIdx));
            return opts;
          })() },
        ];
        // x/y 对所有类型都显示（圆心偏移/固定坐标）
        base.push({ key: 'x', label: 'X (偏移)', value: Math.round(orb.x || 0) });
        base.push({ key: 'y', label: 'Y (偏移)', value: Math.round(orb.y || 0) });
        if (orb.type === 'circular') {
          base.push({ key: 'radius', label: '半径', value: orb.radius || 0 });
          base.push({ key: 'period', label: '周期(秒)', value: orb.period || 20 });
          base.push({ key: 'phase', label: '相位(度)', value: Math.round((orb.phase || 0) * 180 / Math.PI) });
        } else if (orb.type === 'elliptical') {
          base.push({ key: 'rx', label: 'rx', value: orb.rx || 0 });
          base.push({ key: 'ry', label: 'ry', value: orb.ry || 0 });
          base.push({ key: 'period', label: '周期(秒)', value: orb.period || 20 });
          base.push({ key: 'phase', label: '相位(度)', value: Math.round((orb.phase || 0) * 180 / Math.PI) });
        }
        return base;
      }
      case 'star': {
        const s = dd.stars[sel.starIdx];
        if (!s) return [];
        return [
          { key: 'mass', label: '质量', value: s.mass },
          { key: 'radius', label: '半径', value: s.radius },
          { key: 'collisionRadius', label: '碰撞半径', value: s.collisionRadius },
          { key: 'color', label: '颜色', value: s.color },
          { key: 'label', label: '名称', value:s.label },
          { key: 'orbit', label: '轨道', value: s.orbit, options: this._orbitOptions() },
        ];
      }
      case 'planet': {
        const p = dd.planets[sel.planetIdx];
        if (!p) return [];
        return [
          { key: 'mass', label: '质量', value: p.mass },
          { key: 'radius', label: '半径', value: p.radius },
          { key: 'collisionRadius', label: '碰撞半径', value: p.collisionRadius },
          { key: 'color', label: '颜色', value: p.color },
          { key: 'label', label: '名称', value:p.label },
          { key: 'orbit', label: '轨道', value: p.orbit, options: this._orbitOptions() },
        ];
      }
      case 'point': {
        const pt = dd.buildings[sel.bldIdx]?.points[sel.ptIdx];
        if (!pt) return [];
        const props = [
          { key: 'mass', label: '质量', value: pt.mass },
          { key: 'radius', label: '半径', value: pt.radius },
          { key: 'score', label: '分数', value: pt.score },
          { key: 'color', label: '颜色', value: pt.color },
          { key: 'important', label: '重要目标', value: pt.important ? '是' : '否' },
        ];
        if (pt.isCore) {
          props.push({ key: 'orbit', label: '轨道', value: pt.orbit ?? '无' });
          props.push({ key: 'explosionRadius', label: '爆炸半径', value: pt.explosionRadius });
          props.push({ key: 'explosionImpulse', label: '爆炸冲量', value: pt.explosionImpulse });
        }
        if (pt.isEnemy) {
          props.push({ key: 'hp', label: 'HP', value: pt.hp });
          props.push({ key: 'renderRadius', label: '渲染半径', value: pt.renderRadius });
        }
        if (!pt.isCore && !pt.isEnemy) {
          const core = this.dd.getBuildingCoreWorld(sel.bldIdx);
          props.push({ key: 'relX', label: '相对X', value: Math.round(pt.x || 0) });
          props.push({ key: 'relY', label: '相对Y', value: Math.round(pt.y || 0) });
          props.push({ key: 'explosionRadius', label: '爆炸半径', value: pt.explosionRadius ?? 0 });
          props.push({ key: 'explosionImpulse', label: '爆炸冲量', value: pt.explosionImpulse ?? 0 });
        }
        return props;
      }
      case 'spring': {
        const sp = dd.buildings[sel.bldIdx]?.springs[sel.spIdx];
        if (!sp) return [];
        return [
          { key: 'a', label: '端点A', value: sp.a },
          { key: 'b', label: '端点B', value: sp.b },
          { key: 'stiffness', label: '劲度系数', value: sp.stiffness },
          { key: 'damping', label: '阻尼', value: sp.damping },
          { key: 'breakTension', label: '断裂张力', value: sp.breakTension },
        ];
      }
      case 'bullet': {
        const b = dd.bullets[sel.bulletIdx];
        if (!b) return [];
        const typeOpts = [
          { label: '普通弹', value: 'normal' },
          { label: '爆炸弹', value: 'explosive' },
          { label: '动能弹', value: 'kinetic' },
          { label: '机动弹', value: 'agile' },
          { label: '分裂弹', value: 'cluster' },
          { label: '引力弹', value: 'gravity' },
          { label: '燃烧弹', value: 'incendiary' },
        ];
        const props = [
          { key: 'type', label: '类型', value: b.type || 'normal', options: typeOpts },
        ];
        if (b.orbitAround) {
          props.push({ key: 'orbitBody', label: '绕行星体', value: b.orbitAround.bodyIndex, options: this._orbitOptions() });
          props.push({ key: 'orbitAlt', label: '轨道高度', value: b.orbitAround.altitude });
          props.push({ key: 'orbitPhase', label: '初始相位', value: b.orbitAround.phase ? Math.round(b.orbitAround.phase * 180 / Math.PI) : 0 });
        }
        return props;
      }
      default: return [];
    }
  }

  _canDelete(sel) {
    switch (sel.type) {
      case 'orbit': return true;
      case 'star': return true;
      case 'planet': return true;
      case 'point': return true;
      case 'spring': return true;
      case 'bullet': return true;
      default: return false;
    }
  }

  /** 点击属性字段 → 进入键盘编辑模式 */
  _beginPropEdit(inp) {
    this._activeEdit = {
      key: inp.key,
      text: String(inp.value ?? ''),
      cursorPos: String(inp.value ?? '').length,
      sel: this.dd.selected,
    };
  }

  /** 提交当前编辑 */
  _commitEdit() {
    if (!this._activeEdit) return;
    const { key, text, sel } = this._activeEdit;
    this._activeEdit = null;

    let parsed = text;
    // 尝试解析数字
    if (!isNaN(Number(text)) && text.trim() !== '') {
      parsed = Number(text);
    }
    // 布尔
    if (text === 'true') parsed = true;
    if (text === 'false') parsed = false;
    // null
    if (text === 'null' || text === '无' || text === '') parsed = null;

    this._applyPropChange(sel, key, parsed);
  }

  /** 根据属性面板坐标找到被点击的属性项 */
  _findPropAt(sx, sy) {
    for (const inp of this._propInputs) {
      if (sx >= inp.x && sx <= inp.x + inp.w && sy >= inp.y && sy <= inp.y + inp.h) {
        return inp;
      }
    }
    return null;
  }

  /** 跳到下一个属性字段 */
  _focusNextProp() {
    if (!this._propInputs.length) return;
    const currentKey = this._activeEdit?.key;
    // 找当前 key 的索引
    let idx = 0;
    if (currentKey) {
      const found = this._propInputs.findIndex(p => p.key === currentKey);
      if (found >= 0) idx = (found + 1) % this._propInputs.length;
    }
    this._activeEdit = {
      key: this._propInputs[idx].key,
      text: String(this._propInputs[idx].value ?? ''),
      cursorPos: String(this._propInputs[idx].value ?? '').length,
      sel: this.dd.selected,
    };
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // ---- Escape：先关下拉，再关编辑 ----
      if (e.key === 'Escape') {
        if (this._dropdown) {
          e.preventDefault();
          this._dropdown = null;
          return;
        }
        if (this._activeEdit) {
          e.preventDefault();
          this._activeEdit = null;
          return;
        }
      }

      // ---- 属性编辑模式：键盘输入直接写入 ----
      if (this._activeEdit) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._commitEdit();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          this._commitEdit();
          this._focusNextProp();
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          const ae = this._activeEdit;
          if (ae.cursorPos > 0) {
            ae.text = ae.text.slice(0, ae.cursorPos - 1) + ae.text.slice(ae.cursorPos);
            ae.cursorPos--;
          }
          return;
        }
        if (e.key === 'Delete') {
          e.preventDefault();
          const ae2 = this._activeEdit;
          if (ae2.cursorPos < ae2.text.length) {
            ae2.text = ae2.text.slice(0, ae2.cursorPos) + ae2.text.slice(ae2.cursorPos + 1);
          }
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (this._activeEdit.cursorPos > 0) this._activeEdit.cursorPos--;
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (this._activeEdit.cursorPos < this._activeEdit.text.length) this._activeEdit.cursorPos++;
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          this._activeEdit.cursorPos = 0;
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          this._activeEdit.cursorPos = this._activeEdit.text.length;
          return;
        }
        // Ctrl+A: select all
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this._activeEdit.cursorPos = 0;
          this._activeEdit.selStart = 0;
          this._activeEdit.selEnd = this._activeEdit.text.length;
          return;
        }
        // 打印字符
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const ae3 = this._activeEdit;
          ae3.text = ae3.text.slice(0, ae3.cursorPos) + e.key + ae3.text.slice(ae3.cursorPos);
          ae3.cursorPos++;
        }
        return;
      }

      // ---- 非编辑模式快捷键 ----
      // 快捷键切换工具
      for (const tool of TOOLS) {
        if (e.key === tool.shortcut && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
          e.preventDefault();
          this.dd.tool = tool.id;
          this.dd.clearSelection();
          return;
        }
      }
      // Delete 键删除选中
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.dd.selected && this._canDelete(this.dd.selected) && document.activeElement === document.body) {
          e.preventDefault();
          this._deleteSelected();
        }
      }
      // Escape 取消选择
      if (e.key === 'Escape') {
        this.dd.clearSelection();
        this.dd.tool = 'select';
      }
    });
  }

  // ========================
  // 鼠标事件
  // ========================
  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => this._onMove(e));
    this.canvas.addEventListener('mousedown', (e) => this._onDown(e));
    this.canvas.addEventListener('mouseup', (e) => this._onUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._onRightClick(e);
    });
  }

  _onRightClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // 工具栏/属性面板区域不响应
    if (sy < 46) return;
    if (sx > this.w - 220 && sy > 46) return;
    // 右键拖动过就不选中（contextmenu 在 mousedown 之后触发）
    if (this._rightPanMoved) return;
    // 右键单击 → 选中目标，但不改变当前工具模式
    const wp = this.screenToWorld(sx, sy);
    this._selectAt(wp);
  }

  /** 仅做选择（不拖拽），用于右键，支持同位置多节点循环 */
  _selectAt(wp) {
    // 收集所有命中候选（按优先级排序）
    const candidates = [];

    // 质点
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      for (let pi = 0; pi < this.dd.data.buildings[bi].points.length; pi++) {
        const ptw = this.dd.getPointWorld(bi, pi);
        const d = Math.sqrt((wp.x - ptw.x) ** 2 + (wp.y - ptw.y) ** 2);
        const pr = this.dd.data.buildings[bi].points[pi].radius || 5;
        const hitR = 12 / this.zoom;
        if (d < pr + hitR) {
          candidates.push({ type: 'point', bldIdx: bi, ptIdx: pi });
        }
      }
    }

    // 弹簧
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      const bld = this.dd.data.buildings[bi];
      for (let si = 0; si < bld.springs.length; si++) {
        const sp = bld.springs[si];
        const a = this.dd.getPointWorld(bi, sp.a);
        const b = this.dd.getPointWorld(bi, sp.b);
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.001) continue;
        let t = ((wp.x - a.x) * dx + (wp.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + t * dx, cy = a.y + t * dy;
        const dist = Math.sqrt((wp.x - cx) ** 2 + (wp.y - cy) ** 2);
        if (dist < 6 / this.zoom) {
          candidates.push({ type: 'spring', bldIdx: bi, spIdx: si });
        }
      }
    }

    // 星体
    const bodies = this.dd.getAllBodyPositions();
    for (const bd of bodies) {
      const d = Math.sqrt((wp.x - bd.x) ** 2 + (wp.y - bd.y) ** 2);
      if (d < bd.radius + 15 / this.zoom) {
        const key = bd.type === 'star' ? 'starIdx' : 'planetIdx';
        candidates.push({ type: bd.type, [key]: bd.idx });
      }
    }

    // 轨道（圆心 + 虚线环）
    const orbHitR = 15 / this.zoom;
    const orbRingW = 8 / this.zoom;
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      const orb = this.dd.data.orbits[i];
      const center = this.dd.getOrbitCenterWorld(i);
      const d = Math.sqrt((wp.x - center.x) ** 2 + (wp.y - center.y) ** 2);
      let hit = d < orbHitR;
      if (!hit && orb.type === 'circular' && orb.radius) {
        hit = Math.abs(d - orb.radius) < orbRingW;
      }
      if (!hit && orb.type === 'elliptical' && orb.rx && orb.ry) {
        const ang = Math.atan2(wp.y - center.y, wp.x - center.x);
        const ex = orb.rx * Math.cos(ang);
        const ey = orb.ry * Math.sin(ang);
        const er = Math.sqrt(ex * ex + ey * ey);
        hit = Math.abs(d - er) < orbRingW;
      }
      if (hit) {
        candidates.push({ type: 'orbit', orbitIdx: i });
      }
    }

    if (candidates.length === 0) {
      this.dd.clearSelection();
      this._lastRightPos = null; this._lastRightSel = null;
      return;
    }

    // 判断是否在上一右键附近（循环选择）
    const sameSpot = this._lastRightPos &&
      Math.abs(wp.x - this._lastRightPos.x) < 8 / this.zoom &&
      Math.abs(wp.y - this._lastRightPos.y) < 8 / this.zoom;
    this._lastRightPos = { x: wp.x, y: wp.y };

    if (sameSpot && this._lastRightSel) {
      // 找当前选中在候选列表中的位置
      const curIdx = candidates.findIndex(c =>
        c.type === this._lastRightSel.type &&
        c.bldIdx === this._lastRightSel.bldIdx &&
        c.ptIdx === this._lastRightSel.ptIdx &&
        c.spIdx === this._lastRightSel.spIdx &&
        c.starIdx === this._lastRightSel.starIdx &&
        c.planetIdx === this._lastRightSel.planetIdx &&
        c.orbitIdx === this._lastRightSel.orbitIdx
      );
      const next = (curIdx >= 0) ? candidates[(curIdx + 1) % candidates.length] : candidates[0];
      this.dd.select(next.type, next);
      this._lastRightSel = next;
    } else {
      this.dd.select(candidates[0].type, candidates[0]);
      this._lastRightSel = candidates[0];
    }
  }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const prevWp = this.screenToWorld(this.mx, this.my);
    this.mx = sx;
    this.my = sy;

    // 平移
    if (this._panning) {
      const dx = sx - this._panSX;
      const dy = sy - this._panSY;
      // 标记右键是否产生了实际拖动（超过 3px 才算拖拽）
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._rightPanMoved = true;
      this.camX = this._panCX - dx / this.zoom;
      this.camY = this._panCY - dy / this.zoom;
      return;
    }

    // 拖拽轨道
    if (this._draggingOrbit) {
      const wp = this.screenToWorld(sx, sy);
      const orb = this.dd.data.orbits[this._draggingOrbit.orbitIdx];
      if (orb.type === 'fixed') {
        orb.x = wp.x - (this._draggingOrbit.offsetX || 0);
        orb.y = wp.y - (this._draggingOrbit.offsetY || 0);
      }
      return;
    }

    // 拖拽质点
    if (this._draggingPoint) {
      const wp = this.screenToWorld(sx, sy);
      const { bldIdx, ptIdx } = this._draggingPoint;
      const pt = this.dd.data.buildings[bldIdx].points[ptIdx];
      const core = this.dd.getBuildingCoreWorld(bldIdx);
      pt.x = wp.x - core.x;
      pt.y = wp.y - core.y;
      return;
    }
  }

  _onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = this.screenToWorld(sx, sy);

    // 右键：启动平移拖拽
    if (e.button === 2) {
      if (sy < 46) return;
      if (sx > this.w - 220 && sy > 46) return;
      this._panning = true;
      this._panSX = sx;
      this._panSY = sy;
      this._panCX = this.camX;
      this._panCY = this.camY;
      this._rightPanMoved = false;
      return;
    }

    if (e.button !== 0) return;

    // 对齐网格复选框
    if (this._snapChk && this._inRect(sx, sy, this._snapChk.x, this._snapChk.y, this._snapChk.w, this._snapChk.h)) {
      this.snapToGrid = !this.snapToGrid;
      return;
    }

    // 顶部工具栏按钮
    for (const tool of this._toolBtns || []) {
      if (this._inRect(sx, sy, tool._bx, tool._by, tool._bw, tool._bh)) {
        this.dd.tool = tool.id;
        this.dd.clearSelection();
        return;
      }
    }
    for (const ab of this._actBtns || []) {
      if (this._inRect(sx, sy, ab._bx, ab._by, ab._bw, ab._bh)) {
        this._onActionBtn(ab.id);
        return;
      }
    }

    // 删除按钮
    if (this._deleteBtn && this._inRect(sx, sy, this._deleteBtn.x, this._deleteBtn.y, this._deleteBtn.w, this._deleteBtn.h)) {
      this._deleteSelected();
      return;
    }

    // 下拉菜单选项点击（优先处理）
    if (this._dropdown) {
      const dd = this._dropdown;
      const opts = dd.options;
      for (const opt of opts) {
        if (opt._ox != null && this._inRect(sx, sy, opt._ox, opt._oy, opt._ow, opt._oh)) {
          this._applyPropChange(dd.sel, dd.key, opt.value);
          this._dropdown = null;
          return;
        }
      }
      // 点击下拉菜单外 → 关闭
      this._dropdown = null;
      return;
    }

    // 属性面板输入框
    const propHit = this._findPropAt(sx, sy);
    if (propHit) {
      if (propHit.isDropdown) {
        // 打开下拉菜单
        const sel = this.dd.selected;
        this._activeEdit = null;
        this._dropdown = {
          x: propHit.x,
          y: propHit.y,
          w: propHit.w,
          options: propHit.options,
          key: propHit.key,
          sel: sel,
        };
      } else {
        this._beginPropEdit(propHit);
      }
      return;
    }
    // 点击属性面板空白处取消编辑/下拉
    if (sx > this.w - 220 && sy > 46) {
      this._activeEdit = null;
      this._dropdown = null;
      return;
    }

    // 工具栏区域不允许操作画布
    if (sy < 46) return;
    // 属性面板区域
    if (sx > this.w - 220 && sy > 46) return;

    // 画布区域 — 根据工具处理
    switch (this.dd.tool) {
      case 'orbit': this._toolOrbit(wp); break;
      case 'body': this._toolBody(wp); break;
      case 'core': this._toolCore(wp); break;
      case 'point': this._toolPoint(wp); break;
      case 'enemy': this._toolEnemy(wp); break;
      case 'spring': this._toolSpring(wp); break;
      case 'select': this._toolSelect(wp, sx, sy); break;
    }
  }

  _onUp(e) {
    this._panning = false;
    this._draggingOrbit = null;
    this._draggingPoint = null;
    this._draggingBody = null;
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.max(0.15, Math.min(5, this.zoom + delta));

    // 以鼠标为中心缩放
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = this.screenToWorld(sx, sy);
    this.zoom = newZoom;
    const after = this.screenToWorld(sx, sy);
    this.camX += before.x - after.x;
    this.camY += before.y - after.y;
  }

  _onActionBtn(id) {
    switch (id) {
      case 'test': if (this.cb.onTest) this.cb.onTest(); break;
      case 'export': if (this.cb.onExport) this.cb.onExport(); break;
      case 'import': if (this.cb.onImport) this.cb.onImport(); break;
      case 'new': if (this.cb.onNew) this.cb.onNew(); break;
    }
  }

  // ========================
  // 工具实现
  // ========================

  /** 对齐到最近的网格点（间距 100） */
  _snap(wp) {
    if (!this.snapToGrid) return wp;
    return {
      x: Math.round(wp.x / 100) * 100,
      y: Math.round(wp.y / 100) * 100,
    };
  }

  /** 轨道工具：点击放置 fixed 轨道 */
  _toolOrbit(wp) {
    wp = this._snap(wp);
    const idx = this.dd.addOrbit('fixed', wp.x, wp.y);
    this.dd.select('orbit', { orbitIdx: idx });
  }

  /** 星体工具：点击轨道放置星体 */
  _toolBody(wp) {
    wp = this._snap(wp);
    const orbIdx = this._findClosestOrbit(wp);
    if (orbIdx < 0) { this._showToast('请先创建轨道'); return; }
    const idx = this.dd.addPlanet(orbIdx);
    this.dd.select('planet', { planetIdx: idx });
  }

  /** 核心工具：点击轨道放置核心点 */
  _toolCore(wp) {
    wp = this._snap(wp);
    const orbIdx = this._findClosestOrbit(wp);
    if (orbIdx < 0) { this._showToast('请先创建轨道'); return; }
    // 查找或创建建筑（同一核心在一个建筑里）
    const bldIdx = this.dd.addBuilding();
    const result = this.dd.addPoint(bldIdx, {
      isCore: true,
      orbit: orbIdx,
    });
    this.dd.select('point', { bldIdx: result.bldIdx, ptIdx: result.ptIdx });
  }

  /** 质点工具：点击放置普通质点（有核心建筑则相对放置，无则自动新建建筑） */
  _toolPoint(wp) {
    wp = this._snap(wp);
    const info = this._findClosestBuilding(wp);
    if (info) {
      const result = this.dd.addPoint(info.bldIdx, { x: wp.x, y: wp.y }, info);
      this.dd.select('point', { bldIdx: result.bldIdx, ptIdx: result.ptIdx });
    } else {
      // 无核心建筑附近 → 新建无核心建筑，用绝对坐标
      const bldIdx = this.dd.addBuilding();
      const result = this.dd.addPoint(bldIdx, { x: wp.x, y: wp.y });
      this.dd.select('point', { bldIdx: result.bldIdx, ptIdx: result.ptIdx });
    }
  }

  /** 敌人工具：点击放置敌人质点 */
  _toolEnemy(wp) {
    wp = this._snap(wp);
    const info = this._findClosestBuilding(wp);
    const enemyDef = {
      x: wp.x, y: wp.y,
      isEnemy: true, hp: 150, mass: 12, radius: 7, renderRadius: 8,
      score: 200, important: true, color: '#44ff44',
      explosionRadius: 30, explosionImpulse: 2000,
    };
    let result;
    if (info) {
      result = this.dd.addPoint(info.bldIdx, enemyDef, info);
    } else {
      // 无核心建筑附近 → 新建无核心建筑，用绝对坐标
      const bldIdx = this.dd.addBuilding();
      result = this.dd.addPoint(bldIdx, enemyDef);
    }
    this.dd.select('point', { bldIdx: result.bldIdx, ptIdx: result.ptIdx });
  }

  /** 弹簧工具：依次点击两点创建弹簧 */
  _toolSpring(wp) {
    // 找到被点击的质点
    const hit = this._findPointAt(wp);
    if (!hit) return;

    if (!this.dd._springFirst) {
      this.dd._springFirst = { bldIdx: hit.bldIdx, ptIdx: hit.ptIdx };
      this._showToast('已选第一个质点，点击第二个质点');
    } else {
      const sf = this.dd._springFirst;
      if (sf.bldIdx !== hit.bldIdx) {
        this._showToast('弹簧必须连接同一建筑内的质点');
        this.dd._springFirst = null;
        return;
      }
      const spIdx = this.dd.addSpring(sf.bldIdx, sf.ptIdx, hit.ptIdx);
      this.dd.select('spring', { bldIdx: sf.bldIdx, spIdx });
      this.dd._springFirst = null;
      this._showToast('弹簧已创建（默认参数，可在右侧面板修改）');
    }
  }

  /** 选择工具：点击选中，拖拽移动 */
  _toolSelect(wp, sx, sy) {
    // 优先级：质点 > 星体 > 轨道 > 弹簧

    // 检查质点
    const ptHit = this._findPointAt(wp);
    if (ptHit) {
      const pt = this.dd.data.buildings[ptHit.bldIdx].points[ptHit.ptIdx];
      this.dd.select('point', { bldIdx: ptHit.bldIdx, ptIdx: ptHit.ptIdx });

      // 非核心质点可拖拽
      if (!pt.isCore) {
        this._draggingPoint = { bldIdx: ptHit.bldIdx, ptIdx: ptHit.ptIdx };
      }
      // 固定轨道可拖拽
      if (pt.isCore && pt.orbit != null) {
        const orb = this.dd.data.orbits[pt.orbit];
        if (orb.type === 'fixed') {
          this._draggingOrbit = { orbitIdx: pt.orbit, offsetX: 0, offsetY: 0 };
        }
      }
      return;
    }

    // 检查弹簧（线段附近）
    const spHit = this._findSpringAt(wp);
    if (spHit) {
      this.dd.select('spring', { bldIdx: spHit.bldIdx, spIdx: spHit.spIdx });
      return;
    }

    // 检查星体
    const bodyHit = this._findBodyAt(wp);
    if (bodyHit) {
      const key = bodyHit.type === 'star' ? 'starIdx' : 'planetIdx';
      this.dd.select(bodyHit.type, { [key]: bodyHit.idx });
      // 星体所在轨道如果是 fixed，可拖拽轨道
      const bodyData = bodyHit.type === 'star'
        ? this.dd.data.stars[bodyHit.idx]
        : this.dd.data.planets[bodyHit.idx];
      const orb = this.dd.data.orbits[bodyData.orbit];
      if (orb && orb.type === 'fixed') {
        this._draggingOrbit = { orbitIdx: bodyData.orbit, offsetX: 0, offsetY: 0 };
      }
      return;
    }

    // 检查轨道
    const orbHit = this._findOrbitAt(wp);
    if (orbHit >= 0) {
      this.dd.select('orbit', { orbitIdx: orbHit });
      const orb = this.dd.data.orbits[orbHit];
      if (orb.type === 'fixed') {
        this._draggingOrbit = { orbitIdx: orbHit, offsetX: wp.x - orb.x, offsetY: wp.y - orb.y };
      }
      return;
    }

    // 点击空白 → 取消选择 + 开始平移
    this.dd.clearSelection();
    this._lastRightPos = null; this._lastRightSel = null;
    this._panning = true;
    this._panSX = sx;
    this._panSY = sy;
    this._panCX = this.camX;
    this._panCY = this.camY;
  }

  // ========================
  // 命中检测
  // ========================
  _findClosestOrbit(wp) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      const op = this.dd.getOrbitWorldPos(i);
      const d = Math.sqrt((wp.x - op.x) ** 2 + (wp.y - op.y) ** 2);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  _findClosestBuilding(wp) {
    // 找含核心点的建筑
    let best = null, bestDist = Infinity;
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      const core = this.dd.getBuildingCoreWorld(bi);
      const d = Math.sqrt((wp.x - core.x) ** 2 + (wp.y - core.y) ** 2);
      // 如果建筑有核心（core 不在 0,0）或者有 bindToBody
      const bld = this.dd.data.buildings[bi];
      const hasCore = bld.points.some(p => p.isCore && p.orbit != null);
      const hasBind = bld.bindToBody != null;
      if ((hasCore || hasBind) && d < bestDist) {
        bestDist = d; best = { bldIdx: bi, coreWorldX: core.x, coreWorldY: core.y };
      }
    }
    return best;
  }

  _findPointAt(wp) {
    const hitRadius = 12 / this.zoom; // 屏幕 ~12px 命中半径
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      for (let pi = 0; pi < this.dd.data.buildings[bi].points.length; pi++) {
        const ptw = this.dd.getPointWorld(bi, pi);
        const d = Math.sqrt((wp.x - ptw.x) ** 2 + (wp.y - ptw.y) ** 2);
        const pr = this.dd.data.buildings[bi].points[pi].radius || 5;
        if (d < pr + hitRadius) {
          return { bldIdx: bi, ptIdx: pi };
        }
      }
    }
    return null;
  }

  _findSpringAt(wp) {
    const hitRadius = 6 / this.zoom;
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      const bld = this.dd.data.buildings[bi];
      for (let si = 0; si < bld.springs.length; si++) {
        const sp = bld.springs[si];
        const a = this.dd.getPointWorld(bi, sp.a);
        const b = this.dd.getPointWorld(bi, sp.b);
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.001) continue;
        let t = ((wp.x - a.x) * dx + (wp.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + t * dx, cy = a.y + t * dy;
        const dist = Math.sqrt((wp.x - cx) ** 2 + (wp.y - cy) ** 2);
        if (dist < hitRadius) {
          return { bldIdx: bi, spIdx: si };
        }
      }
    }
    return null;
  }

  _findBodyAt(wp) {
    const hitRadius = 15 / this.zoom;
    const bodies = this.dd.getAllBodyPositions();
    for (const b of bodies) {
      const d = Math.sqrt((wp.x - b.x) ** 2 + (wp.y - b.y) ** 2);
      if (d < b.radius + hitRadius) {
        return { type: b.type, idx: b.idx };
      }
    }
    return null;
  }

  _findOrbitAt(wp) {
    const hitRadius = 15 / this.zoom;
    const ringHitWidth = 8 / this.zoom; // 虚线环的命中宽度
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      const orb = this.dd.data.orbits[i];
      const center = this.dd.getOrbitCenterWorld(i);
      const d = Math.sqrt((wp.x - center.x) ** 2 + (wp.y - center.y) ** 2);
      // 圆心命中
      if (d < hitRadius) return i;
      // 圆形轨道虚线命中：距离圆心 ≈ radius
      if (orb.type === 'circular' && orb.radius) {
        if (Math.abs(d - orb.radius) < ringHitWidth) return i;
      }
      // 椭圆轨道虚线命中
      if (orb.type === 'elliptical' && orb.rx && orb.ry) {
        const ang = Math.atan2(wp.y - center.y, wp.x - center.x);
        const ex = orb.rx * Math.cos(ang);
        const ey = orb.ry * Math.sin(ang);
        const er = Math.sqrt(ex * ex + ey * ey);
        const ed = Math.sqrt((wp.x - center.x) ** 2 + (wp.y - center.y) ** 2);
        if (Math.abs(ed - er) < ringHitWidth) return i;
      }
    }
    return -1;
  }

  _applyPropChange(sel, key, value) {
    const dd = this.dd.data;
    switch (sel.type) {
      case 'orbit':
        // 相位：UI 用角度，存储用弧度
        if (key === 'phase') value = (Number(value) || 0) * Math.PI / 180;
        this.dd.updateOrbit(sel.orbitIdx, { [key]: value });
        break;
      case 'star':
        this.dd.updateStar(sel.starIdx, { [key]: value });
        break;
      case 'planet':
        this.dd.updatePlanet(sel.planetIdx, { [key]: value });
        break;
      case 'point': {
        const pt = dd.buildings[sel.bldIdx].points[sel.ptIdx];
        // relX/relY 直接改 x/y
        if (key === 'relX') pt.x = value;
        else if (key === 'relY') pt.y = value;
        else this.dd.updatePoint(sel.bldIdx, sel.ptIdx, { [key]: value });
        break;
      }
      case 'spring':
        this.dd.updateSpring(sel.bldIdx, sel.spIdx, { [key]: value });
        break;
      case 'bullet': {
        // orbitAround 特殊处理
        if (key === 'orbitBody') {
          const b = dd.bullets[sel.bulletIdx];
          if (!b.orbitAround) b.orbitAround = {};
          b.orbitAround.bodyIndex = value;
        } else if (key === 'orbitAlt') {
          const b = dd.bullets[sel.bulletIdx];
          if (!b.orbitAround) b.orbitAround = {};
          b.orbitAround.altitude = Number(value) || 0;
        } else if (key === 'orbitPhase') {
          const b = dd.bullets[sel.bulletIdx];
          if (!b.orbitAround) b.orbitAround = {};
          // UI 用角度，存储用弧度
          b.orbitAround.phase = (Number(value) || 0) * Math.PI / 180;
        } else {
          this.dd.updateBullet(sel.bulletIdx, { [key]: value });
        }
        break;
      }
    }
  }

  // ========================
  // 删除
  // ========================
  _deleteSelected() {
    const sel = this.dd.selected;
    if (!sel) return;
    switch (sel.type) {
      case 'orbit': this.dd.removeOrbit(sel.orbitIdx); break;
      case 'star': this.dd.removeStar(sel.starIdx); break;
      case 'planet': this.dd.removePlanet(sel.planetIdx); break;
      case 'point': this.dd.removePoint(sel.bldIdx, sel.ptIdx); break;
      case 'spring': this.dd.removeSpring(sel.bldIdx, sel.spIdx); break;
      case 'bullet': this.dd.removeBullet(sel.bulletIdx); break;
    }
    this.dd.clearSelection();
  }

  // ========================
  // 工具函数
  // ========================
  _inRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  _roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    else ctx.stroke();
  }

  _showToast(msg) {
    this._toast = msg;
    this._toastTimer = 2.0;
  }

  /** 每帧更新 toast / 光标闪烁计时器 */
  update(dt) {
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) {
        this._toast = null;
      }
    }
    this._editBlink += dt;
  }
}
