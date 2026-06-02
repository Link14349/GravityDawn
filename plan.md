# Gravity Shooter — 开发计划

## 项目架构

```
src/
  physics.js         — 物理引擎（半隐式欧拉、万有引力）
  celestial.js       — 星体类（质量 + 参数方程轨道）
  bullet.js           — 子弹类（轨道、Delta-V、齐奥尔科夫斯基公式）
  building.js         — 建筑/目标（弹簧质点模型、飞船质点）
  explosion.js        — 爆炸毁伤系统
  renderer.js         — Canvas 渲染器
  game-controller.js  — 游戏状态机 + 输入处理
  ui.js               — 界面系统（开始/选关/结算/HUD）
  level.js            — 关卡数据 & 分数结算
  constants.js        — 物理常量、游戏常量
  main.js             — 入口，主循环
src/css/
  style.css
img/                  — 纹理贴图
test/
  phaseN-demo.html    — 各阶段演示
index.html            — 主页面
```

---

## Phase 1：工程搭建 [x]
- [x] npm 初始化，安装 webpack / babel / css-loader / html-webpack-plugin 等依赖
- [x] 建立目录结构 (src/, src/css/, img/, test/)
- [x] 配置 webpack.config.js
- [x] 创建 index.html 主页面
- [x] 最小化 canvas 渲染 Demo，验证构建链跑通
- [x] 产物：test/phase1-demo.html — 黑底 canvas + "Hello Gravity Shooter"

## Phase 2：物理引擎 [ ]
- [ ] 实现 src/constants.js：引力常量 G、时间步长等
- [ ] 实现 src/physics.js：PhysicsEngine 类
  - 半隐式欧拉积分器
  - 牛顿万有引力公式（多星体对粒子的合力）
  - 粒子状态管理 (position, velocity, acceleration)
- [ ] 产物：test/phase2-demo.html — 两个星体 + 一个受引力影响的测试粒子自由运动

## Phase 3：星体系统 [ ]
- [ ] 实现 src/celestial.js：CelestialBody 类
  - 属性：质量、轨道参数方程 x(t), y(t)
  - 渲染绘制方法
- [ ] 实现 src/renderer.js 基础：星空背景 + 星体渲染
- [ ] 产物：test/phase3-demo.html — 多个星体按各自参数方程轨道运行

## Phase 4：子弹系统 [ ]
- [ ] 实现 src/bullet.js：Bullet 类
  - 近地轨道初始状态计算
  - 齐奥尔科夫斯基火箭公式（燃料质量与 Delta-V 关系）
  - 轨迹预测（虚线绘制）
  - 属性：点火次数、总 ΔV、载荷质量、燃料质量、爆炸半径、爆炸冲击量
- [ ] 实现 src/game-controller.js 基础输入处理：
  - 鼠标悬停子弹 → 时间暂停
  - 点击拖拽 → ΔV 矢量输入（方向=拖动方向，大小=拖动长度）
  - 松开鼠标 → 发射
- [ ] 产物：test/phase4-demo.html — 一颗星体 + 可交互发射的子弹 + 虚线轨迹预测

## Phase 5：建筑与目标系统 [ ]
- [ ] 实现 src/building.js：Building、MassPoint、Spring、Ship 类
  - MassPoint：质点（碰撞箱 + 绑定纹理/形状用于渲染，携带分值）
  - Spring：弹簧连接（张力超阈值断裂）
  - Ship：飞船（质点目标，击中且冲量足够即摧毁）
  - Building：弹簧质点模型物理模拟
- [ ] 碰撞检测：子弹与质点/飞船的碰撞判定
- [ ] 产物：test/phase5-demo.html — 一个弹簧质点建筑结构 + 子弹碰撞交互

## Phase 6：爆炸毁伤系统 [ ]
- [ ] 实现 src/explosion.js：
  - 径向冲量：P(r) = P₀ · exp(-r/r₀)（动能武器 r₀=0 时冲量为 0）
  - 爆心 1/3 爆炸半径内：质点+弹簧直接气化消失
  - 弹簧受张力断裂判定
- [ ] 建筑物毁伤记分：气化=100%分数，脱离主体=70%分数，弹簧不计分
- [ ] 产物：test/phase6-demo.html — 子弹击中建筑 → 爆炸 → 结构碎裂动画

## Phase 7：界面系统 [ ]
- [ ] 实现 src/ui.js：
  - 开始界面（标题 + 开始按钮）
  - 选关界面（关卡列表）
  - 游戏内 HUD（剩余子弹、分数、ΔV 余量）
  - 结算界面（分数明细、通关判定）
- [ ] 产物：test/phase7-demo.html — 四个界面可点击切换浏览

## Phase 8：关卡系统 & 分数结算 [ ]
- [ ] 实现 src/level.js：
  - 关卡数据格式定义（星体配置、建筑布局、重要质点标记及分值、子弹配置）
  - 分数结算逻辑（建筑毁伤分 + 剩余子弹分）
  - 通关条件判定（重要目标全毁 + 毁伤程度达标）
- [ ] 产物：test/phase8-demo.html — 加载一个完整关卡，可玩到结算界面

## Phase 9：整合与打磨 [ ]
- [ ] 实现 src/main.js：完整游戏循环
- [ ] 多个关卡串联
- [ ] 性能优化、视觉润色
- [ ] 最终产物：index.html — 完整可玩游戏
