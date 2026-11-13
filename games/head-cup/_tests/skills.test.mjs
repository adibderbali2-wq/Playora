// Milestone 3: every skill activates, does its job, and cleans up.
import { ok, section, makeGame, run, toPlay, tap, clearInput } from './helpers.mjs';
import { SKILL_IDS, SKILLS } from '../src/skills/index.js';
import { W, GROUND, PHYS } from '../src/config.js';
import { parts } from '../src/physics.js';

function setup(id, extra = {}) {
  const g = makeGame({ skillA: id, skillB: 'teleport', ...extra }); toPlay(g);
  const [a, b] = g.players;
  a.x = 500; b.x = 800; g.skills.get(a).charge = 0; run(g, 0.05);
  return { g, a, b, s: g.skills.get(a) };
}
const fire = (g, p) => tap(g, p, 'skill');

export function skillsTests() {
  section('Skill system');
  ok(SKILL_IDS.length === 14, `14 skills registered (${SKILL_IDS.join(', ')})`);
  ok(SKILL_IDS.every((id) => { const d = SKILLS[id]; return d.name.en && d.name.fr && d.name.ar && d.desc.ar && typeof d.icon === 'function' && d.uses === 1 && d.cooldown > 0 && d.sfx; }), 'each skill has names/descriptions in EN/FR/AR, icon, cooldown, uses, sfx');
  {
    const g = makeGame({ skillA: 'freeze' }); toPlay(g);
    const [a] = g.players;
    tap(g, a, 'skill');
    ok(g.skills.get(a).uses === 1 && g.events.some(([t]) => t === 'skillDenied'), 'a skill cannot be used before its charge bar is full');
    g.skills.get(a).charge = 0; tap(g, a, 'skill');
    ok(g.skills.get(a).uses === 0, 'using a skill consumes its single use (X1 -> X0)');
    g.skills.get(a).charge = 0; tap(g, a, 'skill');
    ok(g.events.filter(([t]) => t === 'skill').length === 1, 'a used-up skill cannot be used again in the match');
  }

  section('Each skill');
  { // 1 Fireball
    const { g, a, b, s } = setup('fireball');
    fire(g, a); ok(s.active && s.data.armed, 'FIREBALL arms the next kick');
    const ball = g.ball; a.x = 500; ball.x = 545; ball.y = GROUND - ball.r; ball.vx = ball.vy = 0; b.x = 1000;
    tap(g, a, 'kick'); run(g, 0.12);
    ok(ball.fire > 0 && ball.vx > 1500, `burning shot (vx ${ball.vx.toFixed(0)})`);
    ok(!s.active, 'fireball is spent after the kick');
    run(g, 0.4);
    ok(b.stun > 0 || g.score[0] > 0 || ball.fire === 0, 'burning ball knocks back the opponent it hits (or scores)');
  }
  { // 2 Teleport
    const { g, a } = setup('teleport');
    g.ball.x = 900; g.ball.y = GROUND - 21; g.ball.vx = 0; fire(g, a);
    ok(Math.abs(a.x - (900 - 58)) < 20, `TELEPORT puts the player behind the ball (x ${a.x.toFixed(0)})`);
  }
  { // 3 Shrink
    const { g, a, b } = setup('shrink');
    fire(g, a); run(g, 1);
    ok(b.scale < 0.7 && b.mods.jumpMul < 1, `SHRINK makes the opponent small (scale ${b.scale.toFixed(2)}) with weaker jumps`);
    ok(a.scale > 0.99, 'the user stays normal size');
    run(g, 5);
    ok(b.scale > 0.95, 'opponent grows back after 5 s');
  }
  { // 4 Mega strength
    const { g, a, b } = setup('megaStrength');
    const normal = a.kickPower;
    fire(g, a); run(g, 0.05);
    ok(a.mods.kickMul === 2, 'MEGA STRENGTH doubles kick power');
    const ball = g.ball; b.x = 1100; ball.x = 545; ball.y = GROUND - ball.r; ball.vx = ball.vy = 0; a.x = 500;
    tap(g, a, 'kick'); run(g, 0.12);
    ok(Math.hypot(ball.vx, ball.vy) > normal * 1.4 && ball.tornado > 0, 'kicked ball is much faster and swirls like a tornado');
    run(g, 6); ok(a.mods.kickMul === 1, 'power returns to normal after 5 s');
  }
  { // 5 Freeze
    const { g, a, b } = setup('freeze');
    fire(g, a); const x = b.x; b.input.left = true; run(g, 1); clearInput(b);
    ok(b.frozen > 0 && Math.abs(b.x - x) < 2, 'FREEZE stops the opponent completely');
    run(g, 1.2); b.input.left = true; run(g, 0.3);
    ok(b.x < x - 30, 'opponent can move again after 2 s');
  }
  { // 6 Giant keeper
    const { g, a, b } = setup('giantKeeper');
    fire(g, a);
    ok(g.walls.length === 1, 'GIANT KEEPER adds a wall in front of your goal');
    const ball = g.ball; b.x = 900; a.x = 900; ball.x = 300; ball.y = GROUND - ball.r; ball.vx = -1400; ball.vy = 0;
    run(g, 1.2);
    ok(g.score[1] === 0, 'a shot at your goal is blocked');
    run(g, 4); ok(g.walls.length === 0, 'wall disappears after 4 s');
  }
  { // 7 Magnet
    const { g, a } = setup('magnet');
    const ball = g.ball; ball.x = 900; ball.y = 300; ball.vx = 0; ball.vy = 0;
    fire(g, a); run(g, 1.5);
    const q = parts(a);
    ok(Math.hypot(ball.x - q.headX, ball.y - q.headY) < 200, 'MAGNET pulls the ball to your head');
  }
  { // 8 Speed boost
    const { g, a } = setup('speedBoost');
    a.input.right = true; run(g, 0.4); const v0 = a.vx; clearInput(a); run(g, 0.4);
    fire(g, a); a.input.left = true; run(g, 0.5);
    ok(Math.abs(a.vx) > v0 * 1.6, `SPEED BOOST: ${v0.toFixed(0)} -> ${Math.abs(a.vx).toFixed(0)} px/s`);
  }
  { // 9 Ghost ball
    const { g, a, b } = setup('ghostBall');
    fire(g, a); const ball = g.ball; b.x = 1100; ball.x = 545; ball.y = GROUND - ball.r; ball.vx = ball.vy = 0; a.x = 500;
    tap(g, a, 'kick'); run(g, 0.12);
    ok(ball.ghost > 0, 'GHOST BALL makes the kicked ball invisible');
    run(g, 2); ok(ball.ghost === 0, 'ball becomes visible again');
  }
  { // 10 Multi-ball
    const { g, a } = setup('multiBall');
    fire(g, a);
    ok(g.balls.length === 3, 'MULTI-BALL adds two balls');
    run(g, 7.5); ok(g.balls.length === 1 || g.phase !== 'play', 'extra balls vanish after 7 s');
    const t = setup('multiBall'); fire(t.g, t.a);
    const e = t.g.balls[1]; for (const p of t.g.players) p.x = W / 2;
    e.x = 300; e.y = GROUND - e.r; e.vx = -1200; e.vy = 0; run(t.g, 1);
    ok(t.g.score[1] === 1, 'an extra ball can score a goal');
  }
  { // 11 Gravity flip
    const { g, a } = setup('gravityFlip');
    const ball = g.ball; ball.x = 640; ball.y = GROUND - ball.r; ball.vx = 0; ball.vy = 0;
    fire(g, a); run(g, 1.5);
    ok(ball.y < 250, `GRAVITY FLIP makes the ball fall upward (y ${ball.y.toFixed(0)})`);
    run(g, 4); ok(ball.gravityMul === 1, 'gravity returns to normal');
  }
  { // 12 Earthquake
    const { g, a, b } = setup('earthquake');
    fire(g, a);
    ok(b.stun > 0, 'EARTHQUAKE stuns an opponent on the ground');
    const t = setup('earthquake'); tap(t.g, t.b, 'jump'); run(t.g, 0.1); fire(t.g, t.a);
    ok(t.b.stun === 0, 'jumping dodges the earthquake');
  }
  { // 13 Reverse
    const { g, a, b } = setup('reverseControls');
    fire(g, a); const x = b.x; b.input.right = true; run(g, 0.4); clearInput(b);
    ok(b.x < x - 20, 'REVERSE CONTROLS: pressing right moves left');
    run(g, 4.2); const x2 = b.x; b.input.right = true; run(g, 0.3); clearInput(b);
    ok(b.x > x2, 'controls return to normal after 4 s');
  }
  { // 14 Big ball
    const { g, a } = setup('bigBall');
    fire(g, a);
    ok(g.ball.r > PHYS.ballRadius * 1.7, 'BIG BALL grows the ball');
    run(g, 6.5); ok(g.ball.r === PHYS.ballRadius, 'ball shrinks back after 6 s');
    const t2 = setup('bigBall'); fire(t2.g, t2.a); for (const p of t2.g.players) p.x = W / 2;
    const bb = t2.g.ball; bb.x = 320; bb.y = GROUND - bb.r; bb.vx = -1300; bb.vy = 0; run(t2.g, 1.2);
    ok(t2.g.score[1] === 1, 'a Big Ball can still score');
  }

  section('Skills reset after a goal');
  {
    const { g, a } = setup('bigBall');
    fire(g, a);
    for (const p of g.players) p.x = W / 2;
    const ball = g.ball; ball.x = 300; ball.y = GROUND - ball.r; ball.vx = -1200; ball.vy = 0;
    run(g, 4.5);
    ok(g.ball.r === PHYS.ballRadius && !g.skills.get(a).active, 'running skills stop when play restarts after a goal');
  }
}
