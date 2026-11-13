// Headless gameplay tests for CHAOS DUEL. Run: node games/chaos-duel/_tests/sim.test.mjs
// (folders starting with "_" are not published by the PLAYORA build)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Match } from '../js/match.js';
import { CHARACTERS } from '../js/characters.js';
import { EVENTS, EVENT_IDS } from '../js/chaos.js';
import { STEP, GROUND, ARENA_LEFT, ARENA_RIGHT } from '../js/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const atlas = JSON.parse(fs.readFileSync(path.join(here, '../assets/characters/atlas.json'), 'utf8'));
for (const id in CHARACTERS) CHARACTERS[id].frameCounts = Object.fromEntries(Object.entries(atlas[id].animations).map(([k, v]) => [k, v.frames]));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✖ ' + msg); } };
function seeded(s = 1) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function newMatch(mode = 'classic', chars = ['bruno', 'zippy'], events = []) {
  const m = new Match({ mode, chars, rng: seeded(7), emit: (t, d) => events.push([t, d]) });
  // skip intro + countdown
  run(m, 3.2);
  return m;
}
function run(m, secs, each) { const n = Math.round(secs / STEP); for (let i = 0; i < n; i++) { if (each) each(i); m.update(STEP); } }
const press = (f, k) => { f.input[k] = true; };
const clear = (f) => { for (const k in f.input) f.input[k] = false; };
const tap = (m, f, k) => { press(f, k); run(m, STEP * 2); f.input[k] = false; run(m, STEP); };
function place(m, x0, x1) { const [a, b] = m.fighters; a.x = x0; b.x = x1; a.facing = 1; b.facing = -1; run(m, STEP); }

console.log('Movement');
{
  const m = newMatch();
  ok(m.phase === 'fight', 'round reaches FIGHT after intro + countdown');
  const [b, z] = m.fighters;
  const bx = b.x, zx = z.x;
  press(b, 'right'); press(z, 'left'); // simultaneous input from both players
  run(m, 0.3);
  const bWalk = b.x - bx, zWalk = zx - z.x;
  ok(bWalk > 40 && zWalk > 60, `both players move at the same time (Bruno ${bWalk.toFixed(0)}px, Zippy ${zWalk.toFixed(0)}px)`);
  ok(zWalk > bWalk, 'Zippy is faster than Bruno');
  clear(b); clear(z); place(m, 300, 900);
  press(b, 'right'); run(m, 0.6);
  ok(b.state === 'run', 'holding a direction turns walking into running');
  clear(b); run(m, 0.4);
  ok(b.state === 'idle' && Math.abs(b.vx) < 1, 'releasing stops the fighter');
}

console.log('Jumping and falling');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  tap(m, b, 'up');
  let minY = b.y, airTime = 0;
  run(m, 2, () => { minY = Math.min(minY, b.y); if (!b.onGround) airTime += STEP; });
  ok(GROUND - minY > 150, `Bruno jumps ${(GROUND - minY).toFixed(0)}px high`);
  ok(b.onGround && b.y === GROUND, 'Bruno lands back on the floor');
  tap(m, z, 'up'); let zMin = z.y; run(m, 2, () => { zMin = Math.min(zMin, z.y); });
  ok(GROUND - zMin > GROUND - minY, 'Zippy jumps higher than Bruno');
}

console.log('Normal attacks, combos and anti-spam');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  place(m, 600, 690);
  tap(m, b, 'attack'); run(m, 0.25);
  const dmg = 100 - z.hp;
  ok(Math.abs(dmg - 7 * 1.1) < 0.01, `Bruno jab deals ${dmg.toFixed(2)} to Zippy (7 x 1.1 defence)`);
  ok(b.stats.hits === 1, 'hit counted in stats');
  // spam: mash attack for 3 seconds, Zippy must not be locked forever
  const m2 = newMatch('classic', ['zippy', 'bruno']);
  const [z2, b2] = m2.fighters; place(m2, 600, 680);
  let free = 0;
  run(m2, 3, (i) => { z2.input.attack = i % 4 < 2; if (b2.state === 'idle') free++; });
  ok(free > 20, `defender regains control while being mashed (${free} free frames in 3s)`);
  ok(b2.hp > 30, `mashing is not a death sentence: Bruno at ${b2.hp.toFixed(0)} HP after 3s of jabs`);
}

