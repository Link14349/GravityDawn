# Gravity Shooter — 技术架构文档

## 项目概览

二维横版关卡制前端网页游戏，Canvas 渲染。核心玩法：基于万有引力的弹弓式射击，类似愤怒的小鸟但力学模型为星际引力。

| 项目 | 技术 |
|------|------|
| 语言 | ES6 (JavaScript) |
| 打包 | Webpack + Babel |
| 渲染 | HTML5 Canvas 2D |
| 物理 | 半隐式欧拉积分 |
| 版本控制 | Git |

---

## 目录结构

```
gravity-shooter/
  src/
    constants.js       — 物理常量 (G, DT, SUB_STEPS)
    physics.js         — 物理引擎 (重力, 半隐式欧拉, 碰撞, 轨迹预测)
    celestial.js       — 星体 (质量, 参数轨道, 碰撞半径)
    bullet.js          — 子弹 (Delta-V, 齐奥尔科夫斯基, HP)
    building.js        — 建筑系统 (弹簧质点, 碰撞, 爆炸, 敌人)
    explosion.js       — 爆炸公式 (指数衰减, 气化判定)
    camera.js          — 镜头 (世界↔屏幕, 平移, 缩放)
    renderer.js        — 渲染器 (星体, 子弹, 建筑, 爆炸, 瞄准)
    game-controller.js — 输入控制 (悬停暂停, 拖拽瞄准, 状态机)
    ui.js               — UI管理器 (开始/选关/HUD/结算)
    tutorial.js        — 教程提示系统 (队列化、会话去重)
    level.js            — 关卡系统 (数据格式 + 加载器 + 通关判定)
    main.js            — 入口与屏幕流程
    flight-simulation.js — 共享飞行步进
    campaign-data.js    — 新旧战役数据加载
    campaign-validation.cjs — 关卡可解性与回归检查
  test/
    phaseN-demo.html   — 各阶段演示页面
  doc/
    framework.md       — 本文档
```

---

## 物理引擎 (physics.js)

### PhysicsEngine 类

**核心算法：半隐式欧拉积分**
```
v(t+dt) = v(t) + a(t)·dt
x(t+dt) = x(t) + v(t+dt)·dt
```

每个物理帧（1/60s）细分为 `subSteps=4` 个子步，子步步长 1/240s。

**万有引力：**
```
a = Σ (G·M_i / r_i²) · û_i
```
对每个重力源（星体）求和，`MIN_DISTANCE=5` 防止 r→0 时的奇点。

**关键方法：**
| 方法 | 说明 |
|------|------|
| `addGravitySource(x,y,mass,colR,orbitFn)` | 添加引力源（星体），可选碰撞半径和轨道函数 |
| `calcGravityAccel(px,py)` | 计算某点的总引力加速度 |
| `stepParticle(p, dtOverride, objRadius)` | 推进单个粒子，返回碰撞信息 |
| `predictTrajectory(state, steps, dt, t0, objectRadius=0)` | 轨迹预测：同步推进星体轨道+粒子+碰撞检测，含弹体碰撞半径，返回 `{path, collision}` |
| `updateSourcePosition(i,x,y)` | 每帧更新移动星体的位置 |
| `checkSourceCollision(px,py,r)` | 检测粒子与星体碰撞 |

---

## 星体系统 (celestial.js)

### CelestialBody 类

星体轨道使用**显式参数方程**以保证稳定性：
```
x(t) = cx + R·cos(ωt + φ)
y(t) = cy + R·sin(ωt + φ)
```

**属性：** mass, radius, collisionRadius, color, label

**静态工厂方法：**
- `circularOrbit(cx, cy, radius, period, phase)`
- `ellipticalOrbit(cx, cy, rx, ry, period, phase)`
- `fixedPosition(x, y)`

---

## 子弹系统 (bullet.js)

### BULLET_TYPES 字典

7 种子弹类型，详见 `doc/bullet.md`。关卡数据只需指定 `type` + `orbitAround`，`ve` 由 Δv 和质量自动推导。

### Bullet 类

**质量模型：齐奥尔科夫斯基火箭公式**
```
Δv = ve · ln(m₀/mf)
mf = m₀ · exp(-Δv/ve)
ve = Δv / ln((payload+fuel) / payload)  — 自动推导
```

**特殊效果方法：**
| 方法 | 子弹类型 | 说明 |
|------|---------|------|
| `getSplitBullets()` | cluster | 返回 3 颗子子弹配置（60° 扇形，60% 速度，不可机动） |
| `getGravityWell()` | gravity | 返回临时引力源 `{x,y,mass,duration}` |
| `applyIncendiary(bld)` | incendiary | 对建筑所有弹簧施加 4 秒灼烧 |

