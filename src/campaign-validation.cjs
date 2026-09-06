/** Run with: node src/campaign-validation.cjs. Uses the production simulation. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
const originalLoader = require.extensions['.js'];
require.extensions['.js'] = (mod, file) => {
  if (!file.startsWith(__dirname + path.sep)) return originalLoader(mod, file);
  const compiled = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file, configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  mod._compile(compiled.code, file);
};
const { LevelManager } = require('./level.js');
const { FlightSimulation } = require('./flight-simulation.js');
const json = file => JSON.parse(fs.readFileSync(path.join(root, 'data/levels', file), 'utf8'));
const levels = json('campaign-index.json').flatMap(dir => json(`${dir}/index.json`).levels.map(file => json(`${dir}/${file}.json`)));
const aliveTargets = sim => sim.buildings.flatMap(b => b.points).filter(p => p.important && p.alive);

function replay(level, actions, endFrame) {
  const sim = new FlightSimulation(LevelManager.load(level));
  for (let frame = 0; frame < endFrame; frame++) {
    for (const action of actions) if (action.frame === frame) {
      const b = sim.bullets[action.bullet];
      b.applyDeltaV(action.dvx, action.dvy);
      b.launchTime = sim.physicsTime;
    }
    sim.step();
  }
  return sim;
}
function findBurns(sim, target, bulletIndex) {
  const bullet = sim.bullets[bulletIndex], result = [];
  const baseTime = sim.physicsTime;
  for (const speed of [110, 140, 90, 160, 70, 125, 150, 100, 60]) {
    const flightTime = Math.hypot(target.x - bullet.x, target.y - bullet.y) / speed;
    const predicted = target._orbit ? target._orbit.getWorldPosition(baseTime + flightTime, target._orbits) : target;
    const direct = Math.atan2(predicted.y - bullet.y, predicted.x - bullet.x);
    for (let a = 0; a <= 64; a += 2) for (const sign of a === 0 ? [1] : [1, -1]) {
      const angle = direct + a * sign * Math.PI / 180;
      const dvx = Math.cos(angle) * speed, dvy = Math.sin(angle) * speed;
      const endX = bullet.x - dvx * 2, endY = bullet.y - dvy * 2;
      if (endX < 15 || endX > 1185 || endY < 95 || endY > 735 || speed > bullet.remainingDeltaV) continue;
      const state = { x: bullet.x, y: bullet.y, vx: bullet.vx + dvx, vy: bullet.vy + dvy };
      for (let f = 1; f <= 720; f++) {
        if (sim.physics.stepParticle(state, undefined, 6)) break;
        const tp = target._orbit ? target._orbit.getWorldPosition(baseTime + f / 60, target._orbits) : target;
        if (Math.hypot(state.x - tp.x, state.y - tp.y) < target.radius + 5) {
          result.push({ bullet: bulletIndex, dvx, dvy, flightFrames: f + 8 });
          break;
        }
      }
      if (result.length >= 8) return result;
    }
  }
  return result;
}

const reports = [];
for (const level of levels) {
  assert(level.id && level.guidance?.text && level.guidance?.hint && level.objective);
  assert(level.bullets.length && level.buildings.length);
  let sim = replay(level, [], 0), frame = 0, actions = [];
  const targetCount = aliveTargets(sim).length;
  const idle = replay(level, [], 600);
  assert.equal(aliveTargets(idle).length, targetCount, `${level.id}: targets die without player action`);
  assert(!LevelManager.checkResult(idle.buildings, level.winCondition).passed, `${level.id}: idle auto-pass`);
  let exhausted = false;
  while (aliveTargets(sim).length && !exhausted) {
    const before = aliveTargets(sim).length;
    let chosen = null;
    for (let bi = 0; bi < level.bullets.length && !chosen; bi++) {
      if (sim.bullets[bi].launched || !sim.bullets[bi].alive) continue;
      for (const target of aliveTargets(sim)) {
        const burns = findBurns(sim, target, bi);
        for (const burn of burns) {
          const action = { frame, ...burn };
          const endFrame = frame + burn.flightFrames;
          const next = replay(level, [...actions, action], endFrame);
          if (aliveTargets(next).length < before) { chosen = { action, next, endFrame }; break; }
        }
        if (chosen) break;
      }
    }
    if (!chosen) { exhausted = true; break; }
    actions.push(chosen.action); sim = chosen.next; frame = chosen.endFrame;
  }
  const result = LevelManager.checkResult(sim.buildings, level.winCondition, sim.getPerformance());
  const report = { id: level.id, name: level.name, passed: result.passed, remaining: aliveTargets(sim).length, stars: result.stars, score: result.totalScore, actions: actions.map(a => ({ frame:a.frame, bullet:a.bullet, dvx:+a.dvx.toFixed(4), dvy:+a.dvy.toFixed(4), flightFrames:a.flightFrames })) };
  reports.push(report);
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${level.id} | ${level.name} | targets ${targetCount - report.remaining}/${targetCount} | shots ${actions.length}/${level.bullets.length}`);
}
fs.writeFileSync(path.join(root, 'doc/campaign-validation.json'), JSON.stringify(reports, null, 2) + '\n');
assert.equal(reports.filter(r => r.passed).length, 36, 'Every campaign mission needs a verified playable solution.');
console.log('36/36 missions passed using the production flight simulation; all survived the idle check.');

// Regression coverage for guidance accuracy, input lifecycle, and save migration.
const { GameController } = require('./game-controller.js');
const { Camera } = require('./camera.js');
const { Bullet } = require('./bullet.js');
const { PhysicsEngine } = require('./physics.js');
global.window = new EventTarget();
const canvas = new EventTarget();
Object.assign(canvas, { width:1200, height:800, getBoundingClientRect:() => ({left:10,top:20,width:600,height:400}) });
const camera = new Camera(canvas);
camera.x = 600; camera.y = 400;
const physics = new PhysicsEngine();
const probe = new Bullet({x:350,y:400,deltaV:100});
const createController = () => new GameController(canvas, {physics,bullets:[probe],camera});
let controller;
for (let i=0;i<12;i++) { controller = createController(); controller.destroy(); }
controller = createController();
const space = new Event('keydown', {cancelable:true});
Object.assign(space, {key:' ',code:'Space'}); window.dispatchEvent(space);
assert(controller.isSpacePaused(), 'One live controller must respond once after repeated retries.');
assert.deepEqual(controller._getCanvasPos({clientX:185,clientY:220}), {x:350,y:400}, 'Scaled pointer coordinates.');
controller.dragBullet=probe; controller.dragging=true;
controller.dragStartX=350; controller.dragStartY=400; controller.dragCurrentX=-250; controller.dragCurrentY=400;
controller._updatePrediction();
const predicted=controller.predictedPath[59];
const actual=new Bullet({x:350,y:400,deltaV:100});actual.applyDeltaV(300,0);
for(let i=0;i<60;i++) physics.stepParticle(actual);
assert(Math.abs(predicted.x-actual.x)<1e-8, 'Fuel-capped prediction must match an actual burn.');
controller.destroy();
const movingLevel=levels.find(l=>l.id==='expedition-interception-02');
const moving=LevelManager.load(movingLevel).buildings[0], core=moving.points[0];
const future=core._orbit.getWorldPosition(5,core._orbits);
assert(moving.checkCollisionAt(future.x,future.y,6,5), 'Future orbital target position is included in prediction.');
assert(!moving.checkCollisionAt(future.x,future.y,6), 'Current position must differ from the future target.');
const store=new Map();
global.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
global.document={cookie:'gravity_dawn_save='+encodeURIComponent(JSON.stringify({levels:{'c0-l0':{stars:2,score:500}}}))};
const storage=require('./storage.js');
storage.configureProgress([{levels:[{id:'new-mission'}]},{levels:[{legacyKey:'c0-l0'}]}]);
assert.equal(storage.getBest(1,0).score,500,'Legacy score migration must preserve original mission identity.');
assert.equal(storage.getBest(0,0),null,'A new mission must not inherit an old mission score.');
storage.saveLevel(0,0,3,300,true);storage.saveLevel(0,0,0,0,false);
assert.equal(storage.getBest(0,0).stars,3,'A failed retry must not erase the best result.');
const saved=JSON.parse(store.get('gravity_dawn_progress_v2'));
assert.equal(saved.levels['new-mission'].score,300);
console.log('PASS input lifecycle, scaled aiming, capped prediction, moving-target prediction, and legacy save migration.');
