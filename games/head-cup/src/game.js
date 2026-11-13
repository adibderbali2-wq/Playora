// Match logic: teams, players, balls, phases (ready / play / goal / end), timer, sudden death.
// Pure logic. The browser loop lives in main.js; Node tests drive Game.update() directly.
import { W, GROUND, STEP, MATCH, BODY } from './config.js';
import { makeBall, stepBall, stepPlayer, separatePlayers, goalCheck, goalCapsules, parts } from './physics.js';
import { statsToPhysics } from './characters.js';
import { SkillSystem } from './skills/index.js';
import { AIController } from './ai.js';

const INPUTS = ['left', 'right', 'jump', 'kick', 'skill'];

export class Game {
  /**
   * @param {object} o
   *  teams: [{ flag, kit, players: [{ char, controller: 'kb1'|'kb2'|'pad0'..'pad3'|'ai', skill }] }, { ... }]
   *  time (s), goalLimit (0 = none), suddenDeath (bool), difficulty ('easy'|'medium'|'hard'),
   *  emit(type, data), rng()
   */
  constructor(o) {
    this.emitFn = o.emit || (() => {});
    this.rng = o.rng || Math.random;
    this.duration = o.time || MATCH.defaultTime;
    this.goalLimit = o.goalLimit || 0;
    this.suddenDeath = o.suddenDeath !== false;
    this.difficulty = o.difficulty || 'medium';
    this.teams = o.teams;
    this.capsules = goalCapsules();
    this.walls = [];
    this.world = { gravityMul: 1, shake: 0 };
    this.score = [0, 0];
    this.time = 0;
    this.clock = this.duration;
    this.golden = false;
    this.paused = false;
    this.winner = null;
    this.players = [];
    this.ai = new Map();
    let id = 0;
    o.teams.forEach((team, ti) => {
      team.players.forEach((slot, si) => {
        const p = makePlayer(id++, ti, si, team.players.length, slot, team);
        this.players.push(p);
        if (slot.controller === 'ai') this.ai.set(p.id, new AIController(this, p, slot.difficulty || this.difficulty));
      });
    });
    this.skills = new SkillSystem(this);
    this.balls = [makeBall(W / 2, 200)];
    this.resetPositions();
    this.setPhase('ready');
    this.emit('whistle', { kind: 'start' });
  }

  get ball() { return this.balls[0]; }
  onKick(ball, p) { this.skills.onKick(ball, p); }
  onTouch(ball, p, part) { this.skills.onTouch(ball, p, part); }
  emit(type, data) { this.emitFn(type, data); }
  setPhase(p) { this.phase = p; this.phaseT = 0; }
  teammates(p) { return this.players.filter((q) => q.team === p.team && q !== p); }
  opponents(p) { return this.players.filter((q) => q.team !== p.team); }

  resetPositions() {
    for (const p of this.players) {
      const n = this.teams[p.team].players.length;
      const base = n === 1 ? 330 : p.slot === 0 ? 400 : 200;
      p.x = p.team === 0 ? base : W - base; p.y = GROUND; p.px = p.x; p.py = p.y;
      p.vx = 0; p.vy = 0; p.onGround = true; p.kick.t = 0; p.legAngle = 0.15;
    }
    this.balls = [makeBall(W / 2, 170)];
    this.ball.vx = (this.rng() - 0.5) * 30;
    this.walls = [];
  }

