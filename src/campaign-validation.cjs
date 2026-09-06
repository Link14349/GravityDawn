/** Regression checks use production entities and FlightSimulation. No alternative game physics. */
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {LevelManager,FlightSimulation,Building}=require('./simulation-node.cjs');
const {replay,solve}=require('./campaign-solver.cjs');
const root=path.resolve(__dirname,'..');
const json=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const levels=json('data/levels/campaign-index.json').flatMap(dir=>json(`data/levels/${dir}/index.json`).levels.map(file=>json(`data/levels/${dir}/${file}.json`)));
const references=json('doc/campaign-solutions.json');
const finite=sim=>sim.buildings.every(b=>b.points.every(p=>Number.isFinite(p.x+p.y+p.vx+p.vy)))&&sim.bullets.every(b=>Number.isFinite(b.x+b.y+b.vx+b.vy+b.remainingDeltaV));
const results=[];
assert.equal(levels.length,36);
assert.equal(new Set(levels.map(l=>l.id)).size,36,'Mission save IDs must be unique.');
assert.equal(references.length,levels.length,'Each mission must have exactly one reference.');
assert.equal(new Set(references.map(r=>r.id)).size,levels.length);
assert.equal(levels.filter(l=>!l.stars.length&&!l.planets.length).length,1,'Only the initial control lesson may omit gravity.');
assert(levels.filter(l=>l.stars.length+l.planets.length>=3).length>=8,'Keep multi-source encounters in the campaign.');
assert(levels.filter(l=>l.stars.length+l.planets.length===4).length>=4,'Keep the four-source finale encounters.');
assert.equal(levels.filter(l=>l.buildings.some(b=>b.bindToBody!=null)).length,2);
assert.deepEqual(levels,require('./campaign-authoring.cjs').levels,'Generated JSON must match the authored blueprints.');
for(let index=0;index<levels.length;index++){
  const level=levels[index],initial=LevelManager.load(level),reference=references.find(r=>r.id===level.id);
  assert(reference,`${level.id}: missing a verified solution`);
  assert(level.guidance?.text&&level.guidance?.hint&&level.objective);
  const initialTargets=initial.buildings.flatMap(b=>b.points).filter(p=>p.important).length;
  if(index>=24){
    assert(initialTargets>=7,`${level.id}: advanced missions require at least seven protected targets`);
    assert(level.buildings.length>=3&&initial.allBodies.length>=3,`${level.id}: preserve multiple forts and gravity sources`);
    assert(level.bullets.length<initialTargets,`${level.id}: ammunition must require multi-target attacks`);
    assert(level.winCondition.parShots<level.bullets.length,`${level.id}: two stars must reward ammunition conservation`);
    assert(level.winCondition.parDeltaV>0&&level.winCondition.parDeltaV<level.winCondition.parShots*100);
    assert.equal(level.difficulty,index+1);
  }
  const idle=new FlightSimulation(initial);
  const surfaceBuildings=level.buildings.map((b,i)=>b.bindToBody!=null?i:-1).filter(i=>i>=0);
  for(const bi of surfaceBuildings){
    const b=level.buildings[bi];
    assert(b.orbit==null&&b.points.every(p=>!p.fixed&&!p.isCore&&p.orbit==null),'Surface buildings must be physically supported.');
  }
  const surfacePositions=surfaceBuildings.map(bi=>initial.buildings[bi].points.map(p=>({x:p.x,y:p.y})));
  const movingBodies=initial.allBodies.filter(b=>b.orbit.type!=='fixed'||b.orbit.parent!=null).length;
  const longestPeriod=Math.max(0,...level.orbits.map(o=>Math.abs(o.period||0)));
  const idleSeconds=surfaceBuildings.length?240:movingBodies?Math.max(240,Math.ceil(longestPeriod*2)):60;
  let maxSurfaceDrift=0,peakTensionRatio=0;
  for(let f=0;f<idleSeconds*60;f++){
    idle.step();
    assert(finite(idle),`${level.id}: invalid idle state at frame ${f}`);
    for(const bullet of idle.bullets){
      assert(!idle.buildings.some(b=>b.checkCollisionAt(bullet.x,bullet.y,bullet.renderRadius)),`${level.id}: parking orbit enters a fortress`);
      assert(!idle.physics.checkSourceCollision(bullet.x,bullet.y,bullet.renderRadius),`${level.id}: parking orbit enters a celestial body`);
    }
    if(f%60===0){
      for(let a=0;a<idle.allBodies.length;a++)for(let b=a+1;b<idle.allBodies.length;b++){
        const pa=idle.allBodies[a].getPosition(),pb=idle.allBodies[b].getPosition();
        assert(Math.hypot(pa.x-pb.x,pa.y-pb.y)>idle.allBodies[a].collisionRadius+idle.allBodies[b].collisionRadius,`${level.id}: celestial bodies overlap`);
      }
      for(const b of idle.buildings)for(const sp of b.springs)peakTensionRatio=Math.max(peakTensionRatio,sp.tension/sp.breakTension);
      surfaceBuildings.forEach((bi,j)=>idle.buildings[bi].points.forEach((p,k)=>{
        maxSurfaceDrift=Math.max(maxSurfaceDrift,Math.hypot(p.x-surfacePositions[j][k].x,p.y-surfacePositions[j][k].y));
      }));
    }
  }
  assert(maxSurfaceDrift<5,`${level.id}: surface building drifts off its footing (${maxSurfaceDrift})`);
  assert(idle.buildings.every(b=>b.points.every(p=>p.alive)&&b.springs.every(s=>s.alive)),`${level.id}: structure changes without player input`);
  assert(idle.buildings.every(b=>b.score===0),`${level.id}: idle scoring`);
  const sim=replay(level,reference.actions,reference.endFrame+360);
  assert(finite(sim),`${level.id}: invalid state after solution`);
  const result=LevelManager.checkResult(sim.buildings,level.winCondition,sim.getPerformance());
  assert(result.passed,`${level.id}: reference no longer clears the mission (${result.importantRemaining} remain)`);
  if(index>=24)assert.equal(result.stars,3,`${level.id}: advanced three-star budget must be achievable`);
  // Replacing each planned burn with the full fuel budget must not clear introductory forts.
  const full=reference.actions.map(a=>{
    const max=initial.bullets[a.bullet].maxDeltaV,d=Math.hypot(a.dvx,a.dvy)||1;
    return {...a,dvx:a.dvx/d*max,dvy:a.dvy/d*max};
  });
  const fullSim=replay(level,full,reference.endFrame+360);
  const fullPassed=LevelManager.checkResult(fullSim.buildings,level.winCondition).passed;
  if(index<10)assert(!fullPassed,`${level.id}: full-thrust replacement bypasses the puzzle`);
  const sweeps=[];
  if(index<10){
    assert(initialTargets>=level.bullets.length,'Introductory ammunition must remain limited relative to protected targets.');
    for(const startFrame of (initial.allBodies.length?[0,180,360,540]:[0])){
      const attack=solve(level,{max:true,startFrame});
      assert(finite(attack.sim));
      assert(!attack.result.passed,`${level.id}: maximum-thrust angle sweep passed at ${startFrame}`);
      sweeps.push({startFrame,remaining:attack.result.importantRemaining,shots:attack.actions.length,actions:attack.actions});
    }
  }
  results.push({id:level.id,name:level.name,fingerprint:crypto.createHash('sha256').update(JSON.stringify(level)).digest('hex'),
    points:initial.buildings.reduce((n,b)=>n+b.points.length,0),springs:initial.buildings.reduce((n,b)=>n+b.springs.length,0),targets:initialTargets,
    gravitySources:initial.allBodies.length,movingBodies,surfaceBuildings:surfaceBuildings.length,idleSeconds,maxSurfaceDrift,peakTensionRatio,passed:result.passed,stars:result.stars,shots:sim.getPerformance().shotsUsed,fullThrustReplacementPassed:fullPassed,maxThrustSweeps:sweeps});
  console.log(`PASS ${level.id} | ${result.stars} stars | idle stable | ${sweeps.length?`max-thrust ${sweeps.length} sweeps rejected`:'reference replay'}`);
}
fs.writeFileSync(path.join(root,'doc/campaign-validation.json'),JSON.stringify(results,null,2)+'\n');

