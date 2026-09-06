# 子弹系统

## 设计概要

7 种子弹类型，在 `levels.json` 中只需指定 `type` + `orbitAround`，其余属性从 `BULLET_TYPES` 字典读取。`ve`（排气速度）由 Δv 和质量参数自动推导，不再作为外部输入。

## 类型字典 (BULLET_TYPES)

| type | 名称 | ΔV | 点火 | 爆炸半径 | 爆炸冲量 | 渲染半径 | 颜色 | HP | 特殊效果 |
|------|------|-----|------|---------|---------|---------|------|----|---------|
| `normal` | 普通弹 | 300 | 2 | 30 | 1500 | 8 | `#ff4444` 红 | 0 | — |
| `explosive` | 爆炸弹 | 300 | 2 | 200 | 4000 | 14 | `#ff8fb4` 珊瑚粉 | 0 | — |
| `kinetic` | 动能弹 | 220 | 2 | 0 | 0 | 16 | `#a82020` 深红 | 300 | 无爆炸，靠撞击+HP生存 |
| `agile` | 机动弹 | 1000 | 10 | 30 | 2000 | 8 | `#ffdd44` 黄 | 0 | 高ΔV+多次点火 |
| `cluster` | 分裂弹 | 280 | 2 | 25 | 1000 | 8 | `#44ddee` 青 | 0 | 分裂 3 颗小子弹(不可机动) |
| `gravity` | 引力弹 | 260 | 2 | 40 | 500 | 10 | `#cc88ff` 紫 | 0 | 撞击生成 3 秒临时引力源(质量8000) |
| `incendiary` | 燃烧弹 | 300 | 2 | 50 | 2500 | 9 | `#ff9944` 橙 | 0 | 对弹簧施加 4 秒灼烧(降 breakTension) |

弹体实心圆和外圈统一使用 `Bullet.color`：优先使用关卡显式 `color`，否则使用类型字典颜色。待发射、飞行及悬停时均保留该颜色；关卡背景统一为暖白色，弹体实心圆带深色细描边，确保黄色、青色、珊瑚粉等浅色弹体清晰可见。爆炸弹保持明亮的珊瑚粉。待发射墨色描边与悬停光环继续表示交互状态（可机动为墨色，不可机动为橙色），不覆盖类型颜色。动能弹默认渲染半径 16，是普通弹 8 的两倍，便于区分两种红色弹药。分裂子弹继承母弹颜色（默认青色）。`test/phase13-demo.html` 调用实际 `Bullet` 与 `Renderer` 展示七种弹药及各状态。

### 质量参数

| type | payloadMass | fuelMass | 初始总质量 |
|------|------------|---------|-----------|
| normal | 5 | 8 | 13 |
| explosive | 10 | 18 | 28 |
| kinetic | 20 | 12 | 32 |
| agile | 3 | 8 | 11 |
| cluster | 5 | 10 | 15 |
| gravity | 8 | 10 | 18 |
| incendiary | 6 | 10 | 16 |

## 通用机制

### 推进模型（齐奥尔科夫斯基公式）

```
Δv = ve · ln(m₀ / mf)
mf = m₀ · exp(-Δv / ve)
```

- `payloadMass` — 载荷质量（机动中不变）
- `fuelMass` — 燃料质量（随 ΔV 递减）
- `ve` — 排气速度（由 Δv 和质量参数自动推导：`ve = Δv / ln((payload+fuel) / payload)`）
- `totalMass = payloadMass + fuelMass`
- `remainingDeltaV = ve · ln(totalMass / payloadMass)`

### 爆炸公式

```
P(r) = P₀ · exp(-r / r₀)
```

- r₀（爆炸半径）= 0 → 无爆炸冲击（动能弹）
- 有效爆炸属性随剩余燃料比例缩放
- 爆心 1/3 半径内质点+弹簧直接气化

### 轨道绑定

```json
"orbitAround": {
  "bodyIndex": 0,   // 绕行 allBodies 中的索引
  "altitude": 80,   // 轨道高度（距星体表面）
  "phase": 0        // 初始相位（弧度）
}
```

发射前绕星体做圆形轨道运动（参数方程，非物理模拟）。发射后脱离轨道，进入引力物理模拟。