  // ------------------------------------------------------------------ step
  update(dt) {
    if (this.paused || this.phase === 'end') return;
    this.time += dt;
    this.phaseT += dt;
    let sdt = dt;

    if (this.phase === 'ready' && this.phaseT >= MATCH.readyTime) { this.setPhase('play'); this.emit('whistle', { kind: 'kickoff' }); }
    if (this.phase === 'goal') {
      sdt = this.phaseT < 0.7 ? dt * 0.3 : dt; // slow-motion moment after the goal
      if (this.phaseT >= MATCH.celebrateTime) {
        if (this.checkEnd()) return;
        this.resetPositions();
        this.skills.onReset();
        this.setPhase('ready'); this.phaseT = MATCH.readyTime - MATCH.kickoffDelay;
      }
    }
    const live = this.phase === 'play';

    // inputs -> intents
    for (const p of this.players) {
      const ai = this.ai.get(p.id);
      if (ai) { if (live) ai.update(dt); else ai.idle(); }
      const inp = p.input, prev = p.prevInput;
      const canAct = live && p.frozen <= 0 && p.stun <= 0;
      if (canAct && inp.jump && !prev.jump) p.jumpBuffer = 0.12;
      if (canAct && inp.kick && !prev.kick && p.kick.t === 0) { p.kick.t = 0.0001; p.kick.hit = false; this.emit('swing', { player: p.id }); }
      if (canAct && inp.skill && !prev.skill) this.skills.tryActivate(p);
      for (const k of INPUTS) prev[k] = inp[k];
      if (!live) { p.jumpBuffer = 0; }
    }

    // status timers
    for (const p of this.players) {
      p.frozen = Math.max(0, p.frozen - sdt);
      p.stun = Math.max(0, p.stun - sdt);
      p.reversed = Math.max(0, p.reversed - sdt);
      p.shrunk = Math.max(0, p.shrunk - sdt);
      const targetScale = p.shrunk > 0 ? 0.6 : 1;
      p.scale += (targetScale - p.scale) * Math.min(1, sdt * 8);
      p.mods = { speedMul: 1, kickMul: 1, jumpMul: p.shrunk > 0 ? 0.8 : 1 };
      p.emotionT = Math.max(0, p.emotionT - dt);
      if (p.emotionT <= 0) p.emotion = 'normal';
    }
    if (live || this.phase === 'goal') this.skills.update(sdt);

    for (const p of this.players) { p.px = p.x; p.py = p.y; if (this.phase !== 'ready' || this.phaseT > 0.05) stepPlayer(p, sdt, this); }
    separatePlayers(this.players);

    if (this.phase !== 'ready') {
      for (const b of this.balls) stepBall(b, sdt, this);
    } else {
      for (const b of this.balls) { b.px = b.x; b.py = b.y; }
    }
    // extra balls (Multi-ball) expire
    this.balls = this.balls.filter((b, i) => i === 0 || (b.life -= sdt) > 0);

    if (live) {
      for (const b of this.balls) {
        const scorer = goalCheck(b);
        if (scorer >= 0) { this.onGoal(scorer, b); break; }
      }
    }
    if (live && !this.golden) {
      this.clock -= dt;
      if (this.clock <= 0) { this.clock = 0; this.onTimeUp(); }
    }
    this.world.shake = Math.max(0, this.world.shake - dt * 30);
  }

  onGoal(team, ball) {
    this.score[team]++;
    const scorer = this.players.find((p) => p.id === ball.lastTouch);
    if (scorer) { if (scorer.team === team) scorer.goals++; else scorer.ownGoals++; }
    for (const p of this.players) { p.emotion = p.team === team ? 'happy' : 'sad'; p.emotionT = MATCH.celebrateTime; }
    this.lastGoal = { team, x: ball.x, y: ball.y, scorer: scorer ? scorer.id : null, own: scorer ? scorer.team !== team : false };
    this.world.shake = 18;
    this.setPhase('goal');
    this.emit('goal', this.lastGoal);
  }

  onTimeUp() {
    if (this.score[0] === this.score[1] && this.suddenDeath) {
      this.golden = true;
      this.emit('golden', {});
      this.emit('whistle', { kind: 'golden' });
      return;
    }
    this.finish();
  }

  /** After a goal: is the match over? */
  checkEnd() {
    if (this.golden) return this.finish(), true;
    if (this.goalLimit && Math.max(...this.score) >= this.goalLimit) return this.finish(), true;
    if (this.clock <= 0) return this.finish(), true;
    return false;
  }

  finish() {
    this.winner = this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 0 : 1;
    for (const p of this.players) { p.emotion = this.winner == null ? 'normal' : p.team === this.winner ? 'happy' : 'sad'; p.emotionT = 999; }
    this.setPhase('end');
    this.emit('whistle', { kind: 'end' });
    this.emit('end', { winner: this.winner, score: this.score.slice() });
  }

  /** Run the game for `secs` seconds at the fixed step (tests / AI sims). */
  simulate(secs) { const n = Math.round(secs / STEP); for (let i = 0; i < n && this.phase !== 'end'; i++) this.update(STEP); }
}

function makePlayer(id, team, slot, teamSize, cfg, teamCfg) {
  const ch = cfg.char;
  const phys = statsToPhysics(ch.stats);
  return {
    id, team, slot, char: ch, controller: cfg.controller, skillId: cfg.skill,
    kit: teamCfg.kit, flag: teamCfg.flag,
    facing: team === 0 ? 1 : -1,
    x: 0, y: GROUND, px: 0, py: GROUND, vx: 0, vy: 0, onGround: true,
    size: phys.size, scale: 1,
    speed: phys.speed, jumpPower: phys.jump, kickPower: phys.kick,
    input: { left: false, right: false, jump: false, kick: false, skill: false },
    prevInput: { left: false, right: false, jump: false, kick: false, skill: false },
    jumpBuffer: 0, kick: { t: 0, hit: false }, legAngle: 0.15,
    frozen: 0, stun: 0, reversed: 0, shrunk: 0,
    mods: { speedMul: 1, kickMul: 1, jumpMul: 1 },
    emotion: 'normal', emotionT: 0, goals: 0, ownGoals: 0, tag: cfg.tag || '',
  };
}

export { parts, BODY };

/**
 * Browser frame loop: fixed-timestep physics with interpolated rendering.
 * update(step) runs 0..n times per frame; render(alpha, dt) gets the interpolation factor.
 */
export function startLoop({ update, render }) {
  let acc = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 12) { update(STEP); acc -= STEP; n++; }
    if (n === 12) acc = 0; // tab was frozen: drop the backlog instead of fast-forwarding
    render(acc / STEP, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
