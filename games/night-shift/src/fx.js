// Particles + decals: blood sprays, sparks, dust, bullet holes, blood pools.
import * as THREE from 'three';

class Particles {
  constructor(scene, n, { color, size, additive = false, gravity = 9, drag = 1.5, tex = null }) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3).fill(-999); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color, size, map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, opacity: additive ? 1 : 0.9 });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.gravity = gravity; this.drag = drag;
  }
  emit(p, dir, count, speed, spread, life) {
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = (dir.x + (Math.random() - 0.5) * spread) * s;
      this.vel[i * 3 + 1] = (dir.y + (Math.random() - 0.3) * spread) * s;
      this.vel[i * 3 + 2] = (dir.z + (Math.random() - 0.5) * spread) * s;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
    }
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= this.gravity * dt;
      const dr = Math.max(0, 1 - this.drag * dt);
      this.vel[j] *= dr; this.vel[j + 2] *= dr;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.01) { this.pos[j + 1] = 0.01; this.vel[j] = this.vel[j + 1] = this.vel[j + 2] = 0; }
      if (this.life[i] <= 0) this.pos[j + 1] = -999;
    }
    if (any || this._wasAny) this.pts.geometry.attributes.position.needsUpdate = true;
    this._wasAny = any;
  }
}

export class FX {
  constructor(game) {
    this.game = game;
    const s = game.scene, M = game.M;
    this.bloodP = new Particles(s, 600, { color: 0x5a0606, size: 0.045, gravity: 9, drag: 1.2 });
    this.sparks = new Particles(s, 200, { color: 0xffb050, size: 0.035, additive: true, gravity: 6, drag: 3, tex: M.glowTex });
    this.dust = new Particles(s, 300, { color: 0x8a847a, size: 0.07, gravity: 0.6, drag: 4 });
    const plane = new THREE.PlaneGeometry(1, 1);
    this.holes = []; this.holeI = 0;
    for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(plane, M.bulletHole); m.visible = false; m.scale.setScalar(0.09); s.add(m); this.holes.push(m); }
    this.splats = []; this.splatI = 0;
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(plane, M.bloodSplat); m.visible = false; s.add(m); this.splats.push(m); }
    this.pools = [];
  }

  impact(point, normal) {
    const n = normal.clone();
    this.sparks.emit(point, n, 8, 3.5, 1.6, 0.25);
    this.dust.emit(point, n, 10, 1.2, 1.4, 0.9);
    if (normal.y > 0.5 && point.y < 0.05) return; // floor: no decal floating issues
    const h = this.holes[this.holeI]; this.holeI = (this.holeI + 1) % this.holes.length;
    h.position.copy(point).addScaledVector(n, 0.006);
    h.lookAt(point.clone().add(n)); h.rotateZ(Math.random() * 6);
    h.visible = true;
  }

  blood(point, dir, count = 14) {
    this.bloodP.emit(point, dir.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.25, 0)), count, 3.2, 1.3, 0.9);
    // splatter on the wall behind, if close
    const w = this.game.world;
    const hit = w.raycast(point, dir, 3.5);
    if (hit.solid && hit.solid !== 'floor' && hit.solid !== 'ceil') {
      const p = point.clone().addScaledVector(dir, hit.t);
      const m = this.splats[this.splatI]; this.splatI = (this.splatI + 1) % this.splats.length;
      m.position.copy(p).addScaledVector(hit.normal, 0.008);
      m.lookAt(p.clone().add(hit.normal)); m.rotateZ(Math.random() * 6);
      m.scale.setScalar(0.5 + Math.random() * 0.6); m.visible = true;
    }
  }

  bloodPool(pos) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.game.M.bloodPool);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6;
    m.position.set(pos.x, 0.014 + this.pools.length * 0.0005, pos.z); m.scale.setScalar(0.01);
    m.userData.grow = 1.4 + Math.random() * 0.6;
    this.game.scene.add(m); this.pools.push(m);
  }

  update(dt) {
    this.bloodP.update(dt); this.sparks.update(dt); this.dust.update(dt);
    for (const p of this.pools) { const t = p.userData.grow; if (p.scale.x < t) p.scale.setScalar(Math.min(t, p.scale.x + dt * 0.35)); }
  }

  clear() {
    for (const h of this.holes) h.visible = false;
    for (const s of this.splats) s.visible = false;
    for (const p of this.pools) { this.game.scene.remove(p); p.geometry.dispose(); }
    this.pools = [];
  }
}
