#!/usr/bin/env node
/**
 * Checks every internal link and asset in ./dist exists.
 *   npm run build && npm run check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } })(DIST);

const resolve = (ref) => {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return true;
  let p = path.join(DIST, decodeURIComponent(clean));
  if (clean.endsWith('/')) p = path.join(p, 'index.html');
  return fs.existsSync(p) && fs.statSync(p).isFile();
};

let broken = 0, checked = 0;
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:href|src|data-src)="([^"]+)"/g)) {
    const ref = m[1].replace(/&amp;/g, '&');
    if (!ref.startsWith('/') || ref.startsWith('//')) continue;
    checked++;
    if (!resolve(ref)) { broken++; console.log(`✖ ${path.relative(DIST, f)} -> ${ref}`); }
  }
}
console.log(broken ? `\n${broken} broken link(s) out of ${checked}.` : `✔ All ${checked} internal links and assets OK.`);
process.exit(broken ? 1 : 0);
