// Milestone 1: physics, goal detection, match flow.
import { ok, section, makeGame, run, toPlay, tap, clearInput, seeded, STEP } from './helpers.mjs';
import { W, GROUND, GOAL_LINE, CROSSBAR_Y } from '../src/config.js';
import { parts } from '../src/physics.js';

export function coreTests() {
  section('Ball physics');
  {
    const g = makeGame(); toPlay(g);
    const b = g.ball; b.x = W / 2; b.y = 150; b.vx = 0; b.vy = 0;
    for (const p of g.players) p.x = p.team ? W - 150 : 150;
    let minY = 1e9, maxY = -1e9, bounces = 0;
    g.events.length = 0;
    run(g, 6, () => { minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y); });
    bounces = g.events.filter(([t]) => t === 'bounce').length;
    ok(maxY <= GROUND - b.r + 0.01, 'ball never sinks below the pitch');
    ok(bounces >= 3, `dropped ball bounces (${bounces} bounces) and settles`);
    ok(b.onGround && Math.abs(b.vy) < 1, 'ball comes to rest on the ground');
    b.vx = 600; const x0 = b.x; run(g, 4);
    ok(Math.abs(b.vx) < 120 && b.x > x0, 'rolling ball slows down with friction');
  }

  section('Goal detection');
  {
    const g = makeGame(); toPlay(g);
    for (const p of g.players) p.x = W / 2;
    const b = g.ball; b.x = 300; b.y = GROUND - b.r; b.vx = -900; b.vy = 0;
    run(g, 1.5);
    ok(g.score[1] === 1 && g.score[0] === 0, 'ball rolling into the LEFT goal scores for the RIGHT team');
    ok(g.phase === 'goal', 'goal celebration phase starts');
    ok(g.events.some(([t]) => t === 'goal'), 'goal event fires (for GOOOAL! text and sound)');
    run(g, 3);
    ok(g.phase === 'ready' || g.phase === 'play', 'positions reset and play resumes after the celebration');
    ok(Math.abs(g.ball.x - W / 2) < 40, 'ball is back at the centre for the restart');

    const g2 = makeGame(); toPlay(g2);
    for (const p of g2.players) p.x = W / 2;
    const c = g2.ball; c.x = W - 300; c.y = GROUND - c.r; c.vx = 900; c.vy = 0; run(g2, 1.5);
    ok(g2.score[0] === 1, 'ball into the RIGHT goal scores for the LEFT team');

    const g3 = makeGame(); toPlay(g3);
    for (const p of g3.players) p.x = W / 2;
    const d = g3.ball; d.x = 260; d.y = 300; d.vx = -700; d.vy = -60; run(g3, 3);
    ok(g3.score[0] + g3.score[1] === 0, 'a ball flying over the crossbar is not a goal');
    ok(d.x > GOAL_LINE || d.y < CROSSBAR_Y, 'the ball does not end up stuck on top of the goal');

    const g4 = makeGame(); toPlay(g4);
    for (const p of g4.players) p.x = W / 2;
    const e = g4.ball; e.x = 200; e.y = CROSSBAR_Y - 2; e.vx = -900; e.vy = 0; run(g4, 0.4);
    ok(g4.events.some(([t]) => t === 'post'), 'ball hitting the crossbar triggers a post hit');
    ok(e.vx > 0 || e.y < CROSSBAR_Y - 10 || g4.score[1] === 0, 'crossbar deflects the ball');
  }

  section('No tunnelling at full speed');
  {
    const g = makeGame(); toPlay(g);
    const [a] = g.players; a.x = 600; for (const p of g.players) if (p !== a) p.x = 1100;
    const q = parts(a);
    const b = g.ball; b.x = 200; b.y = q.headY; b.vx = 2500; b.vy = 0;
    run(g, 0.4);
    ok(b.x < a.x, 'a 2500 px/s shot bounces off a head instead of passing through');
  }

  section('Players: run, jump, kick');
  {
    const g = makeGame(); toPlay(g);
    const [p1, p2] = g.players;
    const x0 = p1.x, x1 = p2.x;
    p1.input.right = true; p2.input.left = true; run(g, 0.5); clearInput(p1); clearInput(p2);
    ok(p1.x > x0 + 100 && p2.x < x1 - 100, 'both players move at the same time');
    run(g, 0.5);
    tap(g, p1, 'jump'); let top = GROUND; run(g, 1, () => { top = Math.min(top, p1.y); });
    ok(GROUND - top > 100, `jump height ${(GROUND - top).toFixed(0)} px`);
    ok(p1.onGround, 'player lands');
    // kick toward the right goal
    const b = g.ball; p1.x = 500; p2.x = 1100; run(g, 0.05);
    b.x = 545; b.y = GROUND - b.r; b.vx = 0; b.vy = 0;
    tap(g, p1, 'kick'); run(g, 0.1);
    ok(b.vx > 600, `kick launches the ball toward the opponent goal (vx ${b.vx.toFixed(0)})`);
    ok(g.events.some(([t]) => t === 'kick'), 'kick event fires');
    const p2kick = makeGame(); toPlay(p2kick);
    const [, r] = p2kick.players; r.x = 800; p2kick.players[0].x = 150; run(p2kick, 0.05);
    const bb = p2kick.ball; bb.x = 755; bb.y = GROUND - bb.r; bb.vx = 0; bb.vy = 0;
    tap(p2kick, r, 'kick'); run(p2kick, 0.1);
    ok(bb.vx < -600, 'player 2 kicks toward the left goal');
  }

  section('Header');
  {
    const g = makeGame(); toPlay(g);
    const [p] = g.players; p.x = 600; g.players[1].x = 1150; run(g, 0.05);
    const q = parts(p);
    const b = g.ball; b.x = 600; b.y = q.headY - 160; b.vx = 0; b.vy = 300;
    run(g, 0.4);
    ok(b.vy < 0 || b.y < q.headY - q.headR, 'ball bounces off the head');
  }

  section('Random stress: 10,000 shots');
  {
    const rnd = seeded(42);
    let bad = 0, nan = 0, goalsOk = true, stuck = 0, shots = 0;
    const g = makeGame({ time: 99999 }); toPlay(g);
    for (let i = 0; i < 10000; i++) {
      if (g.phase !== 'play') { toPlay(g); }
      const b = g.ball;
      for (const p of g.players) { p.x = 150 + rnd() * 980; p.input.jump = rnd() < 0.3; p.input.kick = rnd() < 0.3; }
      b.x = 120 + rnd() * 1040; b.y = 80 + rnd() * 450; b.vx = (rnd() - 0.5) * 5000; b.vy = (rnd() - 0.5) * 5000;
      const before = g.score[0] + g.score[1];
      let airStill = 0;
      for (let k = 0; k < 40; k++) {
        g.update(STEP);
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) nan++;
        if (b.x < -1 || b.x > W + 1 || b.y > GROUND - b.r + 1 || b.y < -1) bad++;
        if (!b.onGround && Math.hypot(b.vx, b.vy) < 5) airStill++;
      }
      if (g.score[0] + g.score[1] > before && g.lastGoal) {
        const gx = g.lastGoal.x;
        if (!(gx < GOAL_LINE || gx > W - GOAL_LINE)) goalsOk = false;
      }
      if (airStill > 30) stuck++;
      shots++;
    }
    ok(nan === 0, 'no NaN positions');
    ok(bad === 0, `ball always stays inside the stadium (${bad} violations)`);
    ok(goalsOk, 'every counted goal happened inside a goal mouth');
    ok(stuck === 0, 'ball never freezes in mid-air');
    ok(shots === 10000, '10,000 random shots simulated');
  }

  section('Match flow');
  {
    const g = makeGame({ time: 5, suddenDeath: true }); toPlay(g);
    for (const p of g.players) p.x = p.team ? 1150 : 130;
    g.ball.x = W / 2; g.ball.y = 500; g.ball.vx = 0;
    run(g, 6);
    ok(g.golden && g.phase === 'play', 'tied at full time -> sudden death (golden goal)');
    const b = g.ball; b.x = 300; b.y = GROUND - b.r; b.vx = -900; for (const p of g.players) p.x = W / 2; run(g, 4);
    ok(g.phase === 'end' && g.winner === 1, 'golden goal ends the match');
    ok(g.events.some(([t]) => t === 'end'), 'end event fires (results screen)');

    const g2 = makeGame({ time: 5, suddenDeath: false }); toPlay(g2);
    for (const p of g2.players) p.x = p.team ? 1150 : 130; run(g2, 6);
    ok(g2.phase === 'end' && g2.winner === null, 'without sudden death a tie ends as a draw');

    const g3 = makeGame({ time: 120, goalLimit: 2 }); toPlay(g3);
    for (let i = 0; i < 2; i++) { toPlay(g3); for (const p of g3.players) p.x = W / 2; const c = g3.ball; c.x = W - 300; c.y = GROUND - c.r; c.vx = 900; c.vy = 0; run(g3, 1.5); run(g3, 3); }
    ok(g3.phase === 'end' && g3.winner === 0 && g3.score[0] === 2, 'goal limit (first to 2) ends the match');
  }
}
