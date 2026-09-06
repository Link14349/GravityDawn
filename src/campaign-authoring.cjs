/** Deterministic campaign blueprints. Run npm run author:campaign to emit plain level JSON. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../data/levels');
const round = n => Math.round(n * 1000) / 1000;

class FortBlueprint {
  constructor(name) { this.data = { name, points: [], springs: [] }; }
  point(x, y, extra = {}) {
    this.data.points.push({ x: round(x), y: round(y), mass: 18, radius: 4, score: 10, explosionRadius: 0, explosionImpulse: 0, ...extra });
    return this.data.points.length - 1;
  }
  link(a, b, extra = {}) { this.data.springs.push({ a, b, stiffness: 1400, damping: 65, breakTension: 6500, ...extra }); }
  target(x, y) { return this.point(x, y, { fixed: true, isEnemy: true, important: true, radius: 8, renderRadius: 9, hp: 220, score: 200 }); }
  // A triangulated double rail, not a cosmetic outline. Every segment collides.
  shell(vertices, width = 18, anchorEvery = 4) {
    const outer = vertices.map((v,i)=>{
      const prev=vertices[(i+vertices.length-1)%vertices.length],next=vertices[(i+1)%vertices.length];
      const a=Math.hypot(v[0]-prev[0],v[1]-prev[1]),b=Math.hypot(next[0]-v[0],next[1]-v[1]);
      const n1=[(v[1]-prev[1])/a,-(v[0]-prev[0])/a],n2=[(next[1]-v[1])/b,-(next[0]-v[0])/b];
      const k=width/Math.max(.2,1+n1[0]*n2[0]+n1[1]*n2[1]);
      return [v[0]+(n1[0]+n2[0])*k,v[1]+(n1[1]+n2[1])*k];
    });
    const rails=[];
    vertices.forEach((v,i)=>{
      const next=(i+1)%vertices.length,w=vertices[next],a=outer[i],b=outer[next];
      const count=Math.ceil(Math.max(Math.hypot(w[0]-v[0],w[1]-v[1]),Math.hypot(b[0]-a[0],b[1]-a[1]))/32);
      for(let j=0;j<count;j++){
        const t=j/count,corner=j===0;
        rails.push([this.point(v[0]+(w[0]-v[0])*t,v[1]+(w[1]-v[1])*t,{fixed:corner||j%anchorEvery===0}),
          this.point(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,{fixed:corner})]);
      }
    });
    rails.forEach(([a, b], i) => {
      const [c, d] = rails[(i + 1) % rails.length];
      this.link(a, b); this.link(a, c); this.link(b, d); this.link(i % 2 ? a : b, i % 2 ? d : c);
    });
    return this;
  }
  box(x, y, w, h, width = 18) { return this.shell([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]], width); }
  ring(x, y, r, n = 10, width = 18) { return this.shell(Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),y+r*Math.sin(i*2*Math.PI/n)]),width); }
  beam(ax, ay, bx, by, width = 16) {
    const length = Math.hypot(bx-ax,by-ay), nx = -(by-ay)/length*width/2, ny = (bx-ax)/length*width/2;
    const count = Math.ceil(length / 30), rails = [];
    for (let i=0;i<=count;i++) {
      const x=ax+(bx-ax)*i/count,y=ay+(by-ay)*i/count;
      rails.push([this.point(x+nx,y+ny,{fixed:i===0||i===count}),this.point(x-nx,y-ny,{fixed:i===0||i===count})]);
    }
    rails.forEach(([a,b],i)=>{this.link(a,b);if(i<count){const [c,d]=rails[i+1];this.link(a,c);this.link(b,d);this.link(a,d);}});
    return this;
  }
  finish() {
    const pointDefaults={mass:18,radius:4,score:10,explosionRadius:0,explosionImpulse:0};
    const springDefaults={stiffness:1400,damping:65,breakTension:6500};
    const compact=(object,defaults)=>Object.fromEntries(Object.entries(object).filter(([key,value])=>defaults[key]!==value));
    return {...this.data,pointDefaults,springDefaults,points:this.data.points.map(p=>compact(p,pointDefaults)),springs:this.data.springs.map(s=>compact(s,springDefaults))};
  }
}
// Each blueprint has an actual interior, triangulated armor, and protected command units.
function fort(shape, name) {
  const f = new FortBlueprint(name);
  if (shape === 'skiff') {
    f.shell([[-25,-22],[18,-22],[30,0],[18,22],[-25,22]],10);
    f.target(-8,0); f.target(10,0);
  } else if (shape === 'capsule') {
    f.shell([[-42,-35],[-18,-54],[32,-54],[52,-25],[52,35],[18,54],[-32,54],[-42,20]]);
    f.target(0,-16); f.target(0,16);
  } else if (shape === 'bastion') {
    f.shell([[-48,-52],[10,-78],[80,-52],[112,0],[80,52],[10,78],[-48,52],[-28,0]],22);
    f.target(8,-23); f.target(8,23);
    f.beam(53,-40,77,0); f.beam(77,0,53,40);
  } else if (shape === 'hangar') {
    f.shell([[-46,-80],[20,-80],[78,-42],[78,42],[20,80],[-46,80]],22);
    f.beam(-27,0,55,0,12); f.target(0,-28); f.target(0,28);
  } else if (shape === 'bridge') {
    f.shell([[-98,-35],[-26,-35],[-26,-14],[26,-14],[26,-35],[98,-35],[98,35],[26,35],[26,14],[-26,14],[-26,35],[-98,35]],14);
    f.target(-62,0); f.target(62,0);
  } else if (shape === 'citadel') {
    f.shell([[-62,-148],[18,-148],[18,-98],[96,-98],[118,-50],[118,90],[50,135],[-62,135]],22);
    f.box(-22,-78,36,38,10); f.box(12,72,64,50,12);
    f.target(-22,-78); f.target(12,72);
  } else if (shape === 'crucible') {
    f.shell([[-42,-44],[42,-44],[42,-100],[80,-100],[80,-44],[132,-44],[132,44],[80,44],[80,100],[42,100],[42,44],[-42,44]],18);
    f.target(0,-13); f.target(0,13); f.target(88,0);
    f.beam(52,-28,52,28,12);
  } else if (shape === 'vault') {
    f.ring(0,0,48,12,16); f.shell([[-95,-82],[50,-100],[104,-45],[104,65],[0,103],[-95,70]],20);
    f.target(-8,-14); f.target(8,14);
  } else if (shape === 'array') {
    f.shell([[-34,-115],[34,-115],[34,-28],[94,-28],[94,28],[34,28],[34,115],[-34,115]],14);
    f.target(0,-85); f.target(0,85); f.target(62,0);
  } else if (shape === 'crown') {
    f.shell([[-48,-40],[-10,-85],[36,-40],[76,-85],[110,-40],[110,70],[-48,70]],20);
    f.beam(30,-3,30,43,12); f.target(-7,17); f.target(70,17);
  } else if (shape === 'needle') {
    f.shell([[-42,-100],[42,-100],[62,-50],[42,100],[-42,100],[-62,50]],20);
    f.beam(-30,0,30,0,12); f.target(0,-48); f.target(0,48);
  } else if (shape === 'flagship') {
    f.shell([[-60,-55],[-12,-80],[60,-80],[110,-40],[160,-40],[185,0],[160,40],[110,40],[60,80],[-12,80],[-60,55]],22);
    f.box(8,0,55,80,14); f.target(8,-20); f.target(8,20); f.target(112,0);
    f.beam(66,-57,90,-37,10); f.beam(66,57,90,37,10);
  } else throw new Error(shape);
  return f.finish();
}

// Small, free-standing surface truss: no core, fixed point, or kinematic building frame.
function surfaceBase(radius, angle = 0) {
  const f = new FortBlueprint('地表桁架站');
  const node=(x,y)=>f.point(x,y,{mass:12,radius:4});
  const sides=[];
  for (const side of [-1,1]) {
    const outer=node(side*45,-Math.sqrt((radius+4)**2-45**2));
    const inner=node(side*18,-Math.sqrt((radius+4)**2-18**2));
    const floor=node(side*24,-radius-34);
    const brace=node(side*42,-radius-49);
    const roof=node(side*24,-radius-67);
    for(const [a,b] of [[outer,inner],[outer,floor],[inner,floor],[outer,brace],[floor,brace],[brace,roof],[floor,roof]])f.link(a,b);
    sides.push({floor,roof});
  }
  f.link(sides[0].floor,sides[1].floor);
  f.link(sides[0].roof,sides[1].roof);
  const peak=node(0,-radius-81);
  for(const side of sides)f.link(side.roof,peak);
  f.target(-10,-radius-44); f.target(10,-radius-44);
  const b=f.finish();
  for (const p of b.points) {
    delete p.fixed;
    if(p.isEnemy){p.mass=12;p.radius=7;}
    const x=p.x,y=p.y;
    p.x=round(x*Math.cos(angle)-y*Math.sin(angle));
    p.y=round(x*Math.sin(angle)+y*Math.cos(angle));
  }
  return b;
}

const chapters = [
  ['exp-calibration','引力初航','从第一条弯曲航线出发。','只用一关熟悉反向拖拽与燃料。之后立即进入引力场，学习继承轨道速度、选择撞击面和从轨道攻击地表。'],
  ['exp-gravity','群星航道','行星之间没有永远笔直的航线。','行星遮挡、移动引力源、同轨双月和地表双据点依次出现。观察预测线随相位改变，选择低耗油的进近窗口。'],
  ['exp-interception','追逐星海','行星、卫星与目标一同运动。','从随行星公转的哨站，到椭圆快车、卫星的卫星与错向护航。先观察完整运动，再把弹体送往目标未来的位置。'],
  ['exp-payloads','引力破壁','在引力场中使用不同载荷。','穿甲、分裂、燃烧和局部引力井各保留一个任务。先选择航线，再决定从哪一侧破壁、何时补射。'],
  ['exp-transfer','多星突入','利用不同引力源之间的通路。','三源分流、运动船坞、绕共同中心运行的双星和四源封锁，要求同时考虑星体遮挡、目标相位与弹药分配。'],
  ['exp-expedition','黎明远征','在运动星系中完成最后突击。','双层蜂群、会合窗口、旗舰护航与四星要塞结合此前的技巧。重新观察每次撞击后的通道，保留弹药给最后的目标。'],
];
const fixed = (x,y,mass,radius,label='引力主星') => ({mass,radius,label,orbit:{type:'fixed',x,y}});
const moon = (parent,radius,period,phase,mass,size,label='巡航行星') => ({mass,radius:size,label,orbit:{type:'circular',parent,radius,period,phase}});
const ellipse = (parent,rx,ry,period,phase,mass,size,label='椭圆行星') => ({mass,radius:size,label,orbit:{type:'elliptical',parent,rx,ry,period,phase}});
const E='explosive',K='kinetic';
// Six chapters, four distinct encounters each. Body parents refer to earlier body orbits.
const specs = [
  ['双壳校准','燃料与爆心',[['capsule',160,0]], {ammo:[E],start:[-180,0]},
    '双层桁架包住两个控制单元。悬停弹体，再向左短拖；爆心必须覆盖两个内舱。','从约 40～60 的 Δv 开始。拉满会耗尽燃料；下一关就进入真实引力场。'],
  ['近地点轰炸','继承轨道速度',[['capsule',190,-125]], {bodies:[fixed(-90,70,3200,56)],orbit:180,phases:[2.8],ammo:[E]},
    '弹体绕行星运行，发射时会继承切向速度。用小推力改变轨道，让近地点接近前哨。','先看预测线的弯曲方向，再调整推力；不要直接把箭头指向目标。'],
  ['引力棱堡','选择进近侧',[['bastion',210,10]], {bodies:[fixed(-130,60,3000,58)],orbit:175,phases:[2.7],ammo:[E]},
    '行星让弹道弯向棱堡。左侧凹口距内舱较近，突出装甲会提前拦弹。','结合初始切向速度，从凹口一侧接近；留足燃料覆盖上下两个控制单元。'],
  ['月面桁架','从轨道攻击地表',[], {bodies:[fixed(0,45,1400,96,'驻防行星')],surface:[{body:0}],orbit:215,phases:[2.3],ammo:[E],zoom:1.05},
    '桁架站直接坐落在行星表面，舱内人员和构件都受引力作用。降低轨道，先撞建筑而不是地面。','利用上方进近窗口攻击屋顶或侧墙；观察撞击后自由构件的塌落。'],

  ['行星背面','曲线绕行',[['bastion',220,45]], {bodies:[fixed(-100,45,4200,68)],orbit:205,phases:[Math.PI],ammo:[E]},
    '行星遮住堡垒的直射路径。选择从上方或下方绕过行星的弯曲航线。','悬停冻结观察；既要避开地表，也要让末段接近棱堡凹口。'],
  ['游月弯道','移动引力源',[['hangar',265,-120]], {bodies:[fixed(-150,50,3600,60),moon(0,240,42,0,900,28,'游月')],orbit:145,phases:[2.7,4.1],ammo:[E,E]},
    '游月会穿过发射区与机库之间，改变引力偏折与遮挡。观察它离开通道的时机。','预测线已计入行星未来的位置；等待不同相位，比较航线与所需燃料。'],
  ['双月哨站','同轨双目标',[['capsule',0,-115,{type:'fixed',parent:1}],['capsule',0,115,{type:'fixed',parent:2}]],
    {bodies:[fixed(0,0,3000,46),moon(0,350,76,0,650,30,'青月'),moon(0,350,76,Math.PI,650,30,'白月')],orbit:110,phases:[1.6,4.5],ammo:[E,E],zoom:.85},
    '两颗月亮沿同一轨道保持对望，各自带着一座哨站。目标位置与三源引力同时变化。','两枚弹体分别选择顺势的哨站；不要把第一发的方向复制给第二发。'],
  ['两岸地表站','两个重力方向',[],
    {bodies:[fixed(-210,65,1400,96,'西岸'),fixed(220,65,1400,96,'东岸')],surface:[{body:0,angle:-Math.PI/2},{body:1,angle:Math.PI/2}],orbit:220,phases:[2,4.3],launchBodies:[0,1],ammo:[E,E],zoom:.85},
    '两座自由桁架站分别落在不同的行星上，弹体也从各自的泊车轨道出发。为两岸各留一次攻击。','先观察重力方向与屋顶位置；同一拖拽方向不一定适合另一颗星球。'],

  ['行星追逐','随行星移动的堡垒',[['hangar',0,-150,{type:'fixed',parent:1}]],
    {bodies:[fixed(-80,40,3500,52),moon(0,400,86,.2,900,38,'机库行星')],orbit:110,phases:[2.5,4],ammo:[E,E],zoom:.85},
    '整座机库跟随行星公转。引力场和目标一起移动，要同时留出绕星路径与提前量。','先观察机库经过近侧的窗口，再投入范围载荷；第二发用于清理剩余隔舱。'],
  ['陨星快车','椭圆穿越',[['skiff',0,-65,{type:'fixed',parent:1}]],
    {bodies:[fixed(0,40,3200,50),ellipse(0,350,240,52,0,500,24,'快车行星')],orbit:110,phases:[2.5,4],ammo:[E,E],zoom:.85},
    '小行星沿扁长椭圆穿越星系，哨站随它一起运动。通道在长轴两端与短轴附近明显不同。','等它来到有利一侧再出手；高速追击会耗尽爆炸燃料。'],
  ['月中之月','三级轨道',[['skiff',0,-55,{type:'fixed',parent:2}]],
    {bodies:[fixed(-80,30,3000,48),moon(0,380,88,0,850,32,'母行星'),moon(1,150,31,1.1,220,16,'子卫星')],orbit:100,phases:[2.2,4.2],ammo:[E,E],zoom:.78},
    '哨站跟随卫星，而卫星又绕公转中的母行星运动。三个引力源共同影响弹体。','先观察短周期卫星的摆动，再选择较近的窗口；瞄准它未来的外墙。'],
  ['错向护航','不同运动方向',[['skiff',0,-72,{type:'fixed',parent:1}],['bastion',350,160,{rx:45,ry:30,period:-32}]],
    {bodies:[fixed(-90,40,3100,50),moon(0,240,65,.4,700,30,'护航行星')],orbit:100,phases:[2.1,3.6,4.8],ammo:[E,E,E],zoom:.8},
    '护卫随行星逆时针公转，后方棱堡沿反方向巡航。两条运动节奏会不断错开。','先选择有利的护卫窗口，再为棱堡凹口规划另一条航线。'],

  ['穿甲内环','引力场中破壁',[['vault',180,-20]],
    {bodies:[fixed(-170,90,3200,56)],orbit:170,phases:[2.6,4],ammo:[K,E]},
    '双层外堡保护内环，发射区处于引力场中。动能弹切开外墙后，再将爆心送近内舱。','分别检查两种弹体的初始速度；破口不会自动落在下一发的航线上。'],
  ['三叉天线阵','分裂与补射',[['array',190,0]],
    {bodies:[fixed(-160,70,2800,52)],orbit:150,phases:[2.2,3.4,4.6],ammo:['cluster',E,E]},
    '三个独立舱室呈扇形分布。让弹体先绕过行星，再在接近阵列前右键分裂。','过早分裂会让子弹被行星拉开；为未覆盖的舱室保留补射机会。'],
  ['熔断堡垒','燃烧后再突入',[['citadel',180,0]],
    {bodies:[fixed(-180,100,3000,55)],orbit:170,phases:[2.1,2.9,3.8,4.8],ammo:['incendiary',K,E,E],fragile:true},
    '内舱各有独立外壳。燃烧削弱连接，随后从轨道投入穿甲或范围载荷。','点燃后观察几秒；用新的预测线穿过实际破口，再清理剩余内舱。'],
  ['引力拆解','自然引力与人工引力井',[['crown',230,-25]],
    {bodies:[fixed(-150,75,2900,52),moon(0,245,58,Math.PI,650,26,'外巡月')],orbit:120,phases:[2,3.3,4.6],ammo:['gravity',E,E]},
    '自然引力源持续移动，撞击产生的短暂引力井又会拉扯双冠堡。利用结构受力变化寻找破口。','人工引力井也会改变补射弹道；观察它消失前后的预测线再决定发射。'],

  ['三星分流','三条进近通道',[['hangar',280,-145],['bastion',265,150]],
    {bodies:[fixed(-200,0,3500,58),fixed(65,-15,900,30,'中继星'),moon(1,75,30,Math.PI/2,400,18,'摆渡月')],orbit:150,phases:[2.2,3.4,4.6],ammo:[E,E,K],zoom:.83},
    '第三颗星体绕中继星运动，上下出口的引力与遮挡随之改变。分别选择机库和棱堡的进近侧。','先看通道里游月的未来位置；动能弹可用于开路或处理最后一个目标。'],
  ['迁徙船坞','随行星迁移的多舱结构',[['crucible',30,-165,{type:'fixed',parent:1}],['capsule',510,240]],
    {bodies:[fixed(-120,20,3300,52),moon(0,440,104,0,800,34,'船坞行星')],orbit:105,phases:[2,2.9,3.8,4.8],ammo:[K,E,E,E],zoom:.77},
    '十字船坞随行星迁移，南侧前哨独立驻守。主舱与偏置舱需要不同撞击位置。','为船坞保留穿甲与范围载荷，行星经过空壳附近时重新检查遮挡。'],
  ['双星乱流','绕共同中心运动',[['vault',280,-140],['hangar',300,135]],
    {bodies:[{mass:2200,radius:38,label:'双星甲',orbit:{type:'circular',x:-160,y:0,radius:100,period:40}},
      {mass:2200,radius:38,label:'双星乙',orbit:{type:'circular',x:-160,y:0,radius:100,period:40,phase:Math.PI}},fixed(280,0,650,32,'军港星')],
      orbit:70,phases:[1.5,2.5,4,5],launchBodies:[0,0,1,1],ammo:[K,E,E,E],zoom:.8},
    '两颗引力源绕共同中心公转，弹体分别停泊在两星周围。向外飞行时还要避开军港星。','不要照搬单星的转移轨道；双星相位决定哪一侧较容易脱离。'],
  ['四源封锁','上下通道随时间交替',[['bridge',220,-195],['citadel',330,25],['capsule',100,215]],
    {bodies:[fixed(-230,20,3300,54),fixed(70,0,900,32,'门卫星'),moon(1,115,34,Math.PI/2,300,18,'北巡月'),fixed(340,235,500,27,'远岸星')],
      orbit:150,phases:[1.9,2.7,3.5,4.3,5.2],ammo:[E,K,E,E,E],zoom:.76},
    '四个引力源分隔双塔、内舱堡与南侧前哨，巡月不断开合中间通道。','双塔两端与内舱分别需要覆盖；用等待换取更好的通道和更少的推力。'],

  ['双层蜂群','两颗行星与近月护卫',[['skiff',0,-55,{type:'fixed',parent:3}],['skiff',0,70,{type:'fixed',parent:2}]],
    {bodies:[fixed(0,0,3000,48),moon(0,370,86,0,700,30,'内巡行星'),moon(0,570,118,Math.PI,650,28,'外巡行星'),moon(1,150,33,1.2,220,15,'近月护卫')],
      orbit:100,phases:[1.8,3,4.3],ammo:[E,E,E],zoom:.7},
    '内外行星不同步运行，近月护卫又绕内巡行星运动。两处目标对应不同层级的运动。','内侧的短周期窗口和外侧的长周期窗口分别观察，不必同时发射。'],
  ['船坞会合','移动堡垒与游月交会',[['citadel',190,-245,{rx:35,ry:25,period:34}],['crown',160,245,{rx:50,ry:25,period:-29}]],
    {bodies:[fixed(-220,45,3300,54),fixed(180,25,800,30,'船坞主星'),ellipse(1,110,52,42,0,200,12,'穿梭月')],
      orbit:150,phases:[2,2.8,3.6,4.4,5.2],ammo:[K,E,E,E,E],zoom:.76},
    '上下两座大型船坞反向运动，穿梭月从中间掠过。厚壁破口和星体遮挡都随时间变化。','对每一次补射重新计算提前量，避免向旧破口的世界坐标盲射。'],
  ['旗舰护航','四源轨道战',[['flagship',0,-185,{type:'fixed',parent:1}],['skiff',0,70,{type:'fixed',parent:2}]],
    {bodies:[fixed(-120,25,3300,52),moon(0,520,124,0,900,36,'旗舰行星'),moon(0,330,83,Math.PI,600,26,'护航行星'),moon(1,55,25,0,200,10,'伴月')],
      orbit:100,phases:[1.8,2.5,3.2,3.9,4.6],ammo:[K,'incendiary',E,E,E],fragile:true,zoom:.72},
    '旗舰和护卫分别绕主星运动，旗舰行星还有自己的伴月。先选窗口破壁，再分区清理三个旗舰舱室。','为远端指挥室留一枚范围载荷，伴月靠近时重新检查末段航线。'],
  ['黎明要塞','四星与三座运动堡垒',[['bastion',-25,-220,{rx:20,ry:15,period:25}],['flagship',285,-20,{rx:25,ry:30,period:37}],['capsule',30,205,{rx:35,ry:20,period:-29}]],
    {bodies:[fixed(-220,0,3500,54),fixed(70,0,700,28,'要塞星'),moon(1,70,35,Math.PI/2,220,16,'门卫月'),fixed(350,215,450,25,'黎明星')],
      orbit:145,phases:[1.8,2.5,3.2,3.9,4.6,5.3],ammo:[K,E,E,'incendiary',E,E],fragile:true,zoom:.72},
    '四个引力源与三座运动堡垒构成最后防线。清除护卫、旗舰和南侧前哨的全部控制单元。','结合引力通道、相位、破壁与剩余燃料规划顺序；每发之后先观察，再投入下一枚弹体。'],
];

function makeLevel(spec, i) {
  const [name,skill,placements,opts,text,hint]=spec,ci=Math.floor(i/4),li=i%4,chapter=chapters[ci];
  // Stable semantic IDs prevent removed/reordered missions from inheriting unrelated scores.
  const level={id:i===0?'fortress-calibration-01':`dawn-${chapter[0].slice(4)}-${String(li+1).padStart(2,'0')}`,name,skill,difficulty:i+1,gravity:200,flightTimeout:30,
    camera:{x:0,y:0,zoom:opts.zoom||.95},orbits:[],stars:[],planets:[],bullets:[],buildings:[]};
  const wideViews={6:{x:5,y:0,zoom:.49},8:{x:-64,y:-79,zoom:.5},10:{x:-94,y:-22,zoom:.49},17:{x:-5,y:-116,zoom:.45},20:{x:3,y:49,zoom:.42},21:{x:0,y:-40,zoom:.64},22:{x:-56,y:-98,zoom:.39}};
  if(wideViews[i])level.camera=wideViews[i];
  const orbit=def=>{level.orbits.push(def);return level.orbits.length-1;};
  for(const body of opts.bodies||[])level.planets.push({...body,orbit:orbit(body.orbit),collisionRadius:body.radius});
  opts.ammo.forEach((type,bi)=>{
    const b={type};
    if(opts.bodies){const bodyIndex=opts.launchBodies?.[bi]??0;b.orbitAround={bodyIndex,altitude:opts.orbit-opts.bodies[bodyIndex].radius,phase:opts.phases[bi]};}
    else{b.x=opts.start[0]-bi*22;b.y=opts.start[1]+bi*48-(opts.ammo.length-1)*20;}
    level.bullets.push(b);
  });
  placements.forEach(([shape,x,y,motion],bi)=>{
    const names={skiff:'近月护卫',capsule:'双壳前哨',bastion:'棱堡',hangar:'分舱机库',bridge:'双塔连桥',citadel:'内舱堡',vault:'重装内环',crucible:'十字船坞',array:'三叉阵列',crown:'双冠堡',needle:'长轴船坞',flagship:'装甲旗舰'};
    const b=fort(shape,`${String(bi+1).padStart(2,'0')} / ${names[shape]}`);
    b.orbit=orbit(motion?{type:'elliptical',x,y,phase:0,...motion}:{type:'fixed',x,y});
    if(opts.fragile&&['citadel','flagship'].includes(shape))b.springs.forEach((s,si)=>{if(si%4===3){s.breakTension=shape==='flagship'?3600:1800;s.burnRate=600;}});
    level.buildings.push(b);
  });
  for(const s of opts.surface||[]){const b=surfaceBase(opts.bodies[s.body].radius,s.angle);b.bindToBody=s.body;level.buildings.push(b);}
  const targets=level.buildings.reduce((n,b)=>n+b.points.filter(p=>p.important).length,0);
  level.objective=`摧毁全部 ${targets} 个内部控制单元，得分达到 ${targets*200} 分。`;
  level.guidance={title:skill,text,hint};
  level.winCondition={importantTargetsAll:true,destructionThreshold:0,minScore:targets*200,parShots:opts.ammo.length,parDeltaV:opts.ammo.length*100};
  if(i===0)level.guidance.firstShot={dvx:50,dvy:0};
  if(li===0)level.cutscene={title:chapter[2],kicker:`第 ${ci+1} 章 / ${chapter[1]}`,scenes:[{title:chapter[2],dialogue:{speaker:'战术教官',text:chapter[3]}},{title:'本次任务',dialogue:{speaker:'任务控制中心',text:text+' '+hint}}]};
  return level;
}
const levels=specs.map(makeLevel);
if(require.main===module){
  chapters.forEach(([dir,name,subtitle,description],ci)=>{
    fs.writeFileSync(path.join(ROOT,dir,'index.json'),JSON.stringify({name,subtitle,description,levels:[1,2,3,4].map(n=>`lv${n}`)},null,2)+'\n');
    levels.slice(ci*4,ci*4+4).forEach((l,li)=>fs.writeFileSync(path.join(ROOT,dir,`lv${li+1}.json`),JSON.stringify(l,null,2)+'\n'));
    for(const n of [5,6])fs.rmSync(path.join(ROOT,dir,`lv${n}.json`),{force:true});
  });
  console.log(`Wrote ${levels.length} deterministic gravity missions.`);
}
module.exports={levels,FortBlueprint};
