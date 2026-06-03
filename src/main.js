/**
 * 引力破晓 — 主游戏入口
 */
import { LevelManager } from './level.js';
import { Renderer } from './renderer.js';
import { GameController } from './game-controller.js';
import { Building } from './building.js';
import { Camera } from './camera.js';
import { UIManager, Screen } from './ui.js';

// ============================================================
// 关卡定义
// ============================================================
const LEVELS = [
  { // 第1关: 前哨站
    name: '前哨站', gravity: 300, camera: { x: 725, y: 400, zoom: 0.75 },
    stars: [{ mass: 8000, radius: 50, collisionRadius: 45, color: '#ffbb33', label: '恒星', orbit: { type: 'fixed', x: 600, y: 400 } }],
    planets: [{ mass: 1500, radius: 55, collisionRadius: 50, color: '#66aaff', label: '目标行星', orbit: { type: 'fixed', x: 850, y: 400 } }],
    bullets: [
      { payloadMass: 5, fuelMass: 30, ve: 300, ignitionCount: 2, explosionRadius: 60, explosionImpulse: 3000, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 80, phase: 0 } },
      { payloadMass: 8, fuelMass: 20, ve: 250, ignitionCount: 3, explosionRadius: 40, explosionImpulse: 2000, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 110, phase: Math.PI } },
      { payloadMass: 20, fuelMass: 15, ve: 200, ignitionCount: 2, explosionRadius: 0, explosionImpulse: 0, color: '#ff4444', renderRadius: 12, hp: 200, orbitAround: { bodyIndex: 0, altitude: 140, phase: Math.PI * 0.7 } },
    ],
    buildings: [{
      points: [
        { x: 850, y: 230, mass: 200, radius: 8, score: 300, important: true, isCore: true, color: '#ffdd44', explosionRadius: 60, explosionImpulse: 3000 },
        { x: 820, y: 310, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 310, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 880, y: 310, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 820, y: 275, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 275, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 880, y: 275, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 340, mass: 10, radius: 6, score: 50, color: '#88aacc', explosionRadius: 20, explosionImpulse: 1000 },
        { x: 840, y: 290, mass: 12, radius: 7, score: 200, important: true, isEnemy: true, hp: 150, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
        { x: 865, y: 290, mass: 12, radius: 7, score: 200, important: true, isEnemy: true, hp: 150, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
      ],
      springs: [
        { a: 0, b: 4, stiffness: 4000, damping: 20, breakTension: 7500 }, { a: 0, b: 5, stiffness: 4000, damping: 20, breakTension: 7500 }, { a: 0, b: 6, stiffness: 4000, damping: 20, breakTension: 7500 },
        { a: 4, b: 1, stiffness: 3000, damping: 15, breakTension: 5000 }, { a: 5, b: 2, stiffness: 3000, damping: 15, breakTension: 5000 }, { a: 6, b: 3, stiffness: 3000, damping: 15, breakTension: 5000 },
        { a: 1, b: 7, stiffness: 2500, damping: 15, breakTension: 4000 }, { a: 2, b: 7, stiffness: 3000, damping: 15, breakTension: 5000 }, { a: 3, b: 7, stiffness: 2500, damping: 15, breakTension: 4000 },
        { a: 1, b: 2, stiffness: 1500, damping: 10, breakTension: 2500 }, { a: 2, b: 3, stiffness: 1500, damping: 10, breakTension: 2500 },
        { a: 4, b: 5, stiffness: 1500, damping: 10, breakTension: 2500 }, { a: 5, b: 6, stiffness: 1500, damping: 10, breakTension: 2500 },
      ],
    }, {
      points: [
        { x: 832, y: 470, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 868, y: 470, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 832, y: 506, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 868, y: 506, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 850, y: 488, mass: 12, radius: 7, score: 300, important: true, isEnemy: true, hp: 150, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
      ],
      springs: [
        { a: 0, b: 1, stiffness: 500, damping: 20, breakTension: 50000 }, { a: 1, b: 3, stiffness: 500, damping: 20, breakTension: 50000 },
        { a: 3, b: 2, stiffness: 500, damping: 20, breakTension: 50000 }, { a: 2, b: 0, stiffness: 500, damping: 20, breakTension: 50000 },
        { a: 0, b: 3, stiffness: 500, damping: 20, breakTension: 50000 }, { a: 1, b: 2, stiffness: 500, damping: 20, breakTension: 50000 },
      ],
    }],
    winCondition: { destructionThreshold: 0.2, importantTargetsAll: true, minScore: 100 },
  },
  { // 第2关: 陨石带
    name: '陨石带', gravity: 300, camera: { x: 600, y: 400, zoom: 0.7 },
    stars: [{ mass: 6000, radius: 45, collisionRadius: 40, color: '#ffbb33', label: '恒星', orbit: { type: 'fixed', x: 500, y: 400 } }],
    planets: [
      { mass: 1200, radius: 45, collisionRadius: 40, color: '#44ccbb', label: '水蓝星', orbit: { type: 'fixed', x: 780, y: 320 } },
      { mass: 1000, radius: 40, collisionRadius: 35, color: '#ff6688', label: '赤红星', orbit: { type: 'fixed', x: 900, y: 500 } },
    ],
    bullets: [
      { payloadMass: 5, fuelMass: 25, ve: 300, ignitionCount: 2, explosionRadius: 60, explosionImpulse: 3000, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 80, phase: 0 } },
      { payloadMass: 8, fuelMass: 20, ve: 250, ignitionCount: 2, explosionRadius: 40, explosionImpulse: 2000, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 110, phase: Math.PI * 0.8 } },
      { payloadMass: 15, fuelMass: 15, ve: 200, ignitionCount: 2, explosionRadius: 0, explosionImpulse: 0, color: '#ff4444', renderRadius: 12, hp: 200, orbitAround: { bodyIndex: 0, altitude: 140, phase: Math.PI * 1.6 } },
    ],
    buildings: [{
      points: [
        { x: 780, y: 240, mass: 180, radius: 8, score: 300, important: true, isCore: true, color: '#ffdd44', explosionRadius: 60, explosionImpulse: 3000 },
        { x: 750, y: 295, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 780, y: 295, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 810, y: 295, mass: 8, radius: 5, score: 20, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 780, y: 320, mass: 10, radius: 6, score: 50, color: '#88aacc', explosionRadius: 20, explosionImpulse: 1000 },
        { x: 760, y: 280, mass: 12, radius: 7, score: 200, important: true, isEnemy: true, hp: 150, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
        { x: 800, y: 280, mass: 12, radius: 7, score: 200, important: true, isEnemy: true, hp: 150, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
      ],
      springs: [
        { a: 0, b: 1, stiffness: 3500, damping: 20, breakTension: 7000 }, { a: 0, b: 2, stiffness: 3500, damping: 20, breakTension: 7000 }, { a: 0, b: 3, stiffness: 3500, damping: 20, breakTension: 7000 },
        { a: 1, b: 4, stiffness: 2500, damping: 15, breakTension: 4000 }, { a: 2, b: 4, stiffness: 2800, damping: 15, breakTension: 4500 }, { a: 3, b: 4, stiffness: 2500, damping: 15, breakTension: 4000 },
        { a: 1, b: 2, stiffness: 1500, damping: 10, breakTension: 2500 }, { a: 2, b: 3, stiffness: 1500, damping: 10, breakTension: 2500 },
      ],
    }, {
      points: [
        { x: 900, y: 430, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 930, y: 430, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 915, y: 460, mass: 10, radius: 5, score: 30, color: '#ff9966', explosionRadius: 20, explosionImpulse: 600 },
        { x: 915, y: 445, mass: 12, radius: 7, score: 250, important: true, isEnemy: true, hp: 200, color: '#44ff44', renderRadius: 8, explosionRadius: 30, explosionImpulse: 2000 },
      ],
      springs: [
        { a: 0, b: 1, stiffness: 400, damping: 20, breakTension: 40000 }, { a: 1, b: 2, stiffness: 400, damping: 20, breakTension: 40000 }, { a: 2, b: 0, stiffness: 400, damping: 20, breakTension: 40000 },
      ],
    }],
    winCondition: { destructionThreshold: 0.25, importantTargetsAll: true, minScore: 200 },
  },
  { // 第3关: 雷蒙堡垒
    name: '雷蒙堡垒', gravity: 250, camera: { x: 650, y: 400, zoom: 0.65 },
    stars: [{ mass: 10000, radius: 55, collisionRadius: 50, color: '#ff9933', label: '巨星', orbit: { type: 'fixed', x: 450, y: 400 } }],
    planets: [
      { mass: 2000, radius: 50, collisionRadius: 45, color: '#66aaff', label: '堡垒行星', orbit: { type: 'fixed', x: 850, y: 380 } },
    ],
    bullets: [
      { payloadMass: 5, fuelMass: 20, ve: 300, ignitionCount: 2, explosionRadius: 50, explosionImpulse: 2500, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 90, phase: 0 } },
      { payloadMass: 8, fuelMass: 15, ve: 250, ignitionCount: 2, explosionRadius: 40, explosionImpulse: 2000, color: '#ffdd44', renderRadius: 8, orbitAround: { bodyIndex: 0, altitude: 120, phase: Math.PI * 0.6 } },
      { payloadMass: 20, fuelMass: 10, ve: 200, ignitionCount: 1, explosionRadius: 0, explosionImpulse: 0, color: '#ff4444', renderRadius: 12, hp: 150, orbitAround: { bodyIndex: 0, altitude: 150, phase: Math.PI * 1.3 } },
    ],
    buildings: [{
      points: [
        { x: 850, y: 260, mass: 250, radius: 9, score: 500, important: true, isCore: true, color: '#ffdd44', explosionRadius: 80, explosionImpulse: 4000 },
        { x: 810, y: 330, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 330, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 890, y: 330, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 810, y: 295, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 295, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 890, y: 295, mass: 10, radius: 5, score: 30, color: '#cccccc', explosionRadius: 15, explosionImpulse: 800 },
        { x: 850, y: 355, mass: 12, radius: 6, score: 60, color: '#88aacc', explosionRadius: 20, explosionImpulse: 1000 },
        { x: 835, y: 310, mass: 15, radius: 8, score: 250, important: true, isEnemy: true, hp: 200, color: '#44ff44', renderRadius: 9, explosionRadius: 30, explosionImpulse: 2500 },
        { x: 865, y: 310, mass: 15, radius: 8, score: 250, important: true, isEnemy: true, hp: 200, color: '#44ff44', renderRadius: 9, explosionRadius: 30, explosionImpulse: 2500 },
        { x: 850, y: 280, mass: 15, radius: 8, score: 300, important: true, isEnemy: true, hp: 250, color: '#44ff44', renderRadius: 9, explosionRadius: 30, explosionImpulse: 3000 },
      ],
      springs: [
        { a: 0, b: 4, stiffness: 4500, damping: 20, breakTension: 8000 }, { a: 0, b: 5, stiffness: 4500, damping: 20, breakTension: 8000 }, { a: 0, b: 6, stiffness: 4500, damping: 20, breakTension: 8000 },
        { a: 4, b: 1, stiffness: 3500, damping: 15, breakTension: 6000 }, { a: 5, b: 2, stiffness: 3500, damping: 15, breakTension: 6000 }, { a: 6, b: 3, stiffness: 3500, damping: 15, breakTension: 6000 },
        { a: 1, b: 7, stiffness: 2800, damping: 15, breakTension: 4500 }, { a: 2, b: 7, stiffness: 3200, damping: 15, breakTension: 5500 }, { a: 3, b: 7, stiffness: 2800, damping: 15, breakTension: 4500 },
        { a: 1, b: 2, stiffness: 1800, damping: 10, breakTension: 3000 }, { a: 2, b: 3, stiffness: 1800, damping: 10, breakTension: 3000 },
        { a: 4, b: 5, stiffness: 1800, damping: 10, breakTension: 3000 }, { a: 5, b: 6, stiffness: 1800, damping: 10, breakTension: 3000 },
      ],
    }],
    winCondition: { destructionThreshold: 0.25, importantTargetsAll: true, minScore: 400 },
  },
];

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
    cam._shouldBlockPan = () => ctrl.getHoveredBullet() !== null;
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
      if (explosions.length > 0) frameHadEvent = true;
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
        ui.goTo(Screen.RESULT);
        settling = false; gameActive = false;
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
