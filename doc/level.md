# 关卡系统技术文档

## LevelManager (src/level.js)

关卡系统的核心类，负责关卡数据加载和通关判定。

---

## 关卡数据格式 (LevelData)

```js
{
  name: '前哨站',           // string — 关卡名称
  gravity: 300,             // number — 引力常量 G
  camera: {                 // 初始镜头位置
    x: 700, y: 400,         // 镜头中心世界坐标
    zoom: 0.85              // 缩放级别
  },

  stars: [StarDef],         // 恒星列表
  planets: [PlanetDef],     // 行星列表
  bullets: [BulletDef],     // 子弹配置
  buildings: [BuildingDef], // 建筑配置
  winCondition: WinCond,    // 通关条件
}
```

### StarDef / PlanetDef

```js
{
  mass: 8000,                     // 引力质量
  radius: 50,                     // 渲染半径（px）
  collisionRadius: 45,            // 碰撞半径（px），默认 = radius
  color: '#ffbb33',               // 颜色
  label: '恒星',                  // 标签
  orbit: OrbitDef,                // 轨道定义
}
```

### OrbitDef

**固定位置：**
```js
{ type: 'fixed', x: 600, y: 400 }
```

**圆形轨道：**
```js
{ type: 'circular', cx: 600, cy: 400, radius: 200, period: 10, phase: 0 }
```

**椭圆轨道：**
```js
{ type: 'elliptical', cx: 600, cy: 400, rx: 300, ry: 200, period: 15, phase: 0 }
```

参数说明：
- `cx, cy` — 轨道中心
- `radius / rx, ry` — 轨道半径（px）
- `period` — 轨道周期（秒）
- `phase` — 初始相位（弧度）

### BulletDef

```js
{
  payloadMass: 5,            // 载荷质量（不变）
  fuelMass: 30,              // 燃料质量
  ve: 300,                   // 排气速度
  ignitionCount: 2,          // 可点火次数
  explosionRadius: 60,       // 爆炸半径 r₀（0=动能弹）
  explosionImpulse: 3000,    // 爆炸冲量 P₀
  color: '#ffdd44',          // 渲染颜色
  renderRadius: 8,           // 渲染半径（px）
  hp: 0,                     // 血量（>0=动能弹）
  orbitAround: {             // 初始轨道绑定
    bodyIndex: 0,            // 绕行的星体索引（stars+planets 中的序号）
    altitude: 80,            // 轨道高度（距星体表面）
    phase: 0                 // 初始相位（弧度）
  }
}
```

### BuildingDef

```js
{
  points: [PointDef],        // 质点列表
  springs: [SpringDef],      // 弹簧列表
}
```

#### PointDef

```js
{
  x: 850, y: 230,            // 初始坐标
  mass: 200,                 // 质量
  radius: 8,                 // 碰撞半径
  renderRadius: 10,          // 渲染半径（默认 = radius）
  score: 300,                // 分值
  important: true,           // 重要目标标记
  isCore: true,              // 核心点（参数轨道/静止）
  isEnemy: false,            // 敌人标记
  hp: 200,                   // 敌人血量
  color: '#ffdd44',          // 渲染颜色
  explosionRadius: 60,       // 自身爆炸半径
  explosionImpulse: 3000,    // 自身爆炸冲量
}
```

#### SpringDef

```js
{
  a: 0,                      // 端点 A 的质点索引（在 points 数组中的序号）
  b: 1,                      // 端点 B 的质点索引
  stiffness: 4000,           // 劲度系数 k
  damping: 20,               // 阻尼系数
  breakTension: 7500,        // 断裂张力阈值
  restLength: 50             // 原长（默认取初始距离）
}
```

### WinCond（通关条件）

```js
{
  destructionThreshold: 0.3,   // 质点毁伤比例阈值 (0-1)
  importantTargetsAll: true,   // 是否要求所有重要目标摧毁
  minScore: 100,               // 最低分数
}
```

---

## LevelManager API

### `LevelManager.load(levelData) → GameObjects`

解析关卡数据，返回所有游戏对象：

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `stars` | `CelestialBody[]` | 恒星列表 |
| `planets` | `CelestialBody[]` | 行星列表 |
| `allBodies` | `CelestialBody[]` | 全部星体（=stars+planets） |
| `bullets` | `Bullet[]` | 子弹列表（含初始轨道绑定） |
| `buildings` | `Building[]` | 建筑列表 |
| `physics` | `PhysicsEngine` | 已配置好重力源的物理引擎 |
| `camera` | `{x, y, zoom}` | 初始镜头位置 |

### `LevelManager.checkResult(buildings, winCondition) → Result`

```js
{
  passed: true,              // 是否通关
  stars: 3,                  // 星级 (0-3)
  totalScore: 850,           // 总分
  destructionRate: 0.65,     // 毁伤比例
  importantRemaining: 0,     // 剩余重要目标数
}
```

星级判定：
- 1 星：通关条件全部满足
- 2 星：重要目标全部摧毁
- 3 星：总分 ≥ minScore × 1.5

---

## 完整关卡定义示例

```js
{
  name: '前哨站',
  gravity: 300,
  camera: { x: 700, y: 400, zoom: 0.85 },
  stars: [
    { mass: 8000, radius: 50, color: '#ffbb33', label: '恒星',
      orbit: { type: 'fixed', x: 600, y: 400 } }
  ],
  planets: [
    { mass: 1500, radius: 55, color: '#66aaff', label: '目标行星',
      orbit: { type: 'fixed', x: 850, y: 400 } }
  ],
  bullets: [
    { payloadMass: 5, fuelMass: 30, ve: 300, ignitionCount: 2,
      explosionRadius: 60, explosionImpulse: 3000,
      color: '#ffdd44', renderRadius: 8,
      orbitAround: { bodyIndex: 0, altitude: 80, phase: 0 } }
  ],
  buildings: [
    {
      points: [
        { x: 850, y: 230, mass: 200, score: 300, important: true, isCore: true, color: '#ffdd44' },
        { x: 820, y: 310, mass: 8, score: 20, color: '#cccccc' },
      ],
      springs: [
        { a: 0, b: 1, stiffness: 4000, breakTension: 7500 },
      ]
    }
  ],
  winCondition: { destructionThreshold: 0.3, importantTargetsAll: true, minScore: 100 },
}
```
