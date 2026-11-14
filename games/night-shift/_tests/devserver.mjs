// Development server for NIGHT SHIFT: serves the game folder with caching disabled.
// Dev-only POST /_save?name=thumb.webp writes a generated file (thumbnail capture) into the game folder.
// Usage: node games/night-shift/_tests/devserver.mjs [port]   (folders starting "_" are not published)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const port = +process.argv[2] || 8092;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/_save?name=')) {
    const name = path.basename(decodeURIComponent(req.url.split('=')[1]));
    if (!/^[\w.-]+\.(webp|png|jpg)$/.test(name)) { res.writeHead(400); return res.end(); }
    const chunks = []; req.on('data', (c) => chunks.push(c));
    // test screenshots go to _tests/shots (not published); thumbnails to the game folder
    const dir = name.startsWith('shot') ? path.join(GAME, '_tests', 'shots') : GAME;
    fs.mkdirSync(dir, { recursive: true });
    req.on('end', () => { fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); res.writeHead(200); res.end('saved ' + name); });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(GAME, url);
  if (!file.startsWith(GAME)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('NIGHT SHIFT dev server on http://localhost:' + port));