**旧格式兼容：** 无 `type` 时默认 `normal`，显式 `ve` 会覆盖推导值。

---

## 建筑系统 (building.js)

### MassPoint（质点）

弹簧-质点模型的基本单元。

| 属性 | 说明 |
|------|------|
| x, y, vx, vy | 运动状态 |
| mass | 质量 |
| radius / renderRadius | 碰撞半径 / 渲染半径 |
| score | 分值 |
| important | 重要目标标记 |
| isCore | 核心点（参数轨道，不感受重力） |
| isEnemy | 敌人标记（差异化碰撞） |
| hp / maxHp | 敌人血量 |
| explosionRadius / explosionImpulse | 自身爆炸属性 |

### Spring（弹簧）

| 属性 | 说明 |
|------|------|
| a, b | 两端质点引用 |
| restLength | 原长（默认初始距离，可指定） |
| stiffness | 劲度系数 k |
| damping | 阻尼系数 |
| breakTension | 断裂张力阈值 |
| tension | 只读，`|len - restLen| × stiffness` |

**胡克定律：** `F = k × (len - restLength)`，方向沿弹簧轴线。含阻尼项：`Fdamp = damping × relVelocity_n`。

### Building

弹簧质点物理模拟容器。

**每帧 step(dt, physics, bodies)：** 4 子步循环
1. 核心点参数轨道更新
2. 非核心点受万有引力
3. 弹簧力计算（胡克 + 阻尼）
4. 半隐式欧拉积分
5. 子步内星体碰撞修正（增量处理防止速度累积）
6. 弹簧断裂检测
7. 帧级：质点间碰撞 + 质点-弹簧碰撞 + 越界消失

**碰撞检测三档（质点-弹簧）：**

| 相对速度 | 效果 |
|----------|------|
| ≤ 80 | 完全非弹性碰撞 |
| 80~120 | 切断弹簧 + 传递冲量 |
| > 120 | 质点爆炸 + 弹簧断裂 |

**爆炸处理：**
- `_triggerPointExplosion(point, impulse, radius)` — 杀点+断弹簧+邻里冲量+气化
- `applyExplosion(ex, ey, radius, impulse)` — 区域爆炸+气化+脱离判定
- `handleBulletImpact(bx, by, br, bulletImpulse, bulletRadius)` — 子弹命中全套处理
- `cutSpringAndTransferImpulse(spring, impulse)` — 切断弹簧+传递冲量

**跨建筑碰撞：**
- `getAABB()` — 存活质点包围盒
- `checkCrossCollisions(buildings, explosions)` — 静态方法，AABB 粗筛后精细检测

**记分：** `building.score` 累计，气化 100%/脱离 70%/越界 100%。

---

## 爆炸系统 (explosion.js)

### 核心公式

**径向冲量指数衰减：**
```
P(r) = P₀ · exp(-r / r₀)
```
动能武器 r₀=0 → `calcExplosionImpulse` 返回 0。

**气化判定：**
```
isVaporized(dist, r₀) → dist < r₀ / 3
```

**导出常量：** `VAPOR_RATIO = 1/3`

---

## 碰撞规则汇总

### 质点-质点
| 速度 ≤ 80 | 速度 > 80 |
|-----------|----------|
| 非弹性碰撞（合并质心速度）| 爆炸（max 半径 + sum 冲量）|

### 质点-弹簧
| ≤ 80 | 80~120 | > 120 |
|------|--------|-------|
| 非弹性碰撞 | 切断弹簧 | 爆炸+弹簧断 |

### 质点-星体
| ≤ 120 | > 120 |
|-------|-------|
| 附着表面（法向清零，切向 ×0.85）| 爆炸消失 |

### 敌人特殊
- 碰撞阈值更高（PP=150, PS=200）
- 碰撞扣血不定时爆炸（伤害 = 速度 × 0.8）
- 撞弹簧低速不切断
- 爆炸半半径内瞬杀

---

## 镜头系统 (camera.js)

### Camera 类

| 功能 | 方法 |
|------|------|
| 世界→屏幕 | `worldToScreen(wx, wy)` |
| 屏幕→世界 | `screenToWorld(sx, sy)` |
| 平移 | 左键空白处拖拽 |
| 缩放 | 滚轮，以鼠标位置为中心 |
| 变换 | `applyTransform(ctx)` / `restoreTransform(ctx)` |

缩放范围 [0.2, 5.0]，步长 0.1。

---

## 渲染器 (renderer.js)

### Renderer 类

