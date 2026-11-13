import { char, seeded } from './helpers.mjs';
import { Game } from '../src/game.js';
import { LEVELS } from '../src/ai.js';
import { STEP } from '../src/config.js';
const [A, B] = [process.argv[2] || 'hard', process.argv[3] || 'easy'];
if (process.argv[4]) for (const k in LEVELS) Object.assign(LEVELS[k], JSON.parse(process.argv[4]));
let wA = 0, wB = 0, gA = 0, gB = 0;
const N = +process.env.N || 12; for (let i = 0; i < N; i++) {
  const sw = i % 2; const chars = [['el-maestro','viking'],['nova','atlas-lion'],['samba-king','iron-keeper']][i % 3];
  const g = new Game({ teams: [
    { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#fff', trim: '#fff' }, players: [{ char: char(chars[0]), controller: 'ai', difficulty: sw ? B : A }] },
    { flag: 'brazil', kit: { shirt: '#ffdc02', shorts: '#002776', trim: '#009b3a' }, players: [{ char: char(chars[1]), controller: 'ai', difficulty: sw ? A : B }] },
  ], time: 60, suddenDeath: false, rng: seeded(50 + i) });
  let n = 0; while (g.phase !== 'end' && n++ < 300 / STEP) g.update(STEP);
  const a = sw ? 1 : 0; gA += g.score[a]; gB += g.score[1 - a]; if (g.winner === a) wA++; else if (g.winner === 1 - a) wB++;
}
console.log(`${A} ${wA} wins, ${B} ${wB} wins | goals ${gA}-${gB} (avg ${((gA + gB) / N).toFixed(1)}/match)`);
