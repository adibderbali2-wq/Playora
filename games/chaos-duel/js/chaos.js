// Chaos Events: every CHAOS.interval seconds one random arena rule change. Only one runs at a time,
// and every event resets the world to normal physics when it ends.
import { CHAOS, ARENA_LEFT, ARENA_RIGHT, GROUND } from './config.js';
import { afterHit } from './combat.js';

export function defaultWorld() {
  return {
    gravityMul: 1, fallMul: 1, traction: 1, bounce: false,
    attackScale: 1, damageMul: 1,
    left: ARENA_LEFT, right: ARENA_RIGHT, electricWalls: false,
  };
}

export const EVENTS = {
  lowGravity: {
    name: 'LOW GRAVITY', icon: '🪐', color: '#B98BFF', duration: 9,
    desc: 'Jump higher, fall slower',
    start(w) { w.gravityMul = 0.42; w.fallMul = 0.55; },
  },
  ice: {
    name: 'ICE FLOOR', icon: '❄', color: '#7FE3FF', duration: 9,
    desc: 'No traction, everything slides',
    start(w) { w.traction = 0.07; },
  },
  bounce: {
    name: 'BOUNCE MODE', icon: '⤒', color: '#FF5CC8', duration: 8,
    desc: 'The floor is a trampoline. Hold block to stick',
    start(w) { w.bounce = true; },
    begin(game) { for (const f of game.fighters) if (f.onGround && !f.ko) { f.vy = -700; f.onGround = false; if (f.state === 'idle' || f.state === 'walk' || f.state === 'run' || f.state === 'land') f.setState('air'); } },
  },
  meteors: {
    name: 'METEOR RAIN', icon: '☄', color: '#FF7A3D', duration: 8,
    desc: 'Watch the sky. Shadows mark impacts',
    update(game, ev, dt) {
      ev.spawn -= dt;
      if (ev.spawn <= 0) {
        ev.spawn = 0.42;
        const w = game.world;
        // fair targeting: alternate between players, otherwise random spots
        let x;
        const r = game.rng();
        const live = game.fighters.filter((f) => !f.ko);
        if (r < 0.55 && live.length) { ev.turn = (ev.turn + 1) % live.length; x = live[ev.turn].x + (game.rng() - 0.5) * 160; }
        else x = w.left + 40 + game.rng() * (w.right - w.left - 80);
        x = Math.max(w.left + 30, Math.min(w.right - 30, x));
        game.meteors.push({ x, y: -60 - game.rng() * 80, vy: 900, warn: 0.6, r: 26 });
        game.emit('sfx', 'meteorFall');
      }
    },
    end(game) { /* meteors already in the air still land */ },
  },
  giantFists: {
    name: 'GIANT FISTS', icon: '✊', color: '#FFB547', duration: 8,
    desc: 'Bigger, stronger attacks for everyone',
    start(w) { w.attackScale = 1.6; w.damageMul = 1.3; },
  },
  shrink: {
    name: 'SHRINKING ARENA', icon: '⇥⇤', color: '#C8FF4D', duration: 10,
    desc: 'Electric walls close in',
    start(w) { w.electricWalls = true; },
    update(game, ev, dt) {
      const w = game.world;
      const mid = (ARENA_LEFT + ARENA_RIGHT) / 2;
      const full = (ARENA_RIGHT - ARENA_LEFT) / 2;
      const target = full * 0.42;
      const cur = (w.right - w.left) / 2;
      const next = Math.max(target, cur - 95 * dt);
      w.left = mid - next; w.right = mid + next;
    },
    end(game) { game.wallsRestoring = true; },
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

export class ChaosManager {
  constructor(game, enabled) {
    this.game = game;
    this.enabled = enabled;
    this.reset();
  }

  reset() {
    this.clock = 0; // seconds since last event start (or round start)
    this.state = 'idle'; // idle | warning | active
    this.current = null; // { id, def, t, ... }
    this.next = null;
    this.last = null;
    this.interval = CHAOS.interval;
    this.history = [];
  }

  /** End any active event and restore normal physics (used between rounds too). */
  stop() {
    if (this.current) this.finish();
    this.state = 'idle'; this.next = null;
  }

  pick() {
    const pool = EVENT_IDS.filter((id) => id !== this.last);
    return pool[Math.floor(this.game.rng() * pool.length)];
  }

  update(dt) {
    if (!this.enabled) return;
    const g = this.game;
    this.clock += dt;
    if (this.state === 'idle' && this.clock >= this.interval - CHAOS.warning) {
      this.next = this.forced || this.pick(); this.forced = null;
      this.state = 'warning'; this.warnT = CHAOS.warning;
      g.emit('chaosWarning', { id: this.next, def: EVENTS[this.next] });
      g.emit('sfx', 'siren');
    }
    if (this.state === 'warning') {
      this.warnT -= dt;
      if (this.warnT <= 0) this.begin(this.next);
    }
    if (this.state === 'active') {
      const ev = this.current;
      ev.t += dt;
      if (ev.def.update) ev.def.update(g, ev, dt);
      if (ev.t >= ev.def.duration) { this.finish(); this.state = 'idle'; }
    }
  }

  begin(id) {
    const g = this.game, def = EVENTS[id];
    if (this.current) this.finish();
    g.world = { ...defaultWorld(), left: g.world.left, right: g.world.right };
    if (def.start) def.start(g.world);
    this.current = { id, def, t: 0, spawn: 0.3, turn: 0 };
    if (def.begin) def.begin(g);
    this.state = 'active'; this.clock = 0; this.last = id;
    this.history.push(id);
    g.emit('chaosStart', { id, def });
    g.emit('sfx', 'chaosStart');
    g.emit('shake', 6);
  }

  finish() {
    const g = this.game, ev = this.current;
    if (!ev) return;
    if (ev.def.end) ev.def.end(g, ev);
    const keep = { left: g.world.left, right: g.world.right };
    g.world = { ...defaultWorld(), ...keep };
    this.current = null;
    g.emit('chaosEnd', { id: ev.id });
  }

  get remaining() { return this.current ? Math.max(0, this.current.def.duration - this.current.t) : 0; }
}

/** Meteors live on the game so they finish falling even if the event ends. */
export function updateMeteors(game, dt) {
  const keep = [];
  for (const m of game.meteors) {
    if (m.warn > 0) { m.warn -= dt; keep.push(m); continue; }
    m.vy += 900 * dt; m.y += m.vy * dt;
    let boom = m.y >= GROUND - 10;
    for (const f of game.fighters) {
      const hb = f.hurtbox();
      if (hb && !f.ko && f.invuln <= 0 && Math.abs(f.x - m.x) < f.halfW + m.r && m.y > hb.y && m.y - m.r < hb.y + hb.h) boom = true;
    }
    if (!boom) { keep.push(m); continue; }
    game.emit('sfx', 'explode'); game.emit('shake', 7);
    game.emit('fx', { kind: 'explosion', x: m.x, y: Math.min(m.y, GROUND - 10), color: '#FF7A3D' });
    for (const f of game.fighters) {
      const hb = f.hurtbox();
      if (!hb || f.ko || f.invuln > 0) continue;
      const cx = Math.max(hb.x, Math.min(m.x, hb.x + hb.w)), cy = Math.max(hb.y, Math.min(m.y, hb.y + hb.h));
      if (Math.hypot(cx - m.x, cy - m.y) > 88) continue;
      const hit = { damage: 8, guard: 22, hitstun: 0.38, kb: [380, -420], heavy: true, fromAbove: true };
      const res = f.takeHit(hit, m.x);
      afterHit(game, null, f, res, hit, null);
    }
  }
  game.meteors = keep;
}
