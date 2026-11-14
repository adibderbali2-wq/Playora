// Static prop construction. Every prop is built from many small primitives that get
// merged per-material into a handful of draw calls by GeoBatch.
import * as THREE from 'three';
import { mergeGeometries } from '../assets/lib/BufferGeometryUtils.js';
import { rng, rr } from './textures.js';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

export class GeoBatch {
  constructor() { this.groups = new Map(); }
  add(geo, mat, matrix) {
    const g = geo.index ? geo : geo; // all builtin geos are indexed
    const c = g.clone(); c.applyMatrix4(matrix);
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    c.clearGroups();
    let e = this.groups.get(mat.uuid);
    if (!e) { e = { mat, list: [] }; this.groups.set(mat.uuid, e); }
    e.list.push(c);
  }
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const { mat, list } of this.groups.values()) {
      // chunk to keep index sizes sane
      for (let i = 0; i < list.length; i += 1500) {
        const geo = mergeGeometries(list.slice(i, i + 1500), false);
        if (!geo) continue;
        geo.computeBoundingSphere(); geo.computeBoundingBox();
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = cast && !mat.transparent; m.receiveShadow = receive;
        m.matrixAutoUpdate = false; m.updateMatrix();
        parent.add(m); meshes.push(m);
      }
      list.forEach((g) => g.dispose());
    }
    this.groups.clear();
    return meshes;
  }
}

// Geometry cache so identical primitives aren't regenerated thousands of times.
const geoCache = new Map();
function cached(key, fn) { let g = geoCache.get(key); if (!g) { g = fn(); geoCache.set(key, g); } return g; }
const f2 = (n) => Math.round(n * 1000);

export class Builder {
  constructor(batch, world) {
    this.batch = batch; this.world = world; // world.addSolid(minx,minz,maxx,maxz,h)
    this.m = new THREE.Matrix4(); this.ry = 0; this.x = 0; this.z = 0; this.y = 0;
  }
  at(x, z, ry = 0, y = 0) {
    this.x = x; this.z = z; this.ry = ry; this.y = y;
    this.m.makeRotationY(ry).setPosition(x, y, z);
    return this;
  }
  place(geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(_v.set(px, py, pz), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    m.premultiply(this.m);
    this.batch.add(geo, mat, m);
  }
  box(mat, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const g = cached('b' + f2(sx) + ',' + f2(sy) + ',' + f2(sz), () => new THREE.BoxGeometry(sx, sy, sz));
    this.place(g, mat, px, py, pz, rx, ry, rz);
  }
  cyl(mat, px, py, pz, rt, rb, h, seg = 12, rx = 0, ry = 0, rz = 0, open = false) {
    const g = cached(`c${f2(rt)},${f2(rb)},${f2(h)},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
    this.place(g, mat, px, py, pz, rx, ry, rz);
  }
  sph(mat, px, py, pz, r, sx = 1, sy = 1, sz = 1, seg = 12) {
    const g = cached(`s${f2(r)},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75 | 0)));
    this.place(g, mat, px, py, pz, 0, 0, 0, sx, sy, sz);
  }
  tor(mat, px, py, pz, R, r, rx = 0, ry = 0, rz = 0, seg = 18) {
    const g = cached(`t${f2(R)},${f2(r)},${seg}`, () => new THREE.TorusGeometry(R, r, 6, seg));
    this.place(g, mat, px, py, pz, rx, ry, rz);
  }
  plane(mat, px, py, pz, w, h, rx = 0, ry = 0, rz = 0) {
    const g = cached(`p${f2(w)},${f2(h)}`, () => new THREE.PlaneGeometry(w, h));
    this.place(g, mat, px, py, pz, rx, ry, rz);
  }
  // Local rect (centre px,pz size sx,sz) → world AABB collider
  solid(px, pz, sx, sz, h = 1) {
    const c = Math.cos(this.ry), s = Math.sin(this.ry);
    const wx = this.x + px * c + pz * s, wz = this.z - px * s + pz * c;
    const ex = Math.abs(sx / 2 * c) + Math.abs(sz / 2 * s), ez = Math.abs(sx / 2 * s) + Math.abs(sz / 2 * c);
    this.world.addSolid(wx - ex, wz - ez, wx + ex, wz + ez, h + this.y);
  }
}

