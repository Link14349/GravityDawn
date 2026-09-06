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
  if (shape === 'capsule') {
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

const chapters = [
  ['exp-calibration','结构攻坚','先读结构，再决定推力。','反向拖拽决定增速；推进和爆炸共享燃料。外壳会拦下弹体，必须把有效爆心送到舱室附近。'],
  ['exp-gravity','轨道攻城','利用弯曲航线接近薄弱侧。','弹体从真实泊车轨道出发，继承切向速度。行星遮挡直线，预测线同时受引力影响。先看航线，再看爆心。'],
  ['exp-interception','移动防线','预测堡垒到达的位置。','整个堡垒沿轨道移动。瞄准提示计算未来碰撞，但运动中的自由构件仍会变形；保留一次修正机会。'],
  ['exp-payloads','破壁战术','破壳与清舱需要不同载荷。','动能弹可以连续穿透，燃烧和引力弹改变结构，爆炸弹负责舱内毁伤。观察破口，再投入下一枚弹体。'],
  ['exp-transfer','纵深突入','在多据点之间分配航线与弹药。','远近目标、不同轨道与多层外墙一起出现。每枚弹体都有限；先解决挡住后续航线的外堡。'],
  ['exp-expedition','要塞远征','完整堡垒群与最终旗舰。','这里不再给出建议推力。识别主堡、护卫和内层指挥舱，使用此前学到的轨道规划、破壁和燃料管理。'],
];
// Fort positions and launch geometry are explicitly composed per mission. No random levels.
const specs = [
  ['双壳校准','燃料与爆心',[['capsule',160,0]], { ammo:['explosive'], start:[-180,0] }, '双层桁架包住两个控制单元。悬停弹体，再向左短拖；爆心必须覆盖两个内舱。','从约 40～60 的 Δv 开始。拉满会耗尽燃料，弹体只切断最外层的一根杆。'],
  ['错位双舱','选择撞击面',[['hangar',200,0]], { ammo:['explosive'],start:[-290,-100] }, '上下舱被隔梁分开。让爆心靠近两舱之间的外墙，不要正对上舱用尽燃料。','减小推力，把预测终点移动到左侧中部；只剩一舱时也需要重试。'],
  ['棱堡斜面','避开厚装甲',[['bastion',180,25]], { ammo:['explosive'],start:[-300,130] }, '棱堡正面向外突出，左侧凹口更靠近内部目标。选择接近内舱的撞击面。','正面厚角会提前触发爆炸。用斜向航线接近左侧凹口，保留足够爆炸半径。'],
  ['双塔连桥','分配弹药',[['bridge',180,-20]], { ammo:['explosive','explosive'],start:[-200,-190] }, '两个独立塔舱由承重桥连接。先清近塔，再把第二枚弹体送到远塔外墙。','桥体被切断不等于任务完成；检查两个琥珀色目标是否都消失。'],
  ['机库群','上下攻线',[['capsule',140,-130],['hangar',220,115]], { ammo:['explosive','explosive'],start:[-260,40] }, '上方前哨与下方机库错开布置。两枚弹体分别选择上、下航线，避免都撞上前哨。','每枚至少清掉一组双舱。可在第一枚爆炸后再发射第二枚，观察剩余目标。'],
  ['校准站围攻','三处据点',[['bastion',180,-155],['capsule',345,25],['capsule',110,160]], { ammo:['explosive','explosive','explosive'],start:[-330,0],zoom:.85 }, '三处堡垒互相遮挡。先拆靠近发射区的上下两堡，再处理后方中继站。','沿建筑之间的空隙调整方向；不要把剩余弹药都投入已经清空的结构。'],

  ['近地点轰炸','继承轨道速度',[['capsule',190,-125]], { planet:[-90,70,3200,56],orbit:180,phases:[2.8],ammo:['explosive'] }, '弹体绕行星运行，发射后仍保留原来的切向速度。尝试在左上方出发，接近前哨底部。','预测线比拖拽箭头更可靠。用小推力调整近地点，避免落进行星。'],
  ['行星背面','曲线绕行',[['bastion',220,45]], { planet:[-100,45,4200,68],orbit:205,phases:[Math.PI],ammo:['explosive'] }, '行星遮住了堡垒的直射路径。选择从上方或下方绕过行星的弯曲航线。','悬停可以冻结观察。既要避开星体表面，也要让航线末端接近左侧凹口。'],
  ['双岸哨塔','不同释放相位',[['capsule',130,-180],['capsule',230,155]], { planet:[-80,0,4600,65],orbit:170,phases:[2.4,3.8],ammo:['explosive','explosive'] }, '两枚弹体位于泊车轨道的不同位置；两座哨塔分居行星两侧。分别寻找顺势的航线。','不要照搬第一枚的拖拽方向。先检查第二枚本身的速度与当前相位。'],
  ['月面机库','避开近地表',[['hangar',130,-110]], { planet:[-120,75,5300,70],orbit:175,phases:[2.6,4.1],ammo:['explosive','explosive'],rearControl:true }, '较强引力会把弹道拉向地表。机库有上下隔舱与后部控制单元。分两次接近，不要让两枚弹体重复撞击同一块空壳。','先清理接近爆心的两舱，再从另一侧接近剩余控制单元；若预测先撞行星，稍微抬高航线。'],
  ['双星弯道','叠加引力',[['bastion',250,-90],['capsule',250,150]], { planet:[-170,50,4300,62],second:[90,75,1700,38],orbit:175,phases:[2.6,3.9],ammo:['explosive','explosive'] }, '小行星在路径中部再次改变航向。分别规划北侧棱堡和南侧前哨的到达方向。','用预测线检查第二次偏折；向目标画一条直线并不能代表真实飞行。'],
  ['环月防御带','轨道综合',[['capsule',35,-225],['bridge',245,-45],['capsule',160,200]], { planet:[-120,0,5200,67],orbit:155,phases:[2.2,3.2,4.2],ammo:['explosive','explosive','explosive'],zoom:.82 }, '三个不同方位的据点组成封锁带。先选最容易接近的外堡，再为双塔连桥保留范围载荷。','双塔最好从桥的中部引爆；若只能清一塔，就要重新考虑前面的弹药分配。'],

  ['巡航前哨','运动提前量',[['capsule',175,0,{rx:25,ry:60,period:24}]], { ammo:['explosive'],start:[-300,-70] }, '前哨沿椭圆巡航。瞄准其未来的位置，让预测碰撞点落在靠近两个内舱的外墙上。','不要追着当前位置加大推力。先用约 70 的 Δv 观察预测线与运动外壳的交点。'],
  ['长轴换向','变化的目标速度',[['hangar',150,0,{rx:105,ry:35,period:22}]], { ammo:['explosive'],start:[-330,-130] }, '机库在长轴两端放慢、在中段加速。利用换向附近较宽的拦截窗口。','预测终点会随着观察时间改变；保留燃料比缩短飞行时间更有价值。'],
  ['双舰错航','不同周期',[['capsule',170,-130,{rx:50,ry:30,period:19}],['bastion',230,130,{rx:30,ry:45,period:27}]], { ammo:['explosive','explosive'],start:[-330,0] }, '两舰采用不同巡航周期。每次发射前都重新观察，不能复制另一艘的提前量。','先处理靠近发射区的那一艘，等待残骸与另一条射线分离后再出手。'],
  ['环行机库','引力与提前量',[['hangar',170,-80,{rx:45,ry:35,period:26}]], { planet:[-140,90,4000,60],orbit:175,phases:[2.7],ammo:['explosive'] }, '运动目标与引力偏折同时存在。弹体从泊车轨道出发，机库也在改变位置。','先确认航线绕过行星，再微调终点。一次很大的加速会削弱清舱范围。'],
  ['交错护航','穿过护卫间隙',[['capsule',95,-125,{rx:40,ry:25,period:20}],['capsule',95,135,{rx:40,ry:25,period:24}],['bastion',300,0,{rx:15,ry:30,period:29}]], { ammo:['explosive','explosive','explosive'],start:[-340,0],zoom:.85 }, '上下护卫屏蔽后方棱堡。先清护卫，利用中间的通路接近主堡凹口。','射线上的空壳仍会挡弹，必要时从侧面绕过去。'],
  ['移动船坞','多舱运动结构',[['needle',160,-40,{rx:45,ry:60,period:30}],['capsule',420,130,{rx:25,ry:20,period:21}]], { ammo:['explosive','explosive','explosive'],start:[-330,-40],zoom:.85 }, '船坞有两处远离的舱室，护卫独立巡航。至少要为船坞和护卫分别留下攻击机会。','优先命中船坞中段，有机会同时覆盖上下舱；否则分别处理，别误击已清空的舱段。'],

  ['穿甲通道','动能破壁',[['vault',180,0]], { ammo:['kinetic','explosive'],start:[-310,0] }, '双层外堡保护内环。用动能弹连续切开外壳，再让爆炸弹沿破口接近内环。','动能弹过快会在每次碰撞中损失更多耐久。先尝试中低速度，观察它穿过了几层。'],
  ['纵列机库','连续穿透',[['hangar',95,-35],['capsule',330,-35]], { ammo:['kinetic','explosive','explosive'],start:[-340,-35] }, '近端机库挡住后方前哨。动能弹打开近端横向通路，范围载荷清理两处内部目标。','先瞄准近端中部的隔梁。随后观察实际破口，第二次攻击不必重复相同角度。'],
  ['三叉天线阵','分裂与补射',[['array',175,0]], { ammo:['cluster','explosive','explosive'],start:[-320,0] }, '三个独立舱室呈扇形分布。可在接近阵列前右键分裂，利用子弹清出多条进入线路。','分裂后的子弹不能再次点火。让分裂发生在阵列外侧，再用爆炸弹处理剩余舱室。'],
  ['熔断堡垒','削弱连接',[['citadel',180,0]], { ammo:['incendiary','kinetic','explosive','explosive'],start:[-320,-45],fragile:true }, '内部舱室又有独立外壳。燃烧弹会逐步削弱连接，动能弹可沿已松动的结构继续破壁。','点燃后等几秒看桁架断裂，再决定下一发方向。爆炸弹应尽量接近内舱，而非厚重外角。'],
  ['引力拆解','改变结构受力',[['crown',170,-10]], { ammo:['gravity','explosive','explosive'],start:[-320,10] }, '引力弹会在撞击处生成短暂引力井，拉扯构件。两个指挥舱被竖向隔梁分开。','引力井存在时弹道也会改变。可以等引力井消失后，再根据破口投入爆炸弹。'],
  ['装甲旗舰','载荷配合',[['flagship',150,0]], { ammo:['kinetic','incendiary','explosive','explosive','explosive'],start:[-350,-30],fragile:true,zoom:.85 }, '旗舰有外层船壳、内部双舱与远端指挥室。先破壁，再分区清理，不要把所有载荷打在舰首。','留一枚爆炸弹给右侧远端舱。空壳与断梁也会改变后续撞击位置。'],

  ['前堡与内环','纵深破壁',[['capsule',80,-125],['vault',270,60]], { planet:[-200,90,3700,58],orbit:180,phases:[2.3,3.2,4.2],ammo:['explosive','kinetic','explosive'],zoom:.82 }, '前哨与重装内环构成纵深防线。先用一枚范围载荷清前哨，保留动能弹和另一枚范围载荷攻内环。','重装内环正面要先破壁。绕到外壳较近的侧面，也可能节省一次攻击。'],
  ['两星之间','选择引力通道',[['hangar',280,-120],['bastion',250,140]], { planet:[-190,-35,4500,63],second:[65,85,2300,45],orbit:200,phases:[2.4,3.6,4.6],ammo:['explosive','explosive','kinetic'],zoom:.85 }, '两座堡垒位于不同引力通道出口。规划北侧和南侧线路，把动能弹作为开路或补射工具。','不要只瞄准目标中心；先查预测线是否会撞第二颗星体。'],
  ['三角封锁','多源出发',[['capsule',-20,-230],['bastion',280,-70],['hangar',200,170]], { planet:[-160,0,4400,62],orbit:150,phases:[1.9,3.1,4.4],ammo:['explosive','explosive','explosive'],zoom:.8 }, '三个目标方向相差很大，弹体初始相位也不同。为每枚弹体分配最顺势的据点。','轨道速度本身就是可用速度；只补足需要改变的部分，给爆炸保留燃料。'],
  ['移动内堡','静态破壁与动态拦截',[['bastion',40,-160],['vault',260,55,{rx:35,ry:35,period:28}]], { ammo:['explosive','kinetic','explosive'],start:[-340,0],zoom:.85 }, '前方棱堡静止，内环堡垒沿小轨道巡航。破壁弹与后续爆炸弹必须分别计算提前量。','破口会随堡垒一起移动；不要向上一发撞击留下的世界坐标发射。'],
  ['十字船坞','独立分舱',[['crucible',130,-50],['capsule',300,170]], { planet:[-230,50,3600,55],orbit:160,phases:[2.4,3.3,4.2,5],ammo:['kinetic','explosive','explosive','explosive'],zoom:.8 }, '十字船坞有主舱与偏置舱，另一座前哨位于下方。切开隔梁后再清理纵深目标。','命中十字结构的中心不保证覆盖最右侧舱；观察琥珀色目标的位置。'],
  ['纵深防御网','多层与多方位',[['bridge',100,-175],['citadel',290,35],['capsule',40,180]], { planet:[-230,30,4100,60],orbit:185,phases:[1.8,2.8,3.8,4.8,5.5],ammo:['explosive','kinetic','explosive','explosive','explosive'],zoom:.77 }, '近端双塔、下方哨站和远端内舱堡组成完整防线。按航线遮挡关系分配攻击顺序。','远端两层独立内舱最耗弹。外堡能一次清空时，不要追加浪费。'],

  ['边境棱堡群','综合破壁',[['bastion',70,-185],['hangar',240,10],['capsule',80,185]], { planet:[-220,0,4700,65],orbit:195,phases:[2,2.8,3.7,4.6],ammo:['explosive','kinetic','explosive','explosive'],zoom:.78 }, '三个堡垒分层防守，近地引力较强。先用轨道速度接近薄弱侧，再决定如何投入穿甲载荷。','检查每条预测线首次撞击的位置，而不只是远处看起来对准了哪个目标。'],
  ['双星军港','双星与厚壁',[['vault',180,-130],['hangar',320,145]], { planet:[-220,-50,4800,66],second:[30,100,2400,45],orbit:210,phases:[2.1,3,4,4.8],ammo:['kinetic','explosive','explosive','explosive'],zoom:.78 }, '北侧重装内环与南侧机库共享双星掩护。为重装目标预留破壁组合。','贴近第二颗星体会显著改变末段方向；剩余点火次数可以用于最后一次修正。'],
  ['三舰会合','三个独立时钟',[['capsule',0,-210,{rx:35,ry:25,period:23}],['needle',280,0,{rx:45,ry:25,period:31}],['capsule',20,210,{rx:25,ry:30,period:19}]], { ammo:['explosive','explosive','explosive','kinetic'],start:[-340,0],zoom:.78 }, '三艘舰船各自巡航，中央船坞上下分舱。选择有利窗口，避免追着目标连续耗尽燃料。','消灭一艘后重新观察剩余舰船；各轨道的节奏不会保持同步。'],
  ['环形主堡','外堡与环心',[['capsule',30,-195],['vault',255,-20],['bridge',60,195]], { planet:[-210,10,4900,65],orbit:175,phases:[1.8,2.6,3.5,4.4,5.3],ammo:['explosive','kinetic','explosive','explosive','explosive'],zoom:.76 }, '主堡位于两处外堡后方，双塔通路和内环护甲要求不同撞击位置。分配攻击次序后再行动。','同一条航线反复射击会被残存外墙吸收；利用上下绕行和新的破口。'],
  ['最后的船坞','移动堡垒群',[['citadel',190,-135,{rx:30,ry:25,period:29}],['crown',150,215,{rx:40,ry:20,period:23}]], { planet:[-220,45,3900,57],orbit:185,phases:[2.1,2.9,3.7,4.5,5.3],ammo:['kinetic','explosive','explosive','explosive','explosive'],zoom:.76 }, '两座大型船坞分别运动。上方内舱堡需要深入破壁，下方双冠堡要兼顾隔梁两侧。','优先形成可重复利用的入口；后续弹体根据目标的新位置调整，而非沿旧轨迹盲射。'],
  ['黎明要塞','战役终局',[['bastion',-25,-230,{rx:20,ry:15,period:25}],['flagship',280,0,{rx:20,ry:25,period:35}],['capsule',15,190]], { planet:[-220,0,4500,60],orbit:155,phases:[1.8,2.5,3.2,3.9,4.6,5.3],ammo:['kinetic','explosive','explosive','incendiary','explosive','explosive'],fragile:true,zoom:.72 }, '移动棱堡、重装旗舰和下方前哨组成最后防线。旗舰含三个内部目标，前哨和护卫也必须清除。','保留破壁载荷给旗舰的内层舱室。观察结构与剩余目标，选择爆心位置，再投入最后的燃料。'],
];

function makeLevel(spec, i) {
  const [name,skill,placements,opts,text,hint] = spec, chapter = chapters[Math.floor(i/6)];
  const level = { id:`fortress-${chapter[0].slice(4)}-${String(i%6+1).padStart(2,'0')}`, name, skill, difficulty:i+1, gravity:200, flightTimeout:30,
    camera:{x:0,y:0,zoom:opts.zoom||.95}, orbits:[],stars:[],planets:[],bullets:[],buildings:[] };
  const orbit = def => { level.orbits.push(def); return level.orbits.length-1; };
  if (opts.planet) for (const body of [opts.planet,...(opts.second?[opts.second]:[])]) {
    const [x,y,mass,radius]=body;
    level.planets.push({orbit:orbit({type:'fixed',x,y}),mass,radius,collisionRadius:radius,label:level.planets.length?'伴星':'引力主星'});
  }
  opts.ammo.forEach((type,bi)=> {
    const b = {type};
    if (opts.planet) b.orbitAround={bodyIndex:0,altitude:opts.orbit-opts.planet[3],phase:opts.phases[bi]};
    else { b.x=opts.start[0]-bi*22;b.y=opts.start[1]+bi*48-(opts.ammo.length-1)*20; }
    level.bullets.push(b);
  });
  placements.forEach(([shape,x,y,motion],bi)=> {
    const b=fort(shape,`${String(bi+1).padStart(2,'0')} / ${ {capsule:'双壳前哨',bastion:'棱堡',hangar:'分舱机库',bridge:'双塔连桥',citadel:'内舱堡',vault:'重装内环',crucible:'十字船坞',array:'三叉阵列',crown:'双冠堡',needle:'长轴船坞',flagship:'装甲旗舰'}[shape] }`);
    if(opts.rearControl) b.points.push({x:28,y:50,fixed:true,isEnemy:true,important:true,radius:8,renderRadius:9,hp:220,score:200});
    b.orbit=orbit(motion?{type:'elliptical',x,y,phase:0,...motion}:{type:'fixed',x,y});
    if(opts.fragile && ['citadel','flagship'].includes(shape)) b.springs.forEach((s,si)=>{if(si%4===3){s.breakTension=1800;s.burnRate=600;}});
    level.buildings.push(b);
  });
  const targets=level.buildings.reduce((s,b)=>s+b.points.filter(p=>p.important).length,0);
  level.objective=`摧毁全部 ${targets} 个内部控制单元，得分达到 ${targets*200} 分。`;
  level.guidance={title:skill,text,hint};
  level.winCondition={importantTargetsAll:true,destructionThreshold:0,minScore:targets*200,parShots:opts.ammo.length,parDeltaV:opts.ammo.length*100};
  if(i===0) level.guidance.firstShot={dvx:50,dvy:0};
  if(i%6===0) level.cutscene={title:chapter[2],kicker:`第 ${Math.floor(i/6)+1} 章 / ${chapter[1]}`,scenes:[{title:chapter[2],dialogue:{speaker:'战术教官',text:chapter[3]}},{title:'本次任务',dialogue:{speaker:'任务控制中心',text:text+' '+hint}}]};
  return level;
}
const levels=specs.map(makeLevel);
if(require.main===module){
  chapters.forEach(([dir,name,subtitle,description],ci)=>{
    fs.writeFileSync(path.join(ROOT,dir,'index.json'),JSON.stringify({name,subtitle,description,levels:[1,2,3,4,5,6].map(n=>`lv${n}`)},null,2)+'\n');
    levels.slice(ci*6,ci*6+6).forEach((l,li)=>fs.writeFileSync(path.join(ROOT,dir,`lv${li+1}.json`),JSON.stringify(l,null,2)+'\n'));
  });
  console.log(`Wrote ${levels.length} deterministic fortress missions.`);
}
module.exports={levels,FortBlueprint};
