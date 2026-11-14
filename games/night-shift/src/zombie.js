// Infected: procedurally modelled humanoids on a real bone skeleton (SkinnedMesh),
// driven by AnimationMixer clips with cross-fade blending, plus the AI brain.
import * as THREE from 'three';
import { mergeGeometries } from '../assets/lib/BufferGeometryUtils.js';

/* ================================================================ RIG */
const BONES = [
  // name, parent, offset (scaled)
  ['hips', null, [0, 1.0, 0]],
  ['spine', 'hips', [0, 0.12, 0]],
  ['chest', 'spine', [0, 0.18, 0]],
  ['neck', 'chest', [0, 0.22, 0]],
  ['head', 'neck', [0, 0.1, 0.0]],
  ['jaw', 'head', [0, 0.055, -0.01]],
  ['clavL', 'chest', [0.07, 0.16, 0]], ['uArmL', 'clavL', [0.12, 0, 0]], ['fArmL', 'uArmL', [0, -0.29, 0]], ['handL', 'fArmL', [0, -0.26, 0]],
  ['clavR', 'chest', [-0.07, 0.16, 0]], ['uArmR', 'clavR', [-0.12, 0, 0]], ['fArmR', 'uArmR', [0, -0.29, 0]], ['handR', 'fArmR', [0, -0.26, 0]],
  ['thighL', 'hips', [0.1, -0.05, 0]], ['shinL', 'thighL', [0, -0.45, 0]], ['footL', 'shinL', [0, -0.44, 0]],
  ['thighR', 'hips', [-0.1, -0.05, 0]], ['shinR', 'thighR', [0, -0.45, 0]], ['footR', 'shinR', [0, -0.44, 0]],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

export const TYPES = {
  walker: { hp: 100, speed: 0.95, chase: 1.75, sight: 13, hear: 1, dmg: 14, range: 1.45, radius: 0.32, scale: 1.0, bulk: 1.0, scream: false, lose: 6 },
  runner: { hp: 75, speed: 1.3, chase: 5.0, sight: 18, hear: 1.3, dmg: 11, range: 1.4, radius: 0.3, scale: 0.98, bulk: 0.9, scream: true, lose: 8 },
  tank: { hp: 850, speed: 1.0, chase: 2.6, sight: 16, hear: 1.2, dmg: 34, range: 2.1, radius: 0.55, scale: 1.38, bulk: 1.7, scream: true, lose: 12 },
};

// Appearance presets: hospital patients, a doctor, a security guard, civilians.
const LOOKS = [
  { skin: [0.36, 0.38, 0.33], top: [0.3, 0.4, 0.46], bottom: [0.3, 0.4, 0.46], gown: true, hair: [0.12, 0.1, 0.08], blood: 0.6, limp: false },
  { skin: [0.42, 0.4, 0.36], top: [0.58, 0.58, 0.54], bottom: [0.12, 0.13, 0.15], coat: true, hair: [0.25, 0.22, 0.2], blood: 0.8, limp: true },
  { skin: [0.34, 0.37, 0.32], top: [0.09, 0.11, 0.18], bottom: [0.08, 0.08, 0.1], hair: null, blood: 0.7, limp: false },
  { skin: [0.4, 0.36, 0.33], top: [0.36, 0.14, 0.12], bottom: [0.15, 0.18, 0.25], hair: [0.05, 0.05, 0.05], blood: 0.9, limp: false },
  { skin: [0.35, 0.39, 0.35], top: [0.42, 0.45, 0.42], bottom: [0.42, 0.45, 0.42], gown: true, hair: null, blood: 1.0, limp: true },
];

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    r += hash3(ix + a, iy + b, iz + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  return r;
}

function restWorld(scale) {
  const pos = {};
  for (const [n, p, o] of BONES) {
    const off = v3(o).multiplyScalar(scale);
    pos[n] = p ? pos[p].clone().add(off) : off;
  }
  return pos;
}

/* ---------------------------------------------------- geometry builder */
class Body {
  constructor(look, type) {
    this.look = look; this.type = type; this.parts = [];
    this.scale = TYPES[type].scale; this.bulk = TYPES[type].bulk;
    this.rest = restWorld(this.scale);
  }
  // add geometry already in model space; bone weights from segment A->B
  add(geo, bone, color, { parent = null, a = null, b = null, blend = 0.25, blood = 0, dark = 0, fn = null, colorFn = null } = {}) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.deleteAttribute('uv') ; // regenerate simple uv below
    const n = geo.attributes.position.count;
    const pos = geo.attributes.position;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const A = a || this.rest[bone], B = b || A.clone().add(new THREE.Vector3(0, 0.1, 0));
    const dir = B.clone().sub(A); const len = dir.length() || 1; dir.normalize();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      tmp.fromBufferAttribute(pos, i);
      let t = tmp.clone().sub(A).dot(dir) / len;
      si[i * 4] = BI[bone];
      let wp = 0;
      if (parent) wp = Math.max(0, Math.min(0.5, 0.5 * (1 - t / blend)));
      if (fn) { const r = fn(tmp, t); if (r) { si[i * 4 + 1] = BI[r.bone]; sw[i * 4 + 1] = r.w; sw[i * 4] = 1 - r.w; continue; } }
      if (wp > 0) { si[i * 4 + 1] = BI[parent]; sw[i * 4] = 1 - wp; sw[i * 4 + 1] = wp; }
      else sw[i * 4] = 1;
      // colour: base * grime noise + blood patches
      const nn = noise3(tmp.x * 9, tmp.y * 9, tmp.z * 9);
      const nb = noise3(tmp.x * 5 + 10, tmp.y * 5, tmp.z * 5 - 4);
      let r = color[0], g = color[1], bl = color[2];
      const shade = 0.75 + nn * 0.4 - dark;
      r *= shade; g *= shade; bl *= shade;
      const bloodAmt = Math.max(0, Math.min(1, (nb - (0.72 - blood * 0.35)) * 4));
      if (bloodAmt > 0) { r = r * (1 - bloodAmt) + 0.17 * bloodAmt; g = g * (1 - bloodAmt) + 0.012 * bloodAmt; bl = bl * (1 - bloodAmt) + 0.012 * bloodAmt; }
      const low = Math.max(0, 0.6 - tmp.y) * 0.5; r *= 1 - low; g *= 1 - low * 1.05; bl *= 1 - low * 1.1;
      if (colorFn) { const c = colorFn(tmp, [r, g, bl]); if (c) { r = c[0]; g = c[1]; bl = c[2]; } }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl;
      uv[i * 2] = Math.atan2(tmp.x, tmp.z) / (Math.PI * 2) + 0.5; uv[i * 2 + 1] = tmp.y * 1.5;
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.parts.push(geo);
  }
  // tapered limb from A to B
  limb(bone, parent, A, B, rA, rB, color, o = {}) {
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(rB, rA, len, o.seg || 10, 5, false);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // muscle bulge mid-limb + irregularity
      const t = y / len + 0.5;
      const bulge = 1 + (o.bulge || 0.12) * Math.sin(t * Math.PI) + (noise3(p.getX(i) * 20, y * 20, p.getZ(i) * 20) - 0.5) * 0.12;
      p.setX(i, p.getX(i) * bulge * (o.sx || 1)); p.setZ(i, p.getZ(i) * bulge * (o.sz || 1));
    }
    g.computeVertexNormals();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    this.add(g, bone, color, { parent, a: A, b: B, ...o });
    // joint sphere
    if (o.joint !== false) {
      const s = new THREE.SphereGeometry(rA * 1.02, 10, 8); s.translate(A.x, A.y, A.z);
      this.add(s, bone, color, { parent, a: A, b: B, blend: 0.6, ...o });
    }
  }
  // torso section: elliptical cylinder with a radius profile
  trunk(bone, parent, y0, y1, profile, color, o = {}) {
    const h = y1 - y0;
    const g = new THREE.CylinderGeometry(1, 1, h, 16, 8, false);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / h + 0.5;
      const [rx, rz, zoff] = profile(t);
      let x = p.getX(i), z = p.getZ(i);
      // ribs / bony bumps for emaciated bodies
      const ribs = o.ribs ? Math.max(0, Math.sin(t * o.ribs * Math.PI)) * 0.012 * (z > 0 ? 1 : 0.4) : 0;
      const irr = (noise3(x * 6, t * 8, z * 6) - 0.5) * 0.008;
      p.setX(i, x * (rx + ribs + irr)); p.setZ(i, z * (rz + ribs + irr) + (zoff || 0));
    }
    g.computeVertexNormals();
    g.translate(0, (y0 + y1) / 2, 0);
    this.add(g, bone, color, { parent, a: new THREE.Vector3(0, y0, 0), b: new THREE.Vector3(0, y1, 0), ...o });
  }
  sphere(bone, c, r, sc, color, o = {}) {
    const g = new THREE.SphereGeometry(r, o.ws || 12, o.hs || 10, 0, Math.PI * 2, o.t0 || 0, o.tl || Math.PI);
    g.scale(sc[0], sc[1], sc[2]);
    if (o.rot) g.rotateX(o.rot);
    g.translate(c.x, c.y, c.z);
    this.add(g, bone, color, o);
  }
  box(bone, c, s, color, o = {}) {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2], 2, 2, 2);
    if (o.rx) g.rotateX(o.rx);
    g.translate(c.x, c.y, c.z);
    this.add(g, bone, color, o);
  }
  geometry() {
    const g = mergeGeometries(this.parts, false);
    g.computeBoundingSphere();
    this.parts.forEach((p) => p.dispose());
    return g;
  }
}

