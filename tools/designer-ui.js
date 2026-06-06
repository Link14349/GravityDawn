/**
 * 关卡设计器 — 编辑模式渲染 + 交互 (精简版)
 * 轨道、恒星、行星、对齐网格、测试模式
 */

const C = {
  bg: '#0a0e27',
  panel: 'rgba(10, 14, 39, 0.95)',
  accent: '#3dd6c8',
  text: '#d0d6e8',
  sub: '#6b7a9d',
  btn: '#3dd6c8',
  btnHover: '#5eeadb',
  btnText: '#0a1220',
  orbitColor: 'rgba(94, 234, 219, 0.3)',
  orbitSel: 'rgba(94, 234, 219, 0.8)',
  gridColor: 'rgba(255, 255, 255, 0.04)',
  gridMajor: 'rgba(255, 255, 255, 0.08)',
};

const TOOLS = [
  { id: 'select',  label: '选择', icon: '⊡', shortcut: '0' },
  { id: 'orbit',   label: '轨道', icon: '◎', shortcut: '1' },
  { id: 'star',    label: '恒星', icon: '☀', shortcut: '2' },
  { id: 'planet',  label: '行星', icon: '🜚', shortcut: '3' },
  { id: 'bullet',  label: '子弹', icon: '➤', shortcut: '4' },
  { id: 'building',label: '建筑', icon: '🏗', shortcut: '5' },
];

const BTOOLS = [
  { id: 'core',   label: '核心', icon: '⬡' },
  { id: 'point',  label: '质点', icon: '·', hasTypes: true },
  { id: 'enemy',  label: '敌人', icon: '⬤' },
  { id: 'spring', label: '弹簧', icon: '⏤' },
];

const STAR_COLORS = [
  { label: '金黄', value: '#ffbb33' },
  { label: '暖橙', value: '#ff9933' },
  { label: '赤红', value: '#ff6644' },
  { label: '冰蓝', value: '#66aaff' },
  { label: '青绿', value: '#44ccbb' },
  { label: '粉红', value: '#ff6688' },
  { label: '淡紫', value: '#aa88ff' },
  { label: '灰白', value: '#ccddee' },
];

const POINT_TYPES = [
  { id: 'white',  label: '白色', color: '#cccccc', mass: 8,  radius: 5, score: 20, explosionRadius: 10, explosionImpulse: 500 },
  { id: 'gray',   label: '灰色', color: '#888888', mass: 10, radius: 6, score: 30, explosionRadius: 12, explosionImpulse: 600 },
  { id: 'blue',   label: '蓝灰', color: '#88aacc', mass: 10, radius: 6, score: 50, explosionRadius: 15, explosionImpulse: 800 },
  { id: 'orange', label: '橙色', color: '#ff9966', mass: 10, radius: 5, score: 30, explosionRadius: 15, explosionImpulse: 600 },
];

export class EditModeUI {
  constructor(canvas, designerData, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.dd = designerData;
    this.cb = callbacks;

    this.camX = 0; this.camY = 0; this.zoom = 0.75;
    this.mx = 0; this.my = 0;
    this._panning = false; this._panSX = 0; this._panSY = 0; this._panCX = 0; this._panCY = 0;
    this._draggingOrbit = null;
    this.snapToGrid = false;
    this._lastRightPos = null; this._lastRightSel = null;
    this._toast = null; this._toastTimer = 0;
    this._disabled = false; // 测试模式时禁用编辑交互
    this._stars = this._genStars(150);

    this._propInputs = [];
    this._activeEdit = null; this._editBlink = 0;
    this._dropdown = null;

    // 建筑模式
    this._btool = 'point';        // 当前建筑子工具
    this._activeBld = -1;         // 当前编辑的建筑索引，-1=未选择
    this._springFirst = null;     // 弹簧第一选中点 { bldIdx, ptIdx }
    this._ptype = 'white';        // 当前质点类型

    this._bindEvents();
    this._bindKeyboard();
  }

  worldToScreen(wx, wy) { return { x: (wx - this.camX) * this.zoom + this.w / 2, y: (wy - this.camY) * this.zoom + this.h / 2 }; }
  screenToWorld(sx, sy) { return { x: (sx - this.w / 2) / this.zoom + this.camX, y: (sy - this.h / 2) / this.zoom + this.camY }; }

