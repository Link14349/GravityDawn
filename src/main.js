/**
 * 引力破晓 — 主游戏入口
 */
import { LevelManager } from './level.js';
import { Renderer } from './renderer.js';
import { GameController } from './game-controller.js';
import { Building } from './building.js';
import { Bullet } from './bullet.js';
import { Camera } from './camera.js';
import { UIManager, Screen } from './ui.js';
import { CutsceneManager } from './cutscene.js';
import { TutorialManager } from './tutorial.js';
import { saveLevel, getAllBest } from './storage.js';

// ============================================================
// 关卡加载 — 分章节分文件
// ============================================================
  async function loadChapters() {
    // 1. 总索引: data/levels/index.json → ["ch1", "ch2", ...]
    const _v = Date.now();
    const idxResp = await fetch(`data/levels/index.json?v=${_v}`);
    const chDirs = await idxResp.json();

    const chapters = [];
    for (const chDir of chDirs) {
      const chIdxResp = await fetch(`data/levels/${chDir}/index.json?v=${_v}`);
      const chIdx = await chIdxResp.json();

      const levels = [];
      for (const lvFile of chIdx.levels) {
        const lvResp = await fetch(`data/levels/${chDir}/${lvFile}.json?v=${_v}`);
        const lvData = await lvResp.json();
        levels.push(lvData);
      }

      chapters.push({ name: chIdx.name, levels });
    }

    return chapters;
  }

  const CHAPTERS = await loadChapters();

  function getLevelData(chapterIdx, levelIdx) {
    return CHAPTERS[chapterIdx].levels[levelIdx];
  }

  function getLevelWinCondition(chapterIdx, levelIdx) {
    return getLevelData(chapterIdx, levelIdx).winCondition;
  }

