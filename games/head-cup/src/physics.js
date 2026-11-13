// Physics: ball integration, collisions (circles, capsules, walls, goals) and player movement.
// Pure logic — no DOM — so it runs in the browser and in Node tests alike.
import { W, GROUND, GOAL_LINE, CROSSBAR_Y, BAR_R, ROOF, PHYS, BODY } from './config.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : v > t ? Math.max(t, v - s) : v);

// ------------------------------------------------------------------ ball
export function makeBall(x, y) {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r: PHYS.ballRadius, baseR: PHYS.ballRadius, spin: 0, angle: 0,
    fire: 0, tornado: 0, ghost: 0, gravityMul: 1, extra: false, life: Infinity, lastTouch: null, onGround: false, still: 0 };
}

/** Static colliders of the stadium: both crossbar capsules (roof + post tip). */
export function goalCapsules() {
  return [
    { x0: ROOF.x0, y0: ROOF.y0, x1: ROOF.x1, y1: ROOF.y1, r: BAR_R },
    { x0: W - ROOF.x0, y0: ROOF.y0, x1: W - ROOF.x1, y1: ROOF.y1, r: BAR_R },
  ];
}

/** Collide a ball with a circle that may be moving (vx, vy). Returns impact speed or 0. */
export function collideCircle(ball, cx, cy, cr, cvx, cvy, bounce) {
  const dx = ball.x - cx, dy = ball.y - cy;
  const rr = ball.r + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2) || 0.0001;
  const nx = dx / d, ny = dy / d;
  ball.x = cx + nx * (rr + 0.5);
  ball.y = cy + ny * (rr + 0.5);
  const rvx = ball.vx - cvx, rvy = ball.vy - cvy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0.0001;
  ball.vx -= (1 + bounce) * vn * nx;
  ball.vy -= (1 + bounce) * vn * ny;
  // tangential velocity becomes spin
  const tx = -ny, ty = nx;
  const vt = rvx * tx + rvy * ty;
  ball.spin = clamp(ball.spin + vt * 0.02, -30, 30);
  return -vn;
}

/** Collide a ball with a static capsule (segment with radius). */
export function collideCapsule(ball, c, bounce = 0.6) {
  const sx = c.x1 - c.x0, sy = c.y1 - c.y0;
  const t = clamp(((ball.x - c.x0) * sx + (ball.y - c.y0) * sy) / (sx * sx + sy * sy), 0, 1);
  return collideCircle(ball, c.x0 + sx * t, c.y0 + sy * t, c.r, 0, 0, bounce);
}

/**
 * Advance one ball by dt with sub-stepping (prevents tunnelling at high speed).
 * `game` supplies players, colliders (extra walls) and an event callback.
 */
export function stepBall(ball, dt, game) {
  ball.px = ball.x; ball.py = ball.y;
  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / (ball.r * 0.4)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) subStep(ball, h, game);
  // spin visual + gentle Magnus curve
  ball.angle += ball.spin * dt;
  ball.vy += -ball.spin * ball.vx * 0.00035 * dt * 60 * (ball.onGround ? 0 : 1);
  ball.spin *= Math.pow(ball.onGround ? 0.2 : 0.7, dt);
  const s = Math.hypot(ball.vx, ball.vy);
  if (s > PHYS.maxBallSpeed) { ball.vx *= PHYS.maxBallSpeed / s; ball.vy *= PHYS.maxBallSpeed / s; }
  // anti-stuck: a ball that sits still above the floor for too long gets nudged toward the centre
  if (s < 25 && ball.y < GROUND - ball.r - 4) ball.still += dt; else ball.still = 0;
  if (ball.still > 1.5) { ball.vx = (ball.x < W / 2 ? 1 : -1) * 260; ball.vy = -200; ball.still = 0; }
}