/* =============================================================== props */
export function bed(b, M, { bloody = false, body = false, messy = true } = {}) {
  // frame
  const L = 2.05, W = 0.95, H = 0.55;
  for (const sx of [-1, 1]) {
    b.box(M.metal, sx * W / 2, H, 0, 0.05, 0.06, L);
    for (const sz of [-1, 1]) {
      b.cyl(M.metal, sx * (W / 2 - 0.03), H / 2, sz * (L / 2 - 0.06), 0.025, 0.025, H, 6);
      b.sph(M.rubber, sx * (W / 2 - 0.03), 0.06, sz * (L / 2 - 0.06), 0.06, 1, 1, 0.5, 8);
    }
    // side rails
    b.box(M.chrome, sx * (W / 2 + 0.02), H + 0.28, -0.3, 0.03, 0.03, 1.1);
    b.box(M.chrome, sx * (W / 2 + 0.02), H + 0.12, -0.3, 0.03, 0.03, 1.1);
    for (let i = 0; i < 4; i++) b.box(M.chrome, sx * (W / 2 + 0.02), H + 0.2, -0.8 + i * 0.33, 0.025, 0.2, 0.025);
  }
  // head / foot boards
  b.box(M.plasticLight, 0, H + 0.42, -L / 2, W + 0.06, 0.62, 0.05);
  b.box(M.plasticLight, 0, H + 0.24, L / 2, W + 0.06, 0.36, 0.05);
  b.box(M.metalDark, 0, H + 0.02, 0, W - 0.05, 0.05, L - 0.1);
  // mattress tilted head section
  b.box(M.mattress, 0, H + 0.13, 0.35, W - 0.08, 0.16, L * 0.62);
  b.box(M.mattress, 0, H + 0.3, -0.62, W - 0.08, 0.16, 0.72, -0.45);
  // sheets
  const sheet = bloody ? M.sheetBloody : M.sheet;
  b.box(sheet, 0.04, H + 0.23, 0.42, W + 0.02, 0.04, L * 0.58, 0, messy ? 0.08 : 0, messy ? 0.05 : 0);
  if (messy) b.box(sheet, W * 0.55, H - 0.05, 0.4, 0.03, 0.52, 1.0, 0, 0, 0.15); // sheet hanging off the side
  b.box(M.plasticLight, 0, H + 0.45, -0.78, 0.6, 0.12, 0.38, -0.45); // pillow
  if (body) {
    // shape under a bloody sheet
    b.sph(M.sheetBloody, 0, H + 0.38, -0.6, 0.16, 1, 0.8, 1.2);
    b.box(M.sheetBloody, 0, H + 0.33, 0.25, 0.48, 0.2, 1.3);
    b.sph(M.sheetBloody, 0.12, H + 0.32, 0.9, 0.09, 1, 1, 1.4);
    b.sph(M.sheetBloody, -0.12, H + 0.32, 0.9, 0.09, 1, 1, 1.4);
  }
  b.solid(0, 0, W + 0.1, L, 1.1);
}

export function bedside(b, M) {
  b.box(M.plasticLight, 0, 0.4, 0, 0.45, 0.8, 0.45);
  b.box(M.metalDark, 0, 0.55, 0.226, 0.38, 0.18, 0.01);
  b.box(M.chrome, 0, 0.55, 0.235, 0.14, 0.025, 0.02);
  b.box(M.metalDark, 0, 0.25, 0.226, 0.38, 0.32, 0.01);
  b.cyl(M.plasticLight, 0.1, 0.86, 0, 0.035, 0.03, 0.12, 8); // cup
  b.solid(0, 0, 0.45, 0.45, 0.8);
}

