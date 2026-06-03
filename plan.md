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

## Phase 2：物理引擎 [x]
- [x] 实现 src/constants.js：引力常量 G、时间步长等
- [x] 实现 src/physics.js：PhysicsEngine 类
  - 半隐式欧拉积分器
  - 牛顿万有引力公式（多星体对粒子的合力）
  - 粒子状态管理 (position, velocity, acceleration)
- [x] 产物：test/phase2-demo.html — 两个星体 + 一个受引力影响的测试粒子自由运动

## Phase 3：星体系统 [x]
- [x] 实现 src/celestial.js：CelestialBody 类
  - 属性：质量、轨道参数方程 x(t), y(t)
  - 渲染绘制方法
- [x] 实现 src/renderer.js 基础：星空背景 + 星体渲染
- [x] 产物：test/phase3-demo.html — 多个星体按各自参数方程轨道运行

## Phase 4：子弹系统 [x]
- [x] 实现 src/bullet.js：Bullet 类
  - 近地轨道初始状态计算
  - 齐奥尔科夫斯基火箭公式（燃料质量与 Delta-V 关系）
  - 轨迹预测（虚线绘制）
  - 属性：点火次数、总 ΔV、载荷质量、燃料质量、爆炸半径、爆炸冲击量
- [x] 实现 src/game-controller.js 基础输入处理：
  - 鼠标悬停子弹 → 时间暂停
  - 点击拖拽 → ΔV 矢量输入（方向=拖动方向，大小=拖动长度）
  - 松开鼠标 → 发射
- [x] 产物：test/phase4-demo.html — 一颗星体 + 可交互发射的子弹 + 虚线轨迹预测
- [x] 额外：实现 src/camera.js — Camera 类（世界↔屏幕坐标转换、滚轮缩放、左键空白处拖拽平移）
- [x] 集成 Camera 到 game-controller（坐标转换）和渲染管线（applyTransform/restoreTransform）
- [x] CelestialBody 新增 collisionRadius 碰撞半径属性
- [x] PhysicsEngine 新增：重力源碰撞半径、updateSourcePosition、checkSourceCollision
- [x] Demo 场景重构：恒星 + 多行星 + 子弹绕行星轨道 + 碰撞爆炸效果

## Phase 5：建筑与目标系统 [x]
- [x] 实现 src/building.js：Building、MassPoint、Spring、Ship 类
  - MassPoint：质点（碰撞箱 + 分值 + 固定/重要标记）
  - Spring：弹簧连接（胡克定律 + 阻尼 + 张力超阈值断裂）
  - Ship：飞船（质点目标，冲量足够即摧毁）
  - Building：弹簧质点物理模拟 + checkBulletCollision + applyExplosion
- [x] Renderer.drawBuilding() 建筑渲染（弹簧线 + 质点圆 + 重要目标金边）
- [x] 产物：test/phase5-demo.html — 行星表面塔楼 + 子弹碰撞 + 弹簧断裂

## Phase 6：爆炸毁伤系统 [x]
- [x] 实现 src/explosion.js：
  - calcExplosionImpulse(dist, p0, r0) — P(r) = P₀ · exp(-r/r₀)
  - isVaporized(dist, r0) — 爆心 1/3 半径判定
  - VAPOR_RATIO = 1/3 常量
- [x] building.js 引用 explosion 模块公式，统一爆炸计算
- [x] 建筑物毁伤记分：气化=100%分数，脱离主体=70%分数，弹簧不计分
- [x] 敌人系统（MassPoint isEnemy）：
  - 敌人=不连弹簧的孤立质点，放在建筑结构内部，绿色渲染
  - 碰撞爆炸阈值高于普通质点（ENEMY_PP=150, ENEMY_PS=200）
  - 敌人撞弹簧：高速→爆炸+切断弹簧；低速→完全非弹性碰撞（不切断弹簧）
  - 敌人撞质点/星体：高阈值判定，更难误爆
- [x] 产物：test/phase6-demo.html — HUD 显示各建筑得分+总分+敌人

## Phase 7：界面系统 [x]
- [x] 实现 src/ui.js：UIManager 类 + Screen 状态枚举
  - 开始界面：背景图 + Logo + 开始按钮 + Credits
  - 选关界面：7关卡卡片网格 + 锁定/解锁 + 星级
  - 游戏 HUD：黑条顶栏（关卡名居中 + 分数/子弹右 + 退出左）
  - 结算界面：星级 + 任务完成/失败 + 分数明细面板 + 总分
- [x] 美术风格落地：冷色扁平 UI（深空蓝黑底 + 青主色调 + 金点缀）
- [x] doc/style.md 美术风格设计文档
- [x] 产物：test/phase7-demo.html — 四界面切换 + 键盘 1-4 快捷键

## Phase 8：关卡系统 & 分数结算 [x]
- [x] 实现 src/level.js：LevelManager 类
  - 关卡数据格式（StarDef/PlanetDef/BulletDef/BuildingDef/WinCond）
  - load(levelData): 解析数据→游戏对象（星体/子弹/建筑/物理引擎）
  - checkResult(buildings, winCondition): 通关判定 + 1-3 星级评价
  - 轨道格式：fixed/circular/elliptical
- [x] doc/level.md 关卡系统技术接口文档
- [x] doc/framework.md 更新关卡和 UI 章节
- [x] 产物：test/phase8-demo.html — 完整关卡流程（开始→选关→游戏→结算）
- [x] 结算沉淀机制：10秒缓冲 + 双触发条件 + 倒计时提示
- [x] 飞行时间兜底：子弹飞超 15 秒算已沉淀
- [x] 修复：右键菜单屏蔽 + 拖拽子弹时鼠标离开取消拖拽

## Phase 9：整合与打磨 [ ]
- [ ] 实现 src/main.js：完整游戏循环
- [ ] 多个关卡串联
- [ ] 性能优化、视觉润色
- [ ] 最终产物：index.html — 完整可玩游戏