function buildBodyGeometry(type, look) {
  const B = new Body(look, type);
  const R = B.rest, k = B.scale, bulk = B.bulk;
  const skin = look.skin, top = look.top, bot = look.bottom;
  const blood = look.blood;
  const tank = type === 'tank';

  // ---- torso: one continuous sculpted profile split across hips/spine/chest bones
  const hipY = R.hips.y;
  const PROF = [ // y (rel. hips), half-width, half-depth, forward offset
    [-0.13, 0.13, 0.1, 0], [-0.04, 0.165, 0.118, 0], [0.08, 0.155, 0.108, 0.004], [0.18, 0.134, 0.098, 0.008],
    [0.3, 0.153, 0.11, 0.012], [0.4, 0.172, 0.12, 0.014], [0.47, 0.188, 0.108, 0.002], [0.53, 0.15, 0.085, -0.008], [0.59, 0.062, 0.058, 0.0],
  ];
  const prof = (yy) => {
    let i = 0; while (i < PROF.length - 2 && yy > PROF[i + 1][0]) i++;
    const a = PROF[i], b = PROF[i + 1];
    let t = Math.max(0, Math.min(1, (yy - a[0]) / (b[0] - a[0]))); t = (1 - Math.cos(t * Math.PI)) / 2;
    const belly = tank ? Math.exp(-((yy - 0.16) ** 2) / 0.02) : 0;
    return [(a[1] + (b[1] - a[1]) * t) * k * bulk, (a[2] + (b[2] - a[2]) * t) * k * bulk * (1 + belly * 0.45), ((a[3] + (b[3] - a[3]) * t) + belly * 0.05) * k];
  };
  const section = (bone, parent, y0, y1, color, o) => B.trunk(bone, parent, hipY + y0 * k, hipY + y1 * k, (t) => prof(y0 + (y1 - y0) * t), color, o);
  // torn clothing: rips expose grey skin with a dark edge
  const rips = (amount) => (v, c) => {
    const n = noise3(v.x * 14 + 3, v.y * 14, v.z * 14 - 2);
    if (n > 0.78 - amount * 0.12) return skin.map((x) => x * 0.85);
    if (n > 0.74 - amount * 0.12) return [c[0] * 0.45, c[1] * 0.42, c[2] * 0.42];
    return null;
  };
  section('hips', null, -0.13, 0.12, look.gown ? top : bot, { blood: blood * 0.5 });
  section('spine', 'hips', 0.1, 0.32, top, { blood, blend: 0.3, colorFn: rips(blood) });
  section('chest', 'spine', 0.3, 0.6, top, { blood, blend: 0.3, colorFn: rips(blood) });
  // belt
  if (!look.gown) { const bp = prof(0.06); const g = new THREE.CylinderGeometry(1, 1, 0.035 * k, 16, 1, true); g.scale(bp[0] * 1.04, 1, bp[1] * 1.06); g.translate(0, hipY + 0.06 * k, bp[2]); B.add(g, 'hips', [0.06, 0.05, 0.04], {}); }
  // open wound on the flank of the bloodiest
  if (blood > 0.75) B.sphere('spine', new THREE.Vector3(0.09 * k, hipY + 0.22 * k, 0.07 * k * bulk), 0.045 * k, [1.0, 1.4, 0.5], [0.26, 0.02, 0.02], { colorFn: (v) => (noise3(v.x * 60, v.y * 60, v.z * 60) > 0.6 ? [0.5, 0.36, 0.3] : null) });

  // ---- gown / coat skirt (weighted to thighs at the hem)
  if (look.gown || look.coat) {
    const len = look.coat ? 0.62 : 0.5;
    const g = new THREE.CylinderGeometry(0.175 * k * bulk, 0.23 * k * bulk, len * k, 18, 6, true);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -len * k * 0.45) p.setY(i, y + (noise3(p.getX(i) * 30, 0, p.getZ(i) * 30) - 0.3) * 0.12); // torn hem
      p.setZ(i, p.getZ(i) * 0.78);
    }
    g.computeVertexNormals(); g.translate(0, hipY + 0.06 * k - len * k / 2, 0);
    B.add(g, 'hips', top, {
      blood, fn: (v) => {
        const t = (hipY + 0.05 * k - v.y) / (len * k);
        if (t > 0.25) return { bone: v.x > 0 ? 'thighL' : 'thighR', w: Math.min(0.85, (t - 0.25) * 1.6) };
        return null;
      },
    });
  }

  // ---- neck & head
  B.limb('neck', 'chest', R.neck.clone().add(new THREE.Vector3(0, -0.04 * k, 0)), R.head.clone().add(new THREE.Vector3(0, 0.04 * k, 0.005)), 0.056 * k * (tank ? 1.7 : 1), 0.049 * k * (tank ? 1.45 : 1), skin, { blood: blood * 0.8, joint: false, bulge: 0.05 });
  const H = R.head.clone().add(new THREE.Vector3(0, 0.085 * k, 0.008));
  const hs = k * (tank ? 1.12 : 1);
  const HR = 0.112 * hs, HSC = [0.86, 1.15, 1.02];
  const EYE = [-1, 1].map((s) => new THREE.Vector3(s * 0.36, 0.13, 0.92).normalize());
  const rotNose = blood > 0.85;
  // sculpted cranium + face (sockets, brow, nose, cheek hollows, mouth) by vertex displacement
  {
    const g = new THREE.SphereGeometry(HR, 30, 24);
    const p = g.attributes.position; const d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i)).divideScalar(HR);
      let s = 1 + (noise3(d.x * 5, d.y * 5, d.z * 5) - 0.5) * 0.05;
      for (const e of EYE) { const a = Math.acos(Math.min(1, d.dot(e))); if (a < 0.3) s *= 1 - 0.14 * Math.cos(a / 0.3 * Math.PI / 2) ** 2; }
      if (d.z > 0.55 && d.y > 0.2 && d.y < 0.38 && Math.abs(d.x) < 0.6) s *= 1.035; // brow ridge
      if (d.z > 0.8 && Math.abs(d.x) < 0.14 && d.y > -0.24 && d.y < 0.14) { const f = (1 - Math.abs(d.x) / 0.14) * Math.min(1, (0.14 - d.y) / 0.3); s *= 1 + (rotNose ? -0.05 : 0.11) * f; }
      if (Math.abs(d.x) > 0.42 && Math.abs(d.x) < 0.78 && d.y > -0.42 && d.y < -0.06 && d.z > 0.3) s *= 0.955; // gaunt cheeks
      if (Math.abs(d.x) < 0.34 && d.y > -0.52 && d.y < -0.34 && d.z > 0.68) s *= 0.95; // mouth
      if (d.y < -0.55) s *= 0.9; // chin handled by the jaw
      if (d.z < -0.25 && d.y > -0.2) s *= 1.03; // occiput
      p.setXYZ(i, d.x * HR * s * HSC[0], d.y * HR * s * HSC[1], d.z * HR * s * HSC[2]);
    }
    g.computeVertexNormals(); g.translate(H.x, H.y, H.z);
    const local = new THREE.Vector3();
    B.add(g, 'head', skin, {
      blood: blood * 0.6,
      colorFn: (v, c) => {
        local.copy(v).sub(H); local.set(local.x / (HR * HSC[0]), local.y / (HR * HSC[1]), local.z / (HR * HSC[2])).normalize();
        for (const e of EYE) { const a = Math.acos(Math.min(1, local.dot(e))); if (a < 0.34) { const k2 = a / 0.34; return [0.03 + 0.1 * k2 * k2, 0.02 + 0.07 * k2 * k2, 0.02 + 0.06 * k2 * k2]; } }
        if (Math.abs(local.x) < 0.34 && local.y > -0.52 && local.y < -0.34 && local.z > 0.66) return [0.07, 0.02, 0.02];
        if (rotNose && local.z > 0.8 && Math.abs(local.x) < 0.12 && local.y > -0.24 && local.y < 0.1) return [0.1, 0.02, 0.02];
        if (local.y > 0.15 && local.z > 0.5 && noise3(v.x * 90, v.y * 90, v.z * 90) > 0.65) return [c[0] * 0.6, c[1] * 0.55, c[2] * 0.7]; // veins
        return null;
      },
    });
  }
  for (const s of [-1, 1]) B.sphere('head', H.clone().add(new THREE.Vector3(s * 0.098 * hs, 0.0, -0.005)), 0.026 * hs, [0.35, 1.15, 0.7], skin, { dark: 0.12 }); // ears
  // mouth cavity + upper teeth (yellowed, uneven)
  B.sphere('head', H.clone().add(new THREE.Vector3(0, -0.05 * hs, 0.062 * hs)), 0.04 * hs, [1, 0.55, 0.8], [0.07, 0.01, 0.01], {});
  for (let i = 0; i < 6; i++) B.box('head', H.clone().add(new THREE.Vector3((-0.025 + i * 0.01) * hs, -0.05 * hs, (0.088 - Math.abs(i - 2.5) * 0.005) * hs)), [0.008 * hs, (0.012 + (i % 3) * 0.002) * hs, 0.006 * hs], [0.55, 0.48, 0.3]);
  // jaw (own bone) + lower teeth
  {
    const J = H.clone().add(new THREE.Vector3(0, -0.068 * hs, 0.028 * hs));
    const g = new THREE.SphereGeometry(0.07 * hs, 16, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58);
    g.scale(0.84, 0.66, 0.98); g.translate(J.x, J.y + 0.022 * hs, J.z);
    B.add(g, 'jaw', skin, { blood: Math.min(1, blood + 0.45), colorFn: (v) => (v.z > J.z + 0.05 * hs && v.y > J.y + 0.005 ? [0.08, 0.02, 0.02] : null) });
    for (let i = 0; i < 6; i++) B.box('jaw', J.clone().add(new THREE.Vector3((-0.025 + i * 0.01) * hs, 0.024 * hs, (0.055 - Math.abs(i - 2.5) * 0.005) * hs)), [0.008 * hs, 0.011 * hs, 0.006 * hs], [0.5, 0.44, 0.28]);
  }
  // patchy hair
  if (look.hair) {
    const g = new THREE.SphereGeometry(0.118 * hs, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = noise3(p.getX(i) * 50, p.getY(i) * 50, p.getZ(i) * 50);
      const s = n > 0.62 ? 0.9 : 1 + n * 0.08; // bald patches sink into skull
      p.setXYZ(i, p.getX(i) * s * 0.92, p.getY(i) * s * 1.16, p.getZ(i) * s * 1.08);
    }
    g.rotateX(-0.25); g.computeVertexNormals(); g.translate(H.x, H.y + 0.005, H.z - 0.01);
    B.add(g, 'head', look.hair, {});
  }

  // ---- arms
  for (const [sd, s] of [['L', 1], ['R', -1]]) {
    const sh = R['uArm' + sd], el = R['fArm' + sd], wr = R['hand' + sd];
    const thick = k * (tank ? 1.7 : 1) * (type === 'runner' ? 0.9 : 1);
    const sleeveCol = look.coat ? top : (look.gown ? top : top);
    B.limb('uArm' + sd, 'clav' + sd, sh, el, 0.058 * thick, 0.045 * thick, sleeveCol, { blood: blood * 0.6, sx: 1, sz: 1 });
    B.limb('fArm' + sd, 'uArm' + sd, el, wr, 0.043 * thick, 0.032 * thick, look.coat ? top : skin, { blood: blood, bulge: 0.18 });
    // hand: palm + 4 curled clawing fingers + thumb
    const hc = wr.clone().add(new THREE.Vector3(0, -0.05 * k, 0.005));
    B.box('hand' + sd, hc, [0.035 * thick, 0.09 * k, 0.075 * thick], skin, { blood: Math.min(1, blood + 0.3) });
    for (let f = 0; f < 4; f++) {
      const fz = (-0.027 + f * 0.018) * thick;
      const f0 = hc.clone().add(new THREE.Vector3(0, -0.045 * k, fz));
      const f1 = f0.clone().add(new THREE.Vector3(s * 0.012 * k, -0.045 * k, 0.012 * k));
      const f2 = f1.clone().add(new THREE.Vector3(s * 0.018 * k, -0.025 * k, 0.018 * k));
      B.limb('hand' + sd, null, f0, f1, 0.009 * thick, 0.008 * thick, skin, { joint: false, seg: 5, blood });
      B.limb('hand' + sd, null, f1, f2, 0.008 * thick, 0.005 * thick, [0.2, 0.17, 0.12], { joint: false, seg: 5 });
    }
    B.limb('hand' + sd, null, hc.clone().add(new THREE.Vector3(s * 0.01, -0.01, 0.035 * thick)), hc.clone().add(new THREE.Vector3(s * 0.02, -0.05 * k, 0.06 * thick)), 0.01 * thick, 0.007 * thick, skin, { joint: false, seg: 5 });
  }

  // ---- legs
  for (const sd of ['L', 'R']) {
    const hp = R['thigh' + sd], kn = R['shin' + sd], an = R['foot' + sd];
    const thick = k * (tank ? 1.55 : 1);
    const legCol = look.gown ? skin : bot;
    B.limb('thigh' + sd, 'hips', hp, kn, 0.082 * thick, 0.058 * thick, legCol, { blood: blood * 0.5, blend: 0.2 });
    B.limb('shin' + sd, 'thigh' + sd, kn, an, 0.056 * thick, 0.04 * thick, legCol, { blood: blood * 0.7 });
    // foot / shoe
    const fc = an.clone().add(new THREE.Vector3(0, -0.035 * k, 0.05 * k));
    B.box('foot' + sd, fc, [0.085 * thick, 0.06 * k, 0.24 * k], look.gown ? skin : [0.08, 0.07, 0.06], { blood: blood * 0.4 });
  }
  return B.geometry();
}

