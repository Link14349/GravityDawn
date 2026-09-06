# 引力破晓 — Gravity Dawn

二维横版引力弹弓射击游戏。利用万有引力和 Delta-V 机动，发射子弹摧毁敌方建筑。

## 重建版本

全中文科学极简界面：任务档案、轨道简报、飞行笔记、弹体遥测、暂停与结果复盘。
新增 6 章 36 关，按基础校准、引力入门、动态拦截、载荷实验、复合航线、远征考核推进；原有 23 关保留为旧版档案。

- `npm run build`：生成可独立运行的 dist，含主页面和阶段九、十演示。
- `npm run check:campaign`：使用生产物理模拟验证 36 关，并执行输入、预测与存档回归检查。
- `http://localhost:8080/test/phase9-demo.html`：中文 UI 与简报演示。
- `http://localhost:8080/test/phase10-demo.html`：完整战役演示。

详见 [战役设计](doc/campaign.md)。

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
npm install
```

## 启动开发服务器

```bash
# 默认 8080 端口
npm run dev

# 指定端口（服务器部署推荐）
PORT=3000 npm run serve
```

- 游戏主页面：`http://localhost:<端口>/`
- 关卡设计器：`http://localhost:<端口>/tools/design.html`

## 服务器部署

### 快速启动

```bash
# 前台运行（默认 8080 端口）
./deploy.sh

# 指定端口
./deploy.sh 3000

# 后台长期运行
nohup ./deploy.sh 3000 > gravity.log 2>&1 &

# 停止服务
./deploy.sh stop
```

### systemd 服务（推荐）

```bash
# 编辑服务文件，修改路径
sudo vi gravity-shooter.service
# 将 /path/to/gravity-shooter 替换为实际路径

# 安装并启动
sudo cp gravity-shooter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gravity-shooter
sudo systemctl status gravity-shooter
```

### 开发模式

```bash
# 自动重编译，刷新浏览器查看修改，监听 0.0.0.0
npm run serve
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
