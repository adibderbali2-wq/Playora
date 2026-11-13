// Fighter: one player's character. Pure game logic (no DOM, no drawing) so it can be tested headlessly.
import { GRAVITY, MAX_FALL, GROUND, MAX_HP } from './config.js';

const BUFFER = 0.14; // input buffer window (s)
const ACTIONABLE = new Set(['idle', 'walk', 'run', 'air', 'land', 'block']);

export class Fighter {
  constructor(def, index, game) {
    this.def = def;
    this.index = index; // 0 = Player 1, 1 = Player 2
    this.game = game;
    this.input = { left: false, right: false, up: false, down: false, attack: false, heavy: false, special: false };
    this.prevInput = { ...this.input };
    this.stats = { damage: 0, hits: 0, maxCombo: 0 };
    this.reset(0, 1);
  }

  reset(x, facing) {
    this.x = x; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.facing = facing; this.hp = MAX_HP; this.guard = this.def.guardMax;
    this.state = 'idle'; this.stateTime = 0; this.onGround = true;
    this.cd = { normal: 0, heavy: 0, dash: 0, special: 0 };
    this.buffer = { up: 9, attack: 9, heavy: 9, special: 9 };
    this.move = null; this.chainCount = 0; this.chainHit = false;
    this.stun = 0; this.invuln = 0; this.flash = 0; this.boost = 0; this.zapCd = 0;
    this.guardDelay = 0; this.airDashUsed = false; this.runTime = 0;
    this.combo = 0; this.comboTimer = 0; // hits *received* in the current combo (for scaling)
    this.slam = null; this.dashDir = 0; this.ko = false; this.lie = 0;
    this.trail = [];
  }