/* ========================================================== ANIMATION */
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const POSE_BONES = BONES.map((b) => b[0]);

function makeClip(name, frames, hipsH) {
  // frames: [{t, pose:{bone:[rx,ry,rz]}, hip:[x,y,z] (y as fraction of hipsH)}]
  const tracks = [];
  for (const bone of POSE_BONES) {
    const times = [], vals = [];
    for (const f of frames) {
      const r = f.pose[bone] || [0, 0, 0];
      _q.setFromEuler(_e.set(r[0], r[1] || 0, r[2] || 0));
      times.push(f.t); vals.push(_q.x, _q.y, _q.z, _q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, vals));
  }
  const pt = [], pv = [];
  for (const f of frames) { const h = f.hip || [0, 1, 0]; pt.push(f.t); pv.push(h[0] * hipsH, h[1] * hipsH, h[2] * hipsH); }
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', pt, pv));
  return new THREE.AnimationClip(name, frames[frames.length - 1].t, tracks);
}

function sampled(name, dur, n, fn, hipsH) {
  const frames = [];
  for (let i = 0; i <= n; i++) { const ph = i / n; const r = fn(ph); frames.push({ t: ph * dur, pose: r.pose, hip: r.hip }); }
  return makeClip(name, frames, hipsH);
}

const TAU = Math.PI * 2;
function walkPose(ph, limp) {
  const s = Math.sin(TAU * ph), c = Math.cos(TAU * ph);
  return {
    pose: {
      hips: [0, 0.1 * s, 0.06 * s], spine: [0.22, 0, -0.05 * s], chest: [0.08, -0.1 * s, 0], neck: [0.15, 0, 0],
      head: [0.1, 0.05 * s, 0.25 + 0.08 * Math.sin(TAU * ph + 1)], jaw: [0.25 + 0.1 * Math.sin(2 * TAU * ph), 0, 0],
      uArmL: [-1.15 + 0.12 * s, 0, 0.12], fArmL: [-0.35, 0, 0], handL: [0.35, 0, 0],
      uArmR: limp ? [-0.12 + 0.1 * s, 0, -0.08] : [-1.0 - 0.12 * s, 0, -0.15], fArmR: limp ? [-0.1, 0, 0] : [-0.5, 0, 0], handR: [0.3, 0, 0],
      thighL: [-0.38 * s, 0.05, 0.02], shinL: [0.15 + 0.6 * Math.max(0, c), 0, 0], footL: [0.15 * s, 0, 0],
      thighR: [0.24 * s, -0.12, -0.02], shinR: [0.2 + 0.35 * Math.max(0, -c), 0, 0], footR: [0.3, 0, 0],
    },
    hip: [0, 0.985 + 0.015 * Math.cos(2 * TAU * ph), 0],
  };
}
function runPose(ph) {
  const s = Math.sin(TAU * ph), c = Math.cos(TAU * ph);
  return {
    pose: {
      hips: [0.1, 0.15 * s, 0.05 * s], spine: [0.38, 0, 0], chest: [0.15, 0.22 * s, 0], neck: [-0.15, 0, 0], head: [-0.25, 0, 0.1 * s],
      jaw: [0.6 + 0.15 * s, 0, 0],
      uArmL: [-0.9 + 0.9 * s, 0, 0.3], fArmL: [-0.9, 0, 0], handL: [0.2, 0, 0],
      uArmR: [-0.9 - 0.9 * s, 0, -0.3], fArmR: [-0.9, 0, 0], handR: [0.2, 0, 0],
      thighL: [-0.9 * s - 0.2, 0, 0], shinL: [0.35 + 1.3 * Math.max(0, c), 0, 0], footL: [0.2 * s, 0, 0],
      thighR: [0.9 * s - 0.2, 0, 0], shinR: [0.35 + 1.3 * Math.max(0, -c), 0, 0], footR: [-0.2 * s, 0, 0],
    },
    hip: [0, 0.94 + 0.04 * Math.cos(2 * TAU * ph), 0],
  };
}
function idlePose(ph, limp) {
  const s = Math.sin(TAU * ph);
  return {
    pose: {
      hips: [0, 0, 0.03 * s], spine: [0.15 + 0.03 * s, 0, 0], chest: [0.05, 0, 0], neck: [0.15, 0, 0],
      head: [0.15, 0.1 * Math.sin(TAU * ph * 2), 0.3 + 0.1 * Math.sin(TAU * ph * 2 + 0.5)], jaw: [0.2 + 0.15 * Math.max(0, Math.sin(TAU * ph * 3)), 0, 0],
      uArmL: [-0.25 + 0.05 * s, 0, 0.08], fArmL: [-0.3, 0, 0], handL: [0.3, 0, 0],
      uArmR: limp ? [-0.05, 0, -0.06] : [-0.2 - 0.05 * s, 0, -0.1], fArmR: [-0.25, 0, 0], handR: [0.3, 0, 0],
      thighL: [0.05, 0, 0.03], shinL: [0.1, 0, 0], thighR: [-0.08, 0, -0.03], shinR: [0.15, 0, 0], footR: [0.1, 0, 0],
    },
    hip: [0, 0.99, 0],
  };
}
const merge = (a, b) => ({ ...a, ...b });