| 方法 | 说明 |
|------|------|
| `clear()` | 星空背景 |
| `drawCelestialBody(body)` | 扁平科学地图星体、经纬线与质量标注 |
| `drawTargetOrbits(buildings)` | 运动核心的实际轨道线 |
| `drawFirstShotGuide(probe,target,vector)` | 首关拖拽方向与目标指示 |
| `drawOrbitPath(body)` | 轨道虚线 |
| `drawBullet(x,y,vx,vy,r,launched,hovered,color,canManeuver=true)` | 弹体与外圈使用传入的类型颜色，发射/悬停时保持；实心圆细浅色描边保证深色弹药可见，白色待发射描边与悬停光环表示交互状态 |
| `drawBuilding(building)` | 弹簧+质点+敌人/核心标记 |
| `drawFadingTrail(points)` | 衰减轨迹线 |
| `drawAimOverlay(ctrl, bodies)` | 瞄准叠加（预测线+碰撞点+ΔV箭头） |
| `drawExplosion(x,y,r,maxR)` | 爆炸光环+白色十字 |
| `drawGravityWell(x,y,elapsed,duration,mass)` | 引力弹脉动紫色光环 |
| `drawBurnEffect(spring)` | 燃烧弹火焰粒子 |
| `drawPredictionPath(path, color)` | 预测虚线 |

---

## 控制器 (game-controller.js)

### GameController 类

**状态机：**
- `PLAYING` — 正常运行
- `AIMING` — 鼠标悬停子弹，时间暂停
- `LAUNCHED` — 子弹已发射飞行中

**弹弓式操作：**
- 鼠标悬停子弹 → 时间暂停
- 拖拽方向 **相反**于 ΔV 方向（向后拉=向前射）
- 松开 → 应用 Delta-V
- 支持多次点火（`remainingIgnitions > 0`）

**关键方法：**
| 方法 | 说明 |
|------|------|
| `getPredictedPath()` | 当前预测轨迹 |
| `getPredictedCollision()` | 预测碰撞点，使用弹体中心坐标 |
| `getBurnPreview()` | 当前拖拽实际可用的 Δv、点火后燃料比例和爆炸半径，不修改弹体 |
| `getDragVector()` | 拖拽 ΔV 矢量 |
| `getHoveredBullet()` | 当前 Canvas 内悬停的子弹 |
| `cycleTimeScale()` | 将 `timeScale` 从默认 1 逐次加到 10，再回到 1，返回新倍率；重建控制器时恢复 1 |
| `destroy()` | 中止全部事件监听，重试/离关后不再响应输入 |

---

## 常量 (constants.js)

| 常量 | 值 | 说明 |
|------|-----|------|
| G | 2000 | 万有引力常量（游戏尺度） |
| DT | 1/60 | 物理帧步长 |
| SUB_STEPS | 4 | 每帧子步数 |
| MIN_DISTANCE | 5 | 最小引力距离 |
| PREDICTION_STEPS | 300 | 轨迹预测步数 |
| PREDICTION_DT | 1/30 | 预测步长（已被 physics.dt 覆盖） |

---

## Demo 页面测试流程

每个 Phase 对应 `test/phaseN-demo.html`，通过 webpack-dev-server 或 HTTP 服务器运行。Demo JS 内联于 HTML，只做场景搭建和调用 src 模块。

| Phase | 测试焦点 |
|-------|---------|
| 1 | 构建链验证 |
| 2 | 引力+粒子轨迹 |
| 3 | 多星体轨道 |
| 4 | 子弹发射+轨迹预测+Camera |
| 5 | 弹簧质点建筑+碰撞 |
| 6 | 爆炸毁伤+记分+敌人+跨建筑碰撞 |
| 7 | UI系统（开始/选关/HUD/结算） |
| 8 | 关卡系统+通关判定 |
| 9 | 科学极简中文界面与任务简报 |
| 10 | 36 关新战役 + 23 关旧版档案 |
| 11 | 36 关堡垒重建、爆心引导与满推力反例验证 |
| 14 | 精简至 24 关，移动天体、多引力源与无锚点地表建筑 |
| 15 | 单屏主界面、章节与关卡独立滚动、窄屏和低窗口适配 |

---

## 关卡系统 (level.js)

### LevelManager 类

关卡系统的核心，负责加载关卡数据和通关判定。

**`LevelManager.load(levelData)`** — 解析关卡数据，返回所有游戏对象：
- `stars`, `planets`, `allBodies` — 星体列表
- `bullets` — 子弹（含初始轨道绑定）
- `buildings` — 建筑列表
- `physics` — 已配置好的物理引擎
- `camera` — 初始镜头位置

