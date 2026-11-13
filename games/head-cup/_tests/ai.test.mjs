// Milestone 4: CPU behaviour.
import { ok, section, makeGame, char, seeded } from './helpers.mjs';
import { Game } from '../src/game.js';
import { STEP } from '../src/config.js';

function cpuMatch(dA, dB, seed, secs = 60, chars = ['el-maestro', 'viking']) {
  const g = new Game({
    teams: [
      { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#fff', trim: '#fff' }, players: [{ char: char(chars[0]), controller: 'ai', difficulty: dA }] },
      { flag: 'brazil', kit: { shirt: '#ffdc02', shorts: '#002776', trim: '#009b3a' }, players: [{ char: char(chars[1]), controller: 'ai', difficulty: dB }] },
    ], time: secs, suddenDeath: false, rng: seeded(seed),
  });
  const stats = { kicks: 0, skills: 0, still: 0 };
  g.emitFn = (t) => { if (t === 'kick') stats.kicks++; if (t === 'skill') stats.skills++; };
  let n = 0; while (g.phase !== 'end' && n++ < (secs + 120) / STEP) { g.update(STEP); }
  return { g, stats };
}

export function aiTests() {
  section('CPU players');
  {
    const { g, stats } = cpuMatch('medium', 'medium', 3);
    ok(g.phase === 'end', 'a full CPU vs CPU match finishes without errors');
    ok(stats.kicks > 15, `CPUs actually play the ball (${stats.kicks} kicks in 60 s)`);
    ok(g.score[0] + g.score[1] > 0, `goals are scored (${g.score.join('-')})`);
    ok(stats.skills > 0, `CPUs use their skills (${stats.skills})`);
  }
  {
    let hardWins = 0, easyWins = 0, gh = 0, ge = 0;
    for (let i = 0; i < 20; i++) {
      const swap = i % 2 === 1; // play both sides
      const { g } = cpuMatch(swap ? 'easy' : 'hard', swap ? 'hard' : 'easy', 100 + i, 60);
      const hard = swap ? 1 : 0;
      gh += g.score[hard]; ge += g.score[1 - hard];
      if (g.winner === hard) hardWins++; else if (g.winner === 1 - hard) easyWins++;
    }
    ok(hardWins > easyWins, `HARD beats EASY more often (${hardWins} wins vs ${easyWins}, goals ${gh}-${ge})`);
    ok(gh > ge, 'HARD scores more goals than EASY overall');
  }
  section('Fairness');
  {
    let goals = [0, 0];
    for (let i = 0; i < 20; i++) { const { g } = cpuMatch('medium', 'medium', 300 + i, 60, ['el-maestro', 'el-maestro']); goals[0] += g.score[0]; goals[1] += g.score[1]; }
    const diff = Math.abs(goals[0] - goals[1]) / Math.max(1, goals[0] + goals[1]);
    ok(diff < 0.12, `left and right sides are equal in a mirror match (goals ${goals.join('-')})`);
  }

  section('1 player vs CPU and 2v2');
  {
    const g = makeGame({ cb: 'ai' });
    g.simulate(20);
    ok(g.players[1].x !== 950 && g.events.some(([t, d]) => t === 'kick' && d.player === 1), 'in 1 Player mode the CPU opponent moves and kicks');
    const slot = (c, ctrl, d) => ({ char: char(c), controller: ctrl, difficulty: d });
    const g2 = new Game({ teams: [
      { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#fff', trim: '#fff' }, players: [slot('nova', 'ai', 'medium'), slot('iron-keeper', 'ai', 'medium')] },
      { flag: 'japan', kit: { shirt: '#0b1f6b', shorts: '#fff', trim: '#bc002d' }, players: [slot('ninja', 'ai', 'medium'), slot('viking', 'ai', 'medium')] },
    ], time: 60, rng: seeded(9) });
    let spread = 0, n = 0;
    while (g2.phase !== 'end' && n++ < 200 / STEP) { g2.update(STEP); if (g2.phase === 'play') { const [a, b] = g2.players; spread += Math.abs(a.x - b.x); } }
    ok(g2.phase === 'end', '2v2 with four CPUs completes a match');
    ok(spread / n > 80, `team-mates spread out (attacker + defender), average gap ${(spread / n).toFixed(0)} px`);
  }
}
