# 关卡系统技术文档

## LevelManager (src/level.js)

关卡系统的核心类，负责关卡数据加载和通关判定。

---

## 关卡数据存储

分章节分文件存储，三级索引：

```
data/levels/
  campaign-index.json   → ["exp-calibration", ...]     // 新战役
  index.json            → ["ch0", "ch1", "ch2"]              // 章节文件夹列表
  ch1/
    index.json          → { name, levels: [...] }      // 章节名 + 关卡文件列表
    lv1.json            → LevelDef                     // 单关完整数据
    lv2.json
  ch2/
    index.json
    lv1.json
    ...
```

### 各层格式

**`data/levels/index.json`** — 总索引：
```json
["ch1", "ch2"]
```

**`chN/index.json`** — 章节索引：
```json
{ "name": "第一章 · 初入星海", "levels": ["lv1", "lv2"] }
```

**`chN/lvN.json`** — 单关数据（LevelDef）：

### LevelDef（单关数据）

```js
{
  id: 'fortress-calibration-01', // 重做战役使用新 ID，保留历史成绩
  name: '前哨站',           // string — 关卡名称
  gravity: 300,             // number — 引力常量 G，支持 0
  flightTimeout: 30,        // 可选：长时间飞行兜底，旧关默认 15 秒
  camera: { x: 725, y: 400, zoom: 0.75 },

  orbits: [OrbitDef],       // 轨道定义数组，id=索引
  stars: [StarDef],         // 恒星列表
  planets: [PlanetDef],     // 行星列表
  bullets: [BulletDef],     // 子弹配置
  buildings: [BuildingDef], // 建筑配置
  objective: '摧毁全部核心。', // 中文任务说明
  skill: '方向与发射',       // 选关显示的学习主题
  difficulty: 1,            // 章节内递进的难度标识
  guidance: { title, text, hint, firstShot? }, // 常驻中文引导
  cutscene: { title, kicker, scenes }, // 章节开场简报
  winCondition: WinCond,    // 通关条件
}
```

### OrbitDef

所有轨道统一定义在 `orbits` 数组中，`id = 数组索引`。支持 `parent` 递归叠加。

```js
// 固定位置
{ "type": "fixed", "x": 600, "y": 400 }

// 圆形轨道（绕父级）
{ "type": "circular", "radius": 250, "period": 12, "parent": 0 }

// 椭圆轨道
{ "type": "elliptical", "rx": 300, "ry": 200, "period": 15, "parent": 0 }
```

参数：
- `parent` — 父 Orbit 的 id（null=无父级，即世界坐标原点）
- `radius` — 圆形轨道半径
- `rx/ry` — 椭圆轨道半径
- `period` — 周期（秒）
- `phase` — 初始相位（弧度，默认 0）

### StarDef / PlanetDef

星体和行星通过数字索引引用 `orbits` 数组：

```js
{
  mass: 8000,                     // 引力质量
  radius: 50,                     // 渲染半径（px）
  collisionRadius: 45,            // 碰撞半径（px），默认 = radius
  color: '#ffbb33',               // 颜色
  label: '恒星',                  // 标签
  orbit: 0,                       // 轨道索引（orbits 数组中的序号）
}
```

### BuildingDef

建筑核心点通过数字索引引用 `orbits`：

```js
{
  name: '01 / 双壳前哨',    // 可选：战场结构标签
  orbit: 2,                // 可选：整个建筑的平移参考轨道
  pointDefaults: { mass: 18, radius: 4, score: 10 },
  springDefaults: { stiffness: 1400, damping: 65, breakTension: 6500 },
  points: [PointDef],        // 质点列表
  springs: [SpringDef],      // 弹簧列表
}
```

#### PointDef

```js
// 核心点（绑定轨道）：
{ "mass": 200, "score": 300, "isCore": true, "orbit": 2, "color": "#ffdd44", ... }

// 普通质点（相对核心的偏移）：
{ "x": -30, "y": 80, "mass": 8, "score": 20, "color": "#cccccc", ... }

// 敌人：
{ "x": -10, "y": 60, "mass": 12, "score": 200, "isEnemy": true, "hp": 150, ... }
```

- 核心点：`orbit` 引用全局 orbits 数组，位置自动跟随轨道。无需设置 x/y。
- 非核心点：`x, y` 为相对核心的世界坐标偏移，加载时自动叠加核心世界位置。
- 所有非核心点自动继承核心轨道的世界速度。

建筑级 `orbit` 存在时，所有点的 `x/y` 改为相对此参考原点的偏移；固定锚点与内部控制单元分别保留偏移并跟随轨道，自由构件继承初速度后参与弹簧模拟。没有建筑级 `orbit` 时保持上述旧格式。多个独立轨道核心在加载时分别使用自己的世界位置。

`pointDefaults` / `springDefaults` 先合并，单元素配置覆盖同名公共物理参数。位置、轨道、固定属性和目标标记应逐点填写。

#### SpringDef

```js
{
  a: 0,                      // 端点 A 的质点索引（在 points 数组中的序号）
  b: 1,                      // 端点 B 的质点索引
  stiffness: 4000,           // 劲度系数 k
  damping: 20,               // 阻尼系数
  breakTension: 7500,        // 断裂张力阈值
  burnRate: 80,              // 可选：燃烧时每秒降低的阈值
  restLength: 50             // 原长（默认取初始距离）
}
```

### BulletDef

```js
// 新格式（推荐）：只需 type + orbitAround
{
  type: 'explosive',         // 子弹类型（8 种，见 doc/bullet.md）
  orbitAround: {
    bodyIndex: 0,            // 绕行的星体索引
    altitude: 100,           // 轨道高度
    phase: 0.7854            // 初始相位（弧度）
  }
}

// 旧格式（兼容）：显式指定所有参数，type 缺失时默认 normal
```