### 交互方式

- 鼠标悬停子弹 → 时间暂停
- 拖拽子弹（向后拉=向前射的弹弓式）→ ΔV 矢量
- 悬停或拖拽时显示剩余 ΔV 上限点线圈（半径 = `remainingDeltaV / 0.5`，世界单位，随镜头缩放）
- 圈内或圆周上松开左键 → 发射（消耗一次点火和相应 ΔV）
- 拖出点线圈立即取消规划，清除预览且不消耗燃料/点火，不改变弹体原速度或发射状态；同一次拖拽回圈内也不会发射，需重新按下左键。取消后恢复模拟，已有空格暂停保持
- 松手时用实际鼠标位置复查上限；离开画布仍可取消
- 可多次点火（`remainingIgnitions > 0` 且 `remainingDeltaV > 0`）
- 悬停半径 40 世界单位，ΔV 缩放 0.5（拖动世界距离→ΔV 单位）；输入先经过画布 CSS 比例与镜头坐标转换

## 特殊效果详情

### 分裂弹 (cluster)

撞击或右键手动触发时，在当前位置分裂为 3 颗小子弹：
- 数量：3 颗
- 类型：normal 变体（renderRadius=5，颜色继承母弹，默认青色 `#44ddee`）
- 质量：母弹的 20%（payloadMass + fuelMass）
- 速度：母弹速度的 60%
- 方向：母弹速度方向为中线，±30° 扇形（总 60°）均匀分布
- 子弹出厂即 `launched=true`，**不可机动**（ignitionCount=0, deltaV=0）

### 引力弹 (gravity)

撞击后生成临时引力源：
- 质量 500，持续 3 秒
- 向 PhysicsEngine 注册为临时引力源
- 到期自动移除，不影响结算
- 渲染：脉动紫色光环（`drawGravityWell`）

### 燃烧弹 (incendiary)

撞击建筑后对命中建筑所有存活弹簧施加灼烧：
- 持续时间 4 秒
- 每秒降低 breakTension 80
- 每建筑只燃烧一次（`_burnedBuildings` 去重）
- 渲染：弹簧上橙黄色火焰粒子（`drawBurnEffect`）

### 动能弹 (kinetic)

explosionRadius=0，无爆炸冲击。靠 HP(300)+碰撞速度扣血穿透建筑群。`maxHp>0` 时碰撞扣血不死即穿。

## 关卡数据格式

```json
// 新格式（推荐）
{ "type": "explosive", "orbitAround": { "bodyIndex": 0, "altitude": 100, "phase": 0.7854 } }

// 旧格式（兼容，type 不存在时默认 normal）
{ "payloadMass": 5, "fuelMass": 30, "ve": 300, "ignitionCount": 2, "explosionRadius": 60, "explosionImpulse": 3000, "color": "#ffdd44", "renderRadius": 8, "orbitAround": { "bodyIndex": 0, "altitude": 80, "phase": 0 } }
```

## 实现文件

- `src/bullet.js` — Bullet 类 + BULLET_TYPES 字典 + 特殊效果方法
- `src/flight-simulation.js` — 分裂弹/引力弹/燃烧弹效果触发 + 临时引力源管理（游戏与验证共用）
- `src/renderer.js` — `drawGravityWell()` + `drawBurnEffect()`
- `src/building.js` — 弹簧燃烧效果处理

## 堡垒战役补充（阶段十一）

推进继续按火箭方程消耗燃料。瞄准面板新增本次可实现的 Δv 和点火后燃料；碰撞处的虚线圆半径为剩余爆炸半径的一半，对应内部敌方控制单元的范围清除阈值。较大的推力会缩小这个范围。动能弹仍按每次碰撞时的速度损失耐久，中低速穿透厚桁架可以比全速更有效。

燃烧持续 4 秒，每条弹簧使用自身的 `burnRate`（默认每秒 80，新堡垒可熔断斜撑为 600）降低 `breakTension`。零燃料或零 Δv 的分裂子弹保留被动运动，预算与爆炸范围保持有限，不再出现除零结果。

新战役可通过关卡字段覆盖默认 Δv、点火次数、爆炸半径和渲染半径；实际余量以游戏弹体面板为准。所有界面与提示使用中文。
