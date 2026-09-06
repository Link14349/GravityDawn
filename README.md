# 引力破晓 — Gravity Dawn

二维横版引力弹弓射击游戏。利用万有引力和 Delta-V 机动，发射子弹摧毁敌方建筑。

## v1.0.0 正式版

全中文科学极简界面：任务档案、轨道简报、飞行笔记、弹体遥测、暂停与结果复盘。
新战役共有 9 章 36 关，含「深空攻坚」「共振迷航」「终局星阵」12 个高难度关卡，包含移动行星、最多五处自然引力源和无锚点地表建筑；原有 23 关保留为旧版档案。

- `npm run release`：验证 36 关、构建正式版并生成 `releases/gravity-dawn-1.0.0.tar.gz` 与 SHA-256 校验文件。
- `npm run build`：生成仅含游戏及所需资源的 `dist/`，支持静态网站根目录或子目录部署。
- `npm run preview`：在 `http://127.0.0.1:4173/` 预览正式构建。
- `npm run check:campaign`：使用生产物理模拟验证 36 关，并执行输入、预测与存档回归检查。
- `http://localhost:8080/test/phase23-demo.html`：通过开发服务器运行的正式版阶段演示。

详见 [正式版运行与发布说明](doc/release.md) 和 [战役设计](doc/campaign.md)。

## 玩法简介

- **弹弓瞄准**：鼠标悬停子弹 → 时间暂停 → 向后拖拽 → 松开发射
- **多次点火**：每颗子弹可多次机动修正轨道
- **右键引爆**：爆炸弹/引力弹/燃烧弹等特殊弹药可右键手动触发
- **破坏建筑**：撞击质点、切断弹簧、引发连锁爆炸
- **通关条件**：同时满足所有标记目标、最低分数与毁伤比例；新战役以弹体数量和 Δv 消耗评星

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

- **Node.js** ≥ 20.9
- **npm** ≥ 9

## 环境配置

```bash
# 克隆项目
git clone <repo-url>
cd gravity-shooter

# 安装依赖
npm ci
```

## 启动开发服务器

```bash
# 默认 8080 端口
npm run dev

# 指定开发端口
PORT=3000 npm run serve
```

- 游戏主页面：`http://localhost:<端口>/`
- 关卡设计器：`http://localhost:<端口>/tools/design.html`

## 正式版部署

```bash
npm run release
npm run preview
```

将 `dist/` 的全部内容部署到静态 HTTP(S) 网站即可。也可解压发布包，在解压目录执行 `node src/serve-release.cjs`，无需 npm 安装。服务器默认仅监听本机 4173 端口；需要局域网访问时使用 `HOST=0.0.0.0 PORT=8080 node src/serve-release.cjs`。

游戏通过 HTTP(S) 运行，不支持直接双击 `index.html`。进度保存在浏览器的网站存储中；更换域名或端口会使用不同存档。关卡设计器及其保存接口属于本地开发工具，不包含在正式包中。

桌面鼠标操作为主要支持方式；窄窗口布局自适应。

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
    storage.js    — localStorage 存档与旧 Cookie 迁移
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
