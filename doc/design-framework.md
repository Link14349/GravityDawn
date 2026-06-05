# 关卡设计器 — 技术架构

## 文件结构

```
tools/
  design.html         — 主页面（编辑模式 + 测试模式入口）
  designer.js         — 数据模型 + 状态管理 + 导出/导入
  designer-ui.js      — 编辑模式 Canvas 渲染 + 鼠标/键盘交互
```

## 架构概览

```
┌─────────────────────────────────────────┐
│              design.html                │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  编辑模式     │  │   测试模式        │ │
│  │ DesignerData  │  │ LevelManager     │ │
│  │ + EditModeUI  │  │ + Renderer       │ │
│  │              │  │ + GameController  │ │
│  │              │  │ + PhysicsEngine   │ │
│  │              │  │ + Building        │ │
│  │              │  │ + Camera          │ │
│  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────┘
```

测试模式直接复用 `src/` 下的全部游戏模块，通过 `LevelManager.load()` 从编辑器数据构建运行时对象。

## DesignerData (`tools/designer.js`)

### 核心类

```js
class DesignerData {
  constructor()           // 初始化空关卡数据
  data                    // 关卡数据对象，与单关文件格式一致
  tool                    // 当前工具: 'orbit'|'body'|'core'|'point'|'enemy'|'spring'|'select'
  selected                // 当前选中: { type, orbitIdx?, bodyIdx?, bldIdx?, ptIdx?, ... }
}
```

### 数据结构 (designerData.data)

```js
{
  name: '新关卡',
  gravity: 300,
  camera: { x: 0, y: 0, zoom: 0.75 },

  orbits: [{
    name: '恒星轨道',        // string — 显示名称（可选）
    type: 'fixed',          // 'fixed' | 'circular' | 'elliptical'
    x: 0, y: 0,            // 圆心偏移 / fixed 坐标
    parent: null,           // number|null — 父轨道 id
    radius: 150,            // circular 专属
    period: 20,             // 周期(秒)
    phase: 1.571,           // 相位(弧度)，编辑器 UI 用角度
    rx: 200, ry: 120,       // elliptical 专属
  }],

  stars: [{ orbit: 0, mass: 8000, radius: 50, collisionRadius: 45, color: '#ffbb33', label: '恒星' }],
  planets: [{ orbit: 1, mass: 1500, radius: 45, collisionRadius: 40, color: '#66aaff', label: '行星' }],
  bullets: [{ type: 'explosive', orbitAround: { bodyIndex: 0, altitude: 80, phase: 0 } }],
  buildings: [{ points: [...], springs: [...] }],
  winCondition: { destructionThreshold: 0.2, importantTargetsAll: true, minScore: 100 },
}
```

### 关键方法

| 方法 | 说明 |
|------|------|
| `addOrbit(type, x, y, extra)` | 添加轨道，返回索引 |
| `updateOrbit(idx, props)` | 更新轨道属性（Object.assign） |
| `removeOrbit(idx)` | 删除轨道并修正所有引用索引 |
| `addStar/Planet(orbitIdx, overrides)` | 添加星体 |
| `addBuilding()` | 新建空建筑 |
| `addPoint(bldIdx, ptDef, coreInfo?)` | 添加质点。有 coreInfo 则相对核心偏移，否则绝对坐标 |
| `addSpring(bldIdx, aIdx, bIdx, overrides)` | 添加弹簧 |
| `addBullet(overrides)` | 添加子弹配置 |
| `exportLevel()` | 导出为单关 JSON（深拷贝） |
| `importLevel(json)` | 从 JSON 导入 |
| `getOrbitCenterWorld(idx)` | 计算轨道圆心世界坐标（不含圆周运动） |
| `_calcOrbitWorld(orb, t)` | 递归计算轨道世界位置 |

### 质点添加逻辑

```
addPoint(bldIdx, ptDef, coreInfo?)
  ├─ ptDef.isCore && orbit != null  → 核心点（坐标由 orbit 决定，不存 x/y）
  ├─ coreInfo != null               → 普通质点（x/y = 世界坐标 - 核心世界坐标，相对偏移）
  └─ 其他                           → 无核心质点（存绝对世界坐标）
```

## EditModeUI (`tools/designer-ui.js`)

### 核心类

```js
class EditModeUI {
  constructor(canvas, designerData, callbacks)
  camX, camY, zoom           // 编辑器独立相机
  snapToGrid                 // 对齐网格开关
  _activeEdit                // 当前键盘编辑的字段 { key, text, cursorPos, sel }
  _dropdown                  // 当前打开的下拉菜单 { x, y, w, options, key, sel }
}
```

### 渲染管线

