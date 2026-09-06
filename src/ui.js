/** Semantic interface layered over the physics canvas. */
import { getAllBest } from './storage.js';
import { orbitDiagram, missionDiagram } from './ui-diagrams.js';
import { LevelManager } from './level.js';
import gravityDawnMark from '../img/gravity-dawn-mark.png';
import './css/style.css';

export const Screen = Object.freeze({ START: 'start', LEVEL_SELECT: 'levelSelect', CUTSCENE: 'cutscene', GAME_HUD: 'gameHud', RESULT: 'result' });
export const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const button = (action, label, primary = false, extra = '') => `<button class="button ${primary ? 'primary' : ''}" data-action="${action}" ${extra}>${label}</button>`;

export class UIManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width; this.h = canvas.height;
    this.screen = Screen.START;
    this.buttons = [];
    this.gameData = { score: 0, totalScore: 0, bulletsRemaining: 0, enemiesKilled: 0, stars: 0, passed: false, currentChapter: 0, currentLevel: 0, chapters: [] };
    this.root = document.createElement('div');
    this.root.id = 'interface';
    canvas.parentElement.appendChild(this.root);
    this.root.addEventListener('click', e => {
      const target = e.target.closest('[data-action]');
      if (target && !target.disabled) this._act(target.dataset.action, target.dataset);
    });
    this._keyHandler = e => {
      if (e.key === 'Escape') {
        if (this.root.querySelector('.help-dialog')) { this.root.querySelector('.help-dialog').remove(); return; }
        if (this.screen === Screen.LEVEL_SELECT) this.goTo(Screen.START);
        else if (this.screen === Screen.GAME_HUD) this._act('pause');
      }
      if (this.screen === Screen.GAME_HUD && !e.repeat) {
        if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) this._act('retry');
        if (e.key.toLowerCase() === 'h') this._act('guide');
        if (e.key.toLowerCase() === 'f') this._act('focus');
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  _act(action, data = {}) {
    if (action === 'home') this.goTo(Screen.START);
    if (action === 'missions') this.goTo(Screen.LEVEL_SELECT);
    if (action === 'chapter') {
      const scrollTop = this.root.querySelector('.sector-sidebar nav')?.scrollTop || 0;
      this.gameData.currentChapter = Number(data.chapter);
      this._draw();
      const nav = this.root.querySelector('.sector-sidebar nav');
      if (nav) {
        nav.scrollTop = scrollTop;
        nav.querySelector('.selected')?.focus({ preventScroll: true });
      }
    }
    if (action === 'play') { this.gameData.currentLevel = Number(data.level); this.goTo(Screen.GAME_HUD); }
    if (action === 'continue') {
      const best = getAllBest();
      let next = null;
      this.gameData.chapters.forEach((ch, ci) => ch.levels.forEach((lv, li) => {
        if (!next && !(best[`c${ci}-l${li}`]?.stars > 0)) next = [ci, li];
      }));
      [this.gameData.currentChapter, this.gameData.currentLevel] = next || [0, 0];
      this.goTo(Screen.GAME_HUD);
    }
    if (action === 'retry' && this._onReplay) this._onReplay();
    if (action === 'focus' && this._onFocus) this._onFocus();
    if (action === 'pause' && this._ctrl) { this._ctrl._spacePaused = !this._ctrl._spacePaused; this._updateHUD(); }
    if (action === 'speed' && this._ctrl) { this._ctrl.cycleTimeScale(); this._updateHUD(); }
    if (action === 'guide') { this._guideOpen = !this._guideOpen; this._updateHUD(); }
    if (action === 'help') this._showHelp();
    if (action === 'close-help') this.root.querySelector('.help-dialog')?.remove();
    if (action === 'next') {
      const d = this.gameData;
      if (d.currentLevel + 1 < d.chapters[d.currentChapter].levels.length) d.currentLevel++;
      else if (d.currentChapter + 1 < d.chapters.length) { d.currentChapter++; d.currentLevel = 0; }
      else { this.goTo(Screen.LEVEL_SELECT); return; }
      this.goTo(Screen.GAME_HUD);
    }
  }

  _header(section) {
    return `<header class="masthead"><button class="wordmark" data-action="home" aria-label="引力破晓首页"><img class="brand-logo" src="${gravityDawnMark}" alt="" width="44" height="44"> 引力破晓<span class="brand-divider"></span><span class="mono brand-sub">轨道动力学研究部</span></button><span class="mono section-label">${section}</span>${button('help', '飞行手册 ↗')}</header>`;
  }
  _footer() { return '<footer class="page-footer mono"><span>引力破晓 / 飞行动力学实验室</span><span>观测 · 预测 · 拦截</span><span><i class="status-dot"></i> 系统运行正常</span></footer>'; }
  _level() { return this.gameData.chapters[this.gameData.currentChapter]?.levels[this.gameData.currentLevel] || {}; }

  render() {
    if (this._renderedScreen !== this.screen) this._draw();
    if (this.screen === Screen.GAME_HUD) this._updateHUD();
  }

  _draw() {
    this._renderedScreen = this.screen;
    this.root.className = this.screen === Screen.GAME_HUD ? 'flight-interface' : 'page-interface';
    this.root.hidden = this.screen === Screen.CUTSCENE;
    this.canvas.style.visibility = this.screen === Screen.GAME_HUD ? 'visible' : 'hidden';
    if (this.screen === Screen.START) this._drawStart();
    if (this.screen === Screen.LEVEL_SELECT) this._drawLevelSelect();
    if (this.screen === Screen.GAME_HUD) this._drawHUD();
    if (this.screen === Screen.RESULT) this._drawResult();
    if (this.screen === Screen.CUTSCENE) this.root.innerHTML = '';
  }

  _drawStart() {
    const chapters = this.gameData.chapters;
    const count = chapters.reduce((n, c) => n + c.levels.length, 0);
    const complete = Object.values(getAllBest()).filter(v => v.stars > 0).length;
    this.root.innerHTML = `<main class="home-layout"><section class="hero-copy"><img class="hero-logo" src="${gravityDawnMark}" alt="" width="1254" height="1254">
      <h1>引力破晓</h1>
      <div class="hero-actions">${button('continue', complete ? '继续远征 <span>↗</span>' : '开始远征 <span>↗</span>', true)}${button('missions', '探索关卡 <span>→</span>')}</div>
      <div class="hero-specs"><div><strong>${pad(count)}</strong><span>实验关卡</span></div><div><strong>${pad(chapters.length)}</strong><span>研究章节</span></div><div><strong>Δv</strong><span>你的控制变量</span></div></div>
      <div class="hero-note mono">01 / 微小的改变，无限的可能。</div></section>
      <section class="hero-figure" aria-label="轨道转移示意图"><div class="figure-top mono"><span>图 01 / 轨道转移</span><span>轨道示意 <i class="status-dot"></i></span></div>${orbitDiagram('hero')}<div class="figure-caption"><span class="mono">F = G · m₁m₂ / r²</span><span>引力是工具，<br>而你是变量。</span></div></section></main>
      ${this._footer()}`;
  }

  _drawLevelSelect() {
    const d = this.gameData, best = getAllBest(), ch = d.chapters[d.currentChapter];
    if (!ch) return;
    const total = d.chapters.reduce((n, c) => n + c.levels.length, 0);
    const completed = Object.values(best).filter(v => v.stars > 0).length;
    this.root.innerHTML = `${this._header('任务档案')}
      <main class="archive-layout"><aside class="sector-sidebar"><div class="eyebrow">远征记录</div><h1>选择你的<br>下一条轨迹。</h1><p>从一个原理开始，<br>直到掌握整个星系。</p>
      <nav aria-label="研究章节">${d.chapters.map((c, i) => `<button class="sector ${i === d.currentChapter ? 'selected' : ''}" data-action="chapter" data-chapter="${i}" aria-pressed="${i === d.currentChapter}"><span class="mono">${pad(i + 1)}</span><span>${escapeHTML(c.name)}<small>${c.levels.filter((l, j) => best[`c${i}-l${j}`]?.stars > 0).length} / ${pad(c.levels.length)} 已完成</small></span><span>↗</span></button>`).join('')}</nav>
      <div class="archive-progress"><span class="mono">远征进度</span><strong>${pad(completed)} <small>/ ${total}</small></strong><progress max="${total || 1}" value="${completed}"></progress></div></aside>
      <section class="mission-section"><div class="mission-heading"><div><div class="eyebrow">第 ${pad(d.currentChapter + 1)} 章 / ${escapeHTML(ch.subtitle || '飞行实验')}</div><h2>${escapeHTML(ch.name)}</h2><p>${escapeHTML(ch.description || '观察引力场，规划路线，摧毁所有标记目标。')}</p></div><span class="mono mission-count">${pad(ch.levels.length)} 个关卡</span></div>
      <div class="mission-grid">${ch.levels.map((lv, li) => { const saved = best[`c${d.currentChapter}-l${li}`]; return `<button class="mission-card ${saved?.stars ? 'completed' : ''}" data-action="play" data-level="${li}"><div class="card-top mono"><span>实验 ${pad(li + 1)}</span><span>${saved?.stars ? '已完成 ✓' : `${pad(lv.difficulty || li + 1)} / 难度`}</span></div><div class="mini-plot">${missionDiagram(LevelManager.load(lv))}</div><div class="card-title"><h3>${escapeHTML(lv.name)}</h3><span>↗</span></div><p>${escapeHTML(lv.skill || lv.guidance?.title || '轨道拦截')}</p><div class="card-bottom"><span aria-label="${saved?.stars || 0} / 3 星" class="stars">${[0, 1, 2].map(i => `<span class="${i < (saved?.stars || 0) ? 'earned' : ''}">✦</span>`).join('')}</span><span class="mono">${saved?.stars ? `${saved.score} 分` : `${lv.bullets?.length || 0} 枚弹体`}</span></div></button>`; }).join('')}</div>
      <p class="mission-footnote mono">所有关卡均可体验 · 建议按章节与编号顺序，逐步掌握新技巧</p></section></main>${this._footer()}`;
  }

  _drawHUD() {
    const lv = this._level(), d = this.gameData;
    this._guideOpen = true;
    this.root.innerHTML = `<header class="flight-top"><div class="flight-title">${button('missions', '← 关卡')}<div><span class="mono">第 ${pad(d.currentChapter + 1)} 章 / 实验 ${pad(d.currentLevel + 1)}</span><h1>${escapeHTML(lv.name)}</h1></div></div><div class="flight-metrics"><div><span>剩余目标</span><strong id="hud-targets">—</strong></div><div><span>待发弹体</span><strong id="hud-probes">—</strong></div><div><span>得分</span><strong id="hud-score">0</strong></div></div></header>
      <aside class="objective-panel"><div class="eyebrow">任务目标</div><p>${escapeHTML(lv.objective || '摧毁所有标记目标，并达到分数与毁伤要求。')}</p><small id="hud-requirements"></small></aside>
      <nav class="flight-tools" aria-label="飞行控制">${button('pause', 'Ⅱ 暂停 <kbd>空格</kbd>')}${button('speed', '时间加速 <span id="time-scale">1×</span>', false, 'title="每次点击增加 1 倍，10 倍后回到 1 倍"')}${button('retry', '↻ 重试 <kbd>R</kbd>')}${button('focus', '⊕ 复位 <kbd>F</kbd>')}${button('guide', '? 引导 <kbd>H</kbd>')}</nav>
      <div class="pause-overlay" id="pause-overlay" hidden><span class="eyebrow">模拟已暂停</span><h2>慢慢来，时间由你掌控。</h2><p>观察战场，想好下一步，再继续飞行。</p>${button('pause', '继续飞行 →', true)}</div>
      <aside class="guidance-panel" id="guidance-panel"><span class="eyebrow">飞行笔记 / ${escapeHTML(lv.guidance?.title || '基础操作')}</span><p>${escapeHTML(lv.guidance?.text || '悬停弹体即可暂停时间。向目标的反方向拖拽，松手发射；虚线显示预测轨迹。')}</p><span class="guide-detail">${escapeHTML(lv.guidance?.hint || '预留燃料以便中途修正。拖得越远，燃料消耗越大，剩余爆炸威力越小。')}</span></aside>
      <div id="probe-telemetry" class="probe-telemetry" hidden></div><div id="tutorial-hint" class="tutorial-hint" role="status" hidden></div><div id="settle-status" class="settle-status" role="status" hidden></div>
      <footer class="flight-footer mono"><span><i class="status-dot"></i> <span id="flight-state">模拟运行中</span></span><span>悬停 / 暂停时间 <b>·</b> 拖拽松手 / 点火 <b>·</b> 滚轮 / 缩放</span><span id="flight-time">时间 + 00.0 s</span></footer>`;
  }

  _updateHUD() {
    const d = this.gameData;
    this._text('hud-score', Math.round(d.score)); this._text('hud-probes', pad(d.bulletsRemaining));
    this._text('hud-targets', `${d.importantRemaining ?? '—'} / ${d.importantTotal ?? '—'}`);
    const wc = this._level().winCondition || {};
    this._text('hud-requirements', `得分 ≥ ${wc.minScore || 0}${wc.destructionThreshold ? ` · 毁伤 ≥ ${Math.round(wc.destructionThreshold * 100)}%` : ''}${wc.parShots != null ? ` · 三星：≤${wc.parShots} 枚，Δv≤${wc.parDeltaV}` : ''}`);
    this._text('flight-time', `时间 + ${(d.time || 0).toFixed(1)} s`);
    this._text('time-scale', `${this._ctrl?.timeScale || 1}×`);
    const paused = !!this._ctrl?.isSpacePaused();
    this.root.querySelector('#pause-overlay').hidden = !paused;
    this.root.querySelector('#guidance-panel').hidden = !this._guideOpen;
    this._text('flight-state', paused ? '模拟已暂停' : this._ctrl?.shouldPause() ? '轨迹规划中' : '模拟运行中');
    const probe = this._ctrl?.getHoveredBullet(), node = this.root.querySelector('#probe-telemetry');
    node.hidden = !probe;
    if (probe) {
      const burn = this._ctrl?.getBurnPreview();
      const text = `${probe.typeName} / Δv ${probe.remainingDeltaV.toFixed(0)} · 点火 ${probe.remainingIgnitions} · 燃料 ${Math.round(probe.initialFuelMass > 0 ? probe.fuelMass / probe.initialFuelMass * 100 : 0)}%${probe.onImpact && probe.launched ? ' · 右键 / 触发' : ''}${burn ? ` · 本次 Δv ${burn.deltaV.toFixed(0)} · 点火后燃料 ${Math.round(burn.fuelRatio * 100)}%` : ''}`;
      if (node.textContent !== text) node.textContent = text;
    }
    const settle = this.root.querySelector('#settle-status');
    if (settle && performance.now() - (this._settleAt || 0) > 100) settle.hidden = true;
  }

  _drawResult() {
    const d = this.gameData, lv = this._level();
    this.root.innerHTML = `${this._header('实验报告')}<main class="result-layout"><section class="result-figure">${orbitDiagram('result')}<span class="mono">飞行记录 / ${pad(d.currentChapter + 1)}.${pad(d.currentLevel + 1)}</span></section><section class="result-copy"><div class="eyebrow">${d.passed ? '拦截确认' : '轨迹复盘'}</div><h1>${d.passed ? '一次漂亮的<br>精准拦截。' : '每一次尝试，<br>都有新的发现。'}</h1><p>${escapeHTML(lv.name)} ${d.passed ? '——实验完成。' : '——调整思路，再试一次。'}</p><div class="result-stars" aria-label="${d.stars} / 3 星">${[0, 1, 2].map(i => `<span class="${i < d.stars ? 'earned' : ''}">✦</span>`).join('')}</div><dl class="result-stats"><div><dt>本次得分</dt><dd>${Math.round(d.totalScore)}</dd></div><div><dt>保留弹体</dt><dd>${pad(d.bulletsRemaining)}</dd></div><div><dt>剩余目标</dt><dd>${d.importantRemaining ?? 0}</dd></div></dl><p class="result-note">${escapeHTML(d.passed ? '优化路线，争取三星；也可以继续远征，迎接下一项实验。' : lv.guidance?.hint || '参考预测轨迹，预留燃料，必要时进行二次点火修正。')}</p><div class="result-actions">${d.passed ? button('next', this._hasNext() ? '下一个实验 →' : '远征完成 →', true) : button('retry', '换一条轨迹 ↗', true)}${d.passed ? button('retry', '再次挑战') : ''}${button('missions', '任务档案')}</div></section></main>${this._footer()}`;
  }
  _hasNext() { const d = this.gameData; return d.currentLevel + 1 < (d.chapters[d.currentChapter]?.levels.length || 0) || d.currentChapter + 1 < d.chapters.length; }
  _text(id, value) { const el = this.root.querySelector(`#${id}`); if (el && el.textContent !== String(value)) el.textContent = value; }
  _showHelp() {
    if (this.root.querySelector('.help-dialog')) return;
    this.root.insertAdjacentHTML('beforeend', `<div class="help-dialog" role="dialog" aria-modal="true" aria-label="飞行手册"><section><div class="eyebrow">飞行手册 / 第二版</div><h2>用轨迹思考。</h2><dl><div><dt>悬停弹体</dt><dd>暂停模拟，查看剩余燃料和点火次数。</dd></div><div><dt>反向拖拽，松手发射</dt><dd>像弹弓一样操作：加速方向与拖拽方向相反。</dd></div><div><dt>在飞行中修正</dt><dd>只要还有燃料与点火次数，就能再次悬停、拖拽，调整轨道。</dd></div><div><dt>特殊弹体</dt><dd>在飞行途中右键点击特殊弹体，可以主动触发它的效果。</dd></div><div><dt>空格 · R · F · H</dt><dd>分别对应暂停、重试、镜头复位、切换引导。拖拽空白处平移镜头，滚轮缩放。</dd></div></dl><p>更大的推力消耗更多燃料，剩余燃料决定爆炸威力。通关需要同时满足标记目标、分数与毁伤要求。</p>${button('close-help', '明白了 →', true)}</section></div>`);
    this.root.querySelector('[data-action="close-help"]').focus();
  }
  drawTutorialHint(hint) {
    const node = this.root.querySelector('#tutorial-hint');
    if (!node) return;
    node.hidden = !hint;
    if (hint) { node.textContent = typeof hint === 'string' ? hint : hint.text; node.style.opacity = hint.alpha ?? 1; }
  }
  drawSettleCountdown(remaining) {
    const node = this.root.querySelector('#settle-status');
    if (node) { node.hidden = false; node.textContent = `正在分析结果 / ${remaining.toFixed(1)} s`; this._settleAt = performance.now(); }
  }
  goTo(screen) {
    this.screen = screen;
    this._draw();
  }
}