function oneShots(hipsH, limp) {
  const stand = idlePose(0, limp).pose;
  const walk0 = walkPose(0, limp).pose;
  const run0 = runPose(0).pose;
  const clips = {};
  clips.attack = makeClip('attack', [
    { t: 0, pose: walk0 },
    { t: 0.3, pose: merge(walk0, { spine: [-0.15, 0, 0], chest: [-0.1, 0, 0], uArmL: [-2.7, 0, 0.5], uArmR: [-2.7, 0, -0.5], fArmL: [-0.6, 0, 0], fArmR: [-0.6, 0, 0], jaw: [0.8, 0, 0], head: [-0.3, 0, 0] }) },
    { t: 0.5, pose: merge(walk0, { spine: [0.6, 0, 0], chest: [0.25, 0, 0], uArmL: [-0.8, 0, 0.1], uArmR: [-0.8, 0, -0.1], fArmL: [-0.2, 0, 0], fArmR: [-0.2, 0, 0], jaw: [0.95, 0, 0], head: [0.2, 0, 0] }), hip: [0, 0.95, 0.15] },
    { t: 0.75, pose: merge(walk0, { spine: [0.4, 0, 0], uArmL: [-0.6, 0, 0.1], uArmR: [-0.6, 0, -0.1], fArmL: [-0.4, 0, 0], fArmR: [-0.4, 0, 0], jaw: [0.5, 0, 0] }), hip: [0, 0.97, 0.08] },
    { t: 1.1, pose: walk0, hip: [0, 0.985, 0] },
  ], hipsH);
  clips.hit = makeClip('hit', [
    { t: 0, pose: stand },
    { t: 0.08, pose: merge(stand, { spine: [-0.35, 0, 0.1], chest: [-0.2, 0.2, 0], head: [-0.5, 0, 0.3], jaw: [0.7, 0, 0], uArmL: [-0.5, 0, 0.6], uArmR: [-0.5, 0, -0.6] }), hip: [0, 0.98, -0.06] },
    { t: 0.45, pose: stand },
  ], hipsH);
  const deathF = merge(stand, { hips: [1.45, 0, 0.1], spine: [0.1, 0, 0], neck: [0, 0, 0], head: [0, 0.6, 0.5], jaw: [0.6, 0, 0], uArmL: [-2.6, 0, 0.5], uArmR: [-1.6, 0, -0.9], fArmL: [-0.3, 0, 0], fArmR: [-0.6, 0, 0], thighL: [-0.1, 0, 0.1], thighR: [0.05, 0, -0.15], shinL: [0.25, 0, 0], shinR: [0.5, 0, 0] });
  clips.deathF = makeClip('deathF', [
    { t: 0, pose: stand },
    { t: 0.25, pose: merge(stand, { spine: [0.3, 0, 0], head: [-0.5, 0, 0], shinL: [0.6, 0, 0], shinR: [0.6, 0, 0], thighL: [-0.3, 0, 0], thighR: [-0.3, 0, 0] }), hip: [0, 0.85, 0] },
    { t: 0.6, pose: merge(stand, { hips: [0.5, 0, 0], spine: [0.6, 0, 0], shinL: [1.4, 0, 0], shinR: [1.3, 0, 0], thighL: [-1.2, 0, 0], thighR: [-1.1, 0, 0], uArmL: [-1.2, 0, 0.3], uArmR: [-1.2, 0, -0.3] }), hip: [0, 0.55, 0.15] },
    { t: 1.0, pose: deathF, hip: [0, 0.2, 0.55] },
    { t: 1.5, pose: merge(deathF, { head: [0.1, 0.6, 0.6] }), hip: [0, 0.16, 0.6] },
  ], hipsH);
  const deathB = merge(stand, { hips: [-1.45, 0, -0.1], spine: [-0.1, 0, 0], head: [-0.3, -0.6, 0.6], jaw: [0.9, 0, 0], uArmL: [-0.4, 0, 1.3], uArmR: [-0.6, 0, -1.1], fArmL: [-0.8, 0, 0], fArmR: [-0.3, 0, 0], thighL: [-0.45, 0, 0.15], thighR: [-0.1, 0, -0.1], shinL: [0.5, 0, 0], shinR: [0.1, 0, 0] });
  clips.deathB = makeClip('deathB', [
    { t: 0, pose: stand },
    { t: 0.2, pose: merge(stand, { spine: [-0.4, 0, 0], head: [-0.7, 0, 0], uArmL: [-0.6, 0, 0.8], uArmR: [-0.6, 0, -0.8] }), hip: [0, 0.97, -0.1] },
    { t: 0.6, pose: merge(stand, { hips: [-0.6, 0, 0], spine: [-0.2, 0, 0], shinL: [1.0, 0, 0], shinR: [0.8, 0, 0], thighL: [-0.6, 0, 0], thighR: [-0.5, 0, 0] }), hip: [0, 0.6, -0.3] },
    { t: 1.0, pose: deathB, hip: [0, 0.2, -0.6] },
    { t: 1.5, pose: merge(deathB, { head: [-0.3, -0.7, 0.7] }), hip: [0, 0.17, -0.65] },
  ], hipsH);
  const dormant = {
    hips: [-0.25, 0, 0.05], spine: [0.7, 0, 0.1], chest: [0.35, 0, 0], neck: [0.45, 0, 0], head: [0.45, 0.1, 0.5], jaw: [0.3, 0, 0],
    uArmL: [-0.45, 0, 0.25], fArmL: [-0.4, 0, 0], handL: [0.3, 0, 0], uArmR: [-0.1, 0, -0.35], fArmR: [-0.15, 0, 0], handR: [0.5, 0, 0],
    thighL: [-1.35, 0.15, 0.1], shinL: [0.35, 0, 0], footL: [-0.3, 0, 0], thighR: [-1.3, -0.25, -0.1], shinR: [0.6, 0, 0], footR: [-0.2, 0, 0],
  };
  clips.dormant = makeClip('dormant', [
    { t: 0, pose: dormant, hip: [0, 0.17, -0.1] },
    { t: 2.0, pose: merge(dormant, { head: [0.5, 0.05, 0.55], spine: [0.72, 0, 0.1] }), hip: [0, 0.17, -0.1] },
    { t: 2.15, pose: merge(dormant, { head: [0.2, -0.3, 0.2], jaw: [0.6, 0, 0], fArmR: [-0.6, 0, 0] }), hip: [0, 0.17, -0.1] },
    { t: 2.5, pose: dormant, hip: [0, 0.17, -0.1] },
    { t: 4.0, pose: dormant, hip: [0, 0.17, -0.1] },
  ], hipsH);
  clips.getup = makeClip('getup', [
    { t: 0, pose: dormant, hip: [0, 0.17, -0.1] },
    { t: 0.5, pose: merge(stand, { hips: [0.35, 0, 0], spine: [0.8, 0, 0], neck: [-0.3, 0, 0], head: [-0.3, 0, 0], thighL: [-1.9, 0, 0], thighR: [-1.8, 0, 0], shinL: [2.2, 0, 0], shinR: [2.0, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0], uArmL: [-0.7, 0, 0.2], uArmR: [-0.7, 0, -0.2] }), hip: [0, 0.38, 0] },
    { t: 1.2, pose: merge(stand, { spine: [0.6, 0, 0], thighL: [-0.9, 0, 0], thighR: [-0.9, 0, 0], shinL: [1.2, 0, 0], shinR: [1.1, 0, 0], head: [-0.2, 0, 0] }), hip: [0, 0.75, 0] },
    { t: 1.8, pose: stand, hip: [0, 0.99, 0] },
  ], hipsH);
  const scream = merge(stand, { spine: [-0.25, 0, 0], chest: [-0.2, 0, 0], neck: [-0.3, 0, 0], head: [-0.5, 0, 0], jaw: [1.05, 0, 0], uArmL: [-0.5, 0, 1.1], uArmR: [-0.5, 0, -1.1], fArmL: [-0.6, 0, 0], fArmR: [-0.6, 0, 0] });
  clips.scream = makeClip('scream', [
    { t: 0, pose: stand },
    { t: 0.3, pose: scream },
    { t: 0.6, pose: merge(scream, { head: [-0.45, 0, 0.12] }) },
    { t: 0.85, pose: merge(scream, { head: [-0.5, 0, -0.12] }) },
    { t: 1.1, pose: scream },
    { t: 1.4, pose: run0, hip: [0, 0.95, 0] },
  ], hipsH);
  return clips;
}