### WinCond（通关条件）

```js
{
  destructionThreshold: 0.3,   // 质点毁伤比例阈值 (0-1)
  importantTargetsAll: true,   // 是否要求所有重要目标摧毁
  minScore: 100,               // 最低分数
  parShots: 1,                 // 可选：2 星允许的原始弹体发射数
  parDeltaV: 160,              // 可选：3 星允许的总 Δv 消耗（还须满足 parShots）
}
```

---

## LevelManager API

### `LevelManager.load(levelData) → GameObjects`

解析关卡数据，返回所有游戏对象：

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `orbits` | `Orbit[]` | 全局轨道数组 |
| `stars` | `CelestialBody[]` | 恒星列表 |
| `planets` | `CelestialBody[]` | 行星列表 |
| `allBodies` | `CelestialBody[]` | 全部星体 |
| `bullets` | `Bullet[]` | 子弹列表 |
| `buildings` | `Building[]` | 建筑列表 |
| `physics` | `PhysicsEngine` | 已配置的物理引擎 |
| `camera` | `{x, y, zoom}` | 初始镜头位置 |

### `LevelManager.checkResult(buildings, winCondition, performance?) → Result`

```js
{
  passed: true,              // 是否通关
  stars: 3,                  // 星级 (0-3)
  totalScore: 850,           // 总分
  destructionRate: 0.65,     // 毁伤比例
  importantRemaining: 0,     // 剩余重要目标数
}
```

新战役传入 `FlightSimulation.getPerformance()`：1 星为通关；2 星发射数 ≤ parShots；3 星再满足总 Δv ≤ parDeltaV。旧数据没有 parShots 时维持原规则：2 星总分≥minScore×1.5，3 星总分≥maxScore×0.8。

---

## 完整关卡示例（移动行星+建筑）

```json
{
  "name": "行星追逐", "gravity": 250,
  "camera": { "x": 600, "y": 400, "zoom": 0.55 },
  "orbits": [
    { "type": "fixed", "x": 600, "y": 400 },
    { "type": "circular", "radius": 400, "period": 20, "parent": 0 },
    { "type": "fixed", "x": 0, "y": -170, "parent": 1 }
  ],
  "stars": [
    { "mass": 8000, "radius": 50, "color": "#ffbb33", "label": "恒星", "orbit": 0 }
  ],
  "planets": [
    { "mass": 1500, "radius": 55, "color": "#66aaff", "label": "目标行星", "orbit": 1 }
  ],
  "buildings": [{
    "points": [
      { "mass": 200, "score": 300, "isCore": true, "orbit": 2, "color": "#ffdd44" },
      { "x": -30, "y": 80, "mass": 8, "score": 20, "color": "#cccccc" },
      { "x": 0, "y": 80, "mass": 8, "score": 20, "color": "#cccccc" }
    ],
    "springs": [
      { "a": 0, "b": 1, "stiffness": 4000, "breakTension": 7500 }
    ]
  }],
  "winCondition": { "destructionThreshold": 0.2, "importantTargetsAll": true, "minScore": 100 }
}
```

- `orbits[0]`: 恒星，fixed (600,400)
- `orbits[1]`: 行星，circular radius=400 period=20，parent=0（绕恒星）
- `orbits[2]`: 核心，fixed (0,-170)，parent=1（绑定行星）
- 核心世界坐标 = 行星世界位置 + (0,-170)

---

## 教程系统

新战役 6 章均有逐关 `guidance`，第一章额外提供发射方向图示。上下文提示由 `src/tutorial.js` 的 `TutorialManager` 队列化管理（详见 `doc/framework.md`），
触发点定义在 `src/main.js` 的游戏循环中：

| 触发条件 | 提示内容 |
|---------|---------|
| 进入关卡（队列依次展示） | 本关学习目标（常驻面板同时提供策略提示） |
| 悬停某类型的未发射子弹 | 该类型弹药的特性教学（覆盖全部 7 种） |
| 首次发射 | 可多次点火修正 |
| 特殊弹在飞行中 | 右键可手动触发效果 |
| 首次空格暂停 | 空格暂停/恢复说明 |
| 首次摧毁重要目标 | 通关条件说明 |

每条提示同一会话只显示一次（跨关卡去重），多条触发时排队逐条展示，所有章节均启用；按 H 切换的常驻引导独立于去重队列。


## 新战役编排

`campaign-index.json` 的 6 章每章 6 关，共 36 个确定性场景。之后附加 `index.json` 的 23 个旧关卡。`src/campaign-data.js` 按两份索引的顺序加载并添加旧存档映射，所有 JSON 随 Webpack 的战役 chunk 打包，浏览器无需访问原始源码。

每关 JSON 由 `src/campaign-authoring.cjs` 中的确定性蓝图生成：11 种可组合的桁架建筑，36 组明确编排的方位、轨道、载荷和中文引导。公共参数减少数据重复，运行时不调用生成器，仍可独立交给 `LevelManager.load()`。

重做战役使用 `fortress-*` ID，避免原简单关卡的成绩被当作新关成绩；历史记录保留，23 个旧关继续使用原 `legacyKey`。通关要求内部目标和分数达标，节约弹药与 Δv 用于二、三星评价。`firstShot` 只驱动提示线。

`flightTimeout: 30` 与 1800 步预测相配合，允许低推力进近及绕行。弹体飞出 ±1700 世界边界也可进入结算缓冲；目标全部清除仍触发原有的 5 秒结果分析。拖拽时显示点火后燃料与预计内舱清除范围（剩余爆炸半径的一半），不预测未来全部碎片碰撞。

完整关卡清单与质量验证见 `campaign.md`。