**`LevelManager.checkResult(buildings, winCondition, performance?)`** — 通关判定：
- `passed` — 是否通关
- `stars` — 星级 (0-3)
- `totalScore` — 总分
- `destructionRate` — 毁伤比例
- `importantRemaining` — 剩余重要目标数

新战役星级：1 星满足通关条件；2 星额外满足 `shotsUsed ≤ parShots`；3 星再满足 `deltaVSpent ≤ parDeltaV`。旧数据未设经济性目标时沿用原评分：2 星为分数 ≥ minScore×1.5，3 星为分数 ≥ 最大分数×0.8。

详细数据格式见 `doc/level.md`。

---

## UI 系统 (ui.js)

`UIManager(canvas)` creates the DOM overlay `#interface`. Screens remain `START`, `LEVEL_SELECT`, `CUTSCENE`, `GAME_HUD`, `RESULT`. `goTo(screen)` replaces the screen; `render()` updates live HUD values without rebuilding controls every frame. `gameData` also carries `time`, `importantTotal`, `importantRemaining`, chapters and mission metadata.

`#game-shell` 固定占据 `100dvh`，`html/body` 与 `#interface` 不滚动。菜单使用纵向 flex 布局，主内容以 `min-height: 0` 填充页眉、页脚之间的剩余空间。首页按窗口宽高压缩间距和次要展示，不产生滚动；选关的 `.sector-sidebar nav` 与 `.mission-grid` 分别内部滚动。切换章节保留章节列表的滚动位置与选中按钮焦点，新章节的关卡列表从顶部展示。结算、简报正文与手册只在各自受限内容区滚动，禁止滚动传递到外层；`goTo()` 不再调用 `window.scrollTo()`。

- `_onReplay()` restarts without briefing; `_onFocus()` restores the level camera.
- HUD 的「时间加速」按钮调用控制器 `cycleTimeScale()`，显示当前 `timeScale`（1×–10×）；悬停按钮可查看循环切换说明。暂停期间可切换倍率，恢复时生效；重试和进入新关卡恢复 1×。
- `drawTutorialHint(hint|null)` updates / hides contextual guidance.
- `drawSettleCountdown(remaining)` updates the result countdown.
- `src/ui-diagrams.js` holds decorative scientific SVG. `src/css/style.css` controls layout and responsive behavior.
- `CutsceneManager` owns a separate DOM overlay; see `cutscene.md`.
- Controller `destroy()` aborts event listeners. `enabled=false` blocks input during cutscenes. Camera supports `enabled=false`. Scaled Canvas input is normalized into the 1200 × 800 logical space.
- Webpack extracts the inline module from `index.html` and phase 9+ HTML demos through `src/page-entry-loader.cjs`. Shared chunks include the game modules and bundled JSON; production does not fetch raw source files. Demos have no standalone JavaScript files.

## 教程提示系统 (tutorial.js)

### TutorialManager 类

所有章节的队列化提示管理，由 main.js 在游戏循环中驱动。每关常驻 `guidance` 面板可按 H 切换，不受队列去重影响：

| 方法 | 说明 |
|------|------|
| `reset(enabled)` | 进关时调用；enabled=false 清空队列并禁用（已展示记录保留） |
| `push(id, text, duration)` | 触发提示；同 id 一个会话只展示一次，自动排队不覆盖 |
| `update(paused)` | 每帧推进；真实时钟计时；paused 时冻结倒计时（入场动画/出队照常） |
| `current()` | 当前提示展示状态 `{text, alpha, slide, progress}`，交给 `UIManager.drawTutorialHint` 绘制 |

触发点（main.js）：进关显示该关学习目标；悬停某类型子弹 → 该类型教学；
首次发射 → 中途修正提示；特殊弹飞行中 → 右键触发提示；首次空格暂停、首次摧毁重要目标。

---

## 轨道系统 (binding.js)

### Orbit 类

统一所有轨道（星体/行星/建筑核心），支持递归 parent 链。

| 属性 | 说明 |
|------|------|
| `id` | 在 level.orbits[] 中的索引 |
| `type` | `'fixed'` / `'circular'` / `'elliptical'` |
| `parent` | 父 Orbit id，null=无父级 |
| `params` | type 相关的局部参数 |

**关键方法：**
- `getLocalPosition(t)` — 自身局部坐标
- `getWorldPosition(t, orbits)` — 递归叠加 parent 链的世界坐标
- `getWorldVelocity(t, orbits)` — 递归叠加 parent 链的世界速度