export function ivStand(b, M, tipped = false) {
  const rz = tipped ? 1.45 : 0;
  const oy = tipped ? 0.05 : 0;
  if (tipped) {
    b.cyl(M.chrome, 0.9, 0.06, 0, 0.012, 0.012, 1.9, 6, 0, 0, Math.PI / 2);
    b.box(M.glass, 1.85, 0.12, 0.05, 0.15, 0.06, 0.24, 0, 0, 0.2);
  } else {
    b.cyl(M.chrome, 0, 0.95 + oy, 0, 0.012, 0.012, 1.9, 6, 0, 0, rz);
    b.box(M.chrome, 0, 1.88, 0, 0.32, 0.015, 0.015);
    b.box(M.glass, 0.13, 1.7, 0, 0.12, 0.22, 0.05);
    b.cyl(M.plasticLight, 0.13, 1.1, 0, 0.004, 0.004, 0.9, 4);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    b.box(M.metalDark, Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15, 0.3, 0.02, 0.03, 0, -a, 0);
    b.sph(M.rubber, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, 0.03, 1, 1, 1, 6);
  }
}

export function wheelchair(b, M, tipped = false) {
  const tilt = tipped ? 1.35 : 0;
  // build into a tilted sub-frame by manipulating rx of parts around pivot
  const p = (fn) => fn;
  const parts = () => {
    for (const s of [-1, 1]) {
      b.tor(M.rubber, s * 0.32, 0.31, -0.05, 0.3, 0.02, 0, Math.PI / 2, tilt * s * 0 + tilt);
      b.tor(M.chrome, s * 0.34, 0.31, -0.05, 0.26, 0.008, 0, Math.PI / 2, tilt);
      for (let k = 0; k < 6; k++) b.box(M.chrome, s * 0.32, 0.31, -0.05, 0.004, 0.5, 0.008, k * Math.PI / 6, 0, tilt);
      b.tor(M.rubber, s * 0.26, 0.08, 0.38, 0.07, 0.018, 0, Math.PI / 2, 0);
      b.cyl(M.chrome, s * 0.26, 0.55, -0.28, 0.014, 0.014, 0.85, 6, -0.1, 0, tilt * 0.6);
      b.box(M.chrome, s * 0.26, 0.48, 0.05, 0.025, 0.025, 0.7);
      b.box(M.leather, s * 0.27, 0.72, -0.03, 0.06, 0.04, 0.4);
    }
    b.box(M.leather, 0, 0.5, 0.0, 0.48, 0.04, 0.44, 0, 0, tilt * 0.3);
    b.box(M.leather, 0, 0.78, -0.28, 0.48, 0.48, 0.04, -0.12, 0, tilt * 0.4);
    b.box(M.metalDark, 0, 0.14, 0.42, 0.36, 0.02, 0.14);
  };
  p(parts)();
  b.solid(0, 0, 0.7, 0.9, 0.9);
}

export function chair(b, M, fallen = false) {
  if (fallen) {
    b.box(M.leather, 0, 0.23, 0, 0.45, 0.45, 0.06);
    b.box(M.leather, 0, 0.05, -0.25, 0.45, 0.06, 0.45);
    for (const s of [-1, 1]) b.box(M.metalDark, s * 0.2, 0.22, 0.2, 0.025, 0.025, 0.45);
  } else {
    b.box(M.leather, 0, 0.46, 0, 0.46, 0.06, 0.44);
    b.box(M.leather, 0, 0.75, -0.21, 0.46, 0.5, 0.05, -0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.metalDark, sx * 0.2, 0.22, sz * 0.19, 0.025, 0.45, 0.025);
  }
  b.solid(0, 0, 0.5, 0.5, 0.8);
}

export function waitingChairs(b, M, n = 4, fallenIdx = -1) {
  b.box(M.metalDark, 0, 0.36, 0, n * 0.55, 0.05, 0.06);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.55;
    if (i === fallenIdx) { b.box(M.plasticDark, x + 0.1, 0.06, 0.4, 0.48, 0.05, 0.45, 0, 0.6, 0); continue; }
    b.box(M.plasticDark, x, 0.44, 0.02, 0.48, 0.05, 0.46, 0.05);
    b.box(M.plasticDark, x, 0.72, -0.2, 0.48, 0.5, 0.05, -0.15);
  }
  for (const s of [-1, 1]) {
    const x = s * (n * 0.55 / 2 - 0.1);
    b.box(M.metalDark, x, 0.18, 0, 0.05, 0.36, 0.05);
    b.box(M.metalDark, x, 0.02, 0, 0.05, 0.04, 0.5);
  }
  b.solid(0, 0, n * 0.55, 0.55, 0.9);
}

