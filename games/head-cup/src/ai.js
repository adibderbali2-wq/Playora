// CPU players. The AI only presses the same virtual buttons a human has (left/right/jump/kick/skill).
// Difficulty changes reaction time, prediction accuracy, running speed and jump power (CPU only),
// header/kick timing and skill use.
import { W, GROUND, PHYS } from './config.js';
import { parts } from './physics.js';

export const LEVELS = {
  easy: { react: 0.36, err: 110, speed: 0.72, jump: 0.9, header: 0.25, skill: 0.25, shotAim: 0.35, guard: 0 },
  medium: { react: 0.15, err: 36, speed: 0.92, jump: 0.98, header: 0.6, skill: 0.55, shotAim: 0.7, guard: 0 },
  hard: { react: 0.04, err: 4, speed: 1.1, jump: 1.04, header: 0.92, skill: 0.85, shotAim: 0.95, guard: 0 },
};

/** Where will the ball be when it falls to height `y` (or after `maxT` s)? Simple ballistic guess with wall bounces. */
export function predictBall(b, y, maxT = 1.4, gravityMul = 1) {
  let x = b.x, by = b.y, vx = b.vx, vy = b.vy, t = 0;
  const g = PHYS.gravity * b.gravityMul * gravityMul, dt = 1 / 60;
  while (t < maxT) {
    vy += g * dt; x += vx * dt; by += vy * dt; t += dt;
    if (x < b.r) { x = b.r; vx = -vx * 0.7; }
    if (x > W - b.r) { x = W - b.r; vx = -vx * 0.7; }
    if (by > GROUND - b.r) { by = GROUND - b.r; vy = -vy * 0.6; vx *= 0.9; }
    if (vy > 0 && by >= y) break;
  }
  return { x, y: by, t };
}

export class AIController {
  constructor(game, player, difficulty = 'medium') {
    this.game = game; this.p = player;
    this.cfg = LEVELS[difficulty] || LEVELS.medium;
    this.difficulty = difficulty;
    this.timer = 0; this.target = player.x; this.wantJump = false; this.wantKick = false; this.wantSkill = false;
    this.noise = 0;
    player.aiSpeed = this.cfg.speed; player.aiJump = this.cfg.jump;
  }

  idle() { const i = this.p.input; i.left = i.right = i.jump = i.kick = i.skill = false; }

  update(dt) {
    const g = this.game, p = this.p, c = this.cfg, inp = p.input;
    // tap buttons are released every frame so each press is a fresh edge
    inp.jump = false; inp.kick = false; inp.skill = false;
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = c.react * (0.7 + g.rng() * 0.6); this.think(); }