const clipCache = new Map();
function getClips(type, limp) {
  const key = type + limp;
  if (clipCache.has(key)) return clipCache.get(key);
  const hipsH = TYPES[type].scale * 1.0;
  const c = {
    idle: sampled('idle', 2.8, 16, (p) => idlePose(p, limp), hipsH),
    walk: sampled('walk', 1.5, 16, (p) => walkPose(p, limp), hipsH),
    run: sampled('run', 0.68, 12, runPose, hipsH),
    feed: sampled('feed', 2.0, 16, (p) => {
      const s = Math.sin(TAU * p * 2);
      return { pose: { hips: [0.2, 0, 0], spine: [0.9, 0, 0.05 * s], chest: [0.4, 0, 0], neck: [0.2, 0, 0], head: [0.5 + 0.2 * s, 0.2 * s, 0], jaw: [0.5 + 0.4 * Math.sin(TAU * p * 3), 0, 0], uArmL: [-1.1 + 0.2 * s, 0, 0.2], uArmR: [-1.1 - 0.2 * s, 0, -0.2], fArmL: [-0.8, 0, 0], fArmR: [-0.8, 0, 0], thighL: [-1.75, 0, 0.1], thighR: [-1.75, 0, -0.1], shinL: [2.3, 0, 0], shinR: [2.3, 0, 0], footL: [0.6, 0, 0], footR: [0.6, 0, 0] }, hip: [0, 0.42, 0] };
    }, hipsH),
    ...oneShots(hipsH, limp),
  };
  clipCache.set(key, c);
  return c;
}

