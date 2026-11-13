// Match / round flow for Chaos Duel, Classic Duel and Free Fight. Pure logic: rendering, audio and UI listen through `emit`.
import { ARENA_LEFT, ARENA_RIGHT, ROUNDS_TO_WIN, MAX_HP, MODES, CHAOS } from './config.js';
import { CHARACTERS } from './characters.js';
import { Fighter } from './fighter.js';
import { resolveAttacks, resolvePush, shockwave, afterHit } from './combat.js';
import { ChaosManager, defaultWorld, updateMeteors } from './chaos.js';

const START_X = [400, 880];

export class Match {
  /**
   * @param {object} o { mode, chars: [id, id], emit(type, data), rng, roundTime }
   */
  constructor(o) {
    this.mode = MODES[o.mode] || MODES.chaos;
    this.emitFn = o.emit || (() => {});
    this.rng = o.rng || Math.random;
    this.roundTime = o.roundTime || 99;
    this.world = defaultWorld();
    this.meteors = [];
    this.hitstop = 0;
    this.chars = o.chars.slice();
    this.fighters = [new Fighter(CHARACTERS[this.chars[0]], 0, this), new Fighter(CHARACTERS[this.chars[1]], 1, this)];
    this.chaos = new ChaosManager(this, this.mode.chaos);
    this.wins = [0, 0];
    this.round = 0;
    this.results = null;
    this.paused = false;
    this.time = 0;
    this.startRound();
  }

  emit(type, data) { this.emitFn(type, data); }
  get locked() { return this.phase !== 'fight'; }

  // ---------------------------------------------------------------- rounds
  startRound() {
    this.round++;
    this.resetArena();
    for (const [i, f] of this.fighters.entries()) f.reset(START_X[i], i === 0 ? 1 : -1);
    this.setPhase('intro');
    this.emit('announce', { text: !this.mode.rounds ? 'FREE FIGHT' : this.wins[0] === ROUNDS_TO_WIN - 1 && this.wins[1] === ROUNDS_TO_WIN - 1 ? 'FINAL ROUND' : `ROUND ${this.round}`, big: true });
    this.emit('sfx', 'roundStart');
    this.emit('roundStart', { round: this.round });
  }

  resetArena() {
    this.chaos.stop(); this.chaos.reset();
    this.world = defaultWorld();
    this.wallsRestoring = false;
    this.meteors = [];
    this.timer = this.mode.rounds ? this.roundTime : Infinity; // Free Fight has no clock
    this.hitstop = 0; this.slowmo = 1;
    this.koInfo = null;
  }

  setPhase(p) { this.phase = p; this.phaseT = 0; }

  // ------------------------------------------------------------------ step
  update(dt) {
    if (this.paused || this.phase === 'matchEnd') return;
    this.time += dt;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    const sdt = dt * (this.slowmo || 1);
    this.phaseT += dt;

    if (this.phase === 'intro' && this.phaseT > 1.2) { this.setPhase('countdown'); this.count = 3; this.emit('announce', { text: '3' }); this.emit('sfx', 'beep'); }
    if (this.phase === 'countdown') {
      const n = 3 - Math.floor(this.phaseT / 0.6);
      if (n !== this.count && n >= 1) { this.count = n; this.emit('announce', { text: String(n) }); this.emit('sfx', 'beep'); }
      if (this.phaseT >= 1.8) { this.setPhase('fight'); this.emit('announce', { text: 'FIGHT!', big: true }); this.emit('sfx', 'fight'); }
    }

    for (const f of this.fighters) f.update(sdt);
    resolveAttacks(this);
    resolvePush(this);

    if (this.phase === 'fight') {
      this.chaos.update(sdt);
      if (this.mode.rounds) {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
      }
    }
    updateMeteors(this, sdt);
    if (this.wallsRestoring && !this.world.electricWalls) {
      this.world.left = Math.max(ARENA_LEFT, this.world.left - 220 * dt);
      this.world.right = Math.min(ARENA_RIGHT, this.world.right + 220 * dt);
      if (this.world.left === ARENA_LEFT && this.world.right === ARENA_RIGHT) this.wallsRestoring = false;
    }

    if (this.phase === 'ko' || this.phase === 'timeup') {
      if (this.phaseT > 1.1) this.slowmo = 1;
      if (this.phaseT > 1.3 && !this.koInfo.posed) {
        this.koInfo.posed = true;
        const w = this.koInfo.winner;
        if (w != null) { const wf = this.fighters[w]; if (!wf.ko) { wf.move = null; wf.setState('victory'); } }
        this.emit('roundEnd', this.koInfo);
      }
      if (this.phaseT > 3.4) this.afterRound();
    }
  }

  onKO(loser, attacker) {
    if (this.phase !== 'fight') return;
    const winner = 1 - loser.index;
    this.chaos.stop();
    this.meteors = [];
    this.setPhase('ko');
    this.slowmo = 0.3;
    const wf = this.fighters[winner];
    const perfect = wf.hp >= MAX_HP;
    this.koInfo = { winner, perfect, reason: 'ko' };
    this.wins[winner]++;
    this.emit('announce', { text: perfect ? 'PERFECT K.O.!' : 'K.O.!', big: true, ko: true });
    this.emit('sfx', 'ko'); this.emit('shake', 18);
  }

  timeUp() {
    if (this.phase !== 'fight') return;
    const [a, b] = this.fighters;
    this.chaos.stop(); this.meteors = [];
    let winner = null;
    if (Math.abs(a.hp - b.hp) > 0.01) winner = a.hp > b.hp ? 0 : 1;
    this.setPhase('timeup');
    this.koInfo = { winner, perfect: false, reason: 'time' };
    if (winner != null) this.wins[winner]++;
    if (winner != null) { const lf = this.fighters[1 - winner]; lf.move = null; lf.setState('idle'); }
    this.emit('announce', { text: winner == null ? 'TIME! DRAW' : 'TIME!', big: true });
    this.emit('sfx', 'timeUp');
  }

  afterRound() {
    const info = this.koInfo;
    if (!this.mode.rounds) return this.endMatch({ winner: info.winner, wins: this.wins.slice(), free: true });
    const champ = this.wins.findIndex((w) => w >= ROUNDS_TO_WIN);
    if (champ >= 0) return this.endMatch({ winner: champ, wins: this.wins.slice() });
    this.startRound();
  }

  endMatch(res) {
    this.setPhase('matchEnd');
    this.results = { ...res, chars: this.chars.slice(), stats: this.fighters.map((f) => ({ ...f.stats })), mode: this.mode.id };
    this.emit('matchEnd', this.results);
  }

  // ------------------------------------------------------- hooks from logic
  shockwave(f) { shockwave(this, f); }

  zapWall(f, side) {
    if (f.zapCd > 0 || f.ko || this.phase !== 'fight') return;
    f.zapCd = 0.7;
    const wallX = side < 0 ? this.world.left : this.world.right;
    const hit = { damage: 4, guard: 10, hitstun: 0.28, kb: [560, -260], unblockable: true };
    const res = f.takeHit(hit, wallX - side * 1);
    this.emit('fx', { kind: 'zap', x: wallX, y: f.y - 70 });
    this.emit('sfx', 'zap');
    afterHit(this, null, f, res, hit, null);
  }
}
