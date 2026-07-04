/**
 * 引力破晓 — 静态服务器 + 关卡保存 API
 * 用法: PORT=8080 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist');
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

// ---- 辅助 ----
function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}
function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
function jsonReply(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ---- 静态文件 ----
function serveStatic(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/' || url === '') url = '/index.html';

  const distPath = path.join(DIST, url);
  const rootPath = path.join(ROOT, url);

  let filePath;
  if (fs.existsSync(distPath)) filePath = distPath;
  else if (fs.existsSync(rootPath)) filePath = rootPath;
  else { res.writeHead(404); res.end('404'); return; }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
}

// ---- 关卡保存 API ----
function handleSave(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { chapter, level, levelData, isNew } = JSON.parse(body);
      if (!chapter || !level || !levelData) {
        return jsonReply(res, 400, { error: '缺少 chapter/level/levelData' });
      }

      const chDir = path.join(ROOT, 'data', 'levels', chapter);
      const chIndexPath = path.join(chDir, 'index.json');
      const chIndex = readJSON(chIndexPath);
      if (!chIndex) return jsonReply(res, 400, { error: `章节 ${chapter} 不存在` });

      if (isNew) {
        // 找下一个可用的 lv 编号
        let n = 1;
        while (chIndex.levels.includes(`lv${n}`)) n++;
        const lvName = `lv${n}`;
        chIndex.levels.push(lvName);
        writeJSON(chIndexPath, chIndex);
        writeJSON(path.join(chDir, `${lvName}.json`), levelData);
        jsonReply(res, 200, { ok: true, level: lvName, isNew: true });
      } else {
        // 覆盖已有
        writeJSON(path.join(chDir, `${level}.json`), levelData);
        jsonReply(res, 200, { ok: true, level, isNew: false });
      }
    } catch (e) {
      jsonReply(res, 500, { error: e.message });
    }
  });
}

// ---- 启动 ----
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/save') {
    handleSave(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`✅ 引力破晓服务已启动: http://localhost:${PORT}`);
  console.log(`   游戏:       http://localhost:${PORT}/`);
  console.log(`   关卡设计器: http://localhost:${PORT}/tools/design.html`);
});