  get opponent() { return this.game.fighters[1 - this.index]; }
  get halfW() { return this.def.body.w / 2; }
  get boosted() { return this.boost > 0; }
  get specialReady() { return this.cd.special <= 0 && this.boost <= 0; }
  get blocking() { return this.state === 'block' || this.state === 'blockstun'; }
  get armored() {
    if (this.state === 'dash' && this.def.dash.armor) return true;
    if (this.state === 'heavy' && this.def.id === 'bruno' && this.move && this.move.phase === 'startup') return true;
    if (this.state === 'special' && this.slam && this.slam.phase === 'rise') return true;
    return false;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateTime = 0; } }

  /** World-space hurtbox, or null while untouchable. */
  hurtbox() {
    if (this.state === 'knockdown' && this.onGround) return null;
    const h = this.state === 'knockdown' || this.state === 'ko' ? this.def.body.h * 0.5 : this.def.body.h;
    return { x: this.x - this.halfW, y: this.y - h, w: this.def.body.w, h };
  }

  /** World-space hitbox of the active attack, or null. */
  hitbox() {
    const m = this.move;
    if (!m || m.phase !== 'active' || m.done) return null;
    const scale = this.game.world.attackScale;
    const b = m.def.box;
    const w = b.w * scale, h = b.h * scale;
    const y = this.y + b.y - (h - b.h) / 2;
    const x = this.facing > 0 ? this.x + b.x : this.x - b.x - w;
    return { x, y, w, h };
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game, w = g.world, def = this.def;
    this.stateTime += dt;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.zapCd = Math.max(0, this.zapCd - dt);
    this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0;
    if (this.boost > 0) { this.boost -= dt; if (this.boost <= 0) { this.boost = 0; g.emit('sfx', 'boostEnd'); } }
    if (!this.blocking) {
      this.guardDelay -= dt;
      if (this.guardDelay <= 0) this.guard = Math.min(def.guardMax, this.guard + def.guardMax * 0.35 * dt);
    }

    // input edges -> buffers
    const i = this.input, p = this.prevInput;
    for (const k of ['up', 'attack', 'heavy', 'special']) this.buffer[k] = i[k] && !p[k] ? 0 : this.buffer[k] + dt;
    Object.assign(p, i);

    const locked = g.locked; // during intros / KO the fighters don't take input
    const st = this.state;

    if (st === 'ko' || st === 'victory') { /* scripted */ }
    else if (st === 'hit' || st === 'blockstun') {
      this.stun -= dt;
      if (this.stun <= 0 && (this.onGround || st === 'blockstun')) this.setState(this.onGround ? (st === 'blockstun' && i.down ? 'block' : 'idle') : 'air');
      else if (this.stun <= 0 && !this.onGround) this.setState('air');
    } else if (st === 'stun') {
      this.stun -= dt;
      if (this.stun <= 0) this.setState('idle');
    } else if (st === 'knockdown') {
      if (this.onGround) {
        this.lie -= dt;
        if (this.lie <= 0) { this.setState('getup'); this.invuln = 0.4; }
      }
    } else if (st === 'getup') {
      if (this.stateTime > 0.32) this.setState('idle');
    } else if (st === 'heavy' || st === 'normal') {
      this.updateMove(dt);
    } else if (st === 'dash') {
      this.updateDash(dt);
    } else if (st === 'special') {
      this.updateSpecial(dt);
    }

    if (!locked && ACTIONABLE.has(this.state)) this.control(dt);
    else if (locked && ACTIONABLE.has(this.state) && this.onGround) this.setState('idle');

    this.physics(dt);

    // afterimage trail while dashing or boosted
    if (this.state === 'dash' || this.boosted) {
      this.trail.push({ x: this.x, y: this.y, facing: this.facing, frame: this.frame(), life: 0.22 });
      if (this.trail.length > 10) this.trail.shift();
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
  }

  control(dt) {
    const i = this.input, def = this.def, g = this.game;
    const opp = this.opponent;
    const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);

    if (this.onGround && opp && Math.abs(opp.x - this.x) > 4) this.facing = opp.x > this.x ? 1 : -1;

    // Special button: with a direction = dash, alone = special ability.
    if (this.buffer.special < BUFFER) {
      const canAirDash = !this.onGround && def.dash.air && !this.airDashUsed;
      if (dir !== 0 && this.cd.dash <= 0 && (this.onGround || canAirDash)) { this.buffer.special = 9; return this.startDash(dir); }
      if (dir === 0 && this.specialReady) { this.buffer.special = 9; return this.startSpecial(); }
    }
    if (this.buffer.heavy < BUFFER && this.cd.heavy <= 0) { this.buffer.heavy = 9; return this.startMove('heavy'); }
    if (this.buffer.attack < BUFFER && this.cd.normal <= 0) { this.buffer.attack = 9; this.chainCount = 0; return this.startMove('normal'); }

    if (this.onGround) {
      if (this.buffer.up < BUFFER) {
        this.buffer.up = 9;
        this.vy = -def.jump; this.onGround = false; this.setState('air');
        g.emit('sfx', 'jump'); g.emit('fx', { kind: 'dust', x: this.x, y: this.y, n: 8 });
        return;
      }
      if (i.down) {
        this.setState('block');
        this.runTime = 0;
        return;
      }
      if (this.state === 'land' && this.stateTime < 0.07) return;
      if (dir !== 0) {
        this.runTime += dt;
        this.setState(this.runTime > 0.35 ? 'run' : 'walk');
      } else { this.runTime = 0; this.setState('idle'); }
    } else if (this.state !== 'air') this.setState('air');
  }

  moveSpeed() {
    const i = this.input, def = this.def;
    const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    let sp = this.state === 'run' || (!this.onGround && this.runTime > 0.35) ? def.run : def.walk;
    if (this.boosted) sp *= def.special.moveMul;
    return dir * sp;
  }

  startMove(key) {
    const m = this.def.moves[key];
    this.move = { key, def: m, t: 0, phase: 'startup', done: false, hit: false, final: false };
    this.setState(key);
    if (key === 'normal') {
      this.chainCount++;
      this.move.final = this.chainCount >= m.chain;
    }
    this.game.emit('sfx', key === 'heavy' ? 'whooshHeavy' : 'whoosh');
  }

  updateMove(dt) {
    const m = this.move, d = m.def;
    const speed = this.boosted ? this.def.special.attackSpeed : 1;
    m.t += dt * speed;
    const prev = m.phase;
    m.phase = m.t < d.startup ? 'startup' : m.t < d.startup + d.active ? 'active' : 'recovery';
    if (prev === 'startup' && m.phase === 'active' && this.move.key === 'heavy' && this.onGround) this.vx += this.facing * 160;

    // chain the next normal: allowed only after the previous one connected (hit or blocked)
    if (m.key === 'normal' && m.hit && !m.final && m.phase !== 'startup' && this.buffer.attack < BUFFER) {
      this.buffer.attack = 9;
      return this.startMove('normal');
    }
    if (m.t >= d.startup + d.active + d.recovery) {
      this.cd[m.key] = d.cooldown + (m.key === 'normal' && (m.final || !m.hit) ? 0.22 : 0);
      if (m.key === 'normal' && m.final) this.cd.normal += 0.18;
      this.move = null; this.chainCount = m.key === 'normal' && m.hit && !m.final ? this.chainCount : 0;
      this.setState(this.onGround ? 'idle' : 'air');
    }
  }

  startDash(dir) {
    const d = this.def.dash;
    this.dashDir = dir; this.facing = this.onGround ? this.facing : dir;
    if (!this.onGround) this.airDashUsed = true;
    this.setState('dash');
    this.invuln = Math.max(this.invuln, d.invuln);
    this.vy = 0;
    this.game.emit('sfx', 'dash');
    this.game.emit('fx', { kind: 'dust', x: this.x, y: this.y, n: 6, dir: -dir });
  }

  updateDash() {
    const d = this.def.dash;
    let speed = d.speed * (this.boosted ? 1.15 : 1);
    this.vx = this.dashDir * speed;
    if (!this.onGround) this.vy = Math.min(this.vy, 60);
    if (this.stateTime >= d.time) {
      this.cd.dash = d.cooldown * (this.boosted ? this.def.special.dashCooldownMul : 1);
      this.vx *= 0.35;
      this.setState(this.onGround ? 'idle' : 'air');
    }
  }

  startSpecial() {
    const s = this.def.special, g = this.game;
    this.setState('special');
    if (s.type === 'earthSlam') {
      this.slam = { phase: this.onGround ? 'rise' : 'dive', t: 0, landed: false };
      if (this.onGround) { this.vy = -980; this.vx = this.facing * 180; this.onGround = false; }
      g.emit('sfx', 'slamStart');
    } else if (s.type === 'speedBoost') {
      this.slam = null;
      this.vx *= 0.3;
      g.emit('sfx', 'boost');
      g.emit('fx', { kind: 'burst', x: this.x, y: this.y - 70, color: this.def.color, n: 26 });
    }
    this.cd.special = s.cooldown + (s.duration || 0);
  }

  updateSpecial(dt) {
    const s = this.def.special, g = this.game;
    if (s.type === 'speedBoost') {
      this.vx *= Math.pow(0.02, dt);
      if (this.stateTime >= 0.42) {
        this.boost = s.duration;
        this.setState(this.onGround ? 'idle' : 'air');
      }
      return;
    }
    // Earth Slam
    const sl = this.slam;
    sl.t += dt;
    if (sl.phase === 'rise' && (sl.t > 0.3 || this.vy > 0)) { sl.phase = 'dive'; sl.t = 0; }
    if (sl.phase === 'dive') { this.vy = 2500; this.vx = 0; }
    if (sl.phase === 'dive' && this.onGround) {
      sl.phase = 'impact'; sl.t = 0;
      g.shockwave(this);
    }
    if (sl.phase === 'impact' && sl.t > 0.42) { this.slam = null; this.setState('idle'); }
  }

  // Called by combat when this fighter is struck.
  takeHit(hit, fromX) {
    const g = this.game, def = this.def;
    const dirAway = this.x >= fromX ? 1 : -1;
    const facingAttacker = (fromX > this.x ? 1 : -1) === this.facing;
    const canBlock = this.blocking && (facingAttacker || hit.fromAbove) && !hit.unblockable;

    // combo scaling: each extra hit in a combo does less and stuns less
    this.combo++; this.comboTimer = 0.9;
    const scale = Math.max(0.45, 1 - (this.combo - 1) * 0.12);
    let dmg = hit.damage * def.defense * g.world.damageMul * (hit.ownerMul || 1) * scale;

    if (canBlock) {
      const chip = dmg * (1 - def.blockReduction);
      this.hp = Math.max(0, this.hp - chip);
      this.guard -= hit.guard; this.guardDelay = 0.9;
      this.vx = dirAway * (hit.kb[0] * 0.55) / def.weight;
      if (this.guard <= 0) {
        this.guard = def.guardMax * 0.5;
        this.setState('stun'); this.stun = 1.0; this.move = null; this.slam = null;
        g.emit('sfx', 'guardBreak'); g.emit('announce', { text: 'GUARD BREAK!', small: true, side: this.index });
        return { type: 'guardbreak', damage: chip };
      }
      this.setState('blockstun'); this.stun = 0.16 + hit.guard / 240;
      g.emit('sfx', 'block');
      return { type: 'block', damage: chip };
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.12;
    if (this.armored && !hit.heavy && !hit.knockdown && this.hp > 0) {
      g.emit('sfx', 'armor');
      return { type: 'armor', damage: dmg };
    }
    this.move = null; this.slam = null; this.chainCount = 0;
    const kbx = dirAway * hit.kb[0] / def.weight;
    const kby = hit.kb[1] / Math.sqrt(def.weight);
    if (this.hp <= 0) {
      this.vx = dirAway * Math.max(420, Math.abs(kbx)); this.vy = -620; this.onGround = false;
      this.setState('ko'); this.ko = true;
      return { type: 'ko', damage: dmg };
    }
    if (hit.knockdown) {
      this.vx = kbx; this.vy = Math.min(kby, -280); this.onGround = false;
      this.setState('knockdown'); this.lie = 0.5; this.invuln = 0;
    } else if (hit.stun && this.onGround) {
      this.vx = kbx * 0.5; this.setState('stun'); this.stun = hit.stun;
    } else {
      this.vx = kbx; if (kby) { this.vy = kby; this.onGround = false; } else if (!this.onGround) this.vy = Math.min(this.vy, -200);
      this.setState('hit'); this.stun = hit.hitstun * Math.max(0.55, 1 - (this.combo - 1) * 0.12);
    }
    return { type: 'hit', damage: dmg };
  }

  physics(dt) {
    const g = this.game, w = g.world, def = this.def;
    const i = this.input;
    const st = this.state;
    const traction = w.traction;

    // horizontal
    if (st === 'walk' || st === 'run' || (st === 'air' && (i.left || i.right))) {
      const target = this.moveSpeed();
      const rate = (this.onGround ? def.accel * traction : def.accel * 0.45);
      this.vx = approach(this.vx, target, rate * dt);
    } else if (st !== 'dash' && st !== 'ko') {
      if (this.onGround) this.vx = approach(this.vx, 0, (st === 'hit' || st === 'blockstun' || st === 'knockdown' ? 2400 : def.accel) * traction * dt);
      else this.vx = approach(this.vx, 0, 160 * dt);
    } else if (st === 'ko' && this.onGround) this.vx = approach(this.vx, 0, 1800 * traction * dt);

    // vertical
    const diving = st === 'special' && this.slam && this.slam.phase === 'dive';
    if (!this.onGround || this.vy < 0) {
      if (!diving && !(st === 'dash' && !this.onGround)) this.vy = Math.min(this.vy + GRAVITY * w.gravityMul * dt, MAX_FALL * w.fallMul);
      this.onGround = false;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y >= GROUND) {
      const impact = this.vy;
      this.y = GROUND;
      const wasAir = !this.onGround;
      const canBounce = w.bounce && impact > 380 && st !== 'knockdown' && st !== 'ko' && !diving && !(st === 'block' || i.down);
      if (canBounce) {
        this.vy = -Math.max(impact * 0.82, 760);
        this.onGround = false;
        if (wasAir) { g.emit('sfx', 'boing'); g.emit('fx', { kind: 'dust', x: this.x, y: GROUND, n: 5 }); }
      } else {
        this.vy = 0; this.onGround = true; this.airDashUsed = false;
        if (wasAir) {
          if (st === 'air') { this.setState('land'); }
          if (impact > 600) g.emit('fx', { kind: 'dust', x: this.x, y: GROUND, n: impact > 1200 ? 12 : 6 });
          if (st === 'knockdown' || st === 'ko') { g.emit('shake', 6); g.emit('sfx', 'thud'); }
        }
      }
    }

    // arena walls
    const minX = w.left + this.halfW, maxX = w.right - this.halfW;
    if (this.x < minX) { this.x = minX; if (this.vx < 0) this.vx = st === 'knockdown' || st === 'ko' ? -this.vx * 0.4 : 0; this.touchWall(-1); }
    if (this.x > maxX) { this.x = maxX; if (this.vx > 0) this.vx = st === 'knockdown' || st === 'ko' ? -this.vx * 0.4 : 0; this.touchWall(1); }
  }

  touchWall(side) { if (this.game.world.electricWalls) this.game.zapWall(this, side); }

  // ------------------------------------------------------------- drawing info
  /** Returns { anim, index } for the renderer. */
  frame() {
    const A = this.def.anims, counts = this.def.frameCounts || {};
    const pick = (key, t, fallbackFps = 10) => {
      const a = A[key] || {};
      const anim = a.anim || key;
      const list = a.frames || range(counts[anim] || 1);
      const fps = a.fps || fallbackFps;
      let n = Math.floor(t * fps);
      if (a.hold || a.once) {
        if (a.loopFrom != null && n >= list.length) n = a.loopFrom + ((n - list.length) % (list.length - a.loopFrom));
        else n = Math.min(n, list.length - 1);
      } else n %= list.length;
      return { anim, index: list[n] };
    };
    const st = this.state, t = this.stateTime;
    switch (st) {
      case 'idle': return pick('idle', t);
      case 'walk': return pick('walk', t);
      case 'run': return pick('run', t);
      case 'block': case 'blockstun': return pick('block', t, 16);
      case 'land': return pick('land', t);
      case 'air': {
        if (this.vy < 0) {
          const list = A.jump.frames; const k = Math.min(list.length - 1, Math.floor((1 - Math.min(1, -this.vy / this.def.jump)) * list.length));
          return { anim: 'jump', index: list[k] };
        }
        return pick('fall', t);
      }
      case 'hit': case 'stun': return pick('hit', st === 'stun' ? Math.min(t, 0.12) : t);
      case 'knockdown': case 'getup': case 'ko': {
        if (st === 'getup') return pick('idle', 0);
        return pick('knockdown', t);
      }
      case 'victory': return pick('victory', t);
      case 'dash': return pick('dash', t);
      case 'normal': case 'heavy': {
        const m = this.move; if (!m) return pick('idle', t);
        const d = m.def, f = d.frames[m.phase];
        const start = m.phase === 'startup' ? 0 : m.phase === 'active' ? d.startup : d.startup + d.active;
        const len = m.phase === 'startup' ? d.startup : m.phase === 'active' ? d.active : d.recovery;
        const k = Math.min(f.length - 1, Math.floor(((m.t - start) / len) * f.length));
        return { anim: d.anim, index: f[Math.max(0, k)] };
      }
      case 'special': {
        if (this.def.special.type === 'earthSlam' && this.slam) {
          const ph = this.slam.phase;
          if (ph === 'rise') return { anim: 'special', index: this.slam.t < 0.12 ? 1 : 2 };
          if (ph === 'dive') return { anim: 'special', index: 2 };
          return { anim: 'special', index: [3, 4, 5, 5, 5][Math.min(4, Math.floor(this.slam.t / 0.09))] };
        }
        return pick('special', t);
      }
      default: return pick('idle', t);
    }
  }
}

export function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
const range = (n) => Array.from({ length: n }, (_, i) => i);
