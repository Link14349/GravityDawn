/**
 * 引力破晓 — 主游戏入口
 */
import { LevelManager } from './level.js';
import { Renderer } from './renderer.js';
import { GameController } from './game-controller.js';
import { Camera } from './camera.js';
import { UIManager, Screen } from './ui.js';
import { CutsceneManager } from './cutscene.js';
import { TutorialManager } from './tutorial.js';
import { saveLevel, configureProgress } from './storage.js';
import { FlightSimulation } from './flight-simulation.js';

// ============================================================
// 关卡加载 — 分章节分文件
// ============================================================
  let CHAPTERS;
  const chaptersReady = import(/* webpackChunkName: "campaign" */ './campaign-data.js').then(module => {
    CHAPTERS = module.CHAPTERS;
    configureProgress(CHAPTERS);
  });

  function getLevelData(chapterIdx, levelIdx) {
    return CHAPTERS[chapterIdx].levels[levelIdx];
  }

  function getLevelWinCondition(chapterIdx, levelIdx) {
    return getLevelData(chapterIdx, levelIdx).winCondition;
  }

// ============================================================
// 游戏初始化
// ============================================================
export async function initGame() {
  try { await chaptersReady; }
  catch (error) {
    const message = document.createElement('p');
    message.textContent = '关卡加载失败，请刷新页面重试。';
    document.body.appendChild(message);
    console.error(error);
    return;
  }
  document.getElementById('loading-message')?.remove();
  const canvas = document.getElementById('c');
  canvas.width = 1200; canvas.height = 800;
  const BULLET_R = 6;
  const SETTLE_DURATION = 5;
  const ui = new UIManager(canvas);
  const r = new Renderer(canvas);
  const ctx = r.ctx;

  // 传给 UI 的章节数据
  ui.gameData.chapters = CHAPTERS;
  ui.gameData.currentChapter = 0;
  ui.gameData.currentLevel = 0;

  // 教程提示系统（队列化，会话内去重）
  const tut = new TutorialManager();
  // 悬停某类型子弹时的教学文案
  const TYPE_HINTS = {
    normal: '普通弹 — 均衡的爆炸伤害，适合清理集中的结构',
    kinetic: '动能弹 — 无爆炸，靠高 HP 和动能硬穿透多层目标',
    explosive: '爆炸弹 — 剩余燃料决定爆炸范围，飞行途中右键可提前引爆',
    agile: '机动弹 — 可多次点火修正，具体燃料与点火余量请看弹体面板',
    cluster: '分裂弹 — 撞击后分裂出 3 颗小子弹',
    gravity: '引力弹 — 撞击点生成 3 秒临时引力阱，可弯折其他子弹的轨道',
    incendiary: '燃烧弹 — 灼烧弹簧结构，持续降低其断裂阈值',
  };

  // 游戏状态
  let stars, planets, allBodies, bullets, buildings, physics, camera, orbits;
  let cam, ctrl, physicsTime, explosions, settling, settleTimer, gameActive;
  let currentChapter = 0, currentLevel = 0;
  let tempGravityWells = [];
  let simulation = null;
  let cutsceneMgr = null; // 播片管理器

  function startLevel(chapterIdx, levelIdx, skipCutscene = false) {
    currentChapter = chapterIdx;
    currentLevel = levelIdx;
    const levelData = getLevelData(chapterIdx, levelIdx);
    const loaded = LevelManager.load(levelData);
    simulation = new FlightSimulation(loaded);
    ({ stars, planets, allBodies, bullets, buildings, physics, camera, orbits } = loaded);
    if (!cam) {
      cam = new Camera(canvas, { shouldBlockPan: () => false });
    }
    cam._panning = false;
    cam.x = camera.x; cam.y = camera.y; cam.zoom = camera.zoom;
    if (ctrl) ctrl.destroy();
    ctrl = new GameController(canvas, { physics, bullets, camera: cam, getTime: () => physicsTime, buildings, predictionSteps: levelData.flightTimeout ? levelData.flightTimeout * 60 : 800 });
    cam.enabled = true;
    cam._shouldBlockPan = () => ctrl && ctrl.getHoveredBullet() !== null;
    physicsTime = 0;
    explosions = simulation.explosions;
    tempGravityWells = simulation.tempGravityWells;
    settling = false; settleTimer = 0; gameActive = false;
    for (const b of bullets) b._trail = [];
    ui._ctrl = ctrl;
    ui.gameData.currentChapter = chapterIdx;
    ui.gameData.currentLevel = levelIdx;
    // 检查是否有播片（重试时跳过）
    if (!skipCutscene && levelData.cutscene && levelData.cutscene.scenes && levelData.cutscene.scenes.length > 0) {
      cutsceneMgr = new CutsceneManager(canvas, levelData.cutscene, () => {
        // 播片结束 → 进入关卡
        cutsceneMgr = null;
        _setupLevel(chapterIdx);
        ctrl.enabled = true; cam.enabled = true;
        ui.goTo(Screen.GAME_HUD);
      });
      ctrl.enabled = false; cam.enabled = false;
      cutsceneMgr.start();
      ui.goTo(Screen.CUTSCENE);
    } else {
      _setupLevel(chapterIdx);
      ui.goTo(Screen.GAME_HUD);
    }
  }

  function _setupLevel(chapterIdx) {
    tut.reset(true);
    const level = getLevelData(chapterIdx, currentLevel);
    if (level.guidance) {
      tut.push(`mission:${level.id}`, level.guidance.text, 8);
    }
  }

  // 回调
  ui._onReplay = () => startLevel(currentChapter, currentLevel, true);
  ui._onFocus = () => { if (cam && camera) { cam.x = camera.x; cam.y = camera.y; cam.zoom = camera.zoom; } };

  // 播片事件转发
  canvas.addEventListener('click', (e) => {
    if (ui.screen === Screen.CUTSCENE && cutsceneMgr) {
      const rect = canvas.getBoundingClientRect();
      cutsceneMgr.onClick(e.clientX - rect.left, e.clientY - rect.top);
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (ui.screen === Screen.CUTSCENE && cutsceneMgr) {
      const rect = canvas.getBoundingClientRect();
      cutsceneMgr.onMouseMove(e.clientX - rect.left, e.clientY - rect.top);
    }
  });
  window.addEventListener('keydown', (e) => {
    if (ui.screen === Screen.CUTSCENE && cutsceneMgr) {
      cutsceneMgr.onKeyDown(e);
    }
  });

  // ============================================================
  // 主循环
  // ============================================================
  // 退出关卡时销毁，重新进入时重建
  const _origGoTo = ui.goTo.bind(ui);
  ui.goTo = (screen) => {
    // 离开关卡时销毁运行时（播片不算离开）
    if (ui.screen === Screen.GAME_HUD && screen !== Screen.GAME_HUD && screen !== Screen.CUTSCENE) {
      if (ctrl) ctrl.destroy();
      if (cam) cam.enabled = false;
      ctrl = null; buildings = null; gameActive = false; tempGravityWells = [];
      tut.reset(false);
    }
    _origGoTo(screen);
  };

  let lastFrameAt = performance.now(), accumulator = 0;
  function loop() {
    const now = performance.now();
    accumulator += Math.min((now - lastFrameAt) / 1000, .1);
    lastFrameAt = now;
    if (accumulator < 1 / 60) { requestAnimationFrame(loop); return; }
    const frameSteps = Math.min(6, Math.floor(accumulator * 60));
    accumulator -= frameSteps / 60;
    // 播片屏幕：CutsceneManager 自驱动渲染
    if (ui.screen === Screen.CUTSCENE) {
      if (cutsceneMgr) {
        requestAnimationFrame(loop);
        return; // cutsceneMgr 有自己的 requestAnimationFrame 循环
      }
      requestAnimationFrame(loop);
      return;
    }

    if (ui.screen !== Screen.GAME_HUD) {
      ui.render();
      requestAnimationFrame(loop);
      return;
    }
    if (!ctrl || !buildings) {
      startLevel(ui.gameData.currentChapter || 0, ui.gameData.currentLevel || 0);
      requestAnimationFrame(loop);
      return;
    }

    if (!gameActive) { gameActive = true; }
    let frameHadEvent = false;

    if (!ctrl.shouldPause()) {
      for (let step = 0; step < frameSteps; step++) frameHadEvent = simulation.step(ctrl) || frameHadEvent;
      physicsTime = simulation.physicsTime;
    }

    const userInteracting = ctrl.state === 'aiming' || ctrl.dragging;
    const allLaunched = bullets.every(b => b.launched || !b.alive);
    const allSettled = bullets.every(b => !b.alive || (b.launched && (Math.sqrt(b.vx**2 + b.vy**2) < 5 || physicsTime - b.launchTime > (getLevelData(currentChapter, currentLevel).flightTimeout || 15) || Math.abs(b.x) > 1700 || Math.abs(b.y) > 1700)));
    const importantAllDead = (() => {
      for (const bld of buildings) for (const p of bld.points) if (p.important && p.alive) return false;
      return true;
    })();
    const condA = allLaunched && allSettled && explosions.length === 0;
    const condB = importantAllDead;

    if (!settling) {
      if ((condA || condB) && !userInteracting && !ctrl.shouldPause()) { settling = true; settleTimer = 0; }
    } else {
      // 暂停或用户操作时不计时
      if (!ctrl.shouldPause() && !userInteracting) {
        settleTimer += frameSteps / 60;
      }
      if (frameHadEvent) { settling = false; settleTimer = 0; }
      if (userInteracting || ctrl.shouldPause() || (condB && frameHadEvent)) { settling = false; settleTimer = 0; }
      if (settleTimer >= SETTLE_DURATION) {
        const result = LevelManager.checkResult(buildings, getLevelWinCondition(currentChapter, currentLevel), simulation.getPerformance());
        ui.gameData.passed = result.passed;
        ui.gameData.stars = result.stars;
        ui.gameData.totalScore = result.totalScore;
        ui.gameData.score = result.totalScore;
        ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && !b.launched).length;
        ui.gameData.importantRemaining = result.importantRemaining;
        ui.gameData.enemiesKilled = buildings.reduce((s, bld) => s + bld.points.filter(p => p.isEnemy && !p.alive).length, 0);
        saveLevel(currentChapter, currentLevel, result.stars, result.totalScore, result.passed);
        ui.goTo(Screen.RESULT);
        requestAnimationFrame(loop);
        return;
      }
    }

    ui.gameData.score = buildings.reduce((s, bld) => s + bld.score, 0);
    ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && !b.launched).length;

    ui.gameData.time = physicsTime;
    ui.gameData.importantTotal = buildings.reduce((n, b) => n + b.points.filter(p => p.important).length, 0);
    ui.gameData.importantRemaining = buildings.reduce((n, b) => n + b.points.filter(p => p.important && p.alive).length, 0);

    // ---- 教程提示触发 ----
    {
      // 悬停未发射子弹 → 按类型教学（发射前讲清特性，而非命中后）
      const hb = ctrl.getHoveredBullet();
      if (hb && !hb.launched && TYPE_HINTS[hb.type]) {
        tut.push(`type:${hb.type}`, TYPE_HINTS[hb.type], 6);
      }
      // 首次发射 → 提示中途修正
      if (bullets.some(b => b.launched)) {
        tut.push('launch', '发射成功！剩余点火次数 > 0 时，可再次悬停子弹修正轨道', 6);
      }
      // 特殊弹在飞行中 → 提示右键可手动触发（在能用的时候提示，而非用过之后）
      if (bullets.some(b => b.launched && b.alive && b.onImpact)) {
        tut.push('rightclick', '特殊弹在飞行中，随时右键点击它手动触发效果', 5);
      }
      // 首次空格暂停
      if (ctrl.isSpacePaused()) {
        tut.push('space', '空格键随时暂停/恢复，暂停时仍可拖动镜头观察战场', 4);
      }
      // 首次摧毁重要目标
      if (buildings.some(bld => bld.points.some(p => p.important && !p.alive))) {
        tut.push('important', '一个核心已被摧毁！还需要满足任务的目标、分数和毁伤要求。', 5);
      }
    }

    // 教程提示推进（暂停/瞄准时冻结倒计时，读完为止）
    tut.update(ctrl.shouldPause());

    // 渲染
    r.clear();
    cam.applyTransform(ctx);
    for (const b of allBodies) r.drawCelestialBody(b);
    r.drawTargetOrbits(buildings);
    for (const bld of buildings) r.drawBuilding(bld);
    const firstGuide = getLevelData(currentChapter, currentLevel).guidance?.firstShot;
    if (firstGuide && !bullets.some(b => b.launched)) r.drawFirstShotGuide(bullets[0], buildings[0].points[0], firstGuide);
    for (const b of bullets) r.drawFadingTrail(b._trail);
    r.drawAimOverlay(ctrl, allBodies);
    const hovered = ctrl.getHoveredBullet();
    const dragVec = ctrl.getDragVector();
    for (const b of bullets) {
      if (!b.alive || !isFinite(b.x)) continue;
      // 拖拽DV超过剩余 → 黄框预警
      const overBudget = b === hovered && dragVec && dragVec.magnitude > b.remainingDeltaV;
      const canMvr = b === hovered ? (!overBudget && ctrl.canHoveredManeuver()) : true;
      r.drawBullet(b.x, b.y, b.vx, b.vy, b.renderRadius || BULLET_R, b.launched, b === hovered, b.color, canMvr);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (r.drawExplosion(explosions[i].x, explosions[i].y, explosions[i].r, explosions[i].maxR)) explosions.splice(i, 1);
    }
    // 引力弹临时引力源
    for (const gw of tempGravityWells) {
      r.drawGravityWell(gw.x, gw.y, physicsTime - gw.startTime, gw.duration, gw.mass);
    }
    // 燃烧弹灼烧效果
    for (const bld of buildings) {
      for (const sp of bld.springs) {
        if (sp._burnTimer > 0) r.drawBurnEffect(sp);
      }
    }
    cam.restoreTransform(ctx);
    if (settling) {
      ui.drawSettleCountdown(SETTLE_DURATION - settleTimer, SETTLE_DURATION);
    }
    // 教程提示
    const hint = tut.current();
    ui.drawTutorialHint(hint);
    ui.render();
    requestAnimationFrame(loop);
  }

  loop();
}
