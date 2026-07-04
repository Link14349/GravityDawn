/**
 * 教程提示系统 — 队列化提示管理
 *
 * 解决旧实现的问题：
 *   - 多条提示同帧触发互相覆盖 → 队列逐条展示，条条可见
 *   - setTimeout 跨关卡串扰 → 全部由帧驱动，离开关卡即清空
 *   - 每进一关全部重放 → 同一会话内每条提示只展示一次
 *   - 暂停/瞄准时倒计时照走 → paused 时冻结，留给玩家阅读
 *
 * 由 main.js 在游戏循环中驱动：
 *   tut.reset(isTutorialChapter)  — 进关/离开关卡时
 *   tut.push(id, text, duration)  — 触发点随时调用，自动去重排队
 *   tut.update(dt, paused)        — 每帧推进
 *   tut.current()                 — {text, alpha, slide, progress} | null，交给 UIManager 绘制
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

const FADE_IN = 0.35;  // 入场时长 (s)
const FADE_OUT = 0.5;  // 退场时长 (s)
const GAP = 0.45;      // 两条提示之间的间隔 (s)

export class TutorialManager {
  constructor() {
    this._shown = new Set(); // 会话内已展示的提示 id
    this._queue = [];
    this._current = null;    // { id, text, duration, elapsed }
    this._gapLeft = 0;
    this._enabled = false;
    this._lastAt = performance.now();
  }

  /** 进入关卡时调用；enabled=false 清空队列并禁用（已展示记录保留） */
  reset(enabled) {
    this._enabled = enabled;
    this._queue.length = 0;
    this._current = null;
    this._gapLeft = 0;
    this._lastAt = performance.now();
  }

  /** 触发一条提示；同 id 一个会话只展示一次 */
  push(id, text, duration = 5) {
    if (!this._enabled || this._shown.has(id)) return;
    this._shown.add(id);
    this._queue.push({ id, text, duration });
  }

  /**
   * 每帧推进。用真实时钟计时（不随屏幕刷新率变化，120Hz 下时长不打折）。
   * paused=true（悬停瞄准/空格暂停）时当前提示不倒计时，
   * 但入场动画照常完成、新提示照常出队 —— 悬停触发的提示要立即可见。
   */
  update(paused = false) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastAt) / 1000);
    this._lastAt = now;
    if (this._current) {
      if (!paused || this._current.elapsed < FADE_IN) {
        this._current.elapsed += dt;
      }
      if (this._current.elapsed >= this._current.duration) {
        this._current = null;
        this._gapLeft = GAP;
      }
      return;
    }
    if (this._gapLeft > 0) {
      this._gapLeft -= dt;
      return;
    }
    if (this._queue.length > 0) {
      this._current = { ...this._queue.shift(), elapsed: 0 };
    }
  }

  /** 当前提示的展示状态；无提示时返回 null */
  current() {
    const c = this._current;
    if (!c) return null;
    const tIn = clamp01(c.elapsed / FADE_IN);
    const tOut = clamp01((c.duration - c.elapsed) / FADE_OUT);
    return {
      text: c.text,
      alpha: Math.min(easeOutCubic(tIn), tOut),
      slide: 1 - easeOutCubic(tIn),
      progress: clamp01(c.elapsed / c.duration),
    };
  }
}
