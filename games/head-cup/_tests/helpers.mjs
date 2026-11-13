// Shared helpers for the headless HEAD CUP tests. Run all: node games/head-cup/_tests/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/game.js';
import { parseRoster } from '../src/characters.js';
import { STEP } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROSTER = parseRoster(JSON.parse(fs.readFileSync(path.join(here, '../characters.json'), 'utf8')));
export const char = (id) => ROSTER.find((c) => c.id === id) || ROSTER[0];

export function seeded(s = 1) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

let pass = 0, fail = 0;
export const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✖ ' + msg); } };
export const section = (name) => console.log('\n' + name);
export const summary = () => { console.log(`\n${pass} passed, ${fail} failed`); return fail; };

/** Make a game. players: [[team0 slots...], [team1 slots...]], each slot { char, controller, skill }. */
export function makeGame(opts = {}) {
  const events = [];
  const slot = (c, ctrl, skill) => ({ char: char(c), controller: ctrl, skill });
  const teams = opts.teams || [
    { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#fff' }, players: [slot(opts.a || 'el-maestro', opts.ca || 'kb1', opts.skillA)] },
    { flag: 'brazil', kit: { shirt: '#ffdc02', shorts: '#002776' }, players: [slot(opts.b || 'viking', opts.cb || 'kb2', opts.skillB)] },
  ];
  const g = new Game({ teams, time: opts.time || 60, goalLimit: opts.goalLimit || 0, suddenDeath: opts.suddenDeath !== false,
    difficulty: opts.difficulty || 'medium', rng: seeded(opts.seed || 7), emit: (t, d) => events.push([t, d]) });
  g.events = events;
  return g;
}
export { STEP };
export const run = (g, secs, each) => { const n = Math.round(secs / STEP); for (let i = 0; i < n; i++) { if (each) each(i); g.update(STEP); } };
export const toPlay = (g) => { let n = 0; while (g.phase !== 'play' && n++ < 2000) g.update(STEP); };
export const clearInput = (p) => { for (const k in p.input) p.input[k] = false; };
export const tap = (g, p, k) => { p.input[k] = true; g.update(STEP); g.update(STEP); p.input[k] = false; g.update(STEP); };
