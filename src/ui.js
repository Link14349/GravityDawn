/**
 * UI 管理器 — 界面状态机 + Canvas 绘制 + 按钮交互
 *
 * 四个界面：
 *   START       — 开始界面（标题 + 开始按钮）
 *   LEVEL_SELECT— 选关界面（关卡列表）
 *   GAME_HUD    — 游戏内 HUD（叠在游戏画面上方）
 *   RESULT      — 结算界面（分数明细 + 通关判定）
 */
import { getAllBest } from './storage.js';

export const Screen = Object.freeze({
  START: 'start',
  LEVEL_SELECT: 'levelSelect',
  GAME_HUD: 'gameHud',
  RESULT: 'result',
});

// 扁平鲜艳调色板
const C = {
  bg: '#0a0e27',
  panel: 'rgba(14, 20, 50, 0.92)',
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
  card: 'rgba(20, 28, 65, 0.8)',
  cardBorder: 'rgba(61, 214, 200, 0.2)',
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
    this._bindMouse();

    // 图片由外部预加载后注入
    this._bgImage = null;
    this._logoImage = null;

    // 游戏状态数据（供 HUD 和结算使用）
    this.gameData = {
      score: 0,
      totalScore: 0,
      bulletsRemaining: 3,
      buildingsDestroyed: 0,
      enemiesKilled: 0,
      stars: 0,
      passed: false,
      currentLevel: 1,
      totalLevels: 3,
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
  }

  // ========================
  // 开始界面
  // ========================
  _drawStart(ctx) {
    // 背景图
    if (this._bgImage) { ctx.drawImage(this._bgImage, 0, 0, this.w, this.h); }
    else { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, this.w, this.h); this._drawStars(ctx); }

    // Logo（白底去背）
    this._drawLogo(ctx);

    // Logo 用 HTML overlay (img/logo.png) 显示，canvas 只画下方内容

    // 开始按钮
    const bw = 220, bh = 56;
    this._btn(ctx, '开 始 游 戏', this.w / 2 - bw / 2, this.h * 0.62, bw, bh, () => this.goTo(Screen.LEVEL_SELECT), true);

    // Credits
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '12px Arial';
    ctx.fillText('制作人: Link14349 | 程序: Claude Code | 音乐美术: 待定', this.w / 2, this.h - 38);
    // 版本
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '11px monospace';
    ctx.fillText('v0.7 — Phase 7 Demo', this.w / 2, this.h - 20);
  }

  // ========================
  // 选关界面
  // ========================
  _drawLevelSelect(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this._drawStars(ctx);

    // 标题
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('选 择 关 卡', this.w / 2, 70);

    // 关卡卡片
    const cardsPerRow = 4;
    const cardW = 200, cardH = 130, gapX = 40, gapY = 30;
    const startX = (this.w - (cardsPerRow * cardW + (cardsPerRow - 1) * gapX)) / 2;
    const startY = 120;

    const levelNames = ['前哨站', '陨石带', '矿场废墟', '暗域哨塔', '能量枢纽', '雷蒙堡垒', '赤暗号'];

    for (let i = 0; i < this.gameData.totalLevels; i++) {
      const col = i % cardsPerRow;
      const row = Math.floor(i / cardsPerRow);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);
      const hovered = this._isOver(cx, cy, cardW, cardH);
      const locked = false; // demo 全部解锁

      // 卡片背景
      ctx.fillStyle = locked ? 'rgba(15, 20, 40, 0.6)' : C.card;
      ctx.strokeStyle = hovered && !locked ? C.accent : C.cardBorder;
      ctx.lineWidth = hovered && !locked ? 2 : 1;
      this._roundRect(ctx, cx, cy, cardW, cardH, 8, true);
      this._roundRect(ctx, cx, cy, cardW, cardH, 8, false);

      if (locked) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '40px Arial';
        ctx.fillText('🔒', cx + cardW / 2, cy + cardH / 2 + 5);
      } else {
        ctx.fillStyle = C.text;
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`第 ${i + 1} 关`, cx + cardW / 2, cy + 40);
        ctx.fillStyle = C.sub;
        ctx.font = 'bold 16px Arial';
        ctx.fillText(levelNames[i], cx + cardW / 2, cy + 68);
        let saved = null;
        try { saved = (getAllBest() || {})[i]; } catch(e) {}
        if (saved && saved.stars > 0) {
          ctx.fillStyle = C.gold;
          ctx.font = '13px Arial';
          ctx.fillText('★'.repeat(saved.stars) + '☆'.repeat(3 - saved.stars), cx + cardW / 2, cy + 85);
          ctx.fillStyle = C.sub;
          ctx.font = '10px monospace';
          ctx.fillText(`${saved.score || 0}分`, cx + cardW / 2, cy + 105);
        }

        if (hovered && !locked) {
          this.buttons.push({ x: cx, y: cy, w: cardW, h: cardH, action: () => { this.gameData.currentLevel = i + 1; this.goTo(Screen.GAME_HUD); } });
        }
      }
    }

    // 返回
    this._btn(ctx, '← 退出', 8, 7, 78, 28, () => this.goTo(Screen.START), false);
  }

  // ========================
  // 游戏 HUD
  // ========================
  _drawHUD(ctx) {
    // 半透明顶栏（透明底，游戏画面在下层）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, this.w, 44);

    // 关卡名（居中）
    const levelNames = ['前哨站', '陨石带', '矿场废墟', '暗域哨塔', '能量枢纽', '雷蒙堡垒', '赤暗号'];
    ctx.fillStyle = C.accent;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`第${this.gameData.currentLevel}关 · ${levelNames[this.gameData.currentLevel - 1]}`, this.w / 2, 30);

    // 分数 + 子弹
    ctx.fillStyle = C.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${this.gameData.score}`, this.w - 20, 20);
    ctx.fillText(`剩余子弹: ${this.gameData.bulletsRemaining}`, this.w - 20, 38);

    // 操作提示
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('鼠标悬停子弹 → 时间暂停 | 拖拽子弹（向后拉=向前射）→ 松开发射 | 滚轮缩放 | 空白处拖拽平移镜头', this.w / 2, this.h - 10);

    // 退出按钮（黑条内）
    this._btn(ctx, '← 退出', 8, 7, 78, 28, () => this.goTo(Screen.LEVEL_SELECT), false);
  }

  // ========================
  // 结算界面
  // ========================
  _drawResult(ctx) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this._drawStars(ctx);

    const passed = this.gameData.passed;
    const cx = this.w / 2;

    // 星级评价
    const stars = this.gameData.stars ?? (passed ? 3 : 0);
    const starY = this.h * 0.16;
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    ctx.fillStyle = C.gold;
    ctx.fillText(starStr, cx, starY);

    // 标题
    ctx.fillStyle = passed ? C.gold : C.red;
    ctx.font = 'bold 28px Arial';
    ctx.fillText(passed ? '任务完成' : '任务失败', cx, starY + 50);

    // 分数面板
    const pw = 400, ph = 180;
    const px = cx - pw / 2, py = starY + 70;
    ctx.fillStyle = C.panel;
    this._roundRect(ctx, px, py, pw, ph, 12, true);

    const items = [
      ['建筑毁伤', `${this.gameData.score}`],
      ['剩余子弹', `+${this.gameData.bulletsRemaining * 100}`],
      ['摧毁敌人', `${this.gameData.enemiesKilled}`],
    ];
    let iy = py + 30;
    for (const [label, val] of items) {
      ctx.fillStyle = C.sub; ctx.font = '16px Arial'; ctx.textAlign = 'left';
      ctx.fillText(label, px + 40, iy);
      ctx.fillStyle = C.text; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'right';
      ctx.fillText(val, px + pw - 40, iy);
      iy += 34;
    }
    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 30, iy); ctx.lineTo(px + pw - 30, iy); ctx.stroke();
    iy += 15;
    // 总分
    ctx.fillStyle = C.gold; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`总分  ${this.gameData.totalScore}`, cx, iy + 20);

    // 按钮
    const btnW = 160, btnH = 42, btnY = py + ph + 25;
    if (passed) {
      this._btn(ctx, '↻ 重试', cx - btnW - 10, btnY, btnW, btnH, () => { if (this._onReplay) this._onReplay(); }, false);
      this._btn(ctx, '返回关卡列表', cx + 10, btnY, btnW, btnH, () => this.goTo(Screen.LEVEL_SELECT), false);
    } else {
      this._btn(ctx, '↻ 重试', cx - btnW / 2, btnY, btnW, btnH, () => { if (this._onReplay) this._onReplay(); }, true);
      this._btn(ctx, '返回关卡列表', cx - btnW / 2, btnY + btnH + 15, btnW, btnH, () => this.goTo(Screen.LEVEL_SELECT), false);
    }

    // 下一关（宽按钮，实心）
    if (passed) {
      this._btn(ctx, '下一关 →', cx - btnW - 10, btnY + btnH + 15, btnW * 2 + 20, btnH, () => {
        if (this.gameData.currentLevel < this.gameData.totalLevels) { this.gameData.currentLevel++; this.goTo(Screen.GAME_HUD); }
      }, true);
    }
  }

  // ========================
  // 工具
  // ========================
  _btn(ctx, text, x, y, w, h, action, primary = true) {
    const hovered = this._isOver(x, y, w, h);
    if (primary) {
      ctx.fillStyle = hovered ? C.btnHover : C.btn;
      this._roundRect(ctx, x, y, w, h, 8, true);
      ctx.fillStyle = C.btnText;
    } else {
      ctx.fillStyle = 'transparent';
      ctx.strokeStyle = hovered ? C.btnHover : C.accent;
      ctx.lineWidth = 1.5;
      this._roundRect(ctx, x, y, w, h, 8, false);
      this._roundRect(ctx, x, y, w, h, 8, false);
      ctx.fillStyle = hovered ? C.btnHover : C.accent;
    }
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 6);
    this.buttons.push({ x, y, w, h, action });
  }

  _isOver(x, y, w, h) {
    return this._mx >= x && this._mx <= x + w && this._my >= y && this._my <= y + h;
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

  _drawStars(ctx) {
    for (let i = 0; i < 200; i++) {
      const sx = (i * 7919 + 123) % this.w;
      const sy = (i * 6271 + 456) % this.h;
      const sr = 0.5 + ((i * 3571) % 100) / 100 * 1.5;
      const sa = 0.3 + ((i * 4813) % 100) / 100 * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${sa})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ========================
  // 状态切换
  // ========================
  goTo(screen) {
    this.screen = screen;
    this._mx = -1; this._my = -1;
  }

  _drawLogo(ctx) {
    if (!this._logoImage) return;
    const lw = 768, lh = this._logoImage.height * (768 / this._logoImage.width);
    const lx = this.w / 2 - lw / 2, ly = this.h * 0.10;
    ctx.drawImage(this._logoImage, lx, ly, lw, lh);
  }
}