function subStep(ball, h, game) {
  const g = PHYS.gravity * ball.gravityMul * (game.world ? game.world.gravityMul : 1);
  ball.vy += g * h;
  const drag = 1 - PHYS.airDrag * h;
  ball.vx *= drag; ball.vy *= drag;
  ball.x += ball.vx * h; ball.y += ball.vy * h;
  ball.onGround = false;

  // floor
  if (ball.y + ball.r > GROUND) {
    ball.y = GROUND - ball.r;
    if (ball.vy > 0) {
      const impact = ball.vy;
      ball.vy = impact > 60 ? -impact * PHYS.groundBounce : 0;
      if (impact > 160) game.emit('bounce', { x: ball.x, v: impact });
      // spin converts into roll
      ball.vx += (ball.spin * ball.r - ball.vx) * 0.08;
    }
    ball.onGround = Math.abs(ball.vy) < 1;
    if (ball.onGround) {
      ball.vx *= 1 - Math.min(1, PHYS.rollFriction * h);
      ball.spin = ball.vx / ball.r;
    }
  }
  // ceiling (reversed gravity can take the ball up there)
  if (ball.y - ball.r < 0) { ball.y = ball.r; if (ball.vy < 0) ball.vy = -ball.vy * PHYS.ceilingBounce; }
  // side walls (the back of each goal net)
  if (ball.x - ball.r < 0) { ball.x = ball.r; if (ball.vx < 0) { ball.vx = -ball.vx * PHYS.wallBounce * (ball.y > CROSSBAR_Y ? 0.4 : 1); game.emit(ball.y > CROSSBAR_Y ? 'net' : 'bounce', { x: ball.x, v: 300 }); } }
  if (ball.x + ball.r > W) { ball.x = W - ball.r; if (ball.vx > 0) { ball.vx = -ball.vx * PHYS.wallBounce * (ball.y > CROSSBAR_Y ? 0.4 : 1); game.emit(ball.y > CROSSBAR_Y ? 'net' : 'bounce', { x: ball.x, v: 300 }); } }

  // crossbars
  for (const c of game.capsules) {
    const v = collideCapsule(ball, c, 0.62);
    if (v > 150) game.emit('post', { x: ball.x, y: ball.y, v });
  }
  // temporary walls (e.g. Giant Keeper)
  for (const wall of game.walls) {
    const nearX = clamp(ball.x, wall.x, wall.x + wall.w), nearY = clamp(ball.y, wall.y, wall.y + wall.h);
    collideCircle(ball, nearX, nearY, 0.01, 0, 0, 0.7);
  }
  // players — alternate the order every sub-step so neither side always gets the last touch
  game.flip = !game.flip;
  const ps = game.players;
  if (game.flip) for (let i = 0; i < ps.length; i++) collideBallPlayer(ball, ps[i], game);
  else for (let i = ps.length - 1; i >= 0; i--) collideBallPlayer(ball, ps[i], game);
  // a player can shove the ball into the floor or a wall: keep it inside the stadium
  if (ball.y + ball.r > GROUND) { ball.y = GROUND - ball.r; if (ball.vy > 0) ball.vy = -ball.vy * PHYS.groundBounce; }
  if (ball.y - ball.r < 0) { ball.y = ball.r; if (ball.vy < 0) ball.vy = -ball.vy * PHYS.ceilingBounce; }
  if (ball.x - ball.r < 0) { ball.x = ball.r; if (ball.vx < 0) ball.vx = -ball.vx * 0.5; }
  if (ball.x + ball.r > W) { ball.x = W - ball.r; if (ball.vx > 0) ball.vx = -ball.vx * 0.5; }
}

// ---------------------------------------------------------------- players
/** Positions of a player's colliders this frame. */
export function parts(p) {
  const s = p.size * p.scale;
  const headR = BODY.headR * s;
  const headY = p.y - (BODY.neck * Math.max(0.7, s) + headR * 0.75);
  const bodyY = p.y - BODY.bodyY * Math.max(0.7, s);
  const hipX = p.x + p.facing * 4, hipY = p.y - BODY.hipY * Math.max(0.7, s);
  const a = p.legAngle;
  const L = BODY.legLen * Math.max(0.75, s);
  const footX = hipX + Math.sin(a) * L * p.facing;
  const footY = hipY + Math.cos(a) * L;
  return { headX: p.x, headY, headR, bodyX: p.x, bodyY, bodyR: BODY.bodyR * Math.max(0.7, s), footX, footY, footR: BODY.footR * Math.max(0.8, s), hipX, hipY };
}

function collideBallPlayer(ball, p, game) {
  const q = parts(p);
  // head: headers get a little lift when the player is jumping upward
  let v = collideCircle(ball, q.headX, q.headY, q.headR, p.vx, p.vy, PHYS.headBounce);
  if (v) {
    if (v > 1) {
      // headers are directional: the ball leaves toward the opponent's goal, faster when you jump into it
      const f = p.facing;
      if (ball.vx * f < 260) ball.vx = ball.vx * 0.3 + f * (240 + Math.abs(p.vx) * 0.3 + (p.vy < -100 ? 110 : 0));
      if (p.vy < -100 && ball.vy > -420) ball.vy = Math.min(ball.vy, -420);
      touch(ball, p, game, 'head', v);
    }
  }
  v = collideCircle(ball, q.bodyX, q.bodyY, q.bodyR, p.vx, p.vy, PHYS.bodyBounce);
  if (v > 1) { if (ball.vx * p.facing < 120) ball.vx = ball.vx * 0.5 + p.facing * 170; touch(ball, p, game, 'body', v); }
  // foot: an active kick launches the ball, otherwise it's a soft dribble surface
  const kicking = p.kick.t > 0 && p.kick.t < 0.16 && !p.kick.hit;
  const fdx = ball.x - q.footX, fdy = ball.y - q.footY;
  const reach = ball.r + q.footR + (kicking ? 10 : 0);
  if (kicking && fdx * fdx + fdy * fdy < reach * reach) {
    kickBall(ball, p, q, game);
  } else {
    v = collideCircle(ball, q.footX, q.footY, q.footR, p.vx, p.vy, PHYS.footBounce);
    if (v > 1) { if (ball.vx * p.facing < 100) ball.vx = ball.vx * 0.5 + p.facing * 140; touch(ball, p, game, 'foot', v); }
  }
}

