/** Offline shot search. Candidates are estimates; only production replay certifies a solution. */
const {LevelManager,FlightSimulation,Building}=require('./simulation-node.cjs');
const {Bullet}=require('./bullet.js');
const targets = sim => sim.buildings.flatMap(b=>b.points).filter(p=>p.important&&p.alive);
function replay(level,actions,endFrame) {
  const sim=new FlightSimulation(LevelManager.load(level));
  for(let frame=0;frame<endFrame;frame++){
    const control={triggeredBullets:[],bullets:sim.bullets};
    for(const a of actions)if(a.frame===frame){
      const b=sim.bullets[a.bullet];
      if(a.effect){b.triggerEffect();control.triggeredBullets.push(b);continue;}
      const first=!b.launched;
      b.applyDeltaV(a.dvx,a.dvy);if(first)b.launchTime=sim.physicsTime;
    }
    sim.step(control);
  }
  return sim;
}
function candidates(sim,bi,{max=false,angleStep=2,speeds=null}={}) {
  const b=sim.bullets[bi],found=[];
  if(b.maxHp>0 && !max)return kineticCandidates(sim,bi);
  if(b.launched||!b.alive)return found;
  const shapes=sim.buildings.map(bld=>{
    const ps=bld.points.filter(p=>p.alive);
    return {bld,minX:Math.min(...ps.map(p=>p.x))-20,maxX:Math.max(...ps.map(p=>p.x))+20,minY:Math.min(...ps.map(p=>p.y))-20,maxY:Math.max(...ps.map(p=>p.y))+20,
      base:bld.frameOrbit?.getWorldPosition(sim.physicsTime,sim.orbits),
      motion:Array.from({length:901},(_,f)=>bld.frameOrbit?.getWorldPosition(sim.physicsTime+f/60,sim.orbits))};
  });
  const br=b.maxHp>0?b.renderRadius:6;
  for(const speed of speeds|| (max?[b.remainingDeltaV]:[20,30,40,50,60,70,80,95,110,130,155,180])){
    const model=new Bullet({type:b.type,payloadMass:b.payloadMass,fuelMass:b.fuelMass,deltaV:b.remainingDeltaV,explosionRadius:b.explosionRadius});model.applyDeltaV(speed,0);
    const radius=model.getEffectiveExplosionRadius();
    for(let deg=0;deg<360;deg+=angleStep){
      const angle=deg*Math.PI/180,dvx=Math.cos(angle)*speed,dvy=Math.sin(angle)*speed;
      const state={x:b.x,y:b.y,vx:b.vx+dvx,vy:b.vy+dvy};
      for(let f=1;f<=900;f++){
        if(sim.physics.stepParticle(state,undefined,6))break;
        if(Math.abs(state.x)>1600||Math.abs(state.y)>1600)break;
        let impact=null,shapeHit=null;
        for(const sh of shapes){
          const at=sh.motion[f],dx=at?at.x-sh.base.x:0,dy=at?at.y-sh.base.y:0;
          const x=state.x-dx,y=state.y-dy;
          if(x<sh.minX||x>sh.maxX||y<sh.minY||y>sh.maxY)continue;
          const collision=sh.bld.checkCollisionAt(x,y,br);
          if(collision){impact={...collision,x:state.x,y:state.y};shapeHit=sh;break;}
        }
        if(impact){
          const enemy=shapeHit.bld.points.filter(p=>p.important&&p.alive);
          const at=shapeHit.motion[f],dx=at?at.x-shapeHit.base.x:0,dy=at?at.y-shapeHit.base.y:0;
          const distances=enemy.map(p=>Math.hypot(p.x+dx-impact.x,p.y+dy-impact.y));
          const kills=distances.filter(d=>d<radius*.5-2).length+(impact.point?.important?1:0);
          const nearest=Math.min(...distances);
          const score=kills*10000+Math.min(20,radius*.5-nearest)*10-f*2-speed*.2;
          found.push({bullet:bi,dvx,dvy,flightFrames:f,score,estimatedKills:kills,hitBuilding:sim.buildings.indexOf(shapeHit.bld)});
          break;
        }
      }
    }
  }
  found.sort((a,b)=>b.score-a.score);
  // Avoid spending the real replay budget on many almost identical shots.
  const selected=[];
  for(const a of found)if(!selected.some(c=>c.hitBuilding===a.hitBuilding&&Math.hypot(c.dvx-a.dvx,c.dvy-a.dvy)<3)){selected.push(a);if(selected.length>=45)break;}
  return selected;
}
function kineticCandidates(sim,bi) {
  const bullet=sim.bullets[bi],found=[];
  if(bullet.launched||!bullet.alive)return found;
  for(const speed of [20,30,40,50,60,80,110,150,180])for(let deg=0;deg<360;deg+=3){
    const angle=deg*Math.PI/180,dvx=speed*Math.cos(angle),dvy=speed*Math.sin(angle);
    const state={x:bullet.x,y:bullet.y,vx:bullet.vx+dvx,vy:bullet.vy+dvy};
    const shapes=sim.buildings.map(original=>{
      const b=new Building();b.points=original.points.map(p=>({...p}));
      b.springs=original.springs.map(s=>({...s,a:b.points[original.points.indexOf(s.a)],b:b.points[original.points.indexOf(s.b)]}));
      return {b,original,base:original.frameOrbit?.getWorldPosition(sim.physicsTime,sim.orbits),
        minX:Math.min(...b.points.map(p=>p.x))-22,maxX:Math.max(...b.points.map(p=>p.x))+22,
        minY:Math.min(...b.points.map(p=>p.y))-22,maxY:Math.max(...b.points.map(p=>p.y))+22};
    });
    let hp=bullet.hp,kills=0,hits=0,last=0,lastBuilding=0,closest=Infinity;
    for(let f=1;f<=1080&&hp>0;f++){
      if(sim.physics.stepParticle(state,undefined,6))break;
      if(Math.abs(state.x)>1500||Math.abs(state.y)>1500)break;
      for(let si=0;si<shapes.length;si++){
        const sh=shapes[si],at=sh.original.frameOrbit?.getWorldPosition(sim.physicsTime+f/60,sim.orbits);
        const x=state.x-(at?at.x-sh.base.x:0),y=state.y-(at?at.y-sh.base.y:0);
        if(x<sh.minX||x>sh.maxX||y<sh.minY||y>sh.maxY)continue;
        const p=sh.b.checkBulletCollision(x,y,bullet.renderRadius),sp=p?null:sh.b.checkSpringCollision(x,y,bullet.renderRadius);
        if(!p&&!sp)continue;
        if(p){if(p.important)kills++;p.alive=false;for(const s of sh.b.springs)if(s.a===p||s.b===p)s.alive=false;}
        if(sp)sp.alive=false;
        hp-=Math.hypot(state.vx,state.vy)*.7;hits++;last=f;lastBuilding=si;
        for(const t of sh.b.points)if(t.important&&t.alive)closest=Math.min(closest,Math.hypot(t.x-x,t.y-y));
        break;
      }
    }
    if(hits)found.push({bullet:bi,dvx,dvy,flightFrames:last,score:kills*10000+hits*15-Math.min(closest,300)-last*.1,estimatedKills:kills,hitBuilding:lastBuilding});
  }
  found.sort((a,b)=>b.score-a.score);
  const selected=[];
  for(const a of found)if(!selected.some(c=>Math.hypot(c.dvx-a.dvx,c.dvy-a.dvy)<4)){selected.push(a);if(selected.length>=30)break;}
  return selected;
}
// Preserve class prototypes and shared point/spring references when branching an offline search.
// The returned solution is always certified again from the original level with replay().
function copyState(value, seen=new Map()) {
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  const out=Array.isArray(value)?[]:value instanceof Set?new Set():Object.create(Object.getPrototypeOf(value));
  seen.set(value,out);
  if(value instanceof Set){for(const item of value)out.add(copyState(item,seen));}
  else for(const key of Object.keys(value))out[key]=copyState(value[key],seen);
  return out;
}
function advance(sim,frames){for(let f=0;f<frames;f++)sim.step();return sim;}
function solve(level,{max=false,verbose=false,startFrame=0,initialActions=[]}={}){
  let actions=initialActions.map(a=>({...a})),frame=startFrame,sim=replay(level,initialActions,startFrame);
  for(let turn=0;turn<level.bullets.length;turn++){
    if(!targets(sim).length)break;
    let best=null;
    const movable=sim.allBodies.length || sim.buildings.some(b=>b.frameOrbit && b.frameOrbit.type!=='fixed');
    for(const wait of (max?[0]:movable?[0,120,300,540]:[0])) {
    const atFrame=frame+wait,atSim=wait?advance(copyState(sim),wait):sim;
    for(let bi=0;bi<level.bullets.length;bi++){
      if(sim.bullets[bi].launched)continue;
      const search=candidates(atSim,bi,{max,angleStep:max?1:2});
      const before=targets(sim).length;
      for(const c of search.slice(0,max?5:30)){
        const a={frame:atFrame,bullet:bi,dvx:c.dvx,dvy:c.dvy};
        const end=atFrame+Math.min(c.flightFrames+120,1300),next=copyState(atSim);
        next.bullets[bi].applyDeltaV(a.dvx,a.dvy);next.bullets[bi].launchTime=next.physicsTime;advance(next,end-atFrame);
        if(next.buildings.some(b=>b.points.some(p=>!Number.isFinite(p.x+p.y))))continue;
        const killed=before-targets(next).length;
        const destroyed=sim.buildings.flatMap(b=>b.points).filter(p=>p.alive).length-next.buildings.flatMap(b=>b.points).filter(p=>p.alive).length;
        const cut=sim.buildings.flatMap(b=>b.springs).filter(p=>p.alive).length-next.buildings.flatMap(b=>b.springs).filter(p=>p.alive).length;
        const reward=killed*100000+destroyed*30+cut*3-Math.hypot(a.dvx,a.dvy)*.01-wait*.01;
        if(!best||reward>best.reward)best={a,end,next,reward,killed};
        if(killed>=c.estimatedKills&&killed>0)break;
      }
    }
    if(best?.killed>=Math.min(2,targets(sim).length))break;
    }
    if(!best||best.reward<0)break;
    actions.push(best.a);frame=best.end;sim=best.next;
    if(verbose)console.log('shot',level.id,actions.length,'left',targets(sim).length,'bullet',best.a.bullet,'dv',Math.hypot(best.a.dvx,best.a.dvy).toFixed(1));
  }
  const certified=replay(level,actions,frame);
  return {actions,endFrame:frame,result:LevelManager.checkResult(certified.buildings,level.winCondition,certified.getPerformance()),sim:certified};
}
module.exports={solve,replay,candidates,targets};
if(require.main===module){
  const {levels}=require('./campaign-authoring.cjs'),fs=require('fs');
  const start=Number(process.argv[2]||1)-1,end=Number(process.argv[3]||36),reports=[];
  for(const l of levels.slice(start,end)){
    const s=solve(l,{verbose:true});console.log(s.result.passed?'PASS':'FAIL',l.id,s.result.importantRemaining);
    reports.push({id:l.id,actions:s.actions,endFrame:s.endFrame,...s.result});
    fs.writeFileSync(`/tmp/gravity-solutions-${start+1}.json`,JSON.stringify(reports,null,2));
  }
}