export function desk(b, M, { w = 1.5, d = 0.75, monitor = true, papers = true } = {}) {
  b.box(M.wood, 0, 0.74, 0, w, 0.04, d);
  b.box(M.metalDark, -w / 2 + 0.22, 0.37, 0, 0.42, 0.72, d - 0.05);
  for (let i = 0; i < 3; i++) {
    b.box(M.metal, -w / 2 + 0.22, 0.6 - i * 0.22, d / 2 - 0.02, 0.38, 0.18, 0.01);
    b.box(M.chrome, -w / 2 + 0.22, 0.6 - i * 0.22, d / 2, 0.12, 0.02, 0.02);
  }
  b.box(M.metalDark, w / 2 - 0.03, 0.37, 0, 0.04, 0.72, d - 0.05);
  b.box(M.metalDark, 0.2, 0.45, -d / 2 + 0.03, w - 0.5, 0.5, 0.02);
  if (monitor) crt(b, M, 0.15, 0.76, -0.08);
  if (papers) for (let i = 0; i < 5; i++) b.box(M.paper, rr(-w / 2 + 0.2, w / 2 - 0.2), 0.765 + i * 0.002, rr(-0.2, 0.25), 0.21, 0.002, 0.3, 0, rng() * 3, 0);
  b.box(M.plasticDark, 0.15, 0.775, 0.22, 0.45, 0.02, 0.15); // keyboard
  b.solid(0, 0, w, d, 0.8);
}

export function crt(b, M, x, y, z, ry = 0, on = false) {
  b.box(M.plasticLight, x, y + 0.2, z - 0.05, 0.4, 0.36, 0.34, 0, ry);
  b.box(M.plasticLight, x, y + 0.2, z - 0.28, 0.3, 0.28, 0.2, 0, ry);
  b.box(on ? M.screenGreen : M.screenOff, x, y + 0.21, z + 0.125, 0.32, 0.26, 0.01, 0, ry);
  b.box(M.plasticLight, x, y + 0.01, z - 0.05, 0.24, 0.02, 0.2, 0, ry);
}

export function filingCabinet(b, M, open = false) {
  b.box(M.metal, 0, 0.66, 0, 0.47, 1.32, 0.6);
  for (let i = 0; i < 4; i++) {
    const out = open && i === 1 ? 0.35 : 0;
    b.box(M.metalDark, 0, 1.15 - i * 0.32, 0.301 + out, 0.43, 0.28, 0.01);
    b.box(M.chrome, 0, 1.22 - i * 0.32, 0.31 + out, 0.12, 0.02, 0.02);
    if (out) { b.box(M.metal, 0, 0.83, 0.3 + out / 2, 0.43, 0.26, out); for (let k = 0; k < 6; k++) b.box(M.paper, rr(-0.15, 0.15), 0.9, 0.15 + k * 0.06, 0.25, 0.2, 0.004); }
  }
  b.solid(0, 0, 0.5, 0.62, 1.4);
}

export function shelfRack(b, M, { w = 1.8, d = 0.5, h = 2, fill = 1 } = {}) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.metalRust, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), 0.04, h, 0.04);
  for (let i = 0; i < 4; i++) {
    const y = 0.12 + i * (h - 0.2) / 3;
    b.box(M.metalRust, 0, y, 0, w, 0.025, d);
    if (i < 3 || fill > 1) {
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.2) {
        const t = rng();
        if (t < 0.4 * fill) { const bw = rr(0.25, 0.45), bh = rr(0.18, 0.35); b.box(M.cardboard, x + bw / 2, y + bh / 2 + 0.013, rr(-0.05, 0.05), bw, bh, d * 0.8, 0, rr(-0.1, 0.1)); x += bw + 0.03; }
        else if (t < 0.75 * fill) { for (let k = 0; k < 3; k++) { const bh = rr(0.12, 0.25); b.cyl(rng() < 0.5 ? M.plasticLight : M.glass, x + 0.05 + k * 0.08, y + bh / 2 + 0.013, rr(-0.12, 0.12), 0.035, 0.035, bh, 8); } x += 0.3; }
        else x += rr(0.15, 0.4);
      }
    }
  }
  b.solid(0, 0, w, d, h);
}

