#!/bin/bash
# 引力破晓 — 服务器部署脚本
# 用法:
#   ./deploy.sh              # 默认 8080 端口，前台运行
#   ./deploy.sh 3000         # 指定端口
#   nohup ./deploy.sh 3000 & # 后台运行
#   ./deploy.sh stop         # 停止后台服务

PORT=${1:-8080}
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 停止已有服务
stop_server() {
    echo "🔍 查找端口 $PORT 上的进程..."
    PID=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "⏹ 停止进程 $PID (端口 $PORT)"
        kill $PID 2>/dev/null
        sleep 1
        # 如果还没死，强杀
        kill -9 $PID 2>/dev/null 2>&1
        echo "✅ 已停止"
    else
        echo "ℹ 端口 $PORT 无运行中的服务"
    fi
}

if [ "$1" = "stop" ]; then
    stop_server
    exit 0
fi

echo "═══════════════════════════════════════"
echo "  引力破晓 — Gravity Dawn"
echo "═══════════════════════════════════════"

# 检查依赖
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "📦 安装依赖..."
    cd "$PROJECT_DIR"
    npm install --production
fi

# 构建
echo "🔨 构建生产版本..."
cd "$PROJECT_DIR"
npx webpack --mode production 2>&1 | tail -3

# 停止旧服务
stop_server

# 用一个简单的 Node.js 静态服务器，同时提供 dist/ + 项目根目录的 data/ img/
echo ""
echo "🚀 启动服务 (端口 $PORT)..."
cd "$PROJECT_DIR"
PORT=$PORT node server.js