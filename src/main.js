/**
 * 引力破晓 — 主游戏入口
 */
import { LevelManager } from './level.js';
import { Renderer } from './renderer.js';
import { GameController } from './game-controller.js';
import { Building } from './building.js';
import { Camera } from './camera.js';
import { UIManager, Screen } from './ui.js';
import { saveLevel, getAllBest } from './storage.js';

// ============================================================
// 关卡定义
// ============================================================
  const resp = await fetch('data/levels.json');
  const LEVELS = await resp.json();

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

  ui.gameData.totalLevels = LEVELS.length;

  // 预加载开始界面图片
  ['img/startup-bg.png', 'img/logo.png'].forEach((src, idx) => {
    const img = new Image();
    img.onload = () => { if (idx === 0) ui._bgImage = img; else ui._logoImage = img; };
    img.src = src;
  });

  // 游戏状态
  let stars, planets, allBodies, bullets, buildings, physics, camera;
  let cam, ctrl, physicsTime, explosions, settling, settleTimer, gameActive, currentLevel;

  function startLevel(levelIndex) {
    currentLevel = levelIndex;
    const levelData = LEVELS[levelIndex];
    const loaded = LevelManager.load(levelData);
    ({ stars, planets, allBodies, bullets, buildings, physics, camera } = loaded);
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
    settling = false; settleTimer = 0; gameActive = false;
    for (const b of bullets) b._trail = [];
    ui.gameData.currentLevel = levelIndex + 1;
    ui.gameData.totalLevels = LEVELS.length;
    ui.goTo(Screen.GAME_HUD);
  }

  // 回调
  ui._onReplay = () => startLevel(currentLevel);

  // ============================================================
  // 主循环
  // ============================================================
  // 退出关卡时销毁，重新进入时重建
  const _origGoTo = ui.goTo.bind(ui);
  ui.goTo = (screen) => {
    if (ui.screen === Screen.GAME_HUD && screen !== Screen.GAME_HUD) {
      ctrl = null; buildings = null; gameActive = false;
    }
    _origGoTo(screen);
  };

  function loop() {
    if (ui.screen !== Screen.GAME_HUD) {
      ui.render();
      requestAnimationFrame(loop);
      return;
    }
    if (!ctrl || !buildings) {
      startLevel((ui.gameData.currentLevel || 1) - 1);
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
              if (b.maxHp > 0) { b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7); }
              else { b.alive = false; }
              explosions.push({ x: impact.explosion.x, y: impact.explosion.y, r: 0, maxR: impact.explosion.radius || 50 });
              frameHadEvent = true; hitBuilding = true; break;
            }
          }
          if (!hitBuilding && col) {
            explosions.push({ x: b.x, y: b.y, r: 0, maxR: b.getEffectiveExplosionRadius() || (b.maxHp > 0 ? 15 : 50) });
            if (b.maxHp > 0) b.takeDamage(Math.sqrt(b.vx ** 2 + b.vy ** 2) * 0.7);
            else b.alive = false;
            frameHadEvent = true;
          }
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
      if (condA || condB) { settling = true; settleTimer = 0; }
    } else {
      settleTimer += 1 / 60;
      if (frameHadEvent) { settling = false; settleTimer = 0; }
      if (condB && (userInteracting || frameHadEvent)) { settling = false; settleTimer = 0; }
      if (settleTimer >= SETTLE_DURATION) {
        const result = LevelManager.checkResult(buildings, LEVELS[currentLevel].winCondition);
        ui.gameData.passed = result.passed;
        ui.gameData.stars = result.stars;
        ui.gameData.totalScore = result.totalScore;
        ui.gameData.score = result.totalScore;
        ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && b.launched).length;
        ui.gameData.enemiesKilled = buildings.reduce((s, bld) => s + bld.points.filter(p => p.isEnemy && !p.alive).length, 0);
        saveLevel(currentLevel, result.stars, result.totalScore, result.passed);
        ui.goTo(Screen.RESULT);
        requestAnimationFrame(loop);
        return;
      }
    }

    ui.gameData.score = buildings.reduce((s, bld) => s + bld.score, 0);
    ui.gameData.bulletsRemaining = bullets.filter(b => b.alive && !b.launched).length;

    // 渲染
    r.clear();
    cam.applyTransform(ctx);
    for (const b of allBodies) r.drawCelestialBody(b);
    for (const bld of buildings) r.drawBuilding(bld);
    for (const b of bullets) r.drawFadingTrail(b._trail);
    r.drawAimOverlay(ctrl, allBodies);
    const hovered = ctrl.getHoveredBullet();
    for (const b of bullets) {
      if (!b.alive || !isFinite(b.x)) continue;
      r.drawBullet(b.x, b.y, b.vx, b.vy, b.renderRadius || BULLET_R, b.launched, b === hovered, b.color);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (r.drawExplosion(explosions[i].x, explosions[i].y, explosions[i].r, explosions[i].maxR)) explosions.splice(i, 1);
    }
    cam.restoreTransform(ctx);
    if (settling) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(canvas.width / 2 - 140, canvas.height - 56, 280, 28);
      ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(`结算中... ${(SETTLE_DURATION - settleTimer).toFixed(1)}s`, canvas.width / 2, canvas.height - 36);
    }
    ui.render();
    requestAnimationFrame(loop);
  }

  loop();
}