console.log('Heavy attacks and knockdown');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  place(m, 600, 700);
  tap(m, b, 'heavy');
  run(m, 0.5);
  ok(z.hp < 100 - 15 && z.hp > 100 - 18, `Bruno heavy deals ${(100 - z.hp).toFixed(1)}`);
  ok(z.state === 'knockdown', 'heavy attack knocks down');
  run(m, 1.2);
  ok(z.state === 'idle' || z.state === 'getup', 'knocked-down fighter gets back up');
  ok(b.cd.heavy >= 0, 'heavy has a cooldown');
  // cooldown blocks immediate reuse
  const m2 = newMatch(); const [b2] = m2.fighters; place(m2, 300, 900);
  tap(m2, b2, 'heavy'); run(m2, 0.85); tap(m2, b2, 'heavy');
  ok(b2.state !== 'heavy', 'a second heavy right after the first is blocked by its cooldown');
}

console.log('Blocking and guard');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  place(m, 600, 690);
  press(z, 'down'); run(m, 0.05);
  ok(z.state === 'block', 'holding down blocks');
  tap(m, b, 'attack'); run(m, 0.25);
  const chip = 100 - z.hp;
  ok(chip > 0 && chip < 2.5, `blocked jab only chips ${chip.toFixed(2)}`);
  ok(z.guard < z.def.guardMax, 'blocking drains guard');
  // guard break after enough heavy hits
  let broke = false;
  for (let i = 0; i < 6 && !broke; i++) { b.cd.heavy = 0; tap(m, b, 'heavy'); run(m, 0.9, () => { if (z.state === 'stun') broke = true; }); place(m, 600, 690); }
  ok(broke, 'repeated heavies break the guard (no infinite turtling)');
}

console.log('Dash');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  place(m, 300, 1000);
  press(z, 'left'); tap(m, z, 'special'); clear(z);
  ok(z.state === 'dash', 'Zippy dashes with special + direction');
  ok(z.invuln > 0, 'Zippy dash starts with invulnerability frames');
  run(m, 0.3);
  ok(1000 - z.x > 200, `Zippy dash covers ${(1000 - z.x).toFixed(0)}px`);
  press(b, 'right'); tap(m, b, 'special'); clear(b);
  ok(b.state === 'dash' && b.armored, 'Bruno dash has armour');
  run(m, 0.25); ok(b.state !== 'dash', 'dash ends after its duration');
  press(b, 'right'); tap(m, b, 'special'); clear(b);
  ok(b.state !== 'dash' && b.cd.dash > 0, 'dash cooldown prevents chaining dashes');
}

console.log('Special: Earth Slam');
{
  const m = newMatch();
  const [b, z] = m.fighters;
  place(m, 600, 760);
  tap(m, b, 'special');
  ok(b.state === 'special', 'Bruno starts Earth Slam');
  run(m, 0.9);
  ok(z.hp < 100 && (z.state === 'stun' || z.stun > 0 || z.stateTime < 1), `shockwave hits grounded Zippy (${(100 - z.hp).toFixed(1)} dmg, state ${z.state})`);
  ok(b.cd.special > 5, 'Earth Slam goes on cooldown');
  // jumping dodges it
  const m2 = newMatch(); const [b2, z2] = m2.fighters; place(m2, 600, 760);
  tap(m2, b2, 'special'); run(m2, 0.15); tap(m2, z2, 'up');
  run(m2, 0.8);
  ok(z2.hp === 100, 'jumping over the shockwave avoids all damage');
}

console.log('Special: Speed Boost');
{
  const m = newMatch('classic', ['zippy', 'bruno']);
  const [z, b] = m.fighters;
  place(m, 300, 1000);
  press(z, 'right'); run(m, 0.6); const normal = Math.abs(z.vx); clear(z); run(m, 0.3);
  tap(m, z, 'special'); run(m, 0.5);
  ok(z.boosted, 'Zippy is boosted after the activation pose');
  press(z, 'left'); run(m, 0.6);
  ok(Math.abs(z.vx) > normal * 1.3, `boost raises run speed (${normal.toFixed(0)} -> ${Math.abs(z.vx).toFixed(0)})`);
  clear(z); run(m, 5);
  ok(!z.boosted, 'boost wears off');
  ok(z.cd.special > 0, 'special cooldown still running after boost');
}

