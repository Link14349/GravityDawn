# 播片剧情系统

## 概述

关卡开始前可播放剧情对话，类似明日方舟的播片风格：全屏背景 + 左右人物立绘 + 底部对话框。每关可选是否配置剧情。

## 数据格式

关卡 JSON 中新增可选 `cutscene` 字段，不存在时直接进入关卡。

```json
{
  "name": "关卡名",
  "cutscene": {
    "assets": {
      "backgrounds": { "bridge": "bridge", "outpost": "outpost" },
      "characters": { "commander": "commander", "peach": "peach" }
    },
    "scenes": [
      {
        "bg": "bridge",
        "left": "commander",
        "right": "peach",
        "dialogue": { "speaker": "指挥官", "text": "桃子，前方侦察到异常信号。" }
      },
      {
        "bg": "bridge",
        "left": "commander",
        "right": null,
        "dialogue": { "speaker": "指挥官", "text": "准备出击。" }
      },
      {
        "bg": "outpost",
        "left": null,
        "right": "peach:thinking",
        "dialogue": { "speaker": "桃子", "text": "收到！" }
      }
    ]
  }
}
```

### 资源路径规则

| 资源类型 | key 格式 | 加载路径 |
|---------|---------|---------|
| 背景 | `"bridge"` | `img/bg/bridge.png` |
| 人物（默认表情） | `"commander"` | `img/char/commander/default.png` |
| 人物（指定表情） | `"commander:angry"` | `img/char/commander/angry.png` |

### cutscene 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `assets.backgrounds` | `{ key: key }` | 声明可用的背景 key，程序自动拼 `img/bg/{key}.png` |
| `assets.characters` | `{ key: key }` | 声明可用的人物 key，程序自动拼 `img/char/{key}/` |
| `scenes[]` | `Scene[]` | 场景数组，按顺序播放 |

### Scene 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `bg` | `string` | 背景 key，如 `"bridge"` |
| `left` | `string \| null` | 左侧人物，如 `"commander"` 或 `"peach:thinking"` |
| `right` | `string \| null` | 右侧人物，格式同上 |
| `dialogue.speaker` | `string` | 说话人名称 |
| `dialogue.text` | `string` | 对话文本 |

---

## 界面布局

```
┌──────────────────────────────────────────────┐
│                                              │
│              [全屏背景图]                      │
│                                              │
│  ┌──────┐                      ┌──────┐      │
│  │      │                      │      │      │
│  │ left │                      │right │      │
│  │      │                      │      │      │
│  └──────┘                      └──────┘      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 指挥官                                 │  │
│  │                                        │  │
│  │ 前哨站发现了敌人的踪迹，准备出击。       │  │
│  │                                        │  │
│  │                         [点击继续] [跳过] │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- 背景全屏拉伸（保持比例裁切）
- 人物立绘从底部向上站立，左右各一个
- 对话框位于底部，半透明深色背景
- 说话人名字显示在对话框顶部左上方
- 对话文字从说话人名字下方开始

---

## 交互

| 操作 | 效果 |
|------|------|
| 点击/按空格/Enter | 当前句未播完 → 立即完整显示；已播完 → 进下一句 |
| 点「跳过」按钮 | 直接结束播片，进入关卡 |
| 最后一句后 | 显示「点击开始作战」，点击进入关卡 |

---

## 文字动画

- **打字机效果**：文字逐字出现，速度约 40 字/秒
- 点击跳过打字动画，直接显示完整句子
- 最后一句播放完毕后不自动跳转，需手动点击

---

## 场景转场

| 变化 | 效果 |
|------|------|
| bg 切换 | 背景 0.3s 淡入过渡 |
| left/right 切换 | 人物 0.2s 水平滑入（新） / 滑出（旧） |
| 同一 key 连续出现 | 保持原位不动 |

---

## 状态机

```
LEVEL_SELECT  →  CUTSCREEN  →  GAME_HUD
                    ↑
               (无cutscene则跳过)
```

UI 新增 `Screen.CUTSCENE` 状态：

```js
// src/ui.js
export const Screen = Object.freeze({
  START: 'start',
  LEVEL_SELECT: 'levelSelect',
  CUTSCENE: 'cutscene',   // 新增
  GAME_HUD: 'gameHud',
  RESULT: 'result',
});
```

## 实现文件

| 文件 | 说明 |
|------|------|
| `src/cutscene.js` | **新建** — CutsceneManager 类，播片渲染+交互 |
| `src/ui.js` | 新增 `Screen.CUTSCENE`，`render()` 派发 |
| `src/main.js` | 选关后检测 `cutscene` → 进入 CUTSCENE；结束后进入 GAME_HUD |
| `doc/cutscene.md` | 本文档 |

---

## CutsceneManager 类（设计）

### 构造函数

```js
new CutsceneManager(canvas, cutsceneData, onComplete)
```

- `canvas` — 主画布
- `cutsceneData` — 关卡的 cutscene 对象
- `onComplete` — 播片结束回调

### 生命周期

```
constructor()
  → preloadAssets()    // 预加载所有图片
  → start()            // 开始渲染循环
  → render()           // 每帧绘制
  → advance()          // 下一句
  → skip()             // 跳过全部
  → destroy()          // 清理，回调 onComplete
```

### 预加载

进入播片前一次性加载 `assets.backgrounds` 和 `assets.characters` 中所有图片。加载完成后才开始渲染。加载失败的图片用纯色占位。

---

## 教程章剧情示例

```json
"cutscene": {
  "assets": {
    "backgrounds": { "bridge": "bridge" },
    "characters": { "commander": "commander", "trainee": "trainee" }
  },
  "scenes": [
    { "bg": "bridge", "left": "commander", "right": null,
      "dialogue": { "speaker": "指挥官", "text": "欢迎来到引力破晓的战术训练。" } },
    { "bg": "bridge", "left": "commander", "right": "trainee",
      "dialogue": { "speaker": "指挥官", "text": "今天你将学习三种基本武器的使用方法。" } },
    { "bg": "bridge", "left": null, "right": "trainee:surprised",
      "dialogue": { "speaker": "学员", "text": "明白！请开始训练吧。" } }
  ]
}
```