function touch(ball, p, game, part, v) {
  ball.lastTouch = p.id;
  if (v > 120) game.emit('touch', { part, x: ball.x, y: ball.y, v, player: p.id });
  game.onTouch && game.onTouch(ball, p, part);
}

export function kickBall(ball, p, q, game) {
  p.kick.hit = true;
  const dir = p.facing;
  // aim: low balls get lifted, high balls get driven
  let ang;
  if (ball.y > q.hipY + 6) ang = 0.62; // ~35°
  else if (ball.y > q.headY) ang = 0.42;
  else ang = 0.2;
  if (!p.onGround) ang -= 0.12;
  let power = p.kickPower * (p.mods.kickMul || 1);
  ball.vx = Math.cos(ang) * power * dir + p.vx * 0.3;
  ball.vy = -Math.sin(ang) * power + Math.min(0, p.vy * 0.2);
  ball.spin = -dir * 14;
  ball.x = clamp(q.footX + dir * (ball.r + q.footR) * 0.7, ball.r, W - ball.r);
  ball.lastTouch = p.id;
  game.emit('kick', { x: ball.x, y: ball.y, power, player: p.id });
  game.onKick && game.onKick(ball, p);
}

/** Move one player for dt using its input. */
export function stepPlayer(p, dt, game) {
  const inp = p.input;
  const stunned = p.frozen > 0 || p.stun > 0;
  let dir = stunned ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (p.reversed > 0) dir = -dir;
  const speed = p.speed * (p.mods.speedMul || 1) * (p.aiSpeed || 1);
  p.vx = approach(p.vx, dir * speed, (p.onGround ? 5200 : 3200) * dt);
  if (!stunned && p.jumpBuffer > 0 && p.onGround) {
    p.vy = -p.jumpPower * (p.mods.jumpMul || 1) * (p.aiJump || 1);
    p.onGround = false; p.jumpBuffer = 0;
    game.emit('jump', { player: p.id, x: p.x });
  }
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.vy += PHYS.playerGravity * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.y >= GROUND) {
    if (!p.onGround && p.vy > 500) game.emit('land', { player: p.id, x: p.x });
    p.y = GROUND; p.vy = 0; p.onGround = true;
  } else p.onGround = false;
  const margin = 34;
  p.x = clamp(p.x, margin, W - margin);

  // kick animation: wind-up -> strike -> return
  if (p.kick.t > 0) {
    p.kick.t += dt;
    const t = p.kick.t;
    p.legAngle = t < 0.05 ? -0.5 : t < 0.16 ? -0.5 + ((t - 0.05) / 0.11) * 2.2 : Math.max(0.15, 1.7 - (t - 0.16) * 7);
    if (t > 0.34) { p.kick.t = 0; p.legAngle = 0.15; }
  } else {
    // running legs swing a little
    p.legAngle = p.onGround && Math.abs(p.vx) > 40 ? 0.15 + Math.sin(game.time * 22) * 0.45 : p.onGround ? 0.15 : 0.6;
  }
}

/** Keep players from overlapping; a falling player can bounce off another's head. */
export function separatePlayers(players) {
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    const qa = parts(a), qb = parts(b);
    // head stomp
    for (const [top, under, qu] of [[a, b, qb], [b, a, qa]]) {
      if (top.vy > 0 && Math.abs(top.x - under.x) < qu.headR * 0.9 && top.y > qu.headY - qu.headR - 6 && top.y < qu.headY) {
        top.y = qu.headY - qu.headR - 6; top.vy = -420; top.onGround = false;
      }
    }
    // horizontal push when bodies overlap vertically
    const minD = qa.bodyR + qb.bodyR + 10;
    const dx = b.x - a.x;
    if (Math.abs(dx) < minD && Math.abs(a.y - b.y) < 70) {
      const push = (minD - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1);
      a.x -= push; b.x += push;
    }
  }
}

/** Which team scored, if the ball is fully inside a goal: 1 = right team scored on the left goal, 0 = left team scored on the right. */
export function goalCheck(ball) {
  if (ball.y - ball.r * 0.2 < CROSSBAR_Y + BAR_R) return -1;
  if (ball.x + ball.r < GOAL_LINE) return 1;
  if (ball.x - ball.r > W - GOAL_LINE) return 0;
  return -1;
}