export function gurney(b, M, { body = false, bloody = true } = {}) {
  b.box(M.metal, 0, 0.82, 0, 0.62, 0.04, 1.9);
  b.box(bloody ? M.sheetBloody : M.sheet, 0, 0.86, 0, 0.64, 0.05, 1.92);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(M.chrome, sx * 0.26, 0.42, sz * 0.8, 0.018, 0.018, 0.8, 6);
    b.sph(M.rubber, sx * 0.26, 0.05, sz * 0.8, 0.05, 1, 1, 0.5, 8);
  }
  b.box(M.chrome, 0, 0.3, 0, 0.5, 0.02, 1.6);
  if (body) {
    b.sph(M.sheetBloody, 0, 1.0, -0.7, 0.15, 1, 0.8, 1.2);
    b.box(M.sheetBloody, 0, 0.98, 0.1, 0.46, 0.18, 1.2);
    b.sph(M.sheetBloody, 0.1, 0.95, 0.75, 0.08, 1, 1, 1.5);
    b.sph(M.sheetBloody, -0.1, 0.95, 0.75, 0.08, 1, 1, 1.5);
    b.box(M.sheetBloody, 0.33, 0.7, -0.1, 0.02, 0.35, 0.6); // sheet hanging
  }
  b.solid(0, 0, 0.66, 1.95, 1.1);
}

export function opTable(b, M) {
  b.box(M.metalDark, 0, 0.92, 0, 0.6, 0.08, 2.0);
  b.box(M.leather, 0, 0.98, 0, 0.56, 0.06, 1.95);
  b.box(M.sheetBloody, 0, 1.02, 0.1, 0.62, 0.02, 1.4, 0, 0.1, 0);
  b.cyl(M.chrome, 0, 0.47, 0, 0.12, 0.16, 0.85, 12);
  b.box(M.metalDark, 0, 0.03, 0, 0.6, 0.06, 0.9);
  for (const s of [-1, 1]) b.box(M.leather, s * 0.42, 0.95, -0.35, 0.3, 0.04, 0.12); // arm boards
  b.cyl(M.rubber, 0.25, 1.03, 0.6, 0.04, 0.04, 0.06, 8, 0, 0, Math.PI / 2); // restraints
  b.cyl(M.rubber, -0.25, 1.03, 0.6, 0.04, 0.04, 0.06, 8, 0, 0, Math.PI / 2);
  b.solid(0, 0, 0.8, 2.0, 1.1);
}

export function surgicalLamp(b, M, ceilH) {
  b.cyl(M.metal, 0, ceilH - 0.4, 0, 0.03, 0.03, 0.8, 8);
  b.box(M.metal, 0.35, ceilH - 0.8, 0, 0.7, 0.05, 0.05, 0, 0, -0.3);
  b.cyl(M.plasticLight, 0.7, ceilH - 1.05, 0, 0.42, 0.32, 0.16, 20);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.sph(M.tubeOff, 0.7 + Math.cos(a) * 0.22, ceilH - 1.14, Math.sin(a) * 0.22, 0.06, 1, 0.5, 1, 8); }
  b.sph(M.tubeOff, 0.7, ceilH - 1.14, 0, 0.07, 1, 0.5, 1, 8);
}

export function instrumentTray(b, M) {
  b.box(M.chrome, 0, 0.95, 0, 0.6, 0.02, 0.4);
  b.cyl(M.chrome, 0, 0.47, -0.15, 0.015, 0.015, 0.95, 6);
  b.box(M.metalDark, 0, 0.03, -0.15, 0.4, 0.04, 0.4);
  for (let i = 0; i < 7; i++) b.box(M.chrome, rr(-0.25, 0.25), 0.965, rr(-0.15, 0.15), 0.015, 0.008, rr(0.1, 0.2), 0, rng() * 3, 0);
  b.sph(M.sheetBloody, 0.15, 0.97, 0.08, 0.06, 1, 0.3, 1, 8);
  b.solid(0, -0.05, 0.6, 0.45, 1);
}

