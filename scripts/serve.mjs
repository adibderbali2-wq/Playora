#!/usr/bin/env node
/**
 * Tiny local web server for previewing ./dist (no dependencies).
 *   npm start            -> builds, then serves on http://localhost:8080
 *   PORT=3000 npm start  -> another port
 * Behaves like Cloudflare Pages: /about -> /about/, folders serve index.html, unknown pages get 404.html.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

if (!fs.existsSync(DIST)) {
  console.error('No dist folder yet. Run "npm run build" first.');
  process.exit(1);
}

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  let file = path.join(DIST, path.normalize(urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403).end('Forbidden'); return; }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!urlPath.endsWith('/')) { res.writeHead(308, { Location: urlPath + '/' + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '') }).end(); return; }
    file = path.join(file, 'index.html');
  }
  let status = 200;
  if (!fs.existsSync(file)) { status = 404; file = path.join(DIST, '404.html'); }

  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  PLAYORA is running at http://localhost:${PORT}\n  Press Ctrl+C to stop.\n`);
});
