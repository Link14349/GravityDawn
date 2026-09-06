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

## Phase 9：科学极简 UI 与播片重建 [x]
- [x] 整合 main.js 完整流程，修复页面打包与跨屏输入生命周期
- [x] 重建开始、选关、HUD、暂停、帮助与结算界面
- [x] 重建播片为科学任务简报，保留逐字显示、继续与跳过
- [x] 统一科学示意图和 Canvas 战场配色，支持响应式布局
- [x] 同步技术文档，build + 浏览器验证
- [x] 产物：test/phase9-demo.html

## Phase 10：渐进战役与引导 [x]
- [x] 设计 6 个章节、36 个手工编排实验关卡
- [x] 基础瞄准 → 引力曲线 → 移动拦截 → 特殊载荷 → 复合挑战 → 最终考核
- [x] 逐关任务目标、操作引导、策略提示与章节简报
- [x] 持久化进度与旧战役入口
- [x] 使用实际物理引擎验证关卡可解性，build + 浏览器验证
- [x] 同步关卡文档与产物 test/phase10-demo.html

## Phase 11：堡垒战役重设计 [x]
- [x] 研究旧版桁架、堡垒与轨道关卡，重新编排全部 36 个新关卡
- [x] 多层防护、内部目标、异形结构、多据点和移动堡垒
- [x] 逐关中文战术引导与渐进难度，保留旧版关卡
- [x] 实际模拟验证参考解、结构稳定性和满推力攻击
- [x] build + 浏览器实玩验证，同步文档
- [x] 产物：test/phase11-demo.html

## Phase 12：时间加速 [x]
- [x] 飞行控制栏增加时间倍率按钮，1× 至 10× 逐次切换，10× 后回到 1×
- [x] 固定步长模拟与结算倒计时按倍率加速，暂停不推进，重试/新关恢复 1×
- [x] build + 浏览器验证，同步技术文档
- [x] 产物：test/phase12-demo.html

## Phase 13：弹药颜色区分 [x]
- [x] 弹体和外圈使用类型颜色，发射与悬停时保留；普通弹红、爆炸弹珊瑚粉、动能弹深红、机动弹黄、分裂弹青、引力弹紫、燃烧弹橙
- [x] 按指定配色复验：动能弹半径为普通弹两倍，深色弹体带细浅色描边，分裂子弹继承母弹颜色
- [x] 爆炸弹改为亮珊瑚粉，build + 浏览器验证深色背景中的辨识度
- [x] build + 浏览器验证，同步颜色与渲染技术文档
- [x] 产物：test/phase13-demo.html — 七种弹药的待发射、飞行和悬停颜色对照

## Phase 14：引力战役精简与天体多样性 [x]
- [x] 将 36 关精简为 24 关，仅首关保留无引力操作教学
- [x] 加入移动行星、嵌套卫星、双星公转及三至四引力源关卡
- [x] 少量无 core、无固定锚点地表建筑，并验证静置稳定性
- [x] 使用实际物理模拟验证参考解、轨道避碰与关卡引导
- [x] build + 浏览器验证，同步相关技术文档
- [x] 产物：test/phase14-demo.html

## Phase 15：单屏游戏界面 [x]
- [x] 主界面固定填满视口，按窗口宽高收紧布局，取消整体页面滚动
- [x] 章节与关卡列表独立滚动，结算、手册与简报内容在界面内部滚动
- [x] build + 浏览器验证（桌面、窄屏、横屏及首关发射到结算），同步相关技术文档
- [x] 产物：test/phase15-demo.html

## Phase 16：主菜单标题与入口 [x]
- [x] 删除首页底部的观测、预测、拦截三栏说明
- [x] 用「引力破晓」大标题与简洁 Logo 替换主标语，放大两个主按钮
- [x] build + 浏览器验证（六种窗口尺寸、两枚入口按钮；Logo 原图有资源体积提示），保持单屏布局并同步相关技术文档
- [x] 产物：test/phase16-demo.html

## Phase 17：移除主菜单顶栏 [x]
- [x] 移除首页顶栏，主内容自动填充腾出的空间
- [x] build + 桌面及窄屏浏览器验证，同步相关技术文档
- [x] 产物：test/phase17-demo.html

## Phase 18：暖白战场与统一 Logo [x]
- [x] 关卡 Canvas 与操作面板统一暖白底，调整文字、轨迹与交互标记对比度
- [x] 选关顶栏使用「引力破晓」Logo
- [x] build + 浏览器验证（选关、战场、暂停、七种弹药四种状态、首关发射到结算），同步相关技术文档
- [x] 产物：test/phase18-demo.html

## Phase 19：全窗口操作战场 [x]
- [x] Canvas 铺满窗口，等比扩展视野，原左右留白区域支持平移、缩放与弹体操作
- [x] 窗口变化时同步画布、背景和输入坐标，保持镜头位置与缩放
- [x] build + 浏览器验证（左缘平移、缩放、发射通关及宽窄窗口调整），同步相关技术文档
- [x] 产物：test/phase19-demo.html
