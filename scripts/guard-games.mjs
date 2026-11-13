#!/usr/bin/env node
/**
 * Protects existing games from accidental deletion or breakage.
 *   npm run guard            check protected games (also runs in `npm run check` and the git pre-commit hook)
 *   npm run guard -- --lock  re-snapshot games/.protected.json after an INTENDED change
 *
 * Fails if a protected game was removed from games.json, lost its folder/thumbnail/index.html,
 * or went from "playable" back to "coming-soon". Warns (does not fail) if a game file's content changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.join(ROOT, 'games');
const LOCK = path.join(GAMES, '.protected.json');

const catalog = JSON.parse(fs.readFileSync(path.join(GAMES, 'games.json'), 'utf8')).games;
const byId = Object.fromEntries(catalog.map((g) => [g.id, g]));

const filesOf = (dir) => {
  const out = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p) : out.push(p);
    }
  })(dir);
  return out.sort();
};
const hashDir = (id) => {
  const h = crypto.createHash('sha256');
  for (const f of filesOf(path.join(GAMES, id))) h.update(path.relative(GAMES, f).replace(/\\/g, '/')).update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 16);
};

if (process.argv.includes('--lock')) {
  const games = {};
  for (const g of catalog) games[g.id] = { status: g.status, hash: hashDir(g.id) };
  fs.writeFileSync(LOCK, JSON.stringify({ _help: 'Snapshot of protected games. Update only after an intended change: npm run guard -- --lock', games }, null, 2) + '\n');
  console.log(`✔ Locked ${catalog.length} game(s) in games/.protected.json`);
  process.exit(0);
}

if (!fs.existsSync(LOCK)) { console.error('✖ games/.protected.json missing. Run: npm run guard -- --lock'); process.exit(1); }
const locked = JSON.parse(fs.readFileSync(LOCK, 'utf8')).games;
const errors = [], warnings = [];

for (const [id, snap] of Object.entries(locked)) {
  const g = byId[id];
  const dir = path.join(GAMES, id);
  if (!g) { errors.push(`"${id}" was removed from games/games.json`); continue; }
  if (!fs.existsSync(dir)) { errors.push(`folder games/${id}/ was deleted`); continue; }
  if (!g.thumbnail && !['svg', 'webp', 'png', 'jpg', 'jpeg'].some((x) => fs.existsSync(path.join(dir, `thumb.${x}`)))) errors.push(`games/${id}/ lost its thumbnail`);
  if (snap.status === 'playable') {
    if (g.status !== 'playable') errors.push(`"${id}" was playable, now "${g.status}"`);
    if (!g.url && !fs.existsSync(path.join(dir, 'index.html'))) errors.push(`games/${id}/index.html was deleted`);
  }
  if (hashDir(id) !== snap.hash) warnings.push(`games/${id}/ content changed`);
}

warnings.forEach((w) => console.warn(`⚠ ${w}`));
if (errors.length) {
  console.error('\n✖ Protected game check failed:');
  errors.forEach((e) => console.error('  • ' + e));
  console.error('\nIf this was intended, update the snapshot: npm run guard -- --lock\n');
  process.exit(1);
}
console.log(`✔ ${Object.keys(locked).length} protected game(s) intact${warnings.length ? ' (content changes above; run `npm run guard -- --lock` if intended)' : ''}.`);
