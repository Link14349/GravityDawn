# 引力破晓 — Gravity Dawn

二维横版引力弹弓射击游戏。利用万有引力和 Delta-V 机动，发射子弹摧毁敌方建筑。

## 玩法简介

- **弹弓瞄准**：鼠标悬停子弹 → 时间暂停 → 向后拖拽 → 松开发射
- **多次点火**：每颗子弹可多次机动修正轨道
- **右键引爆**：爆炸弹/引力弹/燃烧弹等特殊弹药可右键手动触发
- **破坏建筑**：撞击质点、切断弹簧、引发连锁爆炸
- **通关条件**：摧毁所有重要目标即可过关

### 子弹类型（7 种）

| 类型 | 特点 |
|------|------|
| 普通弹 | 均衡爆炸伤害 |
| 爆炸弹 | 大范围爆炸（200px），右键引爆 |
| 动能弹 | 无爆炸，HP 穿透多层结构 |
| 机动弹 | 超高 ΔV（1000），10 次点火 |
| 分裂弹 | 撞击分裂 3 颗小子弹 |
| 引力弹 | 撞击生成临时引力源（3 秒） |
| 燃烧弹 | 对弹簧施加灼烧，持续降 BreakTension |

## 环境依赖

- **Node.js** ≥ 18
- **npm** ≥ 9

## 环境配置

```bash
# 克隆项目
git clone <repo-url>
cd gravity-shooter

# 安装依赖
npm install
```

## 启动开发服务器

```bash
# 启动游戏（含关卡设计器）
npm run dev
```

浏览器自动打开 `http://localhost:8080`。

- 游戏主页面：`http://localhost:8080/`
- 关卡设计器：`http://localhost:8080/tools/design.html`

## 服务器部署

```bash
# 构建生产版本
npm run build

# dist/ 目录即为静态文件，部署到任意 HTTP 服务器即可
# 例如使用 nginx：
#   server { root /path/to/dist; }
# 或使用 Python：
#   cd dist && python3 -m http.server 8080
```

## 项目结构

```
gravity-shooter/
  src/            — 游戏源码
    main.js       — 入口
    physics.js    — 物理引擎（半隐式欧拉 + 万有引力）
    bullet.js     — 子弹系统（齐奥尔科夫斯基公式 + 7 种类型）
    building.js   — 建筑系统（弹簧质点模型）
    celestial.js  — 星体（轨道绑定）
    binding.js    — 轨道系统（递归 parent 链）
    explosion.js  — 爆炸公式 P(r)=P₀·exp(-r/r₀)
    renderer.js   — Canvas 渲染器
    game-controller.js — 输入控制
    ui.js         — UI 状态机
    level.js      — 关卡加载器
    cutscene.js   — 播片剧情系统
    camera.js     — 镜头平移/缩放
    storage.js    — Cookie 存档
  tools/          — 关卡设计器
    design.html   — 设计器页面
    designer.js   — 数据模型
    designer-ui.js — 编辑界面
  data/levels/    — 关卡数据（分章节分文件）
  doc/            — 技术文档
  img/            — 图片资源
```

## 技术栈

| 项目 | 技术 |
|------|------|
| 语言 | ES6 JavaScript |
| 打包 | Webpack 5 + Babel |
| 渲染 | HTML5 Canvas 2D |
| 物理 | 半隐式欧拉积分 + 万有引力 |
| 版本控制 | Git |