/* =========================================================== MODEL */
const geoCache = new Map();
const matCache = new Map();
export function createZombieModel(type, lookIdx, grimeTex) {
  const look = LOOKS[lookIdx % LOOKS.length];
  const key = type + lookIdx;
  let geo = geoCache.get(key);
  if (!geo) { geo = buildBodyGeometry(type, look); geoCache.set(key, geo); }
  let mat = matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grimeTex, bumpMap: grimeTex, bumpScale: 1.2, roughness: 0.8, metalness: 0.0 });
    matCache.set(key, mat);
  }
  const scale = TYPES[type].scale;
  const bones = {};
  const list = [];
  for (const [n, p, o] of BONES) {
    const b = new THREE.Bone(); b.name = n;
    b.position.set(o[0] * scale, o[1] * scale, o[2] * scale);
    bones[n] = b; list.push(b);
    if (p) bones[p].add(b);
  }
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(bones.hips);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  // eyes: milky, faintly glowing — the first thing you see in the dark
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xd8d2b0, emissive: type === 'tank' ? 0xff3010 : 0xaa9a60, emissiveIntensity: type === 'tank' ? 1.8 : 0.9, roughness: 0.2 });
  const hs = scale * (type === 'tank' ? 1.12 : 1);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.016 * hs, 8, 6), eyeMat);
    e.position.set(s * 0.038 * hs, (0.085 + 0.012) * hs, 0.09 * hs);
    bones.head.add(e);
  }
  const root = new THREE.Group();
  root.add(mesh);
  const limp = look.limp && type !== 'runner';
  return { root, mesh, bones, clips: getClips(type, limp), eyeMat };
}

/* ============================================================== AI */
export const ST = { IDLE: 'idle', PATROL: 'patrol', INVESTIGATE: 'investigate', ALERT: 'alert', CHASE: 'chase', ATTACK: 'attack', SEARCH: 'search', RETURN: 'return', DEAD: 'dead', DORMANT: 'dormant', WAKE: 'wake', PHANTOM: 'phantom' };