    // move toward the target, throttled by difficulty (an easy CPU hesitates)
    const dx = this.target - p.x;
    inp.left = dx < -10; inp.right = dx > 10;
    if (this.wantJump && p.onGround) { inp.jump = true; this.wantJump = false; }
    if (this.wantKick && p.kick.t === 0) { inp.kick = true; this.wantKick = false; }
    if (this.wantSkill) { inp.skill = true; this.wantSkill = false; }
    // reactive kick/header checks every frame (this is what makes hard CPUs sharp)
    this.reflexes();
  }

  /** Pick the ball that matters most: the one closest to our goal. */
  focusBall() {
    const own = this.p.team === 0 ? 0 : W;
    return this.game.balls.reduce((best, b) => (Math.abs(b.x - own) < Math.abs(best.x - own) ? b : best), this.game.balls[0]);
  }

  think() {
    const g = this.game, p = this.p, c = this.cfg;
    const b = this.focusBall();
    const dir = p.facing; // attack direction
    const ownGoal = p.team === 0 ? 0 : W;
    const q = parts(p);
    const pred = predictBall(b, q.headY, 1.2);
    this.noise = (g.rng() - 0.5) * c.err;
    const px = pred.x + this.noise;
    const ballBehind = (b.x - p.x) * dir < -15; // ball is between me and my own goal
    const danger = Math.abs(b.x - ownGoal) < 380 && b.vx * dir < -150;
    // losing the race to the ball? cover the goal instead of chasing (better CPUs do this more reliably)
    const opp = g.opponents(p);
    const ourHalf = Math.abs(b.x - ownGoal) < W * 0.55;
    const oppCloser = ourHalf && opp.some((o) => Math.abs(o.x - b.x) + 40 < Math.abs(p.x - b.x));
    const mustCover = oppCloser && !this.covering && g.rng() < c.guard;
    this.covering = oppCloser ? (this.covering || mustCover) : false;

    // 2v2: the team-mate closer to the ball attacks, the other one covers the goal
    const mates = g.teammates(p);
    const closerMate = mates.some((m) => Math.abs(m.x - b.x) + 30 < Math.abs(p.x - b.x));
    if (closerMate && !danger) {
      this.target = ownGoal + dir * (Math.abs(b.x - ownGoal) < 450 ? 150 : 260);
      if (Math.abs(b.x - p.x) < 140) this.target = px - dir * 40;
    } else if (this.covering && !ballBehind) {
      // stand between the ball and our goal, about 40% of the way back
      this.target = b.x + (ownGoal - b.x) * 0.4;
      this.target = ownGoal === 0 ? Math.max(200, this.target) : Math.min(W - 200, this.target);
    } else if (danger) {
      // get between the ball and the goal; block with a jump if it comes in high
      this.target = Math.max(200, Math.min(W - 200, ownGoal + dir * 230));
      const atMe = predictBall(b, q.headY - 30, 1).x;
      if (b.y < GROUND - 150 && Math.abs(atMe - p.x) < 60 && g.rng() < c.header) this.wantJump = true;
    } else if (ballBehind) {
      // run around the ball to get back on the goal side of it
      // run around the ball without shoving it toward our own goal: hop over it when close
      this.target = b.x - dir * 80;
      if (Math.abs(b.x - p.x) < 130 && b.y > GROUND - 90 && g.rng() < 0.3 + c.guard * 0.7) this.wantJump = true;
    } else {
      // attack: stand just behind where the ball will come down
      this.target = px - dir * (b.y < GROUND - 150 ? 20 : 42);
    }
    this.target = Math.max(40, Math.min(W - 40, this.target));
    this.useSkill(b, danger);
  }

  reflexes() {
    const p = this.p, c = this.cfg, g = this.game;
    if (p.frozen > 0 || p.stun > 0) return;
    const q = parts(p), dir = p.facing;
    for (const b of g.balls) {
      const rel = (b.x - p.x) * dir; // >0 = ball in front of me
      // kick: ball low and just in front of the foot
      if (rel > 5 && rel < 85 && b.y > q.hipY - 50 && p.kick.t === 0) {
        if (g.rng() < c.shotAim * c.shotAim * 0.3) this.wantKick = true; // easy CPUs often miss their timing
      }
      // header: ball dropping toward my head
      const above = rel > -8 && rel < 75 && b.y < q.headY - 20 && b.y > q.headY - 240 && b.vy > -100;
      if (above && p.onGround && g.rng() < c.header * c.header * 0.12) this.wantJump = true;
    }
  }

  useSkill(b, danger) {
    const g = this.game, p = this.p, c = this.cfg;
    if (!g.skills.ready(p) || g.rng() > c.skill * 0.35) return;
    const id = g.skills.get(p).def.id;
    const dist = Math.abs(b.x - p.x), front = (b.x - p.x) * p.facing > 0;
    const opp = g.opponents(p);
    const oppNearBall = opp.some((o) => Math.abs(o.x - b.x) < 160);
    const towardGoal = Math.abs(b.x - (p.team === 0 ? W : 0)) < 500;
    const use = {
      fireball: dist < 220 && front, megaStrength: dist < 220 && front, ghostBall: dist < 200 && front && towardGoal,
      teleport: !danger && dist > 400, speedBoost: dist > 350, magnet: dist < 380 && b.y < GROUND - 60,
      giantKeeper: danger, freeze: oppNearBall, earthquake: opp.some((o) => o.onGround) && oppNearBall,
      reverseControls: oppNearBall, shrink: oppNearBall || danger, multiBall: towardGoal, gravityFlip: danger, bigBall: towardGoal && front,
    }[id];
    if (use) this.wantSkill = true;
  }
}