export function anesthesia(b, M) {
  b.box(M.plasticLight, 0, 0.7, 0, 0.6, 1.3, 0.55);
  b.box(M.screenOff, 0, 1.15, 0.28, 0.4, 0.28, 0.01);
  for (let i = 0; i < 3; i++) b.cyl(M.chrome, -0.18 + i * 0.18, 0.75, 0.29, 0.05, 0.05, 0.02, 12, Math.PI / 2);
  b.cyl(M.metal, 0.38, 0.6, 0, 0.08, 0.08, 1.1, 10); // gas bottle
  b.cyl(M.rubber, -0.2, 1.4, 0.3, 0.02, 0.02, 0.8, 6, 0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.sph(M.rubber, sx * 0.25, 0.04, sz * 0.22, 0.04, 1, 1, 1, 6);
  b.solid(0, 0, 0.8, 0.6, 1.4);
}

export function monitorCart(b, M, on = true) {
  b.box(M.metalDark, 0, 0.45, 0, 0.45, 0.04, 0.4);
  b.cyl(M.chrome, 0, 0.75, 0, 0.02, 0.02, 0.6, 6);
  b.box(M.plasticLight, 0, 1.15, 0, 0.42, 0.32, 0.18);
  b.box(on ? M.screenGreen : M.screenOff, 0, 1.16, 0.091, 0.34, 0.24, 0.005);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.sph(M.rubber, sx * 0.18, 0.04, sz * 0.16, 0.04, 1, 1, 1, 6);
  b.solid(0, 0, 0.5, 0.45, 1.3);
}

export function curtain(b, M, len, ceilH, open = 0.6) {
  b.cyl(M.chrome, 0, ceilH - 0.15, 0, 0.015, 0.015, len, 6, 0, 0, Math.PI / 2);
  const n = Math.max(3, Math.round(len * open * 6));
  const wSeg = len * open / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + wSeg * (i + 0.5);
    b.box(M.curtain, x, ceilH / 2 + 0.25, Math.sin(i * 1.7) * 0.06, wSeg * 1.05, ceilH - 0.75, 0.01, 0, (i % 2 ? 0.35 : -0.35), 0);
  }
}

export function receptionDesk(b, M) {
  // L-shaped counter
  b.box(M.wood, 0, 0.55, 0, 3.6, 1.1, 0.6);
  b.box(M.wood, 0, 1.12, 0.1, 3.7, 0.05, 0.8);
  b.box(M.wood, -1.8, 0.55, -1.0, 0.6, 1.1, 2.0);
  b.box(M.wood, -1.8, 1.12, -1.0, 0.8, 0.05, 2.1);
  b.box(M.woodDoor, 0, 0.55, 0.31, 3.5, 0.9, 0.01);
  b.box(M.wood, 0.4, 0.74, -0.55, 2.4, 0.04, 0.6); // inner work surface
  crt(b, M, 0.6, 0.76, -0.6, 0, true);
  crt(b, M, -0.4, 0.76, -0.55, 0.3);
  for (let i = 0; i < 9; i++) b.box(M.paper, rr(-1.5, 1.5), 1.15, rr(-0.1, 0.35), 0.21, 0.002, 0.3, 0, rng() * 3, 0);
  b.box(M.plasticDark, 1.3, 1.18, 0.1, 0.2, 0.08, 0.15); // phone
  b.solid(0, 0, 3.7, 0.8, 1.2);
  b.solid(-1.8, -1.0, 0.8, 2.1, 1.2);
}

export function deadPlant(b, M) {
  b.cyl(M.plasticDark, 0, 0.22, 0, 0.2, 0.15, 0.44, 12);
  b.cyl(M.cardboard, 0, 0.43, 0, 0.18, 0.18, 0.02, 12);
  for (let i = 0; i < 7; i++) b.cyl(M.wood, rr(-0.05, 0.05), 0.75, rr(-0.05, 0.05), 0.004, 0.01, 0.7, 4, rr(-0.5, 0.5), 0, rr(-0.5, 0.5));
  b.solid(0, 0, 0.42, 0.42, 0.9);
}

