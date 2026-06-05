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
    level.js            — 关卡系统 (数据格式 + 加载器 + 通关判定)
    main.js            — 入口
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
| `predictTrajectory(state, steps, dt, t0)` | 轨迹预测：同步推进星体轨道+粒子+碰撞检测，返回 `{path, collision}` |
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
| `drawCelestialBody(body)` | 星体+光晕渐变 |
| `drawOrbitPath(body)` | 轨道虚线 |
| `drawBullet(x,y,vx,vy,r,launched,hovered,color)` | 子弹+悬停光环+发射描边 |
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
| `getPredictedCollision()` | 预测碰撞点 |
| `getDragVector()` | 拖拽 ΔV 矢量 |
| `getHoveredBullet()` | 悬停的子弹 |

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

**`LevelManager.checkResult(buildings, winCondition)`** — 通关判定：
- `passed` — 是否通关
- `stars` — 星级 (0-3)
- `totalScore` — 总分
- `destructionRate` — 毁伤比例
- `importantRemaining` — 剩余重要目标数

星级：1星=通关, 2星=重要目标全灭, 3星=总分≥minScore×1.5

详细数据格式见 `doc/level.md`。

---

## UI 系统 (ui.js)

### UIManager 类

Canvas 绘制的界面系统，四个屏幕状态：`START → LEVEL_SELECT → GAME_HUD → RESULT`。

| 屏幕 | 说明 |
|------|------|
| START | Logo + 开始按钮 + Credits |
| LEVEL_SELECT | 关卡卡片网格 + 锁定/星级 |
| GAME_HUD | 半透明顶栏（关卡名/分数/子弹） |
| RESULT | 星级 + 任务完成/失败 + 分数面板 + 操作按钮 |

按钮通过鼠标坐标碰撞检测实现点击交互。

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
