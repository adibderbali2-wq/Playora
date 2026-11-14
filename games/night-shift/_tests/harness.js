// Playtest harness (dev only). In the console: await import('/_tests/harness.js')
import * as THREE from 'three';
window.THREE = THREE;
// Steps the simulation deterministically (works even when the tab is throttled) and
// saves real rendered frames to _tests/shots via the dev server.
const g = window.__ns;
const realRender = g.render.bind(g);
g.renderer.setAnimationLoop(null);
const T = window.T = {
  g,
  look(x, y, z) { const p = g.player, c = { x: p.pos.x, y: p.pos.y + 1.62, z: p.pos.z }; const dx = x - c.x, dy = y - c.y, dz = z - c.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); g.player.updateCamera(0); },
  tp(x, z, yaw) { const p = g.player; p.pos.set(x, 0, z); if (yaw !== undefined) p.yaw = yaw; p.vel.set(0, 0, 0); },
  step(sec, render = false) {
    if (g.mode === 'paused') g.mode = 'play';
    const n = Math.max(1, Math.round(sec * 60)); g.clock.getDelta = () => 1 / 60;
    if (!render) g.render = () => {};
    const t0 = performance.now();
    for (let i = 0; i < n; i++) g.frame();
    g.render = realRender; g.render(0);
    return (performance.now() - t0) / n;
  },
  walk(keys, sec) { keys.forEach((k) => (g.input.k[k] = true)); const ms = this.step(sec); keys.forEach((k) => (g.input.k[k] = false)); return ms; },
  // walk toward a point with simple steering
  goto(x, z, maxSec = 20) {
    const p = g.player; let t = 0;
    while (t < maxSec) {
      const dx = x - p.pos.x, dz = z - p.pos.z; if (Math.hypot(dx, dz) < 0.4) break;
      p.yaw = Math.atan2(-dx, -dz); g.input.k.KeyW = true; this.step(0.1); t += 0.1;
    }
    g.input.k.KeyW = false; return { t, pos: [p.pos.x, p.pos.z] };
  },
  async shot(name) {
    realRender(0);
    const blob = await new Promise((r) => g.renderer.domElement.toBlob(r, 'image/jpeg', 0.85));
    await fetch('/_save?name=' + name + '.jpg', { method: 'POST', body: blob });
    return name;
  },
  P(id) { return g.pickups.find((p) => p.def.id === id); },
  start(items = ['flashlight', 'pistol', 'ammo1']) { g.menuAction('new'); g.player.wakeT = 0; items.forEach((id) => g.take(this.P(id))); g.mode = 'play'; this.step(0.1); },
  z(id) { return g.zombies.find((z) => z.id === id); },
  aimHead(z) { const h = z.bones.head.getWorldPosition(new THREE.Vector3()); this.look(h.x, h.y + 0.08 * z.T.scale, h.z); g.player.updateCamera(0); },
  fire() { g.player.fireCd = 0; g.shoot(); },
  // stand at (sx,sz), look at target, press E. Returns the prompt that was shown.
  use(sx, sz, tx, ty, tz) { if (g.mode === 'paused') g.mode = 'play'; this.tp(sx, sz); this.look(tx, ty, tz); this.step(0.05); const pr = document.getElementById('prompt'); const txt = pr.hidden ? null : pr.textContent; g.interact(); if (g.mode === 'reader') g.closeDoc(); this.step(0.05); return txt; },
  takeAt(id, sx, sz) { const pk = this.P(id); return this.use(sx, sz, pk.pos.x, pk.pos.y, pk.pos.z); },
  // competent-player combat: headshots on anything hunting within range
  fight(maxSec = 8) {
    const p = g.player; let t = 0; const log = [];
    while (t < maxSec) {
      const hunters = g.zombies.filter((z) => z.alive && z.state !== 'phantom' && z.state !== 'dormant' && Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < 14 && g.world.lineClear(p.pos.x, p.pos.z, z.pos.x, z.pos.z, true));
      if (!hunters.length) break;
      hunters.sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z));
      const z = hunters[0];
      if (p.ammo === 0) { p.tryReload(); this.step(1.7); t += 1.7; continue; }
      this.aimHead(z); this.fire(); log.push(z.id + ':' + Math.round(z.hp)); this.step(0.35); t += 0.35;
    }
    return log;
  },
  state() {
    const p = g.player; const pr = document.getElementById('prompt');
    return { mode: g.mode, pos: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], hp: Math.round(p.health), ammo: p.ammo, res: p.reserve, bat: Math.round(p.battery), keys: [...p.keys], obj: document.getElementById('objText').textContent, prompt: pr.hidden ? null : pr.textContent, ch: g.story.flags.chapter,
      zs: g.zombies.map((z) => ({ id: z.id, st: z.state, hp: Math.round(z.hp), d: +Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z).toFixed(1) })) };
  },
};
export default T;
