/**
 * UI 管理器 — 界面状态机 + Canvas 绘制 + 按钮交互
 *
 * 四个界面：
 *   START       — 开始界面（标题 + 开始按钮）
 *   LEVEL_SELECT— 选关界面（章节标签 + 关卡卡片）
 *   GAME_HUD    — 游戏内 HUD（叠在游戏画面上方）
 *   RESULT      — 结算界面（星级 + 分数明细 + 通关判定）
 *
 * 视觉体系：深空玻璃拟态 — 动态星云背景 + 半透明面板 + 冷青发光强调，
 * 所有交互元素带时间驱动的缓动动画（悬停、入场、星级弹出、分数滚动）。
 */
import { getAllBest } from './storage.js';

export const Screen = Object.freeze({
  START: 'start',
  LEVEL_SELECT: 'levelSelect',
  CUTSCENE: 'cutscene',
  GAME_HUD: 'gameHud',
  RESULT: 'result',
});

// ========================
// 设计基调
// ========================
const C = {
  bgTop: '#03050d',
  bgMid: '#0a102b',
  bgBot: '#120b2e',
  panel: 'rgba(12, 18, 44, 0.82)',
  panelBorder: 'rgba(94, 234, 219, 0.16)',
  accent: '#4fe3d4',
  accentBright: '#8ffcef',
  accentDim: 'rgba(79, 227, 212, 0.35)',
  accent2: '#8b9cff',
  text: '#e9edf7',
  sub: '#8b96b8',
  faint: 'rgba(233, 237, 247, 0.35)',
  btnText: '#04121a',
  gold: '#ffd166',
  goldDim: 'rgba(255, 209, 102, 0.28)',
  red: '#ff5d6c',
  green: '#4ade80',
};

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, "Segoe UI", sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, "Courier New", monospace';
const font = (weight, size, mono = false) => `${weight} ${size}px ${mono ? MONO : FONT}`;