  // ======================== 渲染入口 ========================
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, this.w, this.h);
    this._drawGrid(ctx);
    this._drawStars(ctx);
    const o = this.worldToScreen(0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(o.x - 15, o.y); ctx.lineTo(o.x + 15, o.y);
    ctx.moveTo(o.x, o.y - 15); ctx.lineTo(o.x, o.y + 15); ctx.stroke();

    for (let i = 0; i < this.dd.data.orbits.length; i++) this._drawOrbit(ctx, i);
    const bodies = this.dd.getAllBodyPositions();
    for (const b of bodies) this._drawBody(ctx, b);
    for (let i = 0; i < this.dd.data.bullets.length; i++) this._drawBullet(ctx, i);
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) this._drawBuilding(ctx, bi);
    // 弹簧第一选中点标记
    if (this._springFirst) {
      const sf = this._springFirst;
      const wp = this.dd.getPointWorld(sf.bldIdx, sf.ptIdx);
      const sp = this.worldToScreen(wp.x, wp.y);
      ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 3; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffdd44'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText('点击第二个质点', sp.x, sp.y - 18);
    }
    ctx.restore();

    this._drawToolbar(ctx);
    if (this.dd.tool === 'building') this._drawBuildingToolbar(ctx);
    this._drawPropertyPanel(ctx);
    this._drawStatusBar(ctx);
    if (this._toast) this._drawToast(ctx);
  }

  _drawGrid(ctx) {
    const gs = 100;
    const tl = this.screenToWorld(0, 0), br = this.screenToWorld(this.w, this.h);
    for (let x = Math.floor(tl.x / gs) * gs; x <= br.x; x += gs) {
      const sp = this.worldToScreen(x, 0);
      ctx.strokeStyle = (x % 500 === 0) ? C.gridMajor : C.gridColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sp.x, 0); ctx.lineTo(sp.x, this.h); ctx.stroke();
    }
    for (let y = Math.floor(tl.y / gs) * gs; y <= br.y; y += gs) {
      const sp = this.worldToScreen(0, y);
      ctx.strokeStyle = (y % 500 === 0) ? C.gridMajor : C.gridColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(this.w, sp.y); ctx.stroke();
    }
  }

  _drawStars(ctx) { for (const s of this._stars) { ctx.fillStyle = `rgba(255,255,255,${s.alpha})`; ctx.beginPath(); ctx.arc(s.sx, s.sy, s.r, 0, Math.PI * 2); ctx.fill(); } }
  _genStars(n) { const s = []; for (let i = 0; i < n; i++) s.push({ sx: (i * 7919 + 123) % this.w, sy: (i * 6271 + 456) % this.h, r: 0.5 + ((i * 3571) % 100) / 100 * 1.2, alpha: 0.2 + ((i * 4813) % 100) / 100 * 0.5 }); return s; }

  // ======================== 轨道 ========================
  _drawOrbit(ctx, idx) {
    const orb = this.dd.data.orbits[idx]; if (!orb) return;
    const center = this.dd.getOrbitCenterWorld(idx);
    const sp = this.worldToScreen(center.x, center.y);
    const isSel = this.dd.selected && this.dd.selected.type === 'orbit' && this.dd.selected.orbitIdx === idx;

    if (orb.type === 'circular' && orb.radius) {
      ctx.strokeStyle = isSel ? C.orbitSel : C.orbitColor; ctx.lineWidth = isSel ? 2 : 1.2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, orb.radius * this.zoom, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (orb.parent != null) {
      const pc = this.dd.getOrbitCenterWorld(orb.parent); const pp = this.worldToScreen(pc.x, pc.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(sp.x, sp.y); ctx.stroke(); ctx.setLineDash([]);
    }

    const r = 8;
    ctx.fillStyle = isSel ? '#fff' : C.accent; ctx.strokeStyle = isSel ? '#fff' : C.accent; ctx.lineWidth = isSel ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `${isSel ? 'bold ' : ''}11px monospace`; ctx.textAlign = 'center';
    ctx.fillText(this._orbitLabel(idx), sp.x, sp.y - 16);
  }

  _orbitLabel(idx) {
    const orb = this.dd.data.orbits[idx]; if (!orb) return `轨道#${idx}`;
    return `${orb.name || '轨道'}#${idx}`;
  }

  // ======================== 星体 ========================
  _drawBody(ctx, b) {
    const sp = this.worldToScreen(b.x, b.y); const r = b.radius * this.zoom;
    const isSel = this.dd.selected && this.dd.selected.type === b.type && this.dd.selected[`${b.type}Idx`] === b.idx;

    const g = ctx.createRadialGradient(sp.x, sp.y, r * 0.5, sp.x, sp.y, r * 2.2);
    g.addColorStop(0, 'rgba(255,200,100,0.25)'); g.addColorStop(0.5, 'rgba(255,150,50,0.08)'); g.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 2.2, 0, Math.PI * 2); ctx.fill();

    const bg = ctx.createRadialGradient(sp.x - r * 0.25, sp.y - r * 0.25, 0, sp.x, sp.y, r);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.4, b.color); bg.addColorStop(1, '#000000');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.fill();

    if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sp.x, sp.y, r + 5, 0, Math.PI * 2); ctx.stroke(); }
    if (b.label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.label, sp.x, sp.y - r - 12); }
  }

  // ======================== 顶部工具栏 ========================
  _drawToolbar(ctx) {
    const tbY = 0, tbH = 46, btnW = 54, gap = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, tbY, this.w, tbH);

    let bx = 8;
    for (const tool of TOOLS) {
      const hov = this._inRect(bx, tbY + 6, btnW, tbH - 12);
      const act = this.dd.tool === tool.id;
      ctx.fillStyle = act ? C.accent : (hov ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)');
      this._roundRect(ctx, bx, tbY + 6, btnW, tbH - 12, 6, true);
      if (act) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; this._roundRect(ctx, bx, tbY + 6, btnW, tbH - 12, 6, false); }
      ctx.fillStyle = act ? C.btnText : C.text; ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText(tool.icon, bx + btnW / 2, tbY + 22);
      ctx.font = '10px Arial'; ctx.fillText(tool.label, bx + btnW / 2, tbY + 36);
      tool._bx = bx; tool._by = tbY + 6; tool._bw = btnW; tool._bh = tbH - 12;
      bx += btnW + gap;
    }

    const chkX = bx + 8, chkY = tbY + 12, chkS = 14;
    ctx.font = '11px Arial'; const lw = ctx.measureText('对齐网格').width;
    const chkHov = this._inRect(this.mx, this.my, chkX, chkY, chkS + lw + 6, chkS + 2);
    ctx.fillStyle = this.snapToGrid ? C.accent : 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = chkHov ? C.accent : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
    this._roundRect(ctx, chkX, chkY, chkS, chkS, 3, true); this._roundRect(ctx, chkX, chkY, chkS, chkS, 3, false);
    if (this.snapToGrid) { ctx.fillStyle = C.btnText; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText('✓', chkX + chkS / 2, chkY + chkS - 2); }
    ctx.fillStyle = chkHov ? C.accent : C.sub; ctx.font = '11px Arial'; ctx.textAlign = 'left'; ctx.fillText('对齐网格', chkX + chkS + 5, chkY + chkS - 2);
    this._snapChk = { x: chkX, y: chkY, w: chkS + lw + 6, h: chkS + 2 };

    const actBtns = [
      { id: 'open', label: '打开', primary: false },
      { id: 'rename', label: '改名', primary: false },
      { id: 'export', label: '导出', primary: false },
      { id: 'test', label: '▶ 测试', primary: true },
    ];

    // 关卡名称（居中）
    ctx.fillStyle = C.text; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillText(this.dd.data.name || '新关卡', this.w / 2, tbY + 30);
    let ax = this.w - 12; const abtnW = 68;
    for (let i = actBtns.length - 1; i >= 0; i--) {
      const ab = actBtns[i]; ax -= abtnW + gap;
      const hov = this._inRect(ax, tbY + 8, abtnW, tbH - 16);
      ctx.fillStyle = ab.primary ? (hov ? C.btnHover : C.accent) : (hov ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)');
      this._roundRect(ctx, ax, tbY + 8, abtnW, tbH - 16, 6, true);
      ctx.fillStyle = ab.primary ? C.btnText : (hov ? C.accent : C.text); ctx.font = '12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(ab.label, ax + abtnW / 2, tbY + 28);
      ab._bx = ax; ab._by = tbY + 8; ab._bw = abtnW; ab._bh = tbH - 16;
    }
    this._toolBtns = TOOLS; this._actBtns = actBtns;
  }

  // ======================== 建筑操作栏 ========================
  _drawBuildingToolbar(ctx) {
    const tbY = 46, tbH = 34, gap = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, tbY, this.w, tbH);

    // 建筑选择下拉
    const blds = this.dd.data.buildings;
    const selLabel = this._activeBld >= 0 && this._activeBld < blds.length
      ? this._bldLabel(this._activeBld) : '选择建筑';
    const ddX = 8, ddY = tbY + 5, ddW = 200, ddH = tbH - 10;
    const ddOpen = this._dropdown && this._dropdown._bldDropdown;
    ctx.fillStyle = ddOpen ? 'rgba(61,214,200,0.15)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = ddOpen ? C.accent : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    this._roundRect(ctx, ddX, ddY, ddW, ddH, 4, true); this._roundRect(ctx, ddX, ddY, ddW, ddH, 4, false);
    ctx.fillStyle = C.text; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(selLabel.substring(0, 26), ddX + 8, ddY + ddH / 2 + 4);
    ctx.fillStyle = C.sub; ctx.font = '9px Arial'; ctx.textAlign = 'right'; ctx.fillText('▼', ddX + ddW - 6, ddY + ddH / 2 + 3);
    this._bldDropRect = { x: ddX, y: ddY, w: ddW, h: ddH };

    if (ddOpen) {
      const opts = [{ label: '[+ 新建建筑]', value: -2 }];
      for (let i = 0; i < blds.length; i++) opts.push({ label: this._bldLabel(i), value: i });
      this._dropdown._bldOptions = opts;
      const optH = 22, ddH2 = opts.length * optH;
      const ddy2 = ddY + ddH + 2;
      ctx.fillStyle = 'rgba(20,28,65,0.99)'; ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
      this._roundRect(ctx, ddX, ddy2, ddW, ddH2, 4, true); this._roundRect(ctx, ddX, ddy2, ddW, ddH2, 4, false);
      for (let oi = 0; oi < opts.length; oi++) {
        const opt = opts[oi], oy = ddy2 + oi * optH;
        const hov = this._inRect(this.mx, this.my, ddX, oy, ddW, optH);
        if (hov) { ctx.fillStyle = 'rgba(61,214,200,0.2)'; ctx.fillRect(ddX + 2, oy + 1, ddW - 4, optH - 2); }
        ctx.fillStyle = C.text; ctx.font = '11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(opt.label, ddX + 8, oy + 15);
        opt._oy = oy; opt._ox = ddX; opt._ow = ddW; opt._oh = optH;
        opt._bldOpt = true;
      }
    }

    // 新建按钮
    const newX = ddX + ddW + 6, newW = 50;
    const newHov = this._inRect(this.mx, this.my, newX, ddY, newW, ddH);
    ctx.fillStyle = newHov ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = newHov ? C.accent : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    this._roundRect(ctx, newX, ddY, newW, ddH, 4, true); this._roundRect(ctx, newX, ddY, newW, ddH, 4, false);
    ctx.fillStyle = newHov ? C.accent : C.sub; ctx.font = '11px Arial'; ctx.textAlign = 'center';
    ctx.fillText('+新建', newX + newW / 2, ddY + ddH / 2 + 4);
    this._bldNewRect = { x: newX, y: ddY, w: newW, h: ddH };

    if (this._activeBld < 0) return;

    // 建筑子工具
    const bld = blds[this._activeBld]; if (!bld) return;
    const hasCore = bld.points.some(p => p.isCore && p.orbit != null);
    let bx2 = newX + newW + 12;
    for (const bt of BTOOLS) {
      if (bt.id === 'core' && (hasCore || bld.points.length > 0)) { bt._bx = null; continue; } // 已有核心或非核心点则隐藏
      const bw = 46;
      const hov = this._inRect(this.mx, this.my, bx2, ddY, bw, ddH);
      const act = this._btool === bt.id;
      ctx.fillStyle = act ? C.accent : (hov ? 'rgba(61,214,200,0.2)' : 'rgba(255,255,255,0.06)');
      this._roundRect(ctx, bx2, ddY, bw, ddH, 4, true);
      if (act) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; this._roundRect(ctx, bx2, ddY, bw, ddH, 4, false); }
      ctx.fillStyle = act ? C.btnText : C.text; ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText(bt.icon + ' ' + bt.label, bx2 + bw / 2, ddY + ddH / 2 + 4);
      bt._bx = bx2; bt._by = ddY; bt._bw = bw; bt._bh = ddH;
      bx2 += bw + gap;
    }
    this._btoolBtns = BTOOLS;

    // 质点类型选择器（质点工具时显示）
    if (this._btool === 'point') {
      const pddX = bx2 + 8, pddW = 60;
      const ptSel = POINT_TYPES.find(t => t.id === this._ptype) || POINT_TYPES[0];
      const pddOpen = this._dropdown && this._dropdown._ptypeDropdown;
      ctx.fillStyle = pddOpen ? 'rgba(61,214,200,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = pddOpen ? C.accent : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      this._roundRect(ctx, pddX, ddY, pddW, ddH, 4, true); this._roundRect(ctx, pddX, ddY, pddW, ddH, 4, false);
      ctx.fillStyle = ptSel.color; ctx.beginPath(); ctx.arc(pddX + 10, ddY + ddH / 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.text; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(ptSel.label, pddX + 20, ddY + ddH / 2 + 4);
      ctx.fillStyle = C.sub; ctx.font = '8px Arial'; ctx.textAlign = 'right'; ctx.fillText('▼', pddX + pddW - 4, ddY + ddH / 2 + 3);
      this._ptypeDropRect = { x: pddX, y: ddY, w: pddW, h: ddH };

      if (pddOpen) {
        const popts = POINT_TYPES.map(t => ({ ...t, value: t.id, label: t.label }));
        this._dropdown._ptypeOptions = popts;
        const oH = 22, ddH3 = popts.length * oH;
        const ddy3 = ddY + ddH + 2;
        ctx.fillStyle = 'rgba(20,28,65,0.99)'; ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
        this._roundRect(ctx, pddX, ddy3, pddW, ddH3, 4, true); this._roundRect(ctx, pddX, ddy3, pddW, ddH3, 4, false);
        for (let oi = 0; oi < popts.length; oi++) {
          const opt = popts[oi], oy = ddy3 + oi * oH;
          const hov = this._inRect(this.mx, this.my, pddX, oy, pddW, oH);
          if (hov) { ctx.fillStyle = 'rgba(61,214,200,0.2)'; ctx.fillRect(pddX + 2, oy + 1, pddW - 4, oH - 2); }
          ctx.fillStyle = opt.color; ctx.beginPath(); ctx.arc(pddX + 10, oy + oH / 2, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.text; ctx.font = '10px monospace'; ctx.textAlign = 'left';
          ctx.fillText(opt.label, pddX + 20, oy + 15);
          opt._oy = oy; opt._ox = pddX; opt._ow = pddW; opt._oh = oH;
          opt._ptypeOpt = true;
        }
      }
    }

    // 绑定星体选择器（无核心建筑时显示）
    if (bld && !hasCore) {
      const bindX = this._btool === 'point' ? this._ptypeDropRect.x + this._ptypeDropRect.w + 8 : (bx2 + 8);
      const bindW = 80;
      const bindIdx = bld.bindToBody;
      const bindLabel = bindIdx != null ? `绑定#${bindIdx}` : '不绑定';
      const bindOpen = this._dropdown && this._dropdown._bindDropdown;
      ctx.fillStyle = bindOpen ? 'rgba(61,214,200,0.15)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = bindOpen ? C.accent : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      this._roundRect(ctx, bindX, ddY, bindW, ddH, 4, true); this._roundRect(ctx, bindX, ddY, bindW, ddH, 4, false);
      ctx.fillStyle = C.text; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(bindLabel, bindX + 6, ddY + ddH / 2 + 4);
      ctx.fillStyle = C.sub; ctx.font = '8px Arial'; ctx.textAlign = 'right'; ctx.fillText('▼', bindX + bindW - 4, ddY + ddH / 2 + 3);
      this._bindDropRect = { x: bindX, y: ddY, w: bindW, h: ddH };

      if (bindOpen) {
        const allBodies = [...this.dd.data.stars, ...this.dd.data.planets];
        const bopts = [{ label: '不绑定', value: null }];
        for (let i = 0; i < allBodies.length; i++) {
          bopts.push({ label: `${allBodies[i].label || '星体'}(${i})`, value: i });
        }
        this._dropdown._bindOptions = bopts;
        const oH = 22, ddH3 = bopts.length * oH;
        const ddy3 = ddY + ddH + 2;
        ctx.fillStyle = 'rgba(20,28,65,0.99)'; ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
        this._roundRect(ctx, bindX, ddy3, bindW, ddH3, 4, true); this._roundRect(ctx, bindX, ddy3, bindW, ddH3, 4, false);
        for (let oi = 0; oi < bopts.length; oi++) {
          const opt = bopts[oi], oy = ddy3 + oi * oH;
          const hov = this._inRect(this.mx, this.my, bindX, oy, bindW, oH);
          if (hov) { ctx.fillStyle = 'rgba(61,214,200,0.2)'; ctx.fillRect(bindX + 2, oy + 1, bindW - 4, oH - 2); }
          ctx.fillStyle = C.text; ctx.font = '10px monospace'; ctx.textAlign = 'left';
          ctx.fillText(opt.label, bindX + 6, oy + 15);
          opt._oy = oy; opt._ox = bindX; opt._ow = bindW; opt._oh = oH;
          opt._bindOpt = true;
        }
      }
    }

    // 删除建筑按钮（最右侧）
    if (bld && this._activeBld >= 0) {
      const delW = 90, delX = this.w - 220 - delW - 8;
      const delHov = this._inRect(this.mx, this.my, delX, ddY, delW, ddH);
      ctx.fillStyle = delHov ? 'rgba(255,68,68,0.3)' : 'rgba(255,68,68,0.1)';
      ctx.strokeStyle = delHov ? '#ff4444' : 'rgba(255,68,68,0.3)'; ctx.lineWidth = 1;
      this._roundRect(ctx, delX, ddY, delW, ddH, 4, true); this._roundRect(ctx, delX, ddY, delW, ddH, 4, false);
      ctx.fillStyle = delHov ? '#ff4444' : '#ff6b6b'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText('删除此建筑', delX + delW / 2, ddY + ddH / 2 + 4);
      this._bldDelRect = { x: delX, y: ddY, w: delW, h: ddH };
    }
  }

  _bldLabel(idx) {
    const bld = this.dd.data.buildings[idx]; if (!bld) return `建筑#${idx}`;
    const hasCore = bld.points.some(p => p.isCore && p.orbit != null);
    const hasBind = bld.bindToBody != null;
    const tag = hasCore ? '核心' : (hasBind ? '绑定' : '自由');
    return `建筑#${idx} (${tag}, ${bld.points.length}点)`;
  }

  // ======================== 建筑渲染 ========================
  _drawBuilding(ctx, bldIdx) {
    const bld = this.dd.data.buildings[bldIdx]; if (!bld) return;
    for (const sp of bld.springs) {
      const a = this.dd.getPointWorld(bldIdx, sp.a);
      const b = this.dd.getPointWorld(bldIdx, sp.b);
      const sa = this.worldToScreen(a.x, a.y), sb = this.worldToScreen(b.x, b.y);
      const isSel = this.dd.selected && this.dd.selected.type === 'spring' && this.dd.selected.bldIdx === bldIdx && this.dd.selected.spIdx === bld.springs.indexOf(sp);
      ctx.strokeStyle = isSel ? '#fff' : 'rgba(180,200,220,0.5)'; ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
    }
    for (let pi = 0; pi < bld.points.length; pi++) {
      const pt = bld.points[pi];
      const wp = this.dd.getPointWorld(bldIdx, pi);
      const sp = this.worldToScreen(wp.x, wp.y);
      const isSel = this.dd.selected && this.dd.selected.type === 'point' && this.dd.selected.bldIdx === bldIdx && this.dd.selected.ptIdx === pi;
      const rr = Math.max((pt.renderRadius || pt.radius || 5) * this.zoom, 4);
      ctx.fillStyle = pt.color || '#888'; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr, 0, Math.PI * 2); ctx.fill();
      if (pt.isEnemy) { ctx.strokeStyle = '#44ff44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (pt.isCore && pt.orbit != null) { ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (pt.important && !pt.isCore && !pt.isEnemy) { ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 2, 0, Math.PI * 2); ctx.stroke(); }
      if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
  }

  // ======================== 属性面板 ========================
  _drawPropertyPanel(ctx) {
    const pw = 220, px = this.w - pw, py = 46;
    ctx.fillStyle = C.panel; ctx.fillRect(px, py, pw, this.h - py - 28);
    ctx.strokeStyle = 'rgba(61,214,200,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, this.h - 28); ctx.stroke();

    const sel = this.dd.selected;
    if (!sel) { ctx.fillStyle = C.sub; ctx.font = '12px Arial'; ctx.textAlign = 'center'; ctx.fillText('右键点击物体选择', px + pw / 2, py + 60); return; }

    ctx.fillStyle = C.accent; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left';
    ctx.fillText(this._selLabel(sel), px + 12, py + 24);

    const props = this._getProps(sel); let iy = py + 44;
    this._propInputs = []; let _ddInfo = null;

    for (const prop of props) {
      if (iy > this.h - 100) break;
      ctx.fillStyle = C.sub; ctx.font = '11px Arial'; ctx.textAlign = 'left'; ctx.fillText(prop.label, px + 12, iy + 12);
      const inpW = pw - 100, inpX = px + 90, inpY = iy, inpH = 20;
      const hasOpts = prop.options && prop.options.length > 0;
      const isOpen = hasOpts && this._dropdown && this._dropdown.key === prop.key;
      const isEdit = this._activeEdit && this._activeEdit.key === prop.key;

      if (hasOpts) {
        ctx.fillStyle = isOpen ? 'rgba(61,214,200,0.15)' : 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = isOpen ? C.accent : 'rgba(255,255,255,0.12)'; ctx.lineWidth = isOpen ? 2 : 1;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true); this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);
        const selOpt = prop.options.find(o => o.value === prop.value);
        ctx.fillStyle = C.text; ctx.font = '11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(selOpt ? selOpt.label : String(prop.value ?? ''), inpX + 5, inpY + 14);
        ctx.fillStyle = C.sub; ctx.font = '9px Arial'; ctx.textAlign = 'right'; ctx.fillText('▼', inpX + inpW - 5, inpY + 14);
        this._propInputs.push({ key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH, label: prop.label, value: prop.value, options: prop.options, isDropdown: true });
        if (isOpen) _ddInfo = { inpX, inpY, inpH, inpW, prop };
      } else if (isEdit) {
        ctx.fillStyle = 'rgba(61,214,200,0.15)'; ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true); this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);
        const ae = this._activeEdit;
        ctx.fillStyle = C.text; ctx.font = '11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(ae.text, inpX + 5, inpY + 14);
        if (Math.floor(this._editBlink * 1000 / 530) % 2 === 0) {
          const cx = inpX + 5 + ctx.measureText(ae.text.substring(0, ae.cursorPos)).width;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, inpY + 3); ctx.lineTo(cx, inpY + inpH - 3); ctx.stroke();
        }
        this._propInputs.push({ key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH, label: prop.label, value: prop.value });
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, true); this._roundRect(ctx, inpX, inpY, inpW, inpH, 4, false);
        ctx.fillStyle = C.text; ctx.font = '11px monospace'; ctx.textAlign = 'left';
        const d = String(prop.value ?? ''); ctx.fillText(d.length > 18 ? d.substring(0, 17) + '…' : d, inpX + 5, inpY + 14);
        this._propInputs.push({ key: prop.key, x: inpX, y: inpY, w: inpW, h: inpH, label: prop.label, value: prop.value });
      }
      iy += 26;
    }

    if (this._canDelete(sel)) {
      const delY = Math.max(iy + 10, this.h - 100), delW = pw - 24;
      const hov = this._inRect(px + 12, delY, delW, 28);
      ctx.fillStyle = hov ? '#ff4444' : 'rgba(255,68,68,0.2)'; ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
      this._roundRect(ctx, px + 12, delY, delW, 28, 6, true); this._roundRect(ctx, px + 12, delY, delW, 28, 6, false);
      ctx.fillStyle = hov ? '#fff' : '#ff6b6b'; ctx.font = '12px Arial'; ctx.textAlign = 'center'; ctx.fillText('删除', px + pw / 2, delY + 19);
      this._deleteBtn = { x: px + 12, y: delY, w: delW, h: 28 };
    } else { this._deleteBtn = null; }

    if (_ddInfo) {
      const { inpX, inpY, inpH, inpW, prop } = _ddInfo;
      this._dropdown.options = prop.options;
      const optH = 22, ddH = prop.options.length * optH;
      const drawY = inpY + inpH + 2 + ddH > this.h - 40 ? inpY - ddH - 2 : inpY + inpH + 2;
      ctx.fillStyle = 'rgba(20,28,65,0.99)'; ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
      this._roundRect(ctx, inpX, drawY, inpW, ddH, 4, true); this._roundRect(ctx, inpX, drawY, inpW, ddH, 4, false);
      for (let oi = 0; oi < prop.options.length; oi++) {
        const opt = prop.options[oi], oy = drawY + oi * optH;
        const hov = this._inRect(this.mx, this.my, inpX, oy, inpW, optH), sel = opt.value === prop.value;
        if (hov) { ctx.fillStyle = 'rgba(61,214,200,0.2)'; ctx.fillRect(inpX + 2, oy + 1, inpW - 4, optH - 2); }
        ctx.fillStyle = sel ? C.accent : C.text; ctx.font = sel ? 'bold 11px monospace' : '11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(opt.label, inpX + 8, oy + 15);
        opt._oy = oy; opt._ox = inpX; opt._ow = inpW; opt._oh = optH;
      }
    }
  }

  _orbitOptions(excludeIdx = -1) {
    return this.dd.data.orbits.map((o, i) => ({ label: this._orbitLabel(i), value: i })).filter((_, i) => i !== excludeIdx);
  }

  _getProps(sel) {
    const dd = this.dd.data;
    switch (sel.type) {
      case 'orbit': {
        const orb = dd.orbits[sel.orbitIdx]; if (!orb) return [];
        const base = [
          { key: 'name', label: '名称', value: orb.name || '' },
          { key: 'type', label: '类型', value: orb.type, options: [{ label: 'fixed (固定)', value: 'fixed' }, { label: 'circular (圆形)', value: 'circular' }, { label: 'elliptical (椭圆)', value: 'elliptical' }] },
          { key: 'parent', label: '父轨道', value: orb.parent ?? '无', options: [{ label: '无', value: null }, ...this._orbitOptions(sel.orbitIdx)] },
        ];
        base.push({ key: 'x', label: 'X (偏移)', value: Math.round(orb.x || 0) });
        base.push({ key: 'y', label: 'Y (偏移)', value: Math.round(orb.y || 0) });
        if (orb.type === 'circular') { base.push({ key: 'radius', label: '半径', value: orb.radius || 0 }, { key: 'period', label: '周期(秒)', value: orb.period || 20 }, { key: 'phase', label: '相位(度)', value: Math.round((orb.phase || 0) * 180 / Math.PI) }); }
        if (orb.type === 'elliptical') { base.push({ key: 'rx', label: 'rx', value: orb.rx || 0 }, { key: 'ry', label: 'ry', value: orb.ry || 0 }, { key: 'period', label: '周期(秒)', value: orb.period || 20 }, { key: 'phase', label: '相位(度)', value: Math.round((orb.phase || 0) * 180 / Math.PI) }); }
        return base;
      }
      case 'star': {
        const s = dd.stars[sel.starIdx]; if (!s) return [];
        return [{ key: 'label', label: '名称', value: s.label }, { key: 'mass', label: '质量', value: s.mass }, { key: 'radius', label: '半径', value: s.radius }, { key: 'collisionRadius', label: '碰撞半径', value: s.collisionRadius }, { key: 'color', label: '颜色', value: s.color, options: STAR_COLORS }, { key: 'orbit', label: '轨道', value: s.orbit, options: this._orbitOptions() }];
      }
      case 'planet': {
        const p = dd.planets[sel.planetIdx]; if (!p) return [];
        return [{ key: 'label', label: '名称', value: p.label }, { key: 'mass', label: '质量', value: p.mass }, { key: 'radius', label: '半径', value: p.radius }, { key: 'collisionRadius', label: '碰撞半径', value: p.collisionRadius }, { key: 'color', label: '颜色', value: p.color, options: STAR_COLORS }, { key: 'orbit', label: '轨道', value: p.orbit, options: this._orbitOptions() }];
      }
      case 'bullet': {
        const b = dd.bullets[sel.bulletIdx]; if (!b) return [];
        const typeOpts = [
          { label: '普通弹', value: 'normal' }, { label: '爆炸弹', value: 'explosive' },
          { label: '动能弹', value: 'kinetic' }, { label: '机动弹', value: 'agile' },
          { label: '分裂弹', value: 'cluster' }, { label: '引力弹', value: 'gravity' },
          { label: '燃烧弹', value: 'incendiary' },
        ];
        const oa = b.orbitAround || {};
        const bodyOpts = [];
        const allBodies = [...dd.stars, ...dd.planets];
        for (let i = 0; i < allBodies.length; i++) {
          bodyOpts.push({ label: `${allBodies[i].label || '星体'}(${i})`, value: i });
        }
        return [
          { key: 'type', label: '类型', value: b.type || 'normal', options: typeOpts },
          { key: 'orbitBody', label: '绕行星体', value: oa.bodyIndex, options: bodyOpts },
          { key: 'orbitAlt', label: '轨道高度', value: oa.altitude || 60 },
          { key: 'orbitPhase', label: '相位(度)', value: oa.phase ? Math.round(oa.phase * 180 / Math.PI) : 0 },
        ];
      }
      case 'point': {
        const pt = dd.buildings[sel.bldIdx]?.points[sel.ptIdx]; if (!pt) return [];
        const props = [{ key: 'mass', label: '质量', value: pt.mass }, { key: 'score', label: '分数', value: pt.score }, { key: 'important', label: '重要', value: pt.important ? '是' : '否', options: [{ label: '是', value: true }, { label: '否', value: false }] }];
        if (pt.isCore) { props.push({ key: 'orbit', label: '轨道', value: pt.orbit, options: this._orbitOptions() }); }
        if (pt.isEnemy) { props.push({ key: 'hp', label: 'HP', value: pt.hp }); }
        return props;
      }
      case 'spring': {
        const sp = dd.buildings[sel.bldIdx]?.springs[sel.spIdx]; if (!sp) return [];
        return [{ key: 'stiffness', label: '劲度', value: sp.stiffness }, { key: 'damping', label: '阻尼', value: sp.damping }, { key: 'breakTension', label: '断张力', value: sp.breakTension }];
      }
      default: return [];
    }
  }

  _selLabel(sel) {
    switch (sel.type) { case 'orbit': return this._orbitLabel(sel.orbitIdx); case 'star': return `恒星 ${sel.starIdx}`; case 'planet': return `行星 ${sel.planetIdx}`; case 'bullet': return `子弹${sel.bulletIdx} (${this.dd.data.bullets[sel.bulletIdx]?.type || '?'})`; case 'point': return `${this.dd.data.buildings[sel.bldIdx]?.points[sel.ptIdx]?.isEnemy ? '敌人' : '质点'} [B${sel.bldIdx}:${sel.ptIdx}]`; case 'spring': return `弹簧 [B${sel.bldIdx}:${sel.spIdx}]`; default: return sel.type; }
  }

  _canDelete(sel) { return sel && (sel.type === 'orbit' || sel.type === 'star' || sel.type === 'planet' || sel.type === 'bullet' || sel.type === 'point' || sel.type === 'spring'); }

  // ======================== 状态栏 ========================
  _drawStatusBar(ctx) {
    const sy = this.h - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, sy, this.w, 24);
    const wp = this.screenToWorld(this.mx, this.my);
    ctx.fillStyle = C.sub; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`工具: ${this.dd.tool} | 缩放: ${(this.zoom * 100).toFixed(0)}% | 世界: (${wp.x.toFixed(0)}, ${wp.y.toFixed(0)})`, 10, sy + 16);
  }

  _drawToast(ctx) {
    const alpha = Math.min(1, this._toastTimer / 0.3);
    const tw = 300, th = 36, tx = (this.w - tw) / 2, ty = this.h - 80;
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`; this._roundRect(ctx, tx, ty, tw, th, 8, true);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.fillText(this._toast, this.w / 2, ty + 23);
  }

  // ======================== 事件 ========================
  _bindEvents() {
    this.canvas.addEventListener('mousemove', e => this._onMove(e));
    this.canvas.addEventListener('mousedown', e => this._onDown(e));
    this.canvas.addEventListener('mouseup', e => this._onUp(e));
    this.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onRightClick(e); });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      if (this._dropdown || this._activeEdit) {
        if (e.key === 'Escape') { e.preventDefault(); this._dropdown = null; this._activeEdit = null; return; }
      }
      if (this._activeEdit) {
        if (e.key === 'Enter') { e.preventDefault(); this._commitEdit(); return; }
        if (e.key === 'Tab') { e.preventDefault(); this._commitEdit(); this._focusNextProp(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); const ae = this._activeEdit; if (ae.cursorPos > 0) { ae.text = ae.text.slice(0, ae.cursorPos - 1) + ae.text.slice(ae.cursorPos); ae.cursorPos--; } return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (this._activeEdit.cursorPos > 0) this._activeEdit.cursorPos--; return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); if (this._activeEdit.cursorPos < this._activeEdit.text.length) this._activeEdit.cursorPos++; return; }
        if (e.key === 'Home') { e.preventDefault(); this._activeEdit.cursorPos = 0; return; }
        if (e.key === 'End') { e.preventDefault(); this._activeEdit.cursorPos = this._activeEdit.text.length; return; }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const ae2 = this._activeEdit; ae2.text = ae2.text.slice(0, ae2.cursorPos) + e.key + ae2.text.slice(ae2.cursorPos); ae2.cursorPos++; }
        return;
      }
      for (const tool of TOOLS) { if (e.key === tool.shortcut && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.dd.tool = tool.id; this.dd.clearSelection(); return; } }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.dd.selected && this._canDelete(this.dd.selected)) { e.preventDefault(); this._deleteSelected(); }
      if (e.key === 'Escape') { this.dd.clearSelection(); }
    });
  }

  _onMove(e) {
    if (this._disabled) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mx = e.clientX - rect.left; this.my = e.clientY - rect.top;
    if (this._panning) { const dx = this.mx - this._panSX, dy = this.my - this._panSY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._rightPanMoved = true; this.camX = this._panCX - dx / this.zoom; this.camY = this._panCY - dy / this.zoom; return; }
    if (this._draggingOrbit) { const wp = this.screenToWorld(this.mx, this.my); const orb = this.dd.data.orbits[this._draggingOrbit.orbitIdx]; if (orb.type === 'fixed') { orb.x = wp.x - (this._draggingOrbit.ox || 0); orb.y = wp.y - (this._draggingOrbit.oy || 0); } }
  }

  _onDown(e) {
    if (this._disabled) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top, wp = this.screenToWorld(sx, sy);
    if (e.button === 2) { if (sy < 46 || (sx > this.w - 220 && sy > 46)) return; this._panning = true; this._panSX = sx; this._panSY = sy; this._panCX = this.camX; this._panCY = this.camY; this._rightPanMoved = false; return; }
    if (e.button !== 0) return;

    if (this._snapChk && this._inRect(sx, sy, this._snapChk.x, this._snapChk.y, this._snapChk.w, this._snapChk.h)) { this.snapToGrid = !this.snapToGrid; return; }
    for (const tool of this._toolBtns || []) { if (this._inRect(sx, sy, tool._bx, tool._by, tool._bw, tool._bh)) { this.dd.tool = tool.id; this.dd.clearSelection(); this._activeBld = -1; this._bindDropRect = null; return; } }
    for (const ab of this._actBtns || []) {
      if (this._inRect(sx, sy, ab._bx, ab._by, ab._bw, ab._bh)) {
        if (ab.id === 'test' && this.cb.onTest) this.cb.onTest();
        if (ab.id === 'export' && this.cb.onExport) this.cb.onExport();
        if (ab.id === 'open' && this.cb.onOpen) this.cb.onOpen();
        if (ab.id === 'rename') {
          const n = prompt('关卡名称:', this.dd.data.name || '新关卡');
          if (n && n.trim()) this.dd.data.name = n.trim();
        }
        return;
      }
    }

    if (this._dropdown) {
      const dd = this._dropdown;
      if (dd._bldDropdown) {
        // 建筑选择下拉：选项由 _drawBuildingToolbar 渲染
        for (const opt of dd._bldOptions || []) {
          if (opt._ox != null && this._inRect(sx, sy, opt._ox, opt._oy, opt._ow, opt._oh)) {
            if (opt.value === -2) { this._activeBld = this.dd.addBuilding(); this.dd.clearSelection(); }
            else { this._activeBld = opt.value; this.dd.clearSelection(); }
            this._dropdown = null; this._springFirst = null; return;
          }
        }
        this._dropdown = null; return;
      }
      if (dd._ptypeDropdown) {
        for (const opt of dd._ptypeOptions || []) {
          if (opt._ox != null && this._inRect(sx, sy, opt._ox, opt._oy, opt._ow, opt._oh)) { this._ptype = opt.value; this._dropdown = null; return; }
        }
        this._dropdown = null; return;
      }
      if (dd._bindDropdown) {
        for (const opt of dd._bindOptions || []) {
          if (opt._ox != null && this._inRect(sx, sy, opt._ox, opt._oy, opt._ow, opt._oh)) {
            const bldIdx = this._activeBld;
            const oldBind = this.dd.data.buildings[bldIdx].bindToBody;
            // 保存切换前各质点的绝对世界位置
            const worldPos = [];
            for (let pi = 0; pi < this.dd.data.buildings[bldIdx].points.length; pi++) {
              const pt = this.dd.data.buildings[bldIdx].points[pi];
              if (pt.isCore && pt.orbit != null) continue; // 核心点不受影响
              const pw = this.dd.getPointWorld(bldIdx, pi);
              worldPos.push({ pi, x: pw.x, y: pw.y });
            }
            // 应用新绑定
            this.dd.data.buildings[bldIdx].bindToBody = opt.value;
            if (oldBind !== opt.value) this.dd._invalidateOrbitsCache();
            // 计算新绑定下的核心参考位置，重算相对偏移
            const newCore = this.dd.getBuildingCoreWorld(bldIdx);
            for (const { pi, x: wx, y: wy } of worldPos) {
              const pt = this.dd.data.buildings[bldIdx].points[pi];
              pt.x = Math.round(wx - newCore.x);
              pt.y = Math.round(wy - newCore.y);
            }
            this._dropdown = null; return;
          }
        }
        this._dropdown = null; return;
      }
      for (const opt of dd.options) { if (opt._ox != null && this._inRect(sx, sy, opt._ox, opt._oy, opt._ow, opt._oh)) { this._applyChange(dd.sel, dd.key, opt.value); this._dropdown = null; return; } }
      this._dropdown = null; return;
    }

    const propHit = this._findPropAt(sx, sy);
    if (propHit) { if (propHit.isDropdown) { this._activeEdit = null; this._dropdown = { x: propHit.x, y: propHit.y, w: propHit.w, options: propHit.options, key: propHit.key, sel: this.dd.selected }; } else { this._beginEdit(propHit); } return; }
    if (this._deleteBtn && this._inRect(sx, sy, this._deleteBtn.x, this._deleteBtn.y, this._deleteBtn.w, this._deleteBtn.h)) { this._deleteSelected(); return; }

    // 建筑操作栏点击（工具栏第二行，y=46~80）
    if (this.dd.tool === 'building' && sy >= 46 && sy < 80 && sx < this.w - 220) {
      // 建筑下拉
      if (this._bldDropRect && this._inRect(sx, sy, this._bldDropRect.x, this._bldDropRect.y, this._bldDropRect.w, this._bldDropRect.h)) {
        this._activeEdit = null;
        this._dropdown = { _bldDropdown: true, options: [], key: null, sel: null }; // 由 _drawBuildingToolbar 渲染选项
        return;
      }
      // 新建按钮
      if (this._bldNewRect && this._inRect(sx, sy, this._bldNewRect.x, this._bldNewRect.y, this._bldNewRect.w, this._bldNewRect.h)) {
        this._activeBld = this.dd.addBuilding();
        this.dd.clearSelection();
        return;
      }
      // 删除建筑按钮
      if (this._bldDelRect && this._inRect(sx, sy, this._bldDelRect.x, this._bldDelRect.y, this._bldDelRect.w, this._bldDelRect.h)) {
        if (this._activeBld >= 0 && this._activeBld < this.dd.data.buildings.length) {
          this.dd.removeBuilding(this._activeBld);
          this._activeBld = -1;
          this.dd.clearSelection();
          this._springFirst = null;
        }
        return;
      }
      // 建筑子工具
      for (const bt of BTOOLS) {
        if (bt._bx != null && this._inRect(sx, sy, bt._bx, bt._by, bt._bw, bt._bh)) { this._btool = bt.id; this._springFirst = null; return; }
      }
      // 质点类型下拉
      if (this._ptypeDropRect && this._btool === 'point' && this._inRect(sx, sy, this._ptypeDropRect.x, this._ptypeDropRect.y, this._ptypeDropRect.w, this._ptypeDropRect.h)) {
        this._activeEdit = null;
        this._dropdown = { _ptypeDropdown: true };
        return;
      }
      // 绑定星体下拉
      if (this._bindDropRect && this._inRect(sx, sy, this._bindDropRect.x, this._bindDropRect.y, this._bindDropRect.w, this._bindDropRect.h)) {
        this._activeEdit = null;
        this._dropdown = { _bindDropdown: true };
        return;
      }
      return;
    }

    if (sx > this.w - 220 && sy > 46) { this._activeEdit = null; this._dropdown = null; return; }
    if (sy < (this.dd.tool === 'building' ? 80 : 46)) return;

    switch (this.dd.tool) { case 'select': this._toolSelect(wp, sx, sy); break; case 'orbit': this._toolOrbit(wp); break; case 'star': this._toolStar(wp); break; case 'planet': this._toolPlanet(wp); break; case 'bullet': this._toolBullet(wp); break; case 'building': this._onBuildClick(wp); break; }
  }

  _onUp(e) { this._panning = false; this._draggingOrbit = null; }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(0.15, Math.min(5, this.zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
    const after = this.screenToWorld(sx, sy);
    this.camX += before.x - after.x; this.camY += before.y - after.y;
  }

  _onRightClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (sy < 46 || (sx > this.w - 220 && sy > 46)) return;
    if (this._rightPanMoved) return;
    const hit = this._selectAt(this.screenToWorld(sx, sy));
    if (hit) this._autoSwitchTool();
  }

  // ======================== 工具 ========================
  _snap(wp) { if (!this.snapToGrid) return wp; return { x: Math.round(wp.x / 100) * 100, y: Math.round(wp.y / 100) * 100 }; }

  _toolSelect(wp, sx, sy) { const hit = this._selectAt(wp); if (!hit) { this.dd.clearSelection(); this._lastRightPos = null; this._lastRightSel = null; this._panning = true; this._panSX = sx; this._panSY = sy; this._panCX = this.camX; this._panCY = this.camY; } else if (hit) this._autoSwitchTool(); }

  _autoSwitchTool() {
    const sel = this._lastRightSel || this.dd.selected;
    if (!sel) return;
    if (sel.type === 'orbit') this.dd.tool = 'orbit';
    else if (sel.type === 'star') this.dd.tool = 'star';
    else if (sel.type === 'planet') this.dd.tool = 'planet';
    else if (sel.type === 'bullet') this.dd.tool = 'bullet';
    else if (sel.type === 'point' || sel.type === 'spring') {
      this.dd.tool = 'building';
      this._activeBld = sel.bldIdx;
      this._btool = sel.type;
    }
  }
  _toolOrbit(wp) { wp = this._snap(wp); const idx = this.dd.addOrbit('fixed', wp.x, wp.y); this.dd.select('orbit', { orbitIdx: idx }); }
  _toolStar(wp) { wp = this._snap(wp); const oi = this._findClosestOrbit(wp); if (oi < 0) { this._showToast('请先创建轨道'); return; } this.dd.select('star', { starIdx: this.dd.addStar(oi) }); }
  _toolPlanet(wp) { wp = this._snap(wp); const oi = this._findClosestOrbit(wp); if (oi < 0) { this._showToast('请先创建轨道'); return; } this.dd.select('planet', { planetIdx: this.dd.addPlanet(oi) }); }
  _toolBullet(wp) {
    const allBodies = [...this.dd.data.stars, ...this.dd.data.planets];
    if (allBodies.length === 0) { this._showToast('需要先创建绕行星体（恒星或行星）！'); return; }
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < allBodies.length; i++) {
      const pos = this.dd._calcOrbitWorld(this.dd.data.orbits[allBodies[i].orbit]);
      const d = Math.sqrt((wp.x - pos.x) ** 2 + (wp.y - pos.y) ** 2);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const host = allBodies[bestIdx];
    const hp = this.dd._calcOrbitWorld(this.dd.data.orbits[host.orbit]);
    const dx = wp.x - hp.x, dy = wp.y - hp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const altitude = Math.max(10, Math.round(dist - (host.radius || 40)));
    const phase = Math.atan2(-dy, dx);
    wp = this._snap(wp);
    this.dd.select('bullet', { bulletIdx: this.dd.addBullet({ orbitAround: { bodyIndex: bestIdx, altitude, phase } }) });
  }

  // ======================== 建筑工具 ========================
  _onBuildClick(wp) {
    if (this._activeBld < 0) { this._showToast('请先选择或创建建筑'); return; }
    wp = this._snap(wp);
    const bldIdx = this._activeBld;
    switch (this._btool) {
      case 'core': {
        const oi = this._findClosestOrbit(wp);
        if (oi < 0) { this._showToast('请先创建轨道'); return; }
        this.dd.addPoint(bldIdx, { isCore: true, orbit: oi });
        this.dd.select('point', { bldIdx, ptIdx: this.dd.data.buildings[bldIdx].points.length - 1 });
        this._btool = 'point'; // 核心放完自动切到质点工具
        break;
      }
      case 'point': {
        const bld = this.dd.data.buildings[bldIdx];
        // 无核心无绑定的自由建筑首个质点 → 自动绑定最近星体
        if (bld && !bld.points.some(p => p.isCore && p.orbit != null) && bld.bindToBody == null && bld.points.length === 0) {
          const allBodies = [...this.dd.data.stars, ...this.dd.data.planets];
          if (allBodies.length > 0) {
            let best = 0, bestD = Infinity;
            for (let i = 0; i < allBodies.length; i++) {
              const pos = this.dd._calcOrbitWorld(this.dd.data.orbits[allBodies[i].orbit]);
              const d = Math.sqrt((wp.x - pos.x) ** 2 + (wp.y - pos.y) ** 2);
              if (d < bestD) { bestD = d; best = i; }
            }
            bld.bindToBody = best;
          }
        }
        const pt = POINT_TYPES.find(t => t.id === this._ptype) || POINT_TYPES[0];
        const info = this._findClosestBuildingForBld(wp, bldIdx);
        const def = { x: wp.x, y: wp.y, mass: pt.mass, radius: pt.radius, score: pt.score, color: pt.color, explosionRadius: pt.explosionRadius, explosionImpulse: pt.explosionImpulse };
        if (info) { this.dd.addPoint(bldIdx, def, info); } else { this.dd.addPoint(bldIdx, def); }
        this.dd.select('point', { bldIdx, ptIdx: this.dd.data.buildings[bldIdx].points.length - 1 });
        break;
      }
      case 'enemy': {
        const info = this._findClosestBuildingForBld(wp, bldIdx);
        const ed = { x: wp.x, y: wp.y, isEnemy: true, hp: 150, mass: 12, radius: 7, renderRadius: 8, score: 200, important: true, color: '#44ff44', explosionRadius: 30, explosionImpulse: 2000 };
        if (info) { this.dd.addPoint(bldIdx, ed, info); } else { this.dd.addPoint(bldIdx, ed); }
        this.dd.select('point', { bldIdx, ptIdx: this.dd.data.buildings[bldIdx].points.length - 1 });
        break;
      }
      case 'spring': {
        const bld = this.dd.data.buildings[bldIdx];
        if (!bld) return;
        // 找最近的质点
        let bestPi = -1, bestDist = Infinity;
        for (let pi = 0; pi < bld.points.length; pi++) {
          const pw = this.dd.getPointWorld(bldIdx, pi);
          const d = Math.sqrt((wp.x - pw.x) ** 2 + (wp.y - pw.y) ** 2);
          const pr = bld.points[pi].radius || 5;
          if (d < pr + 12 / this.zoom && d < bestDist) { bestDist = d; bestPi = pi; }
        }
        if (bestPi < 0) return;
        if (!this._springFirst || this._springFirst.bldIdx !== bldIdx) {
          this._springFirst = { bldIdx, ptIdx: bestPi };
          this._showToast('已选第一个质点，点击第二个质点');
        } else {
          this.dd.addSpring(bldIdx, this._springFirst.ptIdx, bestPi);
          this.dd.select('spring', { bldIdx, spIdx: bld.springs.length - 1 });
          this._springFirst = null;
          this._showToast('弹簧已创建');
        }
        break;
      }
    }
  }

  _findClosestBuildingForBld(wp, bldIdx) {
    const bld = this.dd.data.buildings[bldIdx]; if (!bld) return null;
    const core = this.dd.getBuildingCoreWorld(bldIdx);
    const hasCore = bld.points.some(p => p.isCore && p.orbit != null);
    const hasBind = bld.bindToBody != null;
    if (hasCore || hasBind) return { bldIdx, coreWorldX: core.x, coreWorldY: core.y };
    return null;
  }

  // ======================== 选中 ========================
  _selectAt(wp) {
    const cands = [];
    // 子弹
    for (let i = 0; i < this.dd.data.bullets.length; i++) {
      const b = this.dd.data.bullets[i]; if (!b || !b.orbitAround || b.orbitAround.bodyIndex == null) continue;
      const allBodies = [...this.dd.data.stars, ...this.dd.data.planets];
      const host = allBodies[b.orbitAround.bodyIndex]; if (!host) continue;
      const hp = this.dd._calcOrbitWorld(this.dd.data.orbits[host.orbit]);
      const r = (host.radius || 40) + (b.orbitAround.altitude || 60);
      const wx = hp.x + r * Math.cos(b.orbitAround.phase || 0);
      const wy = hp.y - r * Math.sin(b.orbitAround.phase || 0);
      const d = Math.sqrt((wp.x - wx) ** 2 + (wp.y - wy) ** 2);
      if (d < 10 / this.zoom) cands.push({ type: 'bullet', bulletIdx: i });
    }
    // 建筑质点/弹簧
    for (let bi = 0; bi < this.dd.data.buildings.length; bi++) {
      const bld = this.dd.data.buildings[bi];
      for (let pi = 0; pi < bld.points.length; pi++) {
        const pw = this.dd.getPointWorld(bi, pi);
        const pr = bld.points[pi].radius || 5;
        const d = Math.sqrt((wp.x - pw.x) ** 2 + (wp.y - pw.y) ** 2);
        if (d < pr + 12 / this.zoom) cands.push({ type: 'point', bldIdx: bi, ptIdx: pi });
      }
      for (let si = 0; si < bld.springs.length; si++) {
        const sp = bld.springs[si];
        const a = this.dd.getPointWorld(bi, sp.a), b = this.dd.getPointWorld(bi, sp.b);
        const dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue;
        let t = ((wp.x - a.x) * dx + (wp.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + t * dx, cy = a.y + t * dy;
        if (Math.sqrt((wp.x - cx) ** 2 + (wp.y - cy) ** 2) < 6 / this.zoom) cands.push({ type: 'spring', bldIdx: bi, spIdx: si });
      }
    }
    // 星体
    const bodies = this.dd.getAllBodyPositions();
    for (const bd of bodies) { const d = Math.sqrt((wp.x - bd.x) ** 2 + (wp.y - bd.y) ** 2); if (d < bd.radius + 15 / this.zoom) { const k = bd.type === 'star' ? 'starIdx' : 'planetIdx'; cands.push({ type: bd.type, [k]: bd.idx }); } }
    const orbHitR = 15 / this.zoom; const ringW = 8 / this.zoom;
    for (let i = 0; i < this.dd.data.orbits.length; i++) {
      const orb = this.dd.data.orbits[i]; const op = this.dd.getOrbitCenterWorld(i);
      const d = Math.sqrt((wp.x - op.x) ** 2 + (wp.y - op.y) ** 2);
      let hit = d < orbHitR;
      if (!hit && orb.type === 'circular' && orb.radius) hit = Math.abs(d - orb.radius) < ringW;
      if (hit) cands.push({ type: 'orbit', orbitIdx: i });
    }
    if (!cands.length) { this.dd.clearSelection(); this._lastRightPos = null; this._lastRightSel = null; return false; }

    const sameSpot = this._lastRightPos && Math.abs(wp.x - this._lastRightPos.x) < 8 / this.zoom && Math.abs(wp.y - this._lastRightPos.y) < 8 / this.zoom;
    this._lastRightPos = { x: wp.x, y: wp.y };
    if (sameSpot && this._lastRightSel) {
      const ci = cands.findIndex(c => c.type === this._lastRightSel.type && c.orbitIdx === this._lastRightSel.orbitIdx && c.starIdx === this._lastRightSel.starIdx && c.planetIdx === this._lastRightSel.planetIdx && c.bulletIdx === this._lastRightSel.bulletIdx && c.bldIdx === this._lastRightSel.bldIdx && c.ptIdx === this._lastRightSel.ptIdx && c.spIdx === this._lastRightSel.spIdx);
      const next = ci >= 0 ? cands[(ci + 1) % cands.length] : cands[0];
      this.dd.select(next.type, next); this._lastRightSel = next;
    } else { this.dd.select(cands[0].type, cands[0]); this._lastRightSel = cands[0]; }
    return true;
  }

  _findClosestOrbit(wp) { let b = -1, bd = Infinity; for (let i = 0; i < this.dd.data.orbits.length; i++) { const op = this.dd.getOrbitCenterWorld(i); const d = Math.sqrt((wp.x - op.x) ** 2 + (wp.y - op.y) ** 2); if (d < bd) { bd = d; b = i; } } return b; }

  _drawBullet(ctx, idx) {
    const b = this.dd.data.bullets[idx]; if (!b || !b.orbitAround) return;
    const oa = b.orbitAround;
    if (oa.bodyIndex == null) return;
    const allBodies = [...this.dd.data.stars, ...this.dd.data.planets];
    const host = allBodies[oa.bodyIndex];
    if (!host) return;
    const hp = this.dd._calcOrbitWorld(this.dd.data.orbits[host.orbit]);
    const phase = oa.phase || 0;
    const r = (host.radius || 40) + (oa.altitude || 60);
    const wx = hp.x + r * Math.cos(phase);
    const wy = hp.y - r * Math.sin(phase);
    const sp = this.worldToScreen(wx, wy);
    const isSel = this.dd.selected && this.dd.selected.type === 'bullet' && this.dd.selected.bulletIdx === idx;

    // 从 BULLET_TYPES 取渲染参数
    const bt = b.type || 'normal';
    let color = '#ff4444', rr = 8;
    try {
      const def = { normal: { color: '#ff4444', renderRadius: 8 }, explosive: { color: '#4488ff', renderRadius: 14 }, kinetic: { color: '#ff4444', renderRadius: 16 }, agile: { color: '#ffdd44', renderRadius: 8 }, cluster: { color: '#44ff88', renderRadius: 8 }, gravity: { color: '#cc88ff', renderRadius: 10 }, incendiary: { color: '#ff6644', renderRadius: 9 } };
      const d = def[bt] || def.normal;
      color = d.color; rr = d.renderRadius;
    } catch(e) {}

    const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rr * this.zoom);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(rr * this.zoom, 4), 0, Math.PI * 2); ctx.fill();

    if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr * this.zoom + 5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${bt}#${idx}`, sp.x, sp.y - rr * this.zoom - 6);
  }

  // ======================== 属性编辑 ========================
  _findPropAt(sx, sy) { for (const inp of this._propInputs) { if (sx >= inp.x && sx <= inp.x + inp.w && sy >= inp.y && sy <= inp.y + inp.h) return inp; } return null; }
  _beginEdit(inp) { this._activeEdit = { key: inp.key, text: String(inp.value ?? ''), cursorPos: String(inp.value ?? '').length, sel: this.dd.selected }; }

  _commitEdit() { if (!this._activeEdit) return; const { key, text, sel } = this._activeEdit; this._activeEdit = null; let v = text; if (!isNaN(Number(text)) && text.trim() !== '') v = Number(text); if (text === 'true') v = true; if (text === 'false') v = false; if (text === 'null' || text === '无' || text === '') v = null; this._applyChange(sel, key, v); }

  _focusNextProp() { if (!this._propInputs.length) return; const ck = this._activeEdit?.key; let idx = 0; if (ck) { const f = this._propInputs.findIndex(p => p.key === ck); if (f >= 0) idx = (f + 1) % this._propInputs.length; } this._activeEdit = { key: this._propInputs[idx].key, text: String(this._propInputs[idx].value ?? ''), cursorPos: String(this._propInputs[idx].value ?? '').length, sel: this.dd.selected }; }

  _applyChange(sel, key, value) {
    switch (sel.type) {
      case 'orbit':
        if (key === 'phase') { value = (Number(value) || 0) * Math.PI / 180; }
        else if (key === 'parent') {
          const absCenter = this.dd.getOrbitCenterWorld(sel.orbitIdx); // 无父时的绝对圆心
          // 应用到数据
          this.dd.data.orbits[sel.orbitIdx].parent = value;
          this.dd._invalidateOrbitsCache();
          // 计算新父轨道下需要的 x/y 偏移
          const newParentCenter = value != null ? this.dd.getOrbitCenterWorld(value) : { x: 0, y: 0 };
          this.dd.data.orbits[sel.orbitIdx].x = Math.round(absCenter.x - newParentCenter.x);
          this.dd.data.orbits[sel.orbitIdx].y = Math.round(absCenter.y - newParentCenter.y);
          break;
        }
        this.dd.updateOrbit(sel.orbitIdx, { [key]: value }); break;
      case 'star': this.dd.updateStar(sel.starIdx, { [key]: value }); break;
      case 'planet': this.dd.updatePlanet(sel.planetIdx, { [key]: value }); break;
      case 'bullet': {
        const b = this.dd.data.bullets[sel.bulletIdx];
        if (key === 'orbitBody') { if (!b.orbitAround) b.orbitAround = {}; b.orbitAround.bodyIndex = value; }
        else if (key === 'orbitAlt') { if (!b.orbitAround) b.orbitAround = {}; b.orbitAround.altitude = Number(value) || 60; }
        else if (key === 'orbitPhase') { if (!b.orbitAround) b.orbitAround = {}; b.orbitAround.phase = (Number(value) || 0) * Math.PI / 180; }
        else this.dd.updateBullet(sel.bulletIdx, { [key]: value });
        break;
      }
      case 'point': this.dd.updatePoint(sel.bldIdx, sel.ptIdx, { [key]: value }); break;
      case 'spring': this.dd.updateSpring(sel.bldIdx, sel.spIdx, { [key]: value }); break;
    }
  }

  _deleteSelected() { const s = this.dd.selected; if (!s) return; if (s.type === 'orbit') this.dd.removeOrbit(s.orbitIdx); else if (s.type === 'star') this.dd.removeStar(s.starIdx); else if (s.type === 'planet') this.dd.removePlanet(s.planetIdx); else if (s.type === 'bullet') this.dd.removeBullet(s.bulletIdx); else if (s.type === 'point') { this.dd.removePoint(s.bldIdx, s.ptIdx); if (this._activeBld >= this.dd.data.buildings.length) this._activeBld = -1; } else if (s.type === 'spring') this.dd.removeSpring(s.bldIdx, s.spIdx); this.dd.clearSelection(); }

  // ======================== 工具函数 ========================
  _inRect(px, py, x, y, w, h) { return px >= x && px <= x + w && py >= y && py <= y + h; }
  _roundRect(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); if (fill) ctx.fill(); else ctx.stroke(); }
  _showToast(msg) { this._toast = msg; this._toastTimer = 2; }
  update(dt) { if (this._toastTimer > 0) { this._toastTimer -= dt; if (this._toastTimer <= 0) this._toast = null; } this._editBlink += dt; }
}