export function vending(b, M) {
  b.box(M.metalDark, 0, 0.95, 0, 0.9, 1.9, 0.8);
  b.box(M.glass, -0.1, 1.15, 0.401, 0.6, 1.2, 0.01);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) if (rng() < 0.55) b.box(rng() < 0.5 ? M.redLight : M.cardboard, -0.35 + c * 0.17, 0.7 + r * 0.22, 0.25, 0.1, 0.14, 0.08);
  b.box(M.screenRed, 0.36, 1.4, 0.41, 0.1, 0.06, 0.01);
  b.solid(0, 0, 0.9, 0.8, 1.9);
}

export function labBench(b, M, { w = 2.4, gear = true } = {}) {
  b.box(M.plasticDark, 0, 0.9, 0, w, 0.05, 0.8);
  b.box(M.plasticLight, 0, 0.45, 0, w - 0.1, 0.86, 0.75);
  for (let i = 0; i < Math.floor(w / 0.6); i++) b.box(M.metalDark, -w / 2 + 0.3 + i * 0.6, 0.45, 0.376, 0.55, 0.8, 0.01);
  if (gear) {
    b.box(M.plasticLight, -w / 2 + 0.4, 1.12, -0.1, 0.4, 0.4, 0.4); // centrifuge
    b.cyl(M.metal, -w / 2 + 0.4, 1.33, -0.1, 0.15, 0.15, 0.02, 14);
    b.cyl(M.chrome, 0.2, 1.05, 0, 0.06, 0.08, 0.2, 10); // microscope base
    b.cyl(M.metalDark, 0.2, 1.3, -0.05, 0.02, 0.02, 0.35, 6, 0.4);
    for (let i = 0; i < 6; i++) b.cyl(i % 2 ? M.liquidGreen : M.glass, 0.6 + i * 0.07, 1.0, 0.2, 0.02, 0.02, 0.15, 8);
    b.box(M.cardboard, w / 2 - 0.4, 0.94, 0.1, 0.5, 0.03, 0.35);
    crt(b, M, w / 2 - 0.5, 0.92, -0.15, -0.3, rng() < 0.5);
  }
  b.solid(0, 0, w, 0.8, 1.0);
}

export function tube(b, M, { broken = false } = {}) {
  b.cyl(M.metalDark, 0, 0.15, 0, 0.6, 0.65, 0.3, 20);
  b.cyl(M.metalDark, 0, 2.6, 0, 0.6, 0.55, 0.3, 20);
  if (!broken) {
    b.cyl(M.glass, 0, 1.38, 0, 0.5, 0.5, 2.15, 20, 0, 0, 0, true);
    b.cyl(M.liquidGreen, 0, 1.2, 0, 0.47, 0.47, 1.8, 20);
  } else {
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; b.box(M.brokenGlass, Math.cos(a) * 0.5, 0.35 + rng() * 0.4, Math.sin(a) * 0.5, 0.25, rr(0.2, 0.6), 0.01, 0, -a + Math.PI / 2, rr(-0.3, 0.3)); }
    for (let i = 0; i < 6; i++) b.box(M.brokenGlass, rr(-1.2, 1.2), 0.01, rr(-1.2, 1.2), rr(0.1, 0.3), 0.005, rr(0.1, 0.3), 0, rng() * 3, 0);
  }
  for (let i = 0; i < 3; i++) b.cyl(M.metal, Math.cos(i * 2.1) * 0.3, 2.95, Math.sin(i * 2.1) * 0.3, 0.05, 0.05, 0.5, 8);
  b.solid(0, 0, 1.3, 1.3, 2.8);
}

export function serverRack(b, M) {
  b.box(M.metalDark, 0, 1.0, 0, 0.7, 2.0, 0.9);
  for (let i = 0; i < 12; i++) {
    b.box(M.plasticDark, 0, 0.25 + i * 0.14, 0.451, 0.6, 0.1, 0.01);
    if (rng() < 0.6) b.box(rng() < 0.3 ? M.ledRed : M.ledGreen, 0.22, 0.25 + i * 0.14, 0.457, 0.02, 0.02, 0.01);
  }
  b.solid(0, 0, 0.7, 0.9, 2);
}