// ========================
// 缓动函数
// ========================
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const backOut = (p) => {
  const c = 1.70158;
  const q = p - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
};
// 确定性伪随机（星空布点用）
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.screen = Screen.START;
    this.buttons = [];
    this._mx = -1;
    this._my = -1;
    this._bindMouse();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.screen === Screen.LEVEL_SELECT) this.goTo(Screen.START);
        else if (this.screen === Screen.GAME_HUD) this.goTo(Screen.LEVEL_SELECT);
      }
    });

    // 图片由外部预加载后注入
    this._bgImage = null;
    this._logoImage = null;

    // 动画状态
    this._hoverAnim = {};          // 按钮悬停缓动值 key → 0..1
    this._screenEnterAt = performance.now();
    this._lastFrameAt = performance.now();
    this._starLayers = null;       // 星空缓存

    // 游戏状态数据（供 HUD 和结算使用）
    this.gameData = {
      score: 0,
      totalScore: 0,
      bulletsRemaining: 3,
      buildingsDestroyed: 0,
      enemiesKilled: 0,
      stars: 0,
      passed: false,
      currentChapter: 0,
      currentLevel: 0,
      chapters: [],
    };

    // 回调
    this._onStart = null;
    this._onSelectLevel = null;
    this._onNextLevel = null;
    this._onReplay = null;
    this._onBackToMenu = null;
  }

  // ========================
  // 鼠标事件
  // ========================
  _bindMouse() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._mx = e.clientX - rect.left;
      this._my = e.clientY - rect.top;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this._mx = -1;
      this._my = -1;
    });
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const btn of this.buttons) {
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
          if (btn.action) btn.action();
          return;
        }
      }
    });
  }

  // ========================
  // 绘制入口
  // ========================
  render() {
    this.buttons = [];
    const ctx = this.ctx;
    const now = performance.now();
    this._t = now / 1000;
    this._dt = Math.min(0.05, (now - this._lastFrameAt) / 1000);
    this._lastFrameAt = now;
    this._enter = clamp01((now - this._screenEnterAt) / 400);

    ctx.save();
    // GAME_HUD 在游戏画面上叠加，不清屏
    if (this.screen !== Screen.GAME_HUD) {
      ctx.clearRect(0, 0, this.w, this.h);
    }

    switch (this.screen) {
      case Screen.START: this._drawStart(ctx); break;
      case Screen.LEVEL_SELECT: this._drawLevelSelect(ctx); break;
      case Screen.GAME_HUD: this._drawHUD(ctx); break;
      case Screen.RESULT: this._drawResult(ctx); break;
    }

    ctx.restore();
    this._updateCursor();
  }

  _updateCursor() {
    const over = this.buttons.some((b) => this._isOver(b.x, b.y, b.w, b.h));
    if (over) this.canvas.style.cursor = 'pointer';
    else if (this.screen === Screen.GAME_HUD) this.canvas.style.cursor = 'crosshair';
    else this.canvas.style.cursor = 'default';
  }

  // ========================
  // 动态深空背景
  // ========================
  _buildStars() {
    const layers = [];
    const spec = [
      { count: 110, rMax: 0.9, alpha: 0.45, drift: 1.5 },
      { count: 70, rMax: 1.4, alpha: 0.7, drift: 3.5 },
      { count: 34, rMax: 2.0, alpha: 1.0, drift: 7 },
    ];
    let seed = 1;
    for (const s of spec) {
      const stars = [];
      for (let i = 0; i < s.count; i++) {
        stars.push({
          x: hash(seed++) * this.w,
          y: hash(seed++) * this.h,
          r: 0.4 + hash(seed++) * s.rMax,
          phase: hash(seed++) * Math.PI * 2,
          twSpeed: 0.6 + hash(seed++) * 1.8,
          baseA: (0.3 + hash(seed++) * 0.7) * s.alpha,
        });
      }
      layers.push({ stars, drift: s.drift });
    }
    this._starLayers = layers;
  }

  _nebula(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  _drawSpaceBg(ctx) {
    const t = this._t;
    // 深空渐变
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(0.55, C.bgMid);
    g.addColorStop(1, C.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // 漂移星云
    this._nebula(ctx, this.w * 0.22 + Math.sin(t * 0.05) * 40, this.h * 0.32 + Math.cos(t * 0.04) * 24, 360, 'rgba(79, 227, 212, 0.05)');
    this._nebula(ctx, this.w * 0.80 + Math.cos(t * 0.033) * 50, this.h * 0.62 + Math.sin(t * 0.05) * 30, 440, 'rgba(139, 156, 255, 0.06)');
    this._nebula(ctx, this.w * 0.55 + Math.sin(t * 0.02) * 60, this.h * 0.12, 280, 'rgba(255, 93, 108, 0.028)');

    // 三层视差星空 + 闪烁
    if (!this._starLayers) this._buildStars();
    for (const layer of this._starLayers) {
      for (const s of layer.stars) {
        const x = (s.x + t * layer.drift) % this.w;
        const a = s.baseA * (0.55 + 0.45 * Math.sin(t * s.twSpeed + s.phase));
        ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 偶发流星
    const period = 7;
    const phase = (t % period) / 1.1;
    if (phase < 1) {
      const seed = Math.floor(t / period);
      const sx = hash(seed * 3 + 1) * this.w * 0.7 + this.w * 0.15;
      const sy = hash(seed * 7 + 2) * this.h * 0.35 + 30;
      const px = sx + phase * 260;
      const py = sy + phase * 110;
      const lg = ctx.createLinearGradient(px, py, px - 120, py - 50);
      lg.addColorStop(0, `rgba(255, 255, 255, ${(0.8 * (1 - phase)).toFixed(3)})`);
      lg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 120, py - 50);
      ctx.stroke();
    }

    // 边缘暗角
    const v = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.45, this.w / 2, this.h / 2, this.h * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0, 0, 6, 0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ========================
  // 开始界面
  // ========================
  _drawStart(ctx) {
    if (this._bgImage) {
      ctx.drawImage(this._bgImage, 0, 0, this.w, this.h);
      // 压暗，保证前景可读
      const ov = ctx.createLinearGradient(0, 0, 0, this.h);
      ov.addColorStop(0, 'rgba(3, 5, 13, 0.35)');
      ov.addColorStop(0.6, 'rgba(3, 5, 13, 0.45)');
      ov.addColorStop(1, 'rgba(3, 5, 13, 0.75)');
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, this.w, this.h);
    } else {
      this._drawSpaceBg(ctx);
    }

    const t = this._t;
    const float = Math.sin(t * 1.1) * 6;

    if (this._logoImage) {
      const lw = 680;
      const lh = this._logoImage.height * (lw / this._logoImage.width);
      ctx.save();
      ctx.shadowColor = 'rgba(79, 227, 212, 0.45)';
      ctx.shadowBlur = 34;
      ctx.drawImage(this._logoImage, this.w / 2 - lw / 2, this.h * 0.12 + float, lw, lh);
      ctx.restore();
    } else {
      // 无 Logo 时的文字标题
      ctx.textAlign = 'center';
      ctx.save();
      const tg = ctx.createLinearGradient(this.w / 2 - 220, 0, this.w / 2 + 220, 0);
      tg.addColorStop(0, C.accentBright);
      tg.addColorStop(1, C.accent2);
      ctx.fillStyle = tg;
      ctx.shadowColor = 'rgba(79, 227, 212, 0.5)';
      ctx.shadowBlur = 30;
      ctx.font = font('bold', 84);
      ctx.fillText('引 力 破 晓', this.w / 2, this.h * 0.30 + float);
      ctx.restore();
      ctx.fillStyle = C.accent2;
      ctx.font = font('600', 17, true);
      ctx.fillText('G R A V I T Y   D A W N', this.w / 2, this.h * 0.30 + 42 + float);
    }

    // 标语
    ctx.textAlign = 'center';
    ctx.fillStyle = C.sub;
    ctx.font = font('400', 15);
    ctx.fillText('万有引力 · 弹弓机动 · 轨道打击', this.w / 2, this.h * 0.54);

    // 开始按钮（呼吸发光）
    const bw = 260, bh = 60;
    this._btn(ctx, '开 始 游 戏', this.w / 2 - bw / 2, this.h * 0.62, bw, bh,
      () => this.goTo(Screen.LEVEL_SELECT), { primary: true, size: 19, pulse: true });

    // Credits + 版本
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = font('400', 12);
    ctx.fillText('制作人: Link14349 | 程序: Claude Code | 音乐美术: 待定', this.w / 2, this.h - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.font = font('400', 11, true);
    ctx.fillText('v0.9', this.w / 2, this.h - 20);
  }

  // ========================
  // 选关界面
  // ========================
  _drawLevelSelect(ctx) {
    this._drawSpaceBg(ctx);
    const slide = (1 - easeOutCubic(this._enter)) * 16;
    ctx.save();
    ctx.globalAlpha = this._enter;
    ctx.translate(0, slide);

    // 标题 + 强调下划线
    ctx.textAlign = 'center';
    ctx.fillStyle = C.text;
    ctx.font = font('bold', 32);
    ctx.fillText('选 择 关 卡', this.w / 2, 62);
    const ug = ctx.createLinearGradient(this.w / 2 - 40, 0, this.w / 2 + 40, 0);
    ug.addColorStop(0, C.accent);
    ug.addColorStop(1, C.accent2);
    ctx.fillStyle = ug;
    this._roundRect(ctx, this.w / 2 - 40, 74, 80, 3, 1.5, true);

    const chapters = this.gameData.chapters || [];
    if (this.gameData.currentChapter == null) this.gameData.currentChapter = 0;
    const activeCh = Math.min(this.gameData.currentChapter, chapters.length - 1);

    // ---- 章节胶囊标签 ----
    const tabH = 38, tabGap = 14, tabPad = 46;
    ctx.font = font('600', 14);
    const tabWs = chapters.map((ch) => Math.ceil(ctx.measureText(ch.name).width) + tabPad);
    const tabsTotalW = tabWs.reduce((s, w) => s + w, 0) + (chapters.length - 1) * tabGap;
    let tx = (this.w - tabsTotalW) / 2;
    const tabY = 102;

    for (let ci = 0; ci < chapters.length; ci++) {
      const tw = tabWs[ci];
      const isActive = ci === activeCh;
      const hv = this._hover(`tab${ci}`, tx, tabY, tw, tabH);

      if (isActive) {
        const tg = ctx.createLinearGradient(tx, tabY, tx + tw, tabY);
        tg.addColorStop(0, C.accent);
        tg.addColorStop(1, '#3bbfb2');
        ctx.save();
        ctx.shadowColor = 'rgba(79, 227, 212, 0.4)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = tg;
        this._roundRect(ctx, tx, tabY, tw, tabH, tabH / 2, true);
        ctx.restore();
        ctx.fillStyle = C.btnText;
      } else {
        ctx.fillStyle = `rgba(79, 227, 212, ${(0.04 + hv * 0.10).toFixed(3)})`;
        this._roundRect(ctx, tx, tabY, tw, tabH, tabH / 2, true);
        ctx.strokeStyle = `rgba(139, 150, 184, ${(0.25 + hv * 0.4).toFixed(3)})`;
        ctx.lineWidth = 1;
        this._roundRect(ctx, tx, tabY, tw, tabH, tabH / 2, false);
        ctx.fillStyle = hv > 0.3 ? C.text : C.sub;
      }
      ctx.font = font('600', 14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chapters[ci].name, tx + tw / 2, tabY + tabH / 2 + 1);
      ctx.textBaseline = 'alphabetic';

      if (!isActive) {
        const idx = ci;
        this.buttons.push({ x: tx, y: tabY, w: tw, h: tabH, action: () => { this.gameData.currentChapter = idx; } });
      }
      tx += tw + tabGap;
    }

    // ---- 关卡卡片 ----
    const levels = chapters[activeCh]?.levels || [];
    const cardsPerRow = 4;
    const cardW = 224, cardH = 158, gapX = 30, gapY = 28;
    const startX = (this.w - (cardsPerRow * cardW + (cardsPerRow - 1) * gapX)) / 2;
    const startY = 176;
    const allBest = getAllBest();

    for (let li = 0; li < levels.length; li++) {
      const lv = levels[li];
      const col = li % cardsPerRow;
      const row = Math.floor(li / cardsPerRow);
      const cx = startX + col * (cardW + gapX);
      const baseY = startY + row * (cardH + gapY);
      const locked = false;
      const hv = locked ? 0 : this._hover(`card${activeCh}-${li}`, cx, baseY, cardW, cardH);
      const cy = baseY - hv * 5; // 悬停轻微上浮

      // 卡片底
      ctx.save();
      if (hv > 0.01) {
        ctx.shadowColor = `rgba(79, 227, 212, ${(hv * 0.35).toFixed(3)})`;
        ctx.shadowBlur = 22;
      }
      const cg = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      cg.addColorStop(0, locked ? 'rgba(14, 18, 38, 0.72)' : 'rgba(20, 28, 64, 0.88)');
      cg.addColorStop(1, locked ? 'rgba(10, 13, 28, 0.72)' : 'rgba(11, 15, 36, 0.88)');
      ctx.fillStyle = cg;
      this._roundRect(ctx, cx, cy, cardW, cardH, 14, true);
      ctx.restore();
      ctx.strokeStyle = locked
        ? 'rgba(139, 150, 184, 0.12)'
        : `rgba(79, 227, 212, ${(0.14 + hv * 0.6).toFixed(3)})`;
      ctx.lineWidth = 1 + hv;
      this._roundRect(ctx, cx, cy, cardW, cardH, 14, false);

      if (locked) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font = font('400', 34);
        ctx.textAlign = 'center';
        ctx.fillText('🔒', cx + cardW / 2, cy + cardH / 2 + 12);
      } else {
        // 序号水印
        ctx.fillStyle = `rgba(79, 227, 212, ${(0.10 + hv * 0.08).toFixed(3)})`;
        ctx.font = font('bold', 52, true);
        ctx.textAlign = 'right';
        ctx.fillText(String(li + 1).padStart(2, '0'), cx + cardW - 14, cy + 52);

        ctx.textAlign = 'left';
        ctx.fillStyle = C.sub;
        ctx.font = font('600', 12);
        ctx.fillText(`第 ${li + 1} 关`, cx + 18, cy + 32);
        ctx.fillStyle = C.text;
        ctx.font = font('bold', 19);
        ctx.fillText(lv.name, cx + 18, cy + 62);

        // 星级 + 最佳成绩
        const saved = allBest[`c${activeCh}-l${li}`];
        const starN = saved && saved.stars > 0 ? saved.stars : 0;
        for (let s = 0; s < 3; s++) {
          this._drawStarShape(ctx, cx + 28 + s * 26, cy + 102, 9, s < starN);
        }
        if (saved && saved.stars > 0) {
          ctx.fillStyle = C.sub;
          ctx.font = font('500', 12, true);
          ctx.textAlign = 'left';
          ctx.fillText(`最佳 ${saved.score || 0}`, cx + 18, cy + 136);
        } else {
          ctx.fillStyle = C.faint;
          ctx.font = font('400', 12);
          ctx.textAlign = 'left';
          ctx.fillText('尚未挑战', cx + 18, cy + 136);
        }

        const ci = activeCh;
        this.buttons.push({
          x: cx, y: baseY, w: cardW, h: cardH, action: () => {
            this.gameData.currentChapter = ci;
            this.gameData.currentLevel = li;
            this.goTo(Screen.GAME_HUD);
          },
        });
      }
    }

    ctx.restore();

    // 返回按钮（不参与入场平移，位置稳定）
    this._btn(ctx, '← 返回', 20, 18, 92, 34, () => this.goTo(Screen.START), { primary: false, size: 13 });

    ctx.fillStyle = C.faint;
    ctx.font = font('400', 12);
    ctx.textAlign = 'center';
    ctx.fillText('ESC 返回主菜单', this.w / 2, this.h - 22);
  }

  // ========================
  // 游戏 HUD
  // ========================
  _drawHUD(ctx) {
    // 顶部渐隐遮罩（取代黑色实心条）
    const tg = ctx.createLinearGradient(0, 0, 0, 72);
    tg.addColorStop(0, 'rgba(3, 6, 15, 0.82)');
    tg.addColorStop(1, 'rgba(3, 6, 15, 0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, this.w, 72);

    // 关卡名（居中，两行层级）
    const chapters = this.gameData.chapters || [];
    const chIdx = this.gameData.currentChapter || 0;
    const lvIdx = this.gameData.currentLevel || 0;
    const chName = chapters[chIdx]?.name || '';
    const lvName = chapters[chIdx]?.levels[lvIdx]?.name || '';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.sub;
    ctx.font = font('500', 11);
    ctx.fillText(chName, this.w / 2, 22);
    ctx.fillStyle = C.text;
    ctx.font = font('bold', 17);
    ctx.fillText(`第 ${lvIdx + 1} 关 · ${lvName}`, this.w / 2, 44);

    // 右侧状态：得分 + 剩余子弹
    ctx.textAlign = 'right';
    ctx.fillStyle = C.sub;
    ctx.font = font('500', 11);
    ctx.fillText('得分', this.w - 24, 20);
    ctx.fillStyle = C.gold;
    ctx.font = font('bold', 17, true);
    ctx.fillText(String(this.gameData.score), this.w - 24, 40);

    const n = this.gameData.bulletsRemaining;
    ctx.fillStyle = C.sub;
    ctx.font = font('500', 11);
    ctx.fillText('剩余子弹', this.w - 110, 20);
    const dots = Math.min(n, 6);
    for (let i = 0; i < dots; i++) {
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(this.w - 110 - (dots - 1 - i) * 14, 35, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n > 6 || n === 0) {
      ctx.fillStyle = n === 0 ? C.red : C.accent;
      ctx.font = font('bold', 13, true);
      ctx.fillText(n === 0 ? '0' : `×${n}`, this.w - 110, 40);
    }

    // 暂停指示（居中胶囊，呼吸）
    if (this._ctrl && this._ctrl.isSpacePaused()) {
      const a = 0.75 + 0.25 * Math.sin(this._t * 4);
      this._pill(ctx, '⏸ 已暂停 · 空格继续', this.w / 2, 92, {
        bg: 'rgba(6, 10, 26, 0.85)',
        border: `rgba(255, 209, 102, ${(0.5 * a).toFixed(3)})`,
        color: C.gold,
        size: 13,
      });
    }

    // 底部操作提示胶囊
    this._pill(ctx, '悬停子弹暂停时间 · 拖拽瞄准松开发射 · 右键引爆特殊弹 · 滚轮缩放 · 拖拽空白平移', this.w / 2, this.h - 24, {
      bg: 'rgba(3, 6, 15, 0.55)',
      border: 'rgba(139, 150, 184, 0.15)',
      color: 'rgba(233, 237, 247, 0.4)',
      size: 11,
    });

    // 退出按钮
    this._btn(ctx, '✕ 退出', 20, 14, 84, 32, () => this.goTo(Screen.LEVEL_SELECT), { primary: false, size: 12 });
  }

  // ========================
  // 结算界面
  // ========================
  _drawResult(ctx) {
    this._drawSpaceBg(ctx);
    const passed = this.gameData.passed;
    const cx = this.w / 2;
    const elapsed = (performance.now() - this._screenEnterAt) / 1000;

    // 面板背后的氛围光
    const glow = ctx.createRadialGradient(cx, this.h * 0.42, 0, cx, this.h * 0.42, 420);
    glow.addColorStop(0, passed ? 'rgba(79, 227, 212, 0.10)' : 'rgba(255, 93, 108, 0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);

    // ---- 星级（逐个弹出）----
    const stars = this.gameData.stars ?? (passed ? 3 : 0);
    const starY = this.h * 0.155;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 84;
      const filled = i < stars;
      let scale = 1;
      if (filled) {
        const p = clamp01((elapsed - 0.25 - i * 0.22) / 0.45);
        if (p <= 0) continue;
        scale = backOut(p);
      }
      this._drawStarShape(ctx, sx, starY, 30 * scale, filled, filled);
    }

    // ---- 标题 ----
    ctx.textAlign = 'center';
    ctx.save();
    if (passed) {
      const tg = ctx.createLinearGradient(cx - 100, 0, cx + 100, 0);
      tg.addColorStop(0, C.gold);
      tg.addColorStop(1, '#ffe9a8');
      ctx.fillStyle = tg;
      ctx.shadowColor = 'rgba(255, 209, 102, 0.35)';
    } else {
      ctx.fillStyle = C.red;
      ctx.shadowColor = 'rgba(255, 93, 108, 0.35)';
    }
    ctx.shadowBlur = 24;
    ctx.font = font('bold', 34);
    ctx.fillText(passed ? '任 务 完 成' : '任 务 失 败', cx, starY + 78);
    ctx.restore();

    // ---- 分数面板 ----
    const pw = 440, ph = 216;
    const px = cx - pw / 2, py = starY + 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = C.panel;
    this._roundRect(ctx, px, py, pw, ph, 16, true);
    ctx.restore();
    ctx.strokeStyle = C.panelBorder;
    ctx.lineWidth = 1;
    this._roundRect(ctx, px, py, pw, ph, 16, false);
    // 顶部高光线
    const hg = ctx.createLinearGradient(px, 0, px + pw, 0);
    hg.addColorStop(0, 'rgba(143, 252, 239, 0)');
    hg.addColorStop(0.5, 'rgba(143, 252, 239, 0.35)');
    hg.addColorStop(1, 'rgba(143, 252, 239, 0)');
    ctx.fillStyle = hg;
    ctx.fillRect(px + 20, py, pw - 40, 1);

    const items = [
      ['建筑毁伤', String(this.gameData.score), C.text],
      ['剩余子弹奖励', `+${this.gameData.bulletsRemaining * 100}`, C.green],
      ['摧毁敌人', `×${this.gameData.enemiesKilled}`, C.text],
    ];
    let iy = py + 42;
    for (const [label, val, color] of items) {
      ctx.fillStyle = C.sub;
      ctx.font = font('400', 15);
      ctx.textAlign = 'left';
      ctx.fillText(label, px + 36, iy);
      ctx.fillStyle = color;
      ctx.font = font('bold', 17, true);
      ctx.textAlign = 'right';
      ctx.fillText(val, px + pw - 36, iy);
      iy += 36;
    }
    // 分割线
    const dg = ctx.createLinearGradient(px + 30, 0, px + pw - 30, 0);
    dg.addColorStop(0, 'rgba(139, 150, 184, 0)');
    dg.addColorStop(0.5, 'rgba(139, 150, 184, 0.35)');
    dg.addColorStop(1, 'rgba(139, 150, 184, 0)');
    ctx.fillStyle = dg;
    ctx.fillRect(px + 30, iy - 12, pw - 60, 1);

    // 总分（滚动计数）
    const countP = easeOutCubic(clamp01((elapsed - 0.3) / 1.1));
    const shown = Math.round(this.gameData.totalScore * countP);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.sub;
    ctx.font = font('500', 13);
    ctx.fillText('总 分', cx, iy + 16);
    ctx.save();
    ctx.fillStyle = C.gold;
    ctx.shadowColor = C.goldDim;
    ctx.shadowBlur = 18;
    ctx.font = font('bold', 40, true);
    ctx.fillText(String(shown), cx, iy + 58);
    ctx.restore();

    // ---- 按钮 ----
    const btnW = 168, btnH = 44, btnY = py + ph + 28;
    if (passed) {
      this._btn(ctx, '↻ 重试', cx - btnW - 12, btnY, btnW, btnH, () => { if (this._onReplay) this._onReplay(); }, { primary: false });
      this._btn(ctx, '返回关卡列表', cx + 12, btnY, btnW, btnH, () => this.goTo(Screen.LEVEL_SELECT), { primary: false });

      const chapters = this.gameData.chapters || [];
      const ci = this.gameData.currentChapter || 0;
      const li = this.gameData.currentLevel || 0;
      const curChapterLevels = chapters[ci]?.levels?.length || 0;
      let hasNext = false;
      if (li + 1 < curChapterLevels) hasNext = true;
      else if (ci + 1 < chapters.length && (chapters[ci + 1]?.levels?.length || 0) > 0) hasNext = true;

      this._btn(ctx, hasNext ? '下一关 →' : '已是最后一关', cx - btnW - 12, btnY + btnH + 16, btnW * 2 + 24, btnH, () => {
        if (li + 1 < curChapterLevels) {
          this.gameData.currentLevel = li + 1;
        } else if (ci + 1 < chapters.length && (chapters[ci + 1]?.levels?.length || 0) > 0) {
          this.gameData.currentChapter = ci + 1;
          this.gameData.currentLevel = 0;
        } else {
          this.goTo(Screen.LEVEL_SELECT);
          return;
        }
        this.goTo(Screen.GAME_HUD);
      }, { primary: hasNext, size: 16 });
    } else {
      this._btn(ctx, '↻ 重试', cx - btnW / 2, btnY, btnW, btnH, () => { if (this._onReplay) this._onReplay(); }, { primary: true });
      this._btn(ctx, '返回关卡列表', cx - btnW / 2, btnY + btnH + 16, btnW, btnH, () => this.goTo(Screen.LEVEL_SELECT), { primary: false });
    }
  }

  // ========================
  // 游戏内浮层（供 main.js 调用）
  // ========================
  /**
   * 教程提示条 — "教程"徽章 + 文本 + 剩余时间进度条
   * @param {{text: string, alpha?: number, slide?: number, progress?: number}|string} hint
   *   alpha 淡入淡出透明度；slide 入场下滑量 0..1；progress 已展示时长占比 0..1
   */
  drawTutorialHint(hint) {
    const { text, alpha = 1, slide = 0, progress = 0 } = typeof hint === 'string' ? { text: hint } : hint;
    const ctx = this.ctx;
    // 空格暂停时下移，避开暂停指示胶囊（平滑过渡）
    const shiftTarget = this._ctrl && this._ctrl.isSpacePaused() ? 46 : 0;
    this._hintShift = (this._hintShift ?? 0) + (shiftTarget - (this._hintShift ?? 0)) * 0.18;
    const cy = 100 + this._hintShift - slide * 16;
    const h = 42, padX = 16, gap = 12;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 尺寸测量
    ctx.font = font('500', 14);
    const textW = ctx.measureText(text).width;
    ctx.font = font('bold', 11);
    const badgeW = ctx.measureText('教程').width + 18;
    const w = padX + badgeW + gap + textW + padX + 6;
    const x = this.w / 2 - w / 2, y = cy - h / 2;

    // 底板
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(6, 10, 26, 0.88)';
    this._roundRect(ctx, x, y, w, h, h / 2, true);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(79, 227, 212, 0.35)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, h / 2, false);

    // "教程" 徽章
    const bg = ctx.createLinearGradient(x + padX, 0, x + padX + badgeW, 0);
    bg.addColorStop(0, C.accent);
    bg.addColorStop(1, '#3bbfb2');
    ctx.fillStyle = bg;
    this._roundRect(ctx, x + padX, cy - 11, badgeW, 22, 11, true);
    ctx.fillStyle = C.btnText;
    ctx.font = font('bold', 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('教程', x + padX + badgeW / 2, cy + 1);

    // 提示文本
    ctx.fillStyle = C.text;
    ctx.font = font('500', 14);
    ctx.textAlign = 'left';
    ctx.fillText(text, x + padX + badgeW + gap, cy + 1);
    ctx.textBaseline = 'alphabetic';

    // 剩余时间进度条（贴底内侧）
    const bw = w - padX * 2;
    const pw = bw * (1 - clamp01(progress));
    if (pw > 1) {
      ctx.fillStyle = C.accentDim;
      this._roundRect(ctx, x + padX, y + h - 6, pw, 2.5, 1.25, true);
    }
    ctx.restore();
  }

  /** 结算沉淀倒计时 */
  drawSettleCountdown(remaining, total) {
    const ctx = this.ctx;
    const w = 300, h = 52;
    const x = this.w / 2 - w / 2, y = this.h - 118;
    ctx.fillStyle = 'rgba(6, 10, 26, 0.85)';
    this._roundRect(ctx, x, y, w, h, 12, true);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, 12, false);

    ctx.textAlign = 'left';
    ctx.fillStyle = C.sub;
    ctx.font = font('500', 13);
    ctx.fillText('局势沉淀中', x + 18, y + 23);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.gold;
    ctx.font = font('bold', 15, true);
    ctx.fillText(`${remaining.toFixed(1)}s`, x + w - 18, y + 24);

    // 进度条
    const bw = w - 36, bh = 4, bx = x + 18, by = y + h - 16;
    ctx.fillStyle = 'rgba(139, 150, 184, 0.18)';
    this._roundRect(ctx, bx, by, bw, bh, 2, true);
    const p = clamp01(1 - remaining / total);
    if (p > 0.01) {
      const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, C.gold);
      pg.addColorStop(1, '#ffe9a8');
      ctx.fillStyle = pg;
      this._roundRect(ctx, bx, by, bw * p, bh, 2, true);
    }
  }

  // ========================
  // 工具
  // ========================
  /** 悬停缓动值 0→1 */
  _hover(key, x, y, w, h) {
    const target = this._isOver(x, y, w, h) ? 1 : 0;
    const cur = this._hoverAnim[key] ?? 0;
    const next = cur + (target - cur) * Math.min(1, (this._dt || 0.016) * 14);
    this._hoverAnim[key] = next;
    return next;
  }

  _btn(ctx, text, x, y, w, h, action, opts = {}) {
    const { primary = true, size = 16, pulse = false } = opts;
    const hv = this._hover(`btn:${text}:${Math.round(x)}:${Math.round(y)}`, x, y, w, h);
    const r = Math.min(12, h / 2);

    ctx.save();
    if (primary) {
      const glow = 14 + hv * 16 + (pulse ? (Math.sin(this._t * 2.4) + 1) * 5 : 0);
      ctx.shadowColor = 'rgba(79, 227, 212, 0.55)';
      ctx.shadowBlur = glow;
      const bg = ctx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0, hv > 0 ? this._mix('#5ff0e0', '#8ffcef', hv) : '#5ff0e0');
      bg.addColorStop(1, '#2fae9f');
      ctx.fillStyle = bg;
      this._roundRect(ctx, x, y, w, h, r, true);
      ctx.restore();
      ctx.fillStyle = C.btnText;
    } else {
      ctx.restore();
      ctx.fillStyle = `rgba(79, 227, 212, ${(0.05 + hv * 0.12).toFixed(3)})`;
      this._roundRect(ctx, x, y, w, h, r, true);
      ctx.strokeStyle = `rgba(79, 227, 212, ${(0.45 + hv * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.2 + hv * 0.6;
      this._roundRect(ctx, x, y, w, h, r, false);
      ctx.fillStyle = hv > 0.4 ? C.accentBright : C.accent;
    }
    ctx.font = font('bold', size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    this.buttons.push({ x, y, w, h, action });
  }

  /** 居中文字胶囊，x/y 为胶囊中心 */
  _pill(ctx, text, cx, cy, opts = {}) {
    const { bg, border, color, size = 13, padX = 20, height = 32 } = opts;
    ctx.font = font('500', size);
    const tw = ctx.measureText(text).width;
    const w = tw + padX * 2;
    const x = cx - w / 2, y = cy - height / 2;
    if (bg) {
      ctx.fillStyle = bg;
      this._roundRect(ctx, x, y, w, height, height / 2, true);
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, w, height, height / 2, false);
    }
    ctx.fillStyle = color || C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  /** 五角星，filled=实心金色，glow=带光晕 */
  _drawStarShape(ctx, cx, cy, r, filled, glow = false) {
    if (r <= 0.1) return;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      if (glow) {
        ctx.shadowColor = 'rgba(255, 209, 102, 0.6)';
        ctx.shadowBlur = 18;
      }
      const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      g.addColorStop(0, '#ffe9a8');
      g.addColorStop(1, C.gold);
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(139, 150, 184, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  _mix(c1, c2, p) {
    const p1 = parseInt(c1.slice(1), 16), p2 = parseInt(c2.slice(1), 16);
    const r = Math.round(((p1 >> 16) & 255) * (1 - p) + ((p2 >> 16) & 255) * p);
    const g = Math.round(((p1 >> 8) & 255) * (1 - p) + ((p2 >> 8) & 255) * p);
    const b = Math.round((p1 & 255) * (1 - p) + (p2 & 255) * p);
    return `rgb(${r}, ${g}, ${b})`;
  }

  _isOver(x, y, w, h) {
    return this._mx >= x && this._mx <= x + w && this._my >= y && this._my <= y + h;
  }

  _roundRect(ctx, x, y, w, h, r, fill) {
    r = Math.min(r, w / 2, h / 2);
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

  // ========================
  // 状态切换
  // ========================
  goTo(screen) {
    this.screen = screen;
    this._mx = -1;
    this._my = -1;
    this._hoverAnim = {};
    this._screenEnterAt = performance.now();
  }
}
