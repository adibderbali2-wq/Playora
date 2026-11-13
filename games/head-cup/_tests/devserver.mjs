// Development server for HEAD CUP: serves this folder with caching disabled, plus PLAYORA's /assets
// (fonts) so the game looks the same as on the site. Usage: node games/head-cup/_tests/devserver.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ASSETS = path.resolve(GAME, '../../src/assets');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  // dev-only: save a generated file (e.g. the thumbnail) into the game folder
  if (req.method === 'POST' && req.url.startsWith('/_save?name=')) {
    const name = path.basename(decodeURIComponent(req.url.split('=')[1]));
    const chunks = []; req.on('data', (c) => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(GAME, name), Buffer.concat(chunks)); res.writeHead(200); res.end('saved ' + name); });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  const base = url.startsWith('/assets/') ? SITE_ASSETS : GAME;
  let file = path.join(base, url.startsWith('/assets/') ? url.slice(8) : url);
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(+process.argv[2] || 8090, () => console.log('HEAD CUP dev server on http://localhost:' + (+process.argv[2] || 8090)));
