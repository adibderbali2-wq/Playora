import { char, seeded } from './helpers.mjs';
import { Game } from '../src/game.js';
import { STEP } from '../src/config.js';
const c = process.argv[2] || 'el-maestro', d = process.argv[3] || 'medium';
let w = [0, 0], goals = [0, 0];
for (let i = 0; i < 40; i++) {
  const g = new Game({ teams: [
    { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#fff', trim: '#fff' }, players: [{ char: char(c), controller: 'ai', difficulty: d }] },
    { flag: 'brazil', kit: { shirt: '#ffdc02', shorts: '#002776', trim: '#009b3a' }, players: [{ char: char(c), controller: 'ai', difficulty: d }] },
  ], time: 60, suddenDeath: false, rng: seeded(900 + i) });
  let n = 0; while (g.phase !== 'end' && n++ < 300 / STEP) g.update(STEP);
  goals[0] += g.score[0]; goals[1] += g.score[1]; if (g.winner != null) w[g.winner]++;
}
console.log(c, d, 'left wins', w[0], 'right wins', w[1], 'goals', goals.join('-'));