// Input lifecycle, Chinese game flow support, and save identity regressions.
const {GameController}=require('./game-controller.js'),{Camera}=require('./camera.js'),{Bullet}=require('./bullet.js'),{PhysicsEngine}=require('./physics.js');
global.window=new EventTarget();
const canvas=new EventTarget();Object.assign(canvas,{width:1200,height:800,getBoundingClientRect:()=>({left:10,top:20,width:600,height:400})});
const camera=new Camera(canvas);camera.x=600;camera.y=400;
const physics=new PhysicsEngine();const probe=new Bullet({x:350,y:400,deltaV:100});
let controller;for(let i=0;i<12;i++){controller=new GameController(canvas,{physics,bullets:[probe],camera});controller.destroy();}
controller=new GameController(canvas,{physics,bullets:[probe],camera});
const space=new Event('keydown',{cancelable:true});Object.assign(space,{key:' ',code:'Space'});window.dispatchEvent(space);
assert(controller.isSpacePaused());assert.deepEqual(controller._getCanvasPos({clientX:185,clientY:220}),{x:350,y:400});
controller.dragBullet=probe;controller.dragging=true;controller.dragStartX=350;controller.dragStartY=400;controller.dragCurrentX=-250;controller.dragCurrentY=400;
controller._updatePrediction();const predicted=controller.predictedPath[59],burn=controller.getBurnPreview();
const actual=new Bullet({x:350,y:400,deltaV:100});actual.applyDeltaV(300,0);for(let i=0;i<60;i++)physics.stepParticle(actual);
assert(Math.abs(predicted.x-actual.x)<1e-8);assert.equal(burn.deltaV,100);assert(burn.fuelRatio<1e-10);controller.destroy();