// ============================================================
// 游戏初始化
// ============================================================
export function initGame() {
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
    explosive: '爆炸弹 — 半径 200 大范围爆炸，飞行途中右键可提前引爆',
    agile: '机动弹 — Δv 高达 1000、可点火 10 次，适合复杂轨道机动',
    cluster: '分裂弹 — 撞击后分裂出 3 颗小子弹',
    gravity: '引力弹 — 撞击点生成 3 秒临时引力阱，可弯折其他子弹的轨道',
    incendiary: '燃烧弹 — 灼烧弹簧结构，持续降低其断裂阈值',
  };

  // 预加载开始界面图片
  ['img/startup-bg.png', 'img/logo.png'].forEach((src, idx) => {
    const img = new Image();
    img.onload = () => { if (idx === 0) ui._bgImage = img; else ui._logoImage = img; };
    img.src = src;
  });

  // 游戏状态
  let stars, planets, allBodies, bullets, buildings, physics, camera, orbits;
  let cam, ctrl, physicsTime, explosions, settling, settleTimer, gameActive;
  let currentChapter = 0, currentLevel = 0;
  let tempGravityWells = [];
  let cutsceneMgr = null; // 播片管理器

  function _addGravityWell(gw) {
    gw.startTime = physicsTime;
    gw._sourceObj = { x: gw.x, y: gw.y, mass: gw.mass, collisionRadius: 0, orbitFn: null };
    physics.addGravitySource(gw.x, gw.y, gw.mass, 0, null);
    // addGravitySource 会 push，我们存引用最后加的那个
    gw._sourceObj = physics.gravitySources[physics.gravitySources.length - 1];
    tempGravityWells.push(gw);
  }

  function startLevel(chapterIdx, levelIdx, skipCutscene = false) {
    currentChapter = chapterIdx;
    currentLevel = levelIdx;
    const levelData = getLevelData(chapterIdx, levelIdx);
    const loaded = LevelManager.load(levelData);
    ({ stars, planets, allBodies, bullets, buildings, physics, camera, orbits } = loaded);
    if (!cam) {
      cam = new Camera(canvas, { shouldBlockPan: () => false });
    }
    cam.x = camera.x; cam.y = camera.y; cam.zoom = camera.zoom;
    if (!ctrl) {
      ctrl = new GameController(canvas, { physics, bullets, camera: cam, getTime: () => physicsTime, buildings });
    } else {
      ctrl.physics = physics; ctrl.bullets = bullets; ctrl._buildings = buildings; ctrl.camera = cam;
    }
    cam._shouldBlockPan = () => ctrl && ctrl.getHoveredBullet() !== null;
    physicsTime = 0;
    explosions = [];
    tempGravityWells = [];
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
        ui.goTo(Screen.GAME_HUD);
      });
      cutsceneMgr.start();
      ui.goTo(Screen.CUTSCENE);
    } else {
      _setupLevel(chapterIdx);
      ui.goTo(Screen.GAME_HUD);
    }
  }

  function _setupLevel(chapterIdx) {
    // 教程章启用提示；开场基础操作按队列依次展示（会话内只出现一次）
    tut.reset(chapterIdx === 0);
    if (chapterIdx === 0) {
      tut.push('welcome', '欢迎来到教程！拖拽空白区域可以平移镜头', 5);
      tut.push('zoom', '滚动鼠标滚轮缩放镜头，找到你的子弹和目标', 4);
      tut.push('aim', '将鼠标悬停到子弹上 → 时间暂停，按住向后拖拽瞄准，松开发射', 6);
    }
  }

  // 回调
  ui._onReplay = () => startLevel(currentChapter, currentLevel, true);

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
      ctrl = null; buildings = null; gameActive = false; tempGravityWells = [];
      tut.reset(false);
    }
    _origGoTo(screen);
  };

  function loop() {
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
      physicsTime += 1 / 60;
      for (let i = 0; i < allBodies.length; i++) {
        const b = allBodies[i];
        b.update(1 / 60);
        physics.updateSourcePosition(i, b.getPosition().x, b.getPosition().y);
      }
      for (const bld of buildings) {
        const bResult = bld.step(1 / 60, physics, allBodies);
        if (bResult.explosions.length > 0) frameHadEvent = true;
        for (const ex of bResult.explosions) explosions.push({ x: ex.x, y: ex.y, r: 0, maxR: ex.radius || 40 });
      }
      Building.checkCrossCollisions(buildings, explosions);
      for (const b of bullets) {
        if (!b.alive) continue;
        if (!b.launched) { b.updateOrbitPosition(1 / 60); }
        else {
          const col = physics.stepParticle(b, undefined, BULLET_R);
          b._trail.push({ x: b.x, y: b.y, life: 1.0 });
          if (b._trail.length > 300) b._trail.shift();
          let hitBuilding = false;
          for (const bld of buildings) {
            const colR = b.maxHp > 0 ? (b.renderRadius || BULLET_R) : BULLET_R;
            const impact = bld.handleBulletImpact(b.x, b.y, colR, b.getEffectiveExplosionImpulse(), b.getEffectiveExplosionRadius());
            if (impact.hit) {
              // 燃烧弹效果
              b.applyIncendiary(bld);
              if (b.maxHp > 0) { b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7); }
              else { b.alive = false; }
              explosions.push({ x: impact.explosion.x, y: impact.explosion.y, r: 0, maxR: impact.explosion.radius || 50 });
              frameHadEvent = true; hitBuilding = true;
              // 分裂弹
              const splits = b.getSplitBullets();
              if (splits) {
                for (const sd of splits) {
                  const child = new Bullet(sd);
                  child.launchTime = physicsTime;
                  child._trail = [];
                  bullets.push(child);
                  if (ctrl) ctrl.bullets = bullets;
                }
                frameHadEvent = true;
              }
              // 引力弹
              // 引力弹
              const gw = b.getGravityWell();
              if (gw) { _addGravityWell(gw); frameHadEvent = true; }
              break;
            }
          }
          if (!hitBuilding && col) {
            explosions.push({ x: b.x, y: b.y, r: 0, maxR: b.getEffectiveExplosionRadius() || (b.maxHp > 0 ? 15 : 50) });
            if (b.maxHp > 0) b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7);
            else b.alive = false;
            frameHadEvent = true;
            // 星体碰撞也触发分裂/引力效果
            const splits = b.getSplitBullets();
            if (splits) {
              for (const sd of splits) {
                const child = new Bullet(sd);
                child.launchTime = physicsTime;
                child._trail = [];
                bullets.push(child);
                if (ctrl) ctrl.bullets = bullets;
              }
              frameHadEvent = true;
            }
            const gw = b.getGravityWell();
            if (gw) { _addGravityWell(gw); frameHadEvent = true; }
          }
        }
      }
      // 处理右键触发的子弹效果
      if (ctrl && ctrl.triggeredBullets.length > 0) {
        for (const tb of ctrl.triggeredBullets) {
          if (!tb._triggered) continue;
          tb._triggered = false;
          // 爆炸效果：对附近建筑施加爆炸伤害
          if (tb.onImpact === 'explode') {
            const er = tb.getEffectiveExplosionRadius();
            const ep = tb.getEffectiveExplosionImpulse();
            explosions.push({ x: tb.x, y: tb.y, r: 0, maxR: er || 50 });
            for (const bld of buildings) {
              const bldCenter = bld.points.length > 0 ? { x: bld.points[0].x, y: bld.points[0].y } : { x: 0, y: 0 };
              const dist = Math.sqrt((bldCenter.x - tb.x) ** 2 + (bldCenter.y - tb.y) ** 2);
              if (dist < er + 200) {
                const ar = bld.applyExplosion(tb.x, tb.y, er, ep);
                bld.score += ar.totalScore;
              }
            }
          }
          // 分裂弹
          const splits = tb.getSplitBullets();
          if (splits) {
            for (const sd of splits) {
              const child = new Bullet(sd);
              child.launchTime = physicsTime; child._trail = [];
              bullets.push(child);
            }
            if (ctrl) ctrl.bullets = bullets;
          }
          // 引力弹
          const gw = tb.getGravityWell();
          if (gw) _addGravityWell(gw);
          // 燃烧弹
          if (tb.onImpact === 'incendiary') {
            for (const bld of buildings) {
              const dist = Math.sqrt((bld.points[0]?.x - tb.x) ** 2 + (bld.points[0]?.y - tb.y) ** 2);
              if (dist < tb.getEffectiveExplosionRadius() + 100) {
                tb.applyIncendiary(bld);
              }
            }
          }
          frameHadEvent = true;
        }
        ctrl.triggeredBullets.length = 0;
      }
      // 处理临时引力源过期（用引用查找，避免索引问题）
      for (let i = tempGravityWells.length - 1; i >= 0; i--) {
        const gw = tempGravityWells[i];
        if (physicsTime - gw.startTime > gw.duration) {
          if (gw._sourceObj) {
            const idx = physics.gravitySources.indexOf(gw._sourceObj);
            if (idx >= 0) physics.removeGravitySource(idx);
          }
          tempGravityWells.splice(i, 1);
        }
      }
      for (const ex of explosions) ex.r += 4;
    }

    const userInteracting = ctrl.state === 'aiming' || ctrl.dragging;
    const allLaunched = bullets.every(b => b.launched || !b.alive);
    const allSettled = bullets.every(b => !b.alive || (b.launched && (Math.sqrt(b.vx**2 + b.vy**2) < 5 || physicsTime - b.launchTime > 15)));
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
        settleTimer += 1 / 60;
      }
      if (frameHadEvent) { settling = false; settleTimer = 0; }
      if (userInteracting || ctrl.shouldPause() || (condB && frameHadEvent)) { settling = false; settleTimer = 0; }
      if (settleTimer >= SETTLE_DURATION) {
        const result = LevelManager.checkResult(buildings, getLevelWinCondition(currentChapter, currentLevel));
        ui.gameData.passed = result.passed;
        ui.gameData.stars = result.stars;
        ui.gameData.totalScore = result.passed ? result.totalScore : 0;
        ui.gameData.score = result.passed ? result.totalScore : 0;
        ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && b.launched).length;
        ui.gameData.enemiesKilled = buildings.reduce((s, bld) => s + bld.points.filter(p => p.isEnemy && !p.alive).length, 0);
        saveLevel(currentChapter, currentLevel, result.stars, result.totalScore, result.passed);
        ui.goTo(Screen.RESULT);
        requestAnimationFrame(loop);
        return;
      }
    }

    ui.gameData.score = buildings.reduce((s, bld) => s + bld.score, 0);
    ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && !b.launched).length;

    // ---- 教程提示触发 ----
    if (currentChapter === 0) {
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
        tut.push('important', '摧毁了重要目标（金色边框）！摧毁全部重要目标即可通关', 5);
      }
    }

    // 教程提示推进（暂停/瞄准时冻结倒计时，读完为止）
    tut.update(ctrl.shouldPause());

    // 渲染
    r.clear();
    cam.applyTransform(ctx);
    for (const b of allBodies) r.drawCelestialBody(b);
    for (const bld of buildings) r.drawBuilding(bld);
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
    if (hint) ui.drawTutorialHint(hint);
    ui.render();
    requestAnimationFrame(loop);
  }

  loop();
}
