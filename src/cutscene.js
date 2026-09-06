/** Scientific mission transmissions. Accepts legacy dialogue scenes as well. */
import { orbitDiagram } from './ui-diagrams.js';
import { escapeHTML } from './ui.js';
import gravityDawnMark from '../img/gravity-dawn-mark.png';

export class CutsceneManager {
  constructor(canvas, cutsceneData, onComplete) {
    this.canvas = canvas; this.data = cutsceneData; this.onComplete = onComplete;
    this.sceneIdx = 0; this.done = false; this.charFull = false; this.charTimer = 0;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  start() {
    if (!this.data.scenes?.length) { this.skip(); return; }
    this.root = document.createElement('section');
    this.root.className = 'briefing';
    this.root.setAttribute('aria-label', '任务简报');
    this.canvas.parentElement.appendChild(this.root);
    this.root.addEventListener('click', e => {
      if (e.target.closest('[data-skip]')) this.skip();
      else if (e.target.closest('[data-advance]')) this.advance();
    });
    this._showScene();
    this._lastAt = performance.now();
    this._loop();
  }
  _showScene() {
    const sc = this.data.scenes[this.sceneIdx];
    this.charTimer = 0; this.charFull = this._reducedMotion;
    this._text = sc.dialogue?.text || sc.text || '';
    this.root.innerHTML = `<header class="briefing-header"><span class="wordmark"><img class="brand-logo" src="${gravityDawnMark}" alt="" width="44" height="44"> 引力破晓</span><span class="mono">接收传讯 / ${String(this.sceneIdx + 1).padStart(2, '0')}</span><button class="button" data-skip>跳过简报 ↗</button></header><main class="briefing-main"><div class="briefing-diagram"><span class="mono">任务空间 / 轨道示意</span>${orbitDiagram('briefing', this.sceneIdx)}<span class="mono">${escapeHTML(sc.equation || this.data.equation || 'Δv = vₑ ln(m₀ / m₁)')}</span></div><section class="briefing-copy"><div class="eyebrow">${escapeHTML(this.data.kicker || '轨道动力学研究部 / 观测笔记')}</div><h1>${escapeHTML(sc.title || this.data.title || '新的轨迹。')}</h1><h2>${escapeHTML(sc.dialogue?.speaker || '任务控制中心')}</h2><p class="briefing-dialogue" aria-label="${escapeHTML(this._text)}"></p><div class="briefing-steps" aria-label="第 ${this.sceneIdx + 1} / ${this.data.scenes.length} 页">${this.data.scenes.map((_, i) => `<span class="${i <= this.sceneIdx ? 'active' : ''}"></span>`).join('')}</div></section></main><footer class="briefing-footer"><span class="mono">回车 / 继续 · Esc / 跳过<br><br>简报 ${this.sceneIdx + 1} / ${this.data.scenes.length}</span><button class="button primary" data-advance>${this.sceneIdx + 1 === this.data.scenes.length ? '开始实验 ↗' : '继续阅读 →'}</button></footer>`;
    this._dialogue = this.root.querySelector('.briefing-dialogue');
    this._dialogue.textContent = this.charFull ? this._text : '';
    this.root.querySelector('[data-advance]').focus({ preventScroll: true });
  }
  _loop() {
    if (this.done) return;
    const now = performance.now(), dt = Math.min(.1, (now - this._lastAt) / 1000);
    this._lastAt = now;
    if (!this.charFull) {
      this.charTimer += dt * 65;
      this._dialogue.textContent = this._text.slice(0, Math.floor(this.charTimer));
      if (this.charTimer >= this._text.length) this.charFull = true;
    }
    this._frame = requestAnimationFrame(() => this._loop());
  }
  advance() {
    if (this.done) return;
    if (!this.charFull) { this.charFull = true; this._dialogue.textContent = this._text; return; }
    if (++this.sceneIdx >= this.data.scenes.length) this.skip();
    else this._showScene();
  }
  skip() {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this._frame);
    this.root?.remove();
    this.onComplete?.();
  }
  onClick() { this.advance(); return true; }
  onMouseMove() {}
  onKeyDown(e) {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.advance(); }
    if (e.key === 'Escape') { e.preventDefault(); this.skip(); }
  }
}