**轨道数据示例（单关文件）：**
```json
{
  "orbits": [
    { "type": "fixed", "x": 600, "y": 400 },
    { "type": "circular", "radius": 250, "period": 12, "parent": 0 },
    { "type": "fixed", "x": 0, "y": -170, "parent": 1 }
  ],
  "stars": [{ "orbit": 0, ... }],
  "planets": [{ "orbit": 1, ... }],
  "buildings": [{ "points": [{ "orbit": 2, "isCore": true, ... }] }]
}
```

关卡分章节分文件存储在 `data/levels/`，详见 `doc/level.md`。

## 共享飞行步进（flight-simulation.js）

`new FlightSimulation(LevelManager.load(levelData))` 持有星体、建筑、弹体、物理引擎、爆炸、临时引力源与 `physicsTime`。`step(controller?)` 以固定 1/60 秒执行一次生产物理步进，返回本帧是否发生碰撞/爆炸事件；可选 controller 提供右键触发队列。`getPerformance()` 返回原始弹体的已发射数 `shotsUsed` 和累计消耗 `deltaVSpent`，分裂出的子弹不重复计入经济性评价。

main.js 通过真实时间累积器得到基础步数（每帧最多补 6 步），再乘以控制器 `timeScale`（1–10）调用固定步进，单步始终为 1/60 秒，10× 时每帧最多 60 步。星体、弹体、建筑、特殊效果和物理时钟同步加速，结算缓冲也按实际模拟步数计时。悬停/瞄准及空格暂停时步数为 0，不累计待补的模拟步数；恢复后按所选倍率继续。UI、教学提示和播片仍使用真实时间。相同模拟也由关卡验证脚本调用，避免测试另写一套物理。

`Building.checkCollisionAt(x,y,r,time=null)` 使用各锚点的未来位置。建筑级 `frameOrbit` 把尚未脱离的自由构件快照平移到未来参考位置，不预测碎片的后续变形。`Building.time` 随 `step` 累加，用于计算快照与预测时刻之差。瞄准使用燃料能实现的 Δv 上限；建筑爆心为弹体中心；星体检测包含弹体半径。`GameController` 接收可选 `predictionSteps`，默认 800，新堡垒战役使用 1800，对应 30 秒飞行窗口。

## 战役与存档

`campaign-data.js` 作为独立异步 chunk 加载 6 个新章节和 3 个旧章节。新关卡以稳定 `id` 保存成绩，旧关卡的 `legacyKey` 仍对应原 `cN-lN`。`configureProgress(chapters)` 建立屏幕索引映射；`getAllBest()` 返回当前 UI 索引下的成绩。`storage.js` 使用 localStorage 的 `gravity_dawn_progress_v2`，读取旧 Cookie 作为迁移来源，存储不可用时退化为当前会话内存。失败重试不会覆盖最好成绩。

`npm run author:campaign` 从确定性蓝图生成六章 JSON。`npm run check:campaign` 回放 `doc/campaign-solutions.json` 中的参考解，检查静态关 60 秒、移动关至少 240 秒且覆盖最长轨道两周期、地表关 240 秒的结构稳定性，逐帧检查泊车轨道与堡垒/星体分离，前十关满推力反例，以及移动框架、零距离接触、特殊载荷、输入与存档回归；报告输出至 `doc/campaign-validation.json`。离线搜索器 `src/campaign-solver.cjs` 预计算各引力源的未来轨道位置，并用生产 `PhysicsEngine.stepParticle` 推进候选弹道，避免把移动行星当作固定引力源。几何估计仅用于寻找候选动作，生产 `FlightSimulation` 回放通过后才可纳入参考解。

### 堡垒建筑与材料参数（阶段十一）

`BuildingDef.orbit` 指定整座堡垒的平移参考轨道，点坐标保留局部偏移；固定点分别绑定偏移轨道，自由构件继承初始速度。`pointDefaults` 和 `springDefaults` 提供共用物理参数，单元素配置覆盖共用值。`Building.name` 用于中文结构标签，详细数据格式见 `level.md`。

`Spring.burnRate` 默认 80，新战役的可熔断斜撑使用 600，旧关材料参数保持原值。精确位于弹簧中线的接触使用有限的法线分离；引力源中心加速度取零；零燃料分裂弹片的 Δv 和爆炸半径保持有限，避免复杂结构和引力井产生 NaN。

战役 JSON 按章节拆分异步资源，各游戏入口共用渲染与模拟代码。阶段十四精简为六章各四关，23 关带自然引力源，15 关带移动行星；当前演示 `test/phase14-demo.html` 只调用 `initGame()`。首关沿用原 ID，其余使用新的 `dawn-*` ID。地表建筑不含固定点或核心，只在加载时以 `bindToBody` 定位，之后通过真实重力和接触支撑。