```
render()
  ├─ _drawGrid()          // 100px 网格
  ├─ _drawStars()         // 预生成星空点
  ├─ _drawOrbit() × N     // 轨道标记 + 虚线环 + 父子连线
  ├─ _drawBody() × N      // 星体光晕 + 渐变主体
  ├─ _drawBuilding() × N  // 弹簧线段 + 质点圆点 + 光环
  ├─ _drawToolbar()       // 顶部工具栏
  ├─ _drawPropertyPanel() // 右侧属性面板 + 下拉菜单
  └─ _drawStatusBar()     // 底部状态栏
```

### 交互系统

鼠标事件通过 `_bindEvents()` 绑定在 Canvas 上：

| 事件 | 处理 |
|------|------|
| `mousemove` | 平移拖拽、轨道/质点拖拽、悬停检测 |
| `mousedown` | 工具栏点击、属性面板点击、画布工具效果 |
| `mouseup` | 结束拖拽/平移 |
| `wheel` | 以鼠标为中心缩放 |
| `contextmenu` | `_onRightClick()` → `_selectAt()` 右键选择 |

键盘事件通过 `_bindKeyboard()` 绑定在 window 上：

| 按键 | 效果 |
|------|------|
| `1-6,0` | 切换工具 |
| 打印字符 | 属性编辑模式输入 |
| Enter | 确认属性编辑 |
| Tab | 确认并跳到下一字段 |
| Esc | 取消编辑 / 关闭下拉 / 取消选择 |
| Delete/Backspace | 删除选中 / 编辑时删字 |

### 工具系统

每种工具的点击效果由对应的 `_tool*()` 方法实现：

```js
_onDown() → switch (this.dd.tool) {
  'orbit'  → _toolOrbit(wp)   // 创建 fixed 轨道
  'body'   → _toolBody(wp)    // 找最近轨道 → 添加星体
  'core'   → _toolCore(wp)    // 找最近轨道 → 添加核心点
  'point'  → _toolPoint(wp)   // 找最近含核心建筑 → 相对放置，无则新建建筑
  'enemy'  → _toolEnemy(wp)   // 同上 + isEnemy
  'spring' → _toolSpring(wp)  // 依次点击两点 → 创建弹簧
  'select' → _toolSelect(wp)  // 命中检测 → 选中 + 拖拽
}
```

### 命中检测优先级

```
_selectAt(wp):
  1. 质点 (point)     — 距离 < radius + 12px
  2. 弹簧 (spring)    — 距离线段 < 6px
  3. 星体 (body)      — 距离 < radius + 15px
  4. 轨道 (orbit)     — 圆心命中 或 虚线环命中
```

### 右键循环选择

`_selectAt()` 收集所有命中候选到一个列表。如果连续右键位置接近（< 8px），则在候选列表中循环到下一个。

### 属性面板

- `_getSelectionProps(sel)` — 根据选中类型返回属性列表，每个属性 `{ key, label, value, options? }`
- 有 `options` 的属性渲染为下拉框
- 无 `options` 的渲染为文本输入框
- 编辑状态 `_activeEdit` 管理键盘输入和光标位置
- `_applyPropChange(sel, key, value)` — 将修改写入数据模型

### 相位处理

编辑器 UI 使用**角度**（0°–360°），数据存储和导出使用**弧度**：

```js
// 显示：弧度 → 角度
value: Math.round((orb.phase || 0) * 180 / Math.PI)

// 存储：角度 → 弧度
if (key === 'phase') value = (Number(value) || 0) * Math.PI / 180;
```

## design.html — 测试模式

测试模式在 HTML 的 `<script type="module">` 中实现，流程：

```
enterTestMode()
  ├─ dd.exportLevel() → 获取关卡 JSON
  ├─ LevelManager.load(levelData) → 构建运行时对象
  ├─ new Camera/GameController/Renderer → 搭建游戏循环
  └─ requestAnimationFrame(testLoop)

testLoop():
  ├─ 物理步进（星体 + 建筑 + 子弹 + 爆炸）
  ├─ 结算检测（同 main.js 逻辑）
  ├─ Renderer 渲染
  └─ HUD 叠加（分数、剩余子弹、暂停标记）

exitTestMode():
  ├─ running = false → 停止循环
  └─ 回到编辑模式
```

## Webpack 配置

`webpack.config.js` 中为设计器添加了：

- `devServer.static` 增加 `'./'` 使 `tools/` 和 `src/` 下的 ES 模块可被浏览器加载
- 第二个 `HtmlWebpackPlugin` 条目：`template: './tools/design.html'` → `filename: 'tools/design.html'`

浏览器通过 ES module 原生加载 `../src/` 下的游戏模块（不经 webpack 打包，直接作为静态文件提供）。