let ZID = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Zombie {
  constructor(game, type, { pos, ry = 0, look = 0, dormant = false, feed = false, patrol = null, id = null, phantom = false, aggro = false }) {
    this.game = game; this.type = type; this.T = TYPES[type];
    this.id = id || ('z' + ZID++);
    const m = createZombieModel(type, look, game.M.grimeDetail);
    Object.assign(this, m);
    this.pos = this.root.position; this.pos.copy(pos);
    this.root.rotation.y = ry; this.heading = ry;
    game.scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    this.actions = {};
    for (const [k, c] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(c);
      if (['attack', 'hit', 'deathF', 'deathB', 'getup', 'scream'].includes(k)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[k] = a;
    }
    this.hp = this.T.hp; this.maxHp = this.T.hp;
    this.home = pos.clone(); this.patrol = patrol; this.patrolIdx = 0;
    this.path = null; this.pathT = 0; this.target = new THREE.Vector3();
    this.lastKnown = new THREE.Vector3(); this.lostT = 0; this.stateT = 0; this.waitT = 0;
    this.attackHitDone = false; this.stagger = 0; this.speed = 0; this.feed = feed;
    this.seenNoise = 0; this.stuckT = 0; this.lastPos = pos.clone(); this.groanT = 2 + Math.random() * 6;
    this.timeOffset = Math.random() * 5; this.alive = true; this.footT = 0; this.awareness = 0;
    this.cur = null;
    if (phantom) { this.setState(ST.PHANTOM); this.play('idle', 0); }
    else if (dormant) { this.setState(ST.DORMANT); this.play('dormant', 0); }
    else { this.setState(patrol ? ST.PATROL : ST.IDLE); this.play(feed ? 'feed' : 'idle', 0); }
    this.actions[this.cur].time = Math.random() * 2;
    if (aggro) this.alert(true);
  }

  play(name, fade = 0.3, timeScale = 1, force = false) {
    const next = this.actions[name];
    if (this.cur === name && !force) { next.timeScale = timeScale; return; }
    if (this.cur === name) { next.reset(); next.timeScale = timeScale; next.play(); return; }
    next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.timeScale = timeScale;
    if (this.cur && fade > 0) next.crossFadeFrom(this.actions[this.cur], fade, true);
    else if (this.cur) this.actions[this.cur].stop();
    next.play();
    this.cur = name;
  }

  setState(s) { this.state = s; this.stateT = 0; this.path = null; }

  get headPos() { return this.bones.head.getWorldPosition(_c); }

  /* -------------------------------------------------- perception */
  canSeePlayer() {
    const p = this.game.player; if (p.dead) return false;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    let range = this.T.sight + (p.flashlightOn ? 7 : 0);
    if (!p.flashlightOn && p.speed2d < 0.5) range *= 0.55;
    if (d > range) return false;
    if (d > 2.6) {
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      if ((fx * dx + fz * dz) / d < 0.35 && this.state !== ST.CHASE) return false;
    }
    return this.game.world.lineClear(this.pos.x, this.pos.z, p.pos.x, p.pos.z, true);
  }

  hear(n) {
    if (!this.alive || this.state === ST.PHANTOM) return;
    const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z);
    const r = n.r * this.T.hear;
    if (d > r) return;
    // walls muffle sound
    const clear = this.game.world.lineClear(this.pos.x, this.pos.z, n.x, n.z, true);
    if (!clear && d > r * 0.55) return;
    if (this.state === ST.DORMANT) { if (n.type !== 'step' || d < r * 0.6) this.wake(); return; }
    if ([ST.CHASE, ST.ATTACK, ST.ALERT, ST.WAKE].includes(this.state)) return;
    if (n.type === 'shot' && d < r * 0.5) { this.lastKnown.set(n.x, 0, n.z); this.alert(); return; }
    this.lastKnown.set(n.x, 0, n.z);
    this.setState(ST.INVESTIGATE);
    this.target.set(n.x, 0, n.z);
    this.game.audio.zombie(this, 'growl');
  }

  wake() {
    if (this.state !== ST.DORMANT) return;
    this.setState(ST.WAKE); this.play('getup', 0.25);
    this.game.audio.zombie(this, 'growl');
  }

  alert(silent = false) {
    if (!this.alive) return;
    this.lastKnown.copy(this.game.player.pos);
    if (this.T.scream && !silent && this.state !== ST.CHASE) {
      this.setState(ST.ALERT); this.play('scream', 0.2);
      this.game.audio.zombie(this, 'scream');
      this.game.onZombieAlert(this);
    } else {
      this.setState(ST.CHASE);
      if (!silent) this.game.audio.zombie(this, 'growl');
      this.game.onZombieAlert(this);
    }
  }

  /* -------------------------------------------------- damage */
  damage(amount, headshot, hitPoint, dir) {
    if (!this.alive) return;
    this.hp -= amount;
    this.game.fx.blood(hitPoint, dir, headshot ? 26 : 14);
    this.game.audio.play3D('flesh', hitPoint, { vol: 0.8 });
    if (this.hp <= 0) { this.die(dir); return; }
    if (this.state === ST.DORMANT) { this.wake(); return; }
    if (this.type !== 'tank' || amount >= 60) {
      this.stagger = this.type === 'tank' ? 0.25 : (headshot ? 0.55 : 0.38);
      const h = this.actions.hit; h.reset(); h.setEffectiveWeight(this.type === 'tank' ? 0.6 : 1); h.fadeIn(0.05); h.play();
      setTimeout(() => { if (this.alive) h.fadeOut(0.25); }, 220);
    }
    this.game.audio.zombie(this, 'pain');
    if (![ST.CHASE, ST.ATTACK, ST.ALERT, ST.WAKE].includes(this.state)) this.alert(true);
    this.lastKnown.copy(this.game.player.pos); this.lostT = 0;
  }

  die(dir) {
    this.alive = false; this.setState(ST.DEAD);
    this.actions.hit.stop();
    // fall away from the shot
    const fwd = Math.sin(this.heading) * dir.x + Math.cos(this.heading) * dir.z;
    this.play(fwd > 0 ? 'deathF' : 'deathB', 0.15);
    this.game.audio.zombie(this, 'death');
    this.game.onZombieKilled(this);
    this.deadT = 0;
  }

  /* -------------------------------------------------- update */
  update(dt) {
    const g = this.game, p = g.player, w = g.world;
    const distP = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    // LOD: far zombies animate at a lower rate
    const far = distP > 32;
    this.stateT += dt;
    if (!this.alive) {
      this.deadT += dt;
      if (this.deadT < 2.5) this.mixer.update(dt);
      if (this.deadT > 1.2 && !this.pooled) { this.pooled = true; g.fx.bloodPool(this.pos.clone()); }
      return;
    }
    this.root.visible = distP < 45;
    if (far) { this._acc = (this._acc || 0) + dt; if (this._acc > 0.1) { this.mixer.update(this._acc); this._acc = 0; } }
    else this.mixer.update(dt);

    if (this.state === ST.PHANTOM) return;

    if (this.stagger > 0) { this.stagger -= dt; }

    // perception (throttled)
    this.percT = (this.percT || 0) - dt;
    let sees = this.seesCache || false;
    if (this.percT <= 0) {
      this.percT = 0.12 + Math.random() * 0.06;
      sees = this.seesCache = this.state !== ST.DORMANT && this.state !== ST.WAKE && this.canSeePlayer();
    }

    // ambient vocalisation
    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = (this.state === ST.CHASE ? 2.5 : 6) + Math.random() * 6;
      if (distP < 26 && this.state !== ST.DORMANT) g.audio.zombie(this, this.state === ST.CHASE ? 'growl' : 'groan');
    }

    let moveTarget = null, speed = 0, anim = this.feed ? 'feed' : 'idle', animScale = 1;
    const T = this.T;

    switch (this.state) {
      case ST.DORMANT: {
        anim = 'dormant';
        const near = p.flashlightOn && sees ? 7 : 4.2;
        if (distP < near || (distP < 6.5 && p.sprinting)) this.wake();
        break;
      }
      case ST.WAKE:
        anim = 'getup'; animScale = 1.3;
        if (this.stateT > 1.35) this.alert();
        break;
      case ST.IDLE:
        if (sees) { this.alert(); break; }
        if (this.patrol && this.stateT > 3) this.setState(ST.PATROL);
        break;
      case ST.PATROL: {
        if (sees) { this.alert(); break; }
        const wp = this.patrol[this.patrolIdx];
        if (this.waitT > 0) { this.waitT -= dt; break; }
        if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.6) { this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length; this.waitT = 1.5 + Math.random() * 3; this.path = null; break; }
        moveTarget = wp; speed = T.speed; anim = 'walk';
        break;
      }
      case ST.INVESTIGATE:
        if (sees) { this.alert(); break; }
        if (Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 1.0 || this.stateT > 20) { this.setState(ST.SEARCH); this.searchN = 3; break; }
        moveTarget = this.target; speed = this.type === 'runner' ? 2.2 : T.speed * 1.2; anim = 'walk'; animScale = speed / 1.0;
        break;
      case ST.ALERT:
        anim = 'scream';
        this.faceTowards(p.pos, dt, 5);
        if (this.stateT > 1.0) this.setState(ST.CHASE);
        break;
      case ST.CHASE: {
        if (p.dead) { this.setState(ST.RETURN); break; }
        if (sees) { this.lastKnown.copy(p.pos); this.lostT = 0; } else this.lostT += dt;
        if (this.lostT > T.lose) { this.setState(ST.SEARCH); this.searchN = 3; this.target.copy(this.lastKnown); break; }
        if (distP < T.range && sees) { this.setState(ST.ATTACK); this.attackHitDone = false; this.play('attack', 0.12, this.type === 'tank' ? 0.85 : 1.05, true); break; }
        moveTarget = sees ? p.pos : this.lastKnown; speed = T.chase;
        anim = this.type === 'walker' ? 'walk' : 'run';
        animScale = this.type === 'walker' ? 1.5 : (this.type === 'tank' ? 0.8 : 1.05);
        if (!sees && Math.hypot(this.lastKnown.x - this.pos.x, this.lastKnown.z - this.pos.z) < 0.8) { this.setState(ST.SEARCH); this.searchN = 3; this.target.copy(this.lastKnown); }
        break;
      }
      case ST.ATTACK: {
        anim = 'attack';
        this.faceTowards(p.pos, dt, 6);
        const tHit = this.type === 'tank' ? 0.55 : 0.46;
        if (!this.attackHitDone && this.stateT > tHit) {
          this.attackHitDone = true;
          g.audio.zombie(this, 'swing');
          if (distP < T.range + 0.35 && !p.dead) {
            const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
            const dot = (fx * (p.pos.x - this.pos.x) + fz * (p.pos.z - this.pos.z)) / Math.max(distP, 0.01);
            if (dot > 0.3) p.damage(T.dmg * (0.85 + Math.random() * 0.3), this.pos, this.type === 'tank' ? 7 : 2.5);
          }
        }
        if (this.stateT > (this.type === 'tank' ? 1.3 : 1.05)) { this.setState(ST.CHASE); }
        break;
      }
      case ST.SEARCH: {
        if (sees) { this.alert(true); break; }
        if (this.waitT > 0) { this.waitT -= dt; anim = 'idle'; this.heading += Math.sin(this.stateT * 1.3) * dt; break; }
        if (Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 0.8) {
          this.searchN--; this.waitT = 1.5 + Math.random() * 2;
          if (this.searchN <= 0) { this.setState(ST.RETURN); break; }
          const np = w.randomFreePointNear(this.lastKnown.x, this.lastKnown.z, 6);
          if (np) this.target.copy(np); this.path = null;
          break;
        }
        if (this.stateT > 25) { this.setState(ST.RETURN); break; }
        moveTarget = this.target; speed = T.speed * 1.3; anim = 'walk'; animScale = 1.2;
        break;
      }
      case ST.RETURN:
        if (sees) { this.alert(true); break; }
        if (Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z) < 0.8 || this.stateT > 40) { this.setState(this.patrol ? ST.PATROL : ST.IDLE); break; }
        moveTarget = this.home; speed = T.speed; anim = 'walk';
        break;
    }

    if (this.stagger > 0) speed *= 0.1;
    if (moveTarget && speed > 0) this.moveTo(moveTarget, speed, dt, this.state === ST.CHASE && sees && distP < 14);
    else this.speed = 0;
    if (anim !== this.cur && !(this.state === ST.ATTACK && this.cur === 'attack')) {
      this.play(anim, anim === 'run' ? 0.2 : 0.35, animScale);
    } else if (this.actions[this.cur]) this.actions[this.cur].timeScale = animScale;

    // footsteps of runners/tank are audible and readable
    if (this.speed > 0.5) {
      this.footT -= dt * this.speed;
      if (this.footT <= 0) { this.footT = this.type === 'tank' ? 1.3 : 0.75; if (distP < 22) g.audio.play3D(this.type === 'tank' ? 'stomp' : 'zstep', this.pos, { vol: this.type === 'runner' ? 0.9 : 0.6, rate: 0.9 + Math.random() * 0.2 }); }
    }
  }

  faceTowards(t, dt, rate) {
    const want = Math.atan2(t.x - this.pos.x, t.z - this.pos.z);
    let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += Math.max(-rate * dt, Math.min(rate * dt, d));
    this.root.rotation.y = this.heading;
  }

  moveTo(target, speed, dt, direct) {
    const w = this.game.world;
    // path planning (direct steering when the line is clear)
    let aim = target;
    const clear = direct || w.lineClear(this.pos.x, this.pos.z, target.x, target.z, false);
    if (!clear) {
      this.pathT -= dt;
      if (!this.path || this.pathT <= 0 || (this.pathGoal && this.pathGoal.distanceTo(target) > 1.5)) {
        this.path = w.findPath(this.pos.x, this.pos.z, target.x, target.z);
        this.pathGoal = target.clone(); this.pathT = 0.6 + Math.random() * 0.3;
      }
      if (this.path && this.path.length) {
        while (this.path.length > 1 && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < 0.45) this.path.shift();
        aim = this.path[0];
      }
    } else this.path = null;

    const dx = aim.x - this.pos.x, dz = aim.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.speed = 0; return; }
    this.faceTowards(aim, dt, this.type === 'runner' ? 7 : 3.5);
    // accelerate, slower when turning hard
    const want = Math.atan2(dx, dz); let diff = Math.abs(Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)));
    const sp = speed * (diff > 1.2 ? 0.25 : 1 - diff * 0.4);
    this.speed += (sp - this.speed) * Math.min(1, dt * 4);
    const step = Math.min(d, this.speed * dt);
    this.pos.x += Math.sin(this.heading) * step; this.pos.z += Math.cos(this.heading) * step;

    // open unlocked doors in the way (with a bang)
    const ahead = w.navIdx(this.pos.x + Math.sin(this.heading) * 0.9, this.pos.z + Math.cos(this.heading) * 0.9);
    if (ahead >= 0 && w.navDoor[ahead] >= 0) {
      const door = w.doors[w.navDoor[ahead]];
      if (!door.locked && door.target === 0) { w.setDoorOpen(door, true, this.pos); this.game.audio.play3D('doorBang', door.pos, { vol: 1 }); this.game.emitNoise(door.pos.x, door.pos.z, 8, 'door', this); }
    }
    // separation from other infected
    for (const o of this.game.zombies) {
      if (o === this || !o.alive || o.state === ST.PHANTOM) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, od = Math.hypot(ox, oz), min = this.T.radius + o.T.radius;
      if (od < min && od > 0.001) { const push = (min - od) * 0.5; this.pos.x += ox / od * push; this.pos.z += oz / od * push; }
    }
    w.collide(this.pos, this.T.radius, 0);
    // keep out of the player
    const p = this.game.player;
    const px = this.pos.x - p.pos.x, pz = this.pos.z - p.pos.z, pd = Math.hypot(px, pz), pmin = this.T.radius + 0.33;
    if (pd < pmin && pd > 0.001) { this.pos.x += px / pd * (pmin - pd); this.pos.z += pz / pd * (pmin - pd); }

    // stuck recovery
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      if (this.pos.distanceTo(this.lastPos) < 0.15 && this.speed > 0.2) { this.path = null; this.pathT = 0; const np = w.randomFreePointNear(this.pos.x, this.pos.z, 1.5); if (np) { this.pos.x += (np.x - this.pos.x) * 0.3; this.pos.z += (np.z - this.pos.z) * 0.3; } }
      this.lastPos.copy(this.pos); this.stuckT = 0;
    }
  }

  /* ----------------------------------------------- shot detection */
  // Returns {t, head} if the ray hits this zombie.
  rayHit(o, d, maxT) {
    if (!this.alive) return null;
    const head = this.bones.head.getWorldPosition(_a).add(_b.set(0, 0.085 * this.T.scale, 0));
    const hr = 0.135 * this.T.scale * (this.type === 'tank' ? 1.1 : 1);
    let best = null;
    const th = raySphere(o, d, head, hr);
    if (th !== null && th < maxT) best = { t: th, head: true };
    const hips = this.bones.hips.getWorldPosition(new THREE.Vector3());
    const neck = this.bones.neck.getWorldPosition(new THREE.Vector3());
    const tb = rayCapsule(o, d, hips, neck, 0.24 * this.T.scale * this.T.bulk);
    if (tb !== null && tb < maxT && (!best || tb < best.t - 0.05)) best = { t: tb, head: false };
    const fl = this.bones.footL.getWorldPosition(new THREE.Vector3()), fr = this.bones.footR.getWorldPosition(new THREE.Vector3());
    const tl = rayCapsule(o, d, hips, fl.add(fr).multiplyScalar(0.5), 0.2 * this.T.scale * this.T.bulk);
    if (tl !== null && tl < maxT && (!best || tl < best.t)) best = { t: tl, head: false, leg: true };
    const hl = this.bones.handL.getWorldPosition(new THREE.Vector3()), hrr = this.bones.handR.getWorldPosition(new THREE.Vector3());
    const ta = rayCapsule(o, d, hl, hrr, 0.08 * this.T.scale * this.T.bulk);
    if (ta !== null && ta < maxT && (!best || ta < best.t)) best = { t: ta, head: false, arm: true };
    return best;
  }

  dispose() {
    this.game.scene.remove(this.root);
    this.mixer.stopAllAction();
    this.eyeMat.dispose();
  }
}

function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc); return t > 0 ? t : null;
}
// approximate ray-capsule: closest distance between ray and segment
function rayCapsule(o, d, a, b, r) {
  const u = d, v = new THREE.Vector3().subVectors(b, a), w0 = new THREE.Vector3().subVectors(o, a);
  const A = u.dot(u), B = u.dot(v), C = v.dot(v), D = u.dot(w0), E = v.dot(w0);
  const den = A * C - B * B;
  let sc, tc;
  if (den < 1e-8) { sc = 0; tc = B > C ? D / B : E / C; }
  else { sc = (B * E - C * D) / den; tc = (A * E - B * D) / den; }
  tc = Math.max(0, Math.min(1, tc));
  sc = Math.max(0, (tc * B - D) / A);
  const p1 = o.clone().addScaledVector(u, sc), p2 = a.clone().addScaledVector(v, tc);
  if (p1.distanceTo(p2) > r) return null;
  return sc;
}
