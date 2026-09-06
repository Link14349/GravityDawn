/** Chapters 7–9: authored encounters using the existing physics and payloads. */
module.exports = ({fixed, moon, ellipse}) => {
  const E='explosive', K='kinetic', I='incendiary';
  const launch=(ammo,extra={})=>({orbit:130,phases:ammo.map((_,i)=>1.7+i*3.6/(ammo.length-1)),ammo,
    camera:{x:30,y:0,zoom:.64},...extra});
  const hub=()=>[fixed(-300,0,3400,52,'出发星'),fixed(145,0,850,30,'关隘星'),moon(1,85,39,Math.PI/2,220,15,'巡逻月')];
  return {
    chapters:[
      ['exp-siege','深空攻坚','外围防线之后，还有纵深。','目标分散到双闸、反应堆与独立护卫之中。每一发都要兼顾破口、侧翼和下一处目标；节省下来的弹药决定能否完成收尾。'],
      ['exp-resonance','共振迷航','窗口从不同时出现。','反向船坞、双星泊车与多层卫星叠加不同周期。分开观察每一座堡垒的相位，选择离开母星和进入目标的两段窗口。'],
      ['exp-endgame','终局星阵','在整片防线中找出进攻次序。','多座重装堡垒、五源引力与有限载荷构成最终考核。为远端目标留出燃料，利用已经打开的通道完成最后一次突入。'],
    ],
    specs:[
      ['双闸交火','分离舱室与交叉进近',[
        ['gatehouse',130,-220,{rx:18,ry:12,period:41}],['bastion',330,145,{rx:25,ry:18,period:-47}],['capsule',-25,250]],
        launch([K,E,E,E,E,E],{bodies:hub(),parShots:5,parDeltaV:310}),
        '双闸堡的四个内舱隔着中央空隙，另一侧还有棱堡和前哨。六枚弹体必须分配给四处撞击区。',
        '从两座闸塔各自的外侧接近；穿过中央空隙不会引爆。二星要求五发以内，优先寻找能同时覆盖上下舱的爆心。'],
      ['三级断链','三个独立高度的攻击',[
        ['relay',340,-25,{rx:20,ry:28,period:43}],['hangar',-5,-255],['capsule',-5,245]],
        launch([E,E,K,E,E,E],{bodies:hub(),parShots:5,parDeltaV:330}),
        '纵向中继站的三个装甲舱相隔很远，上下补给站各有两个控制单元。巡逻月会切入中层航线。',
        '不要把三层中继当作一个爆心；先选无遮挡的高度，给中央舱保留独立一发。'],
      ['反应堆围城','双层内壳与两翼掩护',[
        ['reactor',380,10,{rx:18,ry:22,period:51}],['spearhead',100,-245],['capsule',20,240]],
        launch([K,I,E,E,E,E],{bodies:hub(),parShots:5,parDeltaV:320}),
        '反应堆内外两层壳体阻挡爆心，楔形战舰和南侧前哨掩护两翼。必须分别清除七个内部目标。',
        '从反应堆左侧凹面破壁，观察真实破口再补射；战舰前舱与后舱需要不同进近位置。'],
      ['四角封城','四据点弹药分配',[
        ['gatehouse',170,-255,{rx:20,ry:15,period:39}],['reactor',400,45],['hangar',175,255,{rx:20,ry:15,period:-43}],['skiff',-45,-185]],
        launch([K,E,E,E,I,E,E],{bodies:[...hub(),fixed(460,-165,450,24,'外缘星')],parShots:6,parDeltaV:390,camera:{x:30,y:0,zoom:.6}}),
        '四座据点形成纵深防线，十个内舱分布在双闸、反应堆、机库和护卫之中。七发弹药容错有限。',
        '先处理挡住远端反应堆的结构；双闸要分两端攻击，避免把两枚范围载荷浪费在同一空壳。'],

      ['逆相船阵','三种周期的移动装甲',[
        ['gatehouse',100,-250,{rx:45,ry:20,period:31}],['spearhead',390,5,{rx:30,ry:55,period:-37}],['hangar',100,250,{rx:42,ry:18,period:53}]],
        launch([K,E,E,E,E,E],{bodies:hub(),parShots:5,parDeltaV:350}),
        '三座堡垒以不同周期、不同方向运动，九个内舱不会同时来到最佳位置。上一发的破口也随舰体移动。',
        '依次寻找双闸两端、战舰前后舱和机库的窗口；等待下一轮比高推力追赶更节省燃料。'],
      ['双星钳击','两个出发轨道与远端装甲',[
        ['gatehouse',240,-240],['reactor',410,70,{rx:24,ry:20,period:-41}],['capsule',80,245]],
        launch([K,E,E,E,E,E],{bodies:[
          {mass:2200,radius:36,label:'双星甲',orbit:{type:'circular',x:-290,y:0,radius:95,period:46}},
          {mass:2200,radius:36,label:'双星乙',orbit:{type:'circular',x:-290,y:0,radius:95,period:46,phase:Math.PI}},
          fixed(170,0,700,28,'钳口星'),moon(2,78,33,Math.PI/2,180,13,'钳口月')],
          orbit:68,launchBodies:[0,0,0,1,1,1],parShots:5,parDeltaV:350,camera:{x:10,y:0,zoom:.59}}),
        '弹体分别绕双星待命；脱离泊车轨道后，还要通过钳口星与小月构成的关口。八个目标分布在三座堡垒内。',
        '分别观察两颗母星的外侧窗口，避免向伴星方向硬冲。为最深处的反应堆保留穿甲与补射载荷。'],
      ['卫星接力','嵌套护卫与固定中继',[
        ['skiff',0,-58,{type:'fixed',parent:2}],['skiff',0,70,{type:'fixed',parent:3}],['relay',610,0]],
        launch([E,E,K,E,E,E],{bodies:[fixed(-120,0,3000,46,'母星'),moon(0,345,91,0,700,29,'内巡星'),
          moon(1,135,29,1.2,180,13,'接力月'),moon(0,525,127,Math.PI,550,25,'外巡星')],
          orbit:100,parShots:5,parDeltaV:350,camera:{x:0,y:0,zoom:.42}}),
        '近月护卫叠加两层公转，外巡护卫沿另一条轨道运动；远方三级中继有三个独立舱室。',
        '近月与外巡窗口分开处理。中继站的三个高度各留一条航线，远距离投送尽量保留燃料。'],
      ['五源织网','五个引力源的时变通道',[
        ['gatehouse',110,-265,{rx:26,ry:12,period:47}],['spearhead',390,-10,{rx:20,ry:24,period:-43}],['relay',110,255]],
        launch([K,E,E,E,E,E,E],{bodies:[...hub(),fixed(395,185,450,24,'织网星'),moon(3,58,27,0,140,10,'细梭月')],
          parShots:6,parDeltaV:390,camera:{x:20,y:35,zoom:.52}}),
        '两个局部月系同时改变通道，双闸、战舰与三级中继共十个控制单元必须全部清除。',
        '避开巡逻月再看末段；中继站南舱与战舰尖端相距很远，不能用同一发的爆炸范围兼顾。'],

      ['熔炉纵深','破壁后穿越多层防区',[
        ['citadel',70,-285,{rx:16,ry:12,period:43}],['reactor',410,-30],['spearhead',200,235,{rx:25,ry:16,period:-49}],['capsule',-40,170]],
        launch([I,K,E,E,E,E,E,E],{bodies:[...hub(),fixed(465,190,430,23,'熔炉星')],fragile:true,braceTension:3600,
          parShots:7,parDeltaV:430,camera:{x:30,y:-10,zoom:.56}}),
        '内舱堡、反应堆和战舰形成多层防区，侧翼前哨还在守卫近路。九个目标包含多组独立内壳。',
        '燃烧用于削弱内舱堡，穿甲用于打开深层装甲；等残骸散开后，重新选择通往反应堆的曲线。'],
      ['三舰会战','移动舰队与分舱收尾',[
        ['flagship',230,-250,{rx:28,ry:18,period:47}],['gatehouse',80,30,{rx:22,ry:22,period:-37}],['spearhead',280,255,{rx:32,ry:20,period:59}]],
        launch([K,I,E,E,E,E,E,E],{bodies:[fixed(-300,0,3400,52,'出发星'),fixed(-20,-155,600,22,'舰队关隘'),moon(1,55,33,0,150,10,'侦察月'),fixed(480,-30,500,26,'舰队星')],fragile:true,braceTension:3600,
          parShots:7,parDeltaV:420,camera:{x:20,y:0,zoom:.56}}),
        '旗舰、双闸舰和楔形战舰沿不同轨道运动，十个内舱分成六组以上的攻击区域。',
        '先打开近侧双闸的通路，再分别处理旗舰内环与舰首；为最后一座战舰留足范围载荷。'],
      ['棱镜封锁','双巡月与四方据点',[
        ['gatehouse',100,-270,{rx:20,ry:12,period:41}],['reactor',395,20,{rx:18,ry:20,period:-53}],['relay',100,260],['skiff',-40,-155]],
        launch([K,E,E,E,E,E,E,E],{bodies:[...hub(),fixed(425,-170,450,23,'棱镜星'),moon(3,55,29,0,130,9,'折光月')],
          parShots:7,parDeltaV:450,camera:{x:25,y:20,zoom:.52}}),
        '五个引力源与四个据点构成封锁网，十一处控制单元跨越双闸、深层内环和三个中继高度。',
        '先清理近侧护卫，等待折光月让出反应堆的进近侧。分开安排三级中继的弹药，避免最后只剩穿甲弹。'],
      ['终夜核心','五源四堡综合考核',[
        ['gatehouse',60,-285,{rx:22,ry:14,period:43}],['flagship',420,-80,{rx:25,ry:24,period:-53}],
        ['reactor',320,250,{rx:22,ry:14,period:61}],['relay',-35,230,{rx:12,ry:18,period:-37}]],
        launch([K,I,E,E,E,E,E,E,E],{bodies:[...hub(),fixed(510,130,480,25,'终夜星'),moon(3,58,31,Math.PI/2,140,10,'余烬月')],
          fragile:true,braceTension:3600,parShots:8,parDeltaV:480,camera:{x:40,y:10,zoom:.52}}),
        '四座重装堡垒同时运动，十二个内部目标横跨五源星阵。九枚弹体需要完成破壁、分舱攻击与远端收尾。',
        '先选双闸或中继的有利窗口，给旗舰内环和反应堆各留一次破壁后的补射。三星要求八发以内且总 Δv 不超过 480。'],
    ],
  };
};
