/** Read-only HTTP server for the built release; no npm dependencies required. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function createReleaseServer(directory = path.resolve(__dirname, '../dist')) {
  const root = fs.realpathSync(directory);
  return http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    let requestPath;
    try { requestPath = decodeURIComponent(req.url.split('?')[0]); }
    catch { res.writeHead(400); res.end(); return; }
    try {
      const candidate = path.resolve(root, '.' + requestPath);
      const file = fs.realpathSync(requestPath.endsWith('/') ? path.join(candidate, 'index.html') : candidate);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403); res.end(); return;
      }
      const stat = fs.statSync(file);
      if (!stat.isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': /\.[a-f0-9]{8}\./.test(path.basename(file))
          ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createReleaseServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`引力破晓正式版: http://${host}:${port}/`));
}

module.exports = { createReleaseServer };