console.log('Chaos events (each forced once)');
{
  for (const id of EVENT_IDS) {
    const m = newMatch('chaos');
    m.chaos.forced = id; m.chaos.clock = 14;
    run(m, 3.5);
    m.chaos.interval = 999; // isolate this event from the next one
    const active = m.chaos.current && m.chaos.current.id === id;
    const w = m.world;
    let effect = false;
    if (id === 'lowGravity') effect = w.gravityMul < 1;
    if (id === 'ice') effect = w.traction < 0.5;
    if (id === 'bounce') effect = w.bounce;
    if (id === 'giantFists') effect = w.attackScale > 1 && w.damageMul > 1;
    if (id === 'meteors') { run(m, 3); effect = m.fighters.some((f) => f.hp < 100) || m.meteors.length > 0; }
    if (id === 'shrink') { run(m, 4); effect = w.right - w.left < (ARENA_RIGHT - ARENA_LEFT) * 0.7; }
    ok(active && effect, `${EVENTS[id].name} is active and changes the rules`);
    run(m, EVENTS[id].duration + 3);
    const r = m.world;
    const restored = r.gravityMul === 1 && r.traction === 1 && !r.bounce && r.attackScale === 1 && r.damageMul === 1 && !r.electricWalls;
    ok(restored && (m.chaos.current === null || m.chaos.current.id !== id || m.chaos.current.t < 1), `${EVENTS[id].name} ends and physics return to normal`);
    if (id === 'shrink') { run(m, 3); ok(m.world.left === ARENA_LEFT && m.world.right === ARENA_RIGHT, 'arena walls return to full width'); }
  }
  const m = newMatch('chaos');
  const seen = new Set(); let overlapEvents = false;
  run(m, 75, () => { if (m.chaos.current) seen.add(m.chaos.current.id); });
  ok(seen.size >= 3, `Chaos Duel triggers events on its own (${[...seen].join(', ')})`);
  const hist = m.chaos.history; ok(hist.every((h, i) => i === 0 || h !== hist[i - 1]), 'never the same event twice in a row');
  const c = newMatch('classic'); run(c, 40); ok(c.chaos.history.length === 0, 'Classic Duel has no chaos events');
}

console.log('Ice floor physics');
{
  const m = newMatch('chaos'); m.chaos.forced = 'ice'; m.chaos.clock = 14; run(m, 3);
  const [b] = m.fighters; place(m, 300, 1000);
  press(b, 'right'); run(m, 0.6); clear(b); const x0 = b.x; run(m, 0.5);
  ok(b.x - x0 > 60, `fighter keeps sliding on ice (${(b.x - x0).toFixed(0)}px after releasing)`);
}

console.log('Rounds and match');
{
  const ev = [];
  const m = new Match({ mode: 'classic', chars: ['bruno', 'zippy'], rng: seeded(3), emit: (t, d) => ev.push([t, d]) });
  run(m, 3.2);
  const ko = (loser) => { m.fighters[loser].hp = 1; const atk = m.fighters[1 - loser]; place(m, 600, 690); if (loser === 0) { atk.x = 690; m.fighters[0].x = 600; } atk.facing = atk.x < m.fighters[loser].x ? 1 : -1; tap(m, atk, 'heavy'); run(m, 0.6); };
  ko(1);
  ok(m.phase === 'ko' && m.wins[0] === 1, 'K.O. gives Player 1 the round');
  run(m, 3.5);
  ok(m.round === 2 && m.phase !== 'ko', 'next round starts');
  ok(m.fighters.every((f) => f.hp === 100 && f.state !== 'ko'), 'HP and states reset between rounds');
  run(m, 3.2);
  ko(0); run(m, 3.5); run(m, 3.2);
  ok(m.wins[0] === 1 && m.wins[1] === 1 && m.round === 3, '1-1 goes to round 3');
  ok(ev.some(([t, d]) => t === 'announce' && d.text === 'FINAL ROUND'), 'final round is announced');
  ko(1); run(m, 4);
  ok(m.phase === 'matchEnd' && m.results.winner === 0, 'Player 1 wins the match 2-1');
  ok(ev.some(([t]) => t === 'matchEnd'), 'matchEnd event fires for the results screen');
  // time out
  const t = new Match({ mode: 'classic', chars: ['zippy', 'zippy'], rng: seeded(5), roundTime: 5 });
  run(t, 3.2); t.fighters[1].hp = 80; run(t, 5.5);
  ok(t.wins[0] === 1, 'time-up gives the round to the healthier fighter');
}

console.log('Free Fight');
{
  const ev = [];
  const m = new Match({ mode: 'free', chars: ['bruno', 'zippy'], rng: seeded(11), emit: (t, d) => ev.push([t, d]) });
  ok(ev.some(([t, d]) => t === 'announce' && d.text === 'FREE FIGHT'), 'Free Fight is announced');
  run(m, 3.2);
  ok(m.phase === 'fight', 'Free Fight starts after the countdown');
  run(m, 150);
  ok(m.phase === 'fight' && m.chaos.history.length === 0, 'no timer and no chaos events: still fighting after 150 s');
  const [b, z] = m.fighters; z.hp = 2; place(m, 600, 690); tap(m, b, 'heavy'); run(m, 5);
  ok(m.phase === 'matchEnd' && m.results.free && m.results.winner === 0, 'one K.O. ends the fight (no rounds)');
  ok(m.round === 1, 'no second round is started');
}



console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