export function fridge(b, M) {
  b.box(M.plasticLight, 0, 0.95, 0, 0.8, 1.9, 0.75);
  b.box(M.glass, 0, 1.0, 0.38, 0.65, 1.6, 0.01);
  for (let i = 0; i < 4; i++) { b.box(M.chrome, 0, 0.45 + i * 0.4, 0.05, 0.7, 0.01, 0.6); for (let k = 0; k < 5; k++) b.cyl(rng() < 0.5 ? M.liquidGreen : M.screenRed, -0.25 + k * 0.12, 0.52 + i * 0.4, 0.1, 0.025, 0.025, 0.12, 6); }
  b.box(M.chrome, 0.33, 1.0, 0.4, 0.02, 0.5, 0.03);
  b.solid(0, 0, 0.8, 0.75, 1.9);
}

export function generator(b, M) {
  b.box(M.metalRust, 0, 0.8, 0, 2.4, 1.6, 1.2);
  b.box(M.metalDark, 0, 0.05, 0, 2.6, 0.1, 1.4);
  for (let i = 0; i < 8; i++) b.box(M.metalDark, -1 + i * 0.28, 1.0, 0.61, 0.04, 0.9, 0.02);
  b.cyl(M.metal, 0.9, 1.9, -0.3, 0.12, 0.12, 0.8, 10);
  b.cyl(M.metalRust, -0.5, 2.3, -0.4, 0.1, 0.1, 1.8, 10, 0, 0, Math.PI / 2);
  b.cyl(M.metalRust, -1.4, 2.0, -0.4, 0.1, 0.1, 0.8, 10);
  b.box(M.screenRed, 0.7, 1.4, 0.61, 0.2, 0.1, 0.01);
  b.solid(0, 0, 2.6, 1.4, 1.8);
}

export function papers(b, M, n = 6, r = 1) {
  for (let i = 0; i < n; i++) b.box(M.paper, rr(-r, r), 0.004 + i * 0.0015, rr(-r, r), 0.21, 0.002, 0.3, 0, rng() * 6, 0);
}

export function debris(b, M, n = 8, r = 1.2) {
  for (let i = 0; i < n; i++) {
    const t = rng();
    if (t < 0.35) b.box(M.ceiling, rr(-r, r), 0.02, rr(-r, r), rr(0.2, 0.6), 0.025, rr(0.2, 0.6), rr(-0.1, 0.1), rng() * 3, rr(-0.1, 0.1));
    else if (t < 0.6) b.cyl(M.glass, rr(-r, r), 0.04, rr(-r, r), 0.035, 0.035, 0.2, 8, 0, rng() * 3, Math.PI / 2);
    else if (t < 0.8) b.box(M.cardboard, rr(-r, r), 0.1, rr(-r, r), rr(0.2, 0.4), 0.2, rr(0.2, 0.4), 0, rng() * 3, 0);
    else b.box(M.paper, rr(-r, r), 0.004, rr(-r, r), 0.21, 0.002, 0.3, 0, rng() * 6, 0);
  }
}

export function trashBin(b, M, tipped = false) {
  if (tipped) { b.cyl(M.metalDark, 0, 0.2, 0, 0.2, 0.17, 0.55, 12, 0, 0, Math.PI / 2, true); papers(b, M, 4, 0.5); }
  else { b.cyl(M.metalDark, 0, 0.28, 0, 0.2, 0.17, 0.55, 12, 0, 0, 0, true); b.cyl(M.metalDark, 0, 0.01, 0, 0.17, 0.17, 0.02, 12); }
}

export function extinguisher(b, M) {
  b.cyl(M.redLight, 0, 0.35, 0, 0.08, 0.08, 0.55, 10);
  b.sph(M.redLight, 0, 0.62, 0, 0.08, 1, 0.6, 1, 8);
  b.box(M.metalDark, 0, 0.72, 0, 0.04, 0.08, 0.12);
}

export function hangingBody(b, M) { /* reserved */ }

export function bloodDecal(b, M, x, z, size, kind = 'splat', rot = rng() * 6) {
  const mat = kind === 'trail' ? M.bloodTrail : kind === 'pool' ? M.bloodPool : M.bloodSplat;
  b.plane(mat, x, 0.012 + rng() * 0.004, z, size, kind === 'trail' ? size * 2.2 : size, -Math.PI / 2, 0, rot);
}
