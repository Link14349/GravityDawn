/**
 * 播片剧情系统 — CutsceneManager
 *
 * 类似明日方舟风格：全屏背景 + 左右人物立绘 + 底部对话文本框
 * 打字机效果，点击/空格/Enter 下一句，跳过按钮直接结束
 */

const CHAR_SPEED = 40;    // 打字速度（字/秒）
const FADE_DUR = 0.3;     // 背景淡入时间
const SLIDE_DUR = 0.2;    // 人物滑入时间

export class CutsceneManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} cutsceneData — 关卡的 cutscene 字段
   * @param {Function} onComplete — 播片结束回调
   */
  constructor(canvas, cutsceneData, onComplete) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.data = cutsceneData;
    this.onComplete = onComplete;

    // 状态
    this.sceneIdx = 0;
    this.charTimer = 0;        // 当前句打字进度
    this.charFull = false;     // 当前句是否完整显示
    this.transitionTimer = 0;  // 转场计时
    this.done = false;
    this.skipping = false;

    // 图片缓存
    this._images = {};         // key → HTMLImageElement
    this._loaded = false;

    // 场景状态
    this._currentBg = null;
    this._currentLeft = null;
    this._currentRight = null;
    this._prevBg = null;
    this._prevLeft = null;
    this._prevRight = null;

    // 按钮区域
    this._skipBtn = null;
    this._loadedCount = 0;
    this._totalCount = 0;
  }

  /** 开始播片（先预加载再渲染） */
  start() {
    this._preloadAssets();
  }

  /** 根据 key 解析背景图路径 */
  _bgPath(key) { return `img/bg/${key}.png`; }

  /** 根据 key:expression 解析人物图片路径，默认 default.png */
  _charPath(keyExpr) {
    if (!keyExpr) return null;
    const [key, expr] = keyExpr.split(':');
    const file = expr || 'default';
    return `img/char/${key}/${file}.png`;
  }

  /** 预加载所有图片 */
  _preloadAssets() {
    const assets = this.data.assets;
    const urls = new Set();

    // 背景图
    for (const key of Object.keys(assets.backgrounds || {})) {
      urls.add(this._bgPath(key));
    }

    // 人物图：预加载所有场景中出现的人物表达式
    for (const sc of this.data.scenes) {
      if (sc.left) { urls.add(this._charPath(sc.left)); urls.add(this._charPath(sc.left.split(':')[0])); }
      if (sc.right) { urls.add(this._charPath(sc.right)); urls.add(this._charPath(sc.right.split(':')[0])); }
    }

    this._totalCount = urls.size;
    if (this._totalCount === 0) {
      this._loaded = true;
      this._beginLoop();
      return;
    }

    for (const url of urls) {
      const img = new Image();
      img.onload = img.onerror = () => {
        this._loadedCount++;
        if (this._loadedCount >= this._totalCount) {
          this._loaded = true;
        }
      };
      img.src = url;
      this._images[url] = img;
    }

    setTimeout(() => { this._loaded = true; }, 1500);
    this._beginLoop();
  }

  _beginLoop() {
    // 先渲染一帧等加载
    const check = () => {
      if (this._loaded) {
        this._initScene();
        this._loop();
      } else {
        this._drawLoading();
        requestAnimationFrame(check);
      }
    };
    check();
  }

  _drawLoading() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('加载中...', this.w / 2, this.h / 2);
  }

  /** 初始化第一个场景 */
  _initScene() {
    const sc = this.data.scenes[this.sceneIdx];
    this._currentBg = sc.bg;
    this._currentLeft = sc.left;
    this._currentRight = sc.right;
    this._prevBg = null;
    this._prevLeft = null;
    this._prevRight = null;
    this.charTimer = 0;
    this.charFull = false;
    this.transitionTimer = 0;
  }

  /** 跳到下一句 */
  advance() {
    if (this.done) return;

    const sc = this.data.scenes[this.sceneIdx];
    if (!sc) return;

    // 当前句未播完 → 直接完整显示
    if (!this.charFull) {
      this.charFull = true;
      this.charTimer = (sc.dialogue?.text || '').length;
      return;
    }

    // 下一句
    this.sceneIdx++;
    if (this.sceneIdx >= this.data.scenes.length) {
      this.done = true;
      if (this.onComplete) this.onComplete();
      return;
    }

    const next = this.data.scenes[this.sceneIdx];

    // 记录上一帧状态用于转场
    this._prevBg = this._currentBg;
    this._prevLeft = this._currentLeft;
    this._prevRight = this._currentRight;
    this._currentBg = next.bg;
    this._currentLeft = next.left;
    this._currentRight = next.right;
    this.charTimer = 0;
    this.charFull = false;
    this.transitionTimer = 0;
  }

  /** 跳过全部播片 */
  skip() {
    this.skipping = true;
    this.done = true;
    if (this.onComplete) this.onComplete();
  }

  /** 主循环 */
  _loop() {
    if (this.done) return; // 播片结束，停止渲染循环

    const dt = 1 / 60;
    const sc = this.data.scenes[this.sceneIdx];
    if (!sc) return;

    // 打字机（无对话的场景直接标记完整）
    const dlgText = sc.dialogue?.text || '';
    if (!this.charFull) {
      if (!dlgText) {
        this.charFull = true;
      } else {
        this.charTimer += CHAR_SPEED * dt;
        if (this.charTimer >= dlgText.length) {
          this.charTimer = dlgText.length;
          this.charFull = true;
        }
      }
    }

    // 转场计时
    this.transitionTimer += dt;

    this._render(sc);
    requestAnimationFrame(() => this._loop());
  }

  /** 渲染一帧 */
  _render(sc) {
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    const hasDialogue = sc.dialogue && (sc.dialogue.text || sc.dialogue.speaker);

    ctx.clearRect(0, 0, w, h);

    // -- 背景 --
    const bgImg = this._getBgImage(sc.bg);
    const bgAlpha = Math.min(1, this.transitionTimer / FADE_DUR);
    if (bgImg) {
      ctx.globalAlpha = bgAlpha;
      this._drawBgImage(ctx, bgImg, w, h);
      if (this._prevBg && this._prevBg !== sc.bg && bgAlpha < 1) {
        ctx.globalAlpha = 1 - bgAlpha;
        const oldBg = this._getBgImage(this._prevBg);
        if (oldBg) this._drawBgImage(ctx, oldBg, w, h);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, w, h);
    }

    // -- 人物立绘 --
    const charY = h * 0.15;
    const charH = h * 0.75;
    const charW = w * 0.3;

    if (sc.left) {
      const sameLeft = sc.left === this._prevLeft;
      const leftAlpha = sameLeft ? 1 : Math.min(1, this.transitionTimer / SLIDE_DUR);
      const leftOffset = sameLeft ? 0 : (1 - leftAlpha) * 60;
      ctx.globalAlpha = leftAlpha;
      this._drawCharacter(ctx, sc.left, 20 + leftOffset, charY, charW, charH, true);
    } else if (this._prevLeft && this.transitionTimer < SLIDE_DUR) {
      ctx.globalAlpha = 1 - this.transitionTimer / SLIDE_DUR;
      this._drawCharacter(ctx, this._prevLeft, 20 + this.transitionTimer / SLIDE_DUR * 60, charY, charW, charH, true);
    }

    if (sc.right) {
      const sameRight = sc.right === this._prevRight;
      const rightAlpha = sameRight ? 1 : Math.min(1, this.transitionTimer / SLIDE_DUR);
      const rightOffset = sameRight ? 0 : (1 - rightAlpha) * 60;
      ctx.globalAlpha = rightAlpha;
      this._drawCharacter(ctx, sc.right, w - charW - 20 - rightOffset, charY, charW, charH);
    } else if (this._prevRight && this.transitionTimer < SLIDE_DUR) {
      ctx.globalAlpha = 1 - this.transitionTimer / SLIDE_DUR;
      this._drawCharacter(ctx, this._prevRight, w - charW - 20 - this.transitionTimer / SLIDE_DUR * 60, charY, charW, charH);
    }

    ctx.globalAlpha = 1;

    // -- 纯背景场景：只显示提示文字 --
    if (!hasDialogue) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('点击继续', w / 2, h - 30);
      this._drawSkipBtn(ctx, w, h);
      return;
    }

    // -- 对话框 --
    const dlgH = h * 0.22;
    const dlgY = h - dlgH - 10;
    const dlgPad = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeStyle = 'rgba(61, 214, 200, 0.3)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, dlgPad, dlgY, w - dlgPad * 2, dlgH, 12, true);
    this._roundRect(ctx, dlgPad, dlgY, w - dlgPad * 2, dlgH, 12, false);

    const nameX = dlgPad + 24;
    const nameY = dlgY + 28;
    if (sc.dialogue.speaker) {
      ctx.fillStyle = '#3dd6c8';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(sc.dialogue.speaker, nameX, nameY);
    }

    const visibleText = (sc.dialogue.text || '').substring(0, Math.floor(this.charTimer));
    const textX = nameX;
    const textY = nameY + 30;
    ctx.fillStyle = '#e8ecf4';
    ctx.font = '15px Arial';
    ctx.textAlign = 'left';
    this._wrapText(ctx, visibleText, textX, textY, w - dlgPad * 2 - 48, 22);

    if (this.charFull && this.sceneIdx < this.data.scenes.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('点击继续 ▼', w - dlgPad - 24, dlgY + dlgH - 16);
    }
    if (this.charFull && this.sceneIdx >= this.data.scenes.length - 1) {
      ctx.fillStyle = '#ffd93d';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('点击开始作战 ▶', w - dlgPad - 24, dlgY + dlgH - 16);
    }

    this._drawSkipBtn(ctx, w, h);
  }

  _drawSkipBtn(ctx, w, h) {
    const skipW = 80, skipH = 30;
    const skipX = w - skipW - 20, skipY = 20;
    const skipHover = this._inRect(this._mx, this._my, skipX, skipY, skipW, skipH);
    ctx.fillStyle = skipHover ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, skipX, skipY, skipW, skipH, 6, true);
    this._roundRect(ctx, skipX, skipY, skipW, skipH, 6, false);
    ctx.fillStyle = skipHover ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('跳过 ▶▶', skipX + skipW / 2, skipY + skipH / 2 + 5);
    this._skipBtn = { x: skipX, y: skipY, w: skipW, h: skipH };
  }

  /** 绘制背景图（等比例填充） */
  _drawBgImage(ctx, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /** 绘制人物立绘（底部对齐，左侧角色左右反转） */
  _drawCharacter(ctx, keyExpr, x, y, maxW, maxH, isLeft = false) {
    const url = this._charPath(keyExpr);
    if (!url) return;
    const img = this._images[url];
    if (!img) return;

    const scale = Math.min(maxW / img.width, maxH / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = x + (maxW - dw) / 2;
    const dy = y + maxH - dh;

    if (isLeft) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  }

  _getBgImage(bgKey) {
    const url = this._bgPath(bgKey);
    return url ? this._images[url] : null;
  }

  // ---- 交互接口 ----

  /** 鼠标移动更新 */
  onMouseMove(sx, sy) {
    this._mx = sx;
    this._my = sy;
  }

  /** 鼠标点击 */
  onClick(sx, sy) {
    if (this._skipBtn && this._inRect(sx, sy, this._skipBtn.x, this._skipBtn.y, this._skipBtn.w, this._skipBtn.h)) {
      this.skip();
      return true;
    }
    this.advance();
    return true;
  }

  /** 键盘事件 */
  onKeyDown(e) {
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      this.advance();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.skip();
    }
  }

  // ---- 工具 ----
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

  _wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text;
    let line = '';
    let cy = y;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      if (ctx.measureText(testLine).width > maxW && line.length > 0) {
        ctx.fillText(line, x, cy);
        line = words[i];
        cy += lineH;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }
}