const fixture=LevelManager.load({gravity:0,orbits:[{type:'circular',x:50,y:30,radius:100,period:20}],buildings:[{orbit:0,pointDefaults:{radius:3},points:[{x:-20,y:0,fixed:true},{x:20,y:0,fixed:true},{x:0,y:25}],springs:[]}]});
const fb=fixture.buildings[0];assert.equal(fb.points[1].x-fb.points[0].x,40,'Frame anchors must not overlap.');
const future=fb.frameOrbit.getWorldPosition(5,fixture.orbits);
assert(fb.checkCollisionAt(future.x,future.y+25,1,5),'Free hull points move with the future building frame.');
assert(!fb.checkCollisionAt(future.x,future.y+25,1),'Current and future hull positions differ.');
const contacts=new Building(),a=contacts.addPoint({x:-20,y:0,fixed:true}),b=contacts.addPoint({x:20,y:0,fixed:true});
contacts.addPoint({x:0,y:0});contacts.addSpring({a,b});contacts.step(1/60,new PhysicsEngine({G:0}),[]);
assert(contacts.points.every(p=>Number.isFinite(p.x+p.y)),'Exact beam contact must remain finite.');
const central=new PhysicsEngine();central.addGravitySource(0,0,8000);assert.deepEqual(central.calcGravityAccel(0,0),{ax:0,ay:0});
const cluster=new Bullet({type:'cluster'});cluster.applyDeltaV(cluster.maxDeltaV,0);
for(const child of cluster.getSplitBullets().map(def=>new Bullet(def))){assert(Number.isFinite(child.remainingDeltaV));assert(Number.isFinite(child.getEffectiveExplosionRadius()));}
const wire=new Building(),wa=wire.addPoint({x:0,y:0,fixed:true}),wb=wire.addPoint({x:40,y:0,fixed:true});wire.addSpring({a:wa,b:wb,breakTension:1800,burnRate:600});
new Bullet({type:'incendiary'}).applyIncendiary(wire);for(let i=0;i<120;i++)wire.step(1/60,new PhysicsEngine({G:0}),[]);assert(wire.springs[0].breakTension<610);

const store=new Map();global.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
global.document={cookie:'gravity_dawn_save='+encodeURIComponent(JSON.stringify({levels:{'c0-l0':{stars:2,score:500}}}))};
const storage=require('./storage.js');storage.configureProgress([{levels:[{id:'fortress-test'}]},{levels:[{legacyKey:'c0-l0'}]}]);
assert.equal(storage.getBest(1,0).score,500);assert.equal(storage.getBest(0,0),null);
storage.saveLevel(0,0,3,300,true);storage.saveLevel(0,0,0,0,false);assert.equal(storage.getBest(0,0).stars,3);
// Exercise the actual Webpack chapter loader, including its legacy-key offset.
const loader={exports:{}};
require('vm').runInNewContext(fs.readFileSync(path.join(__dirname,'campaign-data.js'),'utf8').replace('export const CHAPTERS =','module.exports ='),{
  require:{context:()=>file=>json('data/levels/'+file.replace(/^\.\//,''))},module:loader,
});
const chapters=loader.exports,campaignCount=json('data/levels/campaign-index.json').length;
assert.equal(campaignCount,9);assert.equal(chapters.length,12);
assert(chapters.slice(0,campaignCount).every(c=>c.levels.length===4));
chapters.slice(campaignCount).forEach((c,ci)=>c.levels.forEach((l,li)=>assert.equal(l.legacyKey,`c${ci}-l${li}`)));
storage.configureProgress(chapters);assert.equal(storage.getBest(campaignCount,0).score,500);
console.log('PASS 36 mission replays, advanced three-star budgets, stable parking orbits, maximum-thrust counterchecks, moving frames, exact contacts, payloads, input and expanded-campaign save regressions.');
