// Collision + combat resolution between fighters. Pure logic.
import { GROUND } from './config.js';

export const overlap = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Check each fighter's active hitbox against the other's hurtbox; apply at most one hit per move. */
export function resolveAttacks(game) {
  for (const f of game.fighters) {
    const m = f.move;
    if (!m || m.phase !== 'active' || m.done) continue;
    const opp = f.opponent;
    if (!opp || opp.invuln > 0 || opp.ko) continue;
    const hb = f.hitbox();
    if (!overlap(hb, opp.hurtbox())) continue;
    m.done = true; m.hit = true;
    const d = m.def;
    const final = m.key === 'normal' && m.final;
    const hit = {
      damage: d.damage * (final ? 1.25 : 1),
      guard: d.guard,
      hitstun: d.hitstun,
      kb: final ? [d.kb[0] * 1.9, -260] : d.kb,
      knockdown: !!d.knockdown,
      heavy: m.key === 'heavy',
      ownerMul: f.damageMul || 1,
    };
    const res = opp.takeHit(hit, f.x);
    afterHit(game, f, opp, res, hit, hb);
  }
}

export function afterHit(game, attacker, defender, res, hit, box) {
  const cx = box ? (defender.x + (attacker ? attacker.x : defender.x)) / 2 + (attacker ? attacker.facing * 10 : 0) : defender.x;
  const cy = box ? box.y + box.h / 2 : defender.y - 80;
  if (attacker) {
    attacker.stats.damage += res.damage;
    if (res.type !== 'block') { attacker.stats.hits++; attacker.stats.maxCombo = Math.max(attacker.stats.maxCombo, defender.combo); }
  }
  const big = hit.heavy || hit.knockdown || res.type === 'ko';
  if (res.type === 'block') {
    game.hitstop = 0.05;
    game.emit('fx', { kind: 'block', x: cx, y: cy, color: '#9fe7ff' });
  } else if (res.type === 'guardbreak') {
    game.hitstop = 0.12; game.emit('shake', 10);
    game.emit('fx', { kind: 'burst', x: cx, y: cy, color: '#ffd23d', n: 24 });
  } else {
    game.hitstop = big ? 0.11 : 0.06;
    game.emit('shake', big ? 9 : 3);
    game.emit('sfx', res.type === 'armor' ? 'armor' : big ? 'hitHeavy' : 'hit');
    game.emit('fx', { kind: big ? 'impact' : 'hit', x: cx, y: cy, color: attacker ? attacker.def.accent : '#ff6a3d', dir: attacker ? attacker.facing : 0 });
    game.emit('damage', { x: defender.x, y: defender.y - defender.def.body.h - 14, amount: res.damage, side: defender.index });
  }
  if (res.type === 'ko') game.onKO(defender, attacker);
}

/** Keep fighters from walking through each other. Airborne fighters can cross over. */
export function resolvePush(game) {
  const [a, b] = game.fighters;
  if (!a || !b || a.ko || b.ko) return;
  const ha = a.def.body.h, hb = b.def.body.h;
  const vertical = a.y - ha * 0.65 < b.y && b.y - hb * 0.65 < a.y;
  if (!vertical) return;
  const minDist = (a.def.body.w + b.def.body.w) / 2 * 0.9;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= minDist) return;
  const push = (minDist - dist) / 2;
  const s = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
  const w = game.world;
  let ax = a.x - s * push, bx = b.x + s * push;
  // if one is pinned against a wall, the other takes the full push
  const aMin = w.left + a.halfW, aMax = w.right - a.halfW, bMin = w.left + b.halfW, bMax = w.right - b.halfW;
  if (ax < aMin) { bx += aMin - ax; ax = aMin; }
  if (ax > aMax) { bx -= ax - aMax; ax = aMax; }
  if (bx < bMin) { ax -= bMin - bx; bx = bMin; }
  if (bx > bMax) { ax += bx - bMax; bx = bMax; }
  a.x = ax; b.x = bx;
}

/** Earth Slam shockwave: hits grounded fighters within radius. Jumping avoids it. */
export function shockwave(game, f) {
  const s = f.def.special;
  game.emit('sfx', 'slam'); game.emit('shake', 16);
  game.emit('fx', { kind: 'shockwave', x: f.x, y: GROUND, radius: s.radius * game.world.attackScale, color: '#8fd3ff' });
  game.emit('fx', { kind: 'debris', x: f.x, y: GROUND, n: 22 });
  const opp = f.opponent;
  if (!opp || opp.ko || opp.invuln > 0) return;
  const r = s.radius * game.world.attackScale;
  const grounded = opp.y > GROUND - 46;
  if (Math.abs(opp.x - f.x) > r || !grounded || !opp.hurtbox()) return;
  const hit = { damage: s.damage, guard: s.guard, hitstun: 0.5, kb: s.kb, stun: s.stun, heavy: true, fromAbove: true };
  // the shockwave travels along the floor: blocking still works but costs a lot of guard
  const res = opp.takeHit(hit, f.x);
  afterHit(game, f, opp, res, hit, { y: GROUND - 80, h: 40 });
}
