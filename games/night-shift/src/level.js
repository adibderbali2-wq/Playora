// World construction + spatial queries (collision, line of sight, raycasts, A*).
// The building is a grid of 3 m cells grouped into rooms; walls are thin slabs on
// the edges between different rooms, so rooms connect through real doorways.
import * as THREE from 'three';
import { GeoBatch, Builder } from './props.js';
import { rng } from './textures.js';

export const S = 3;          // cell size (m)
export const CEIL = 3.2;     // ceiling height
export const NAV = 0.5;      // nav grid resolution
const NAVK = S / NAV;

export const cellCenter = (x, z) => new THREE.Vector3((x + 0.5) * S, 0, (z + 0.5) * S);

export class World {
  constructor(scene, M, layout) {
    this.scene = scene; this.M = M; this.L = layout;
    this.W = layout.W; this.H = layout.H;
    this.solids = [];        // {minx,minz,maxx,maxz,h, kind}
    this.cellSolids = new Map();
    this.doors = []; this.doorById = {};
    this.fixtures = [];
    this.group = new THREE.Group(); scene.add(this.group);
    this.cells = new Array(this.W * this.H).fill(null);
    this.zone = new Array(this.W * this.H).fill(null);
    for (const [id, r] of Object.entries(layout.rooms)) {
      for (const rect of r.rects) {
        const [x0, z0, w, h] = rect;
        for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + h; z++) { this.cells[z * this.W + x] = id; this.zone[z * this.W + x] = r.zone; }
      }
    }
    this.edgeFeat = new Map();
    for (const d of layout.doors) this.edgeFeat.set(this.edgeKey(d.cell[0], d.cell[1], d.side), { kind: d.type === 'opening' ? 'opening' : 'door', def: d });
    for (const w of layout.windows) this.edgeFeat.set(this.edgeKey(w[0], w[1], w[2]), { kind: 'window' });
    this.wallOverride = new Map((layout.wallOverrides || []).map(([x, z, side, mat]) => [`${x},${z},${side}`, mat]));
    this.batch = new GeoBatch();
    this.b = new Builder(this.batch, this);
    this._stamp = 0;
  }

  room(x, z) { return (x < 0 || z < 0 || x >= this.W || z >= this.H) ? null : this.cells[z * this.W + x]; }
  zoneAt(x, z) { return (x < 0 || z < 0 || x >= this.W || z >= this.H) ? null : this.zone[z * this.W + x]; }
  roomAtWorld(px, pz) { return this.room(Math.floor(px / S), Math.floor(pz / S)); }

  edgeKey(x, z, side) {
    if (side === 'N') return `h${x},${z}`;
    if (side === 'S') return `h${x},${z + 1}`;
    if (side === 'W') return `v${x},${z}`;
    return `v${x + 1},${z}`;
  }

  addSolid(minx, minz, maxx, maxz, h = CEIL, kind = 'prop') {
    const s = { minx, minz, maxx, maxz, h, kind, id: this.solids.length, enabled: true, stamp: 0 };
    this.solids.push(s);
    const cx0 = Math.floor(minx / S), cx1 = Math.floor(maxx / S), cz0 = Math.floor(minz / S), cz1 = Math.floor(maxz / S);
    for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) {
      const k = z * 1000 + x; let l = this.cellSolids.get(k); if (!l) this.cellSolids.set(k, l = []); l.push(s);
    }
    return s;
  }

  wallMat(roomId, x, z, side) {
    const o = this.wallOverride.get(`${x},${z},${side}`);
    if (o) return this.M[o];
    const zone = this.L.rooms[roomId].zone;
    return this.M[this.L.zoneWall[zone]] || this.M.wallWard;
  }

  /* ------------------------------------------------------------ build */
  build() {
    const { M, b } = this;
    const W = this.W, H = this.H;
    const floorGeo = new THREE.PlaneGeometry(S, S);
    // floors & ceilings
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const r = this.room(x, z); if (!r) continue;
      const zone = this.L.rooms[r].zone;
      b.at((x + 0.5) * S, (z + 0.5) * S);
      b.place(floorGeo, M[this.L.zoneFloor[zone]] || M.floorWard, 0, 0, 0, -Math.PI / 2, 0, 0);
      b.place(floorGeo, (zone === 'containment' || zone === 'generator' || zone === 'storage') ? M.ceilingDark : M.ceiling, 0, CEIL, 0, Math.PI / 2, 0, 0);
    }
    const vertexHasWall = new Set();
    // horizontal edges
    for (let z = 0; z <= H; z++) for (let x = 0; x < W; x++) {
      const a = this.room(x, z - 1), c = this.room(x, z);
      if (a === c) continue;
      this.buildEdge('h', x, z, a, c);
      vertexHasWall.add(`${x},${z}`); vertexHasWall.add(`${x + 1},${z}`);
    }
    for (let x = 0; x <= W; x++) for (let z = 0; z < H; z++) {
      const a = this.room(x - 1, z), c = this.room(x, z);
      if (a === c) continue;
      this.buildEdge('v', x, z, a, c);
      vertexHasWall.add(`${x},${z}`); vertexHasWall.add(`${x},${z + 1}`);
    }
    // corner pillars close the seams where thin walls meet
    for (const k of vertexHasWall) {
      const [x, z] = k.split(',').map(Number);
      let anyFloor = false;
      for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (this.room(x + dx, z + dz)) anyFloor = true;
      if (!anyFloor) continue;
      // which of the 4 edges meeting at this vertex carry a wall
      const wE = this.room(x, z - 1) !== this.room(x, z), wW = this.room(x - 1, z - 1) !== this.room(x - 1, z);
      const wS = this.room(x - 1, z) !== this.room(x, z), wN = this.room(x - 1, z - 1) !== this.room(x, z - 1);
      const n = wE + wW + wS + wN;
      if (n === 2 && ((wE && wW) || (wN && wS))) continue; // straight run of wall: no seam to hide
      b.at(x * S, z * S);
      b.box(M.wallStorage, 0, CEIL / 2, 0, 0.24, CEIL, 0.24);
    }
  }

  buildEdge(dir, x, z, a, c) {
    const { M, b } = this;
    const feat = this.edgeFeat.get(`${dir}${x},${z}`);
    // frame: centre of edge, local +z points toward cell "c"
    let cx, cz, ry;
    if (dir === 'h') { cx = (x + 0.5) * S; cz = z * S; ry = 0; }
    else { cx = x * S; cz = (z + 0.5) * S; ry = Math.PI / 2; }
    // which grid cells are on each side (for materials)
    const cCell = dir === 'h' ? [x, z, 'N'] : [x, z, 'W'];
    const aCell = dir === 'h' ? [x, z - 1, 'S'] : [x - 1, z, 'E'];
    const matC = c ? this.wallMat(c, ...cCell) : null;
    const matA = a ? this.wallMat(a, ...aCell) : null;

    let holeW = 0, holeY0 = 0, holeY1 = 0;
    if (feat && feat.kind === 'door') { holeW = feat.def.type === 'double' || feat.def.type === 'exit' ? 1.8 : 1.2; holeY1 = 2.25; }
    if (feat && feat.kind === 'opening') { holeW = 1.9; holeY1 = 2.4; }
    if (feat && feat.kind === 'window') { holeW = 1.8; holeY0 = 0.9; holeY1 = 2.3; }

    const face = (mat, side) => {
      if (!mat) return;
      const zOff = side * 0.1, rot = side > 0 ? 0 : Math.PI;
      b.at(cx, cz, ry);
      const seg = (u0, u1, y0, y1) => {
        if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
        const g = wallQuad(u0, u1, y0, y1);
        // local x of the segment centre; back face mirrors x
        const lx = (u0 + u1) / 2 - S / 2;
        b.place(g, mat, side > 0 ? lx : -lx, (y0 + y1) / 2, zOff, 0, rot, 0);
      };
      if (!holeW) { seg(0, S, 0, CEIL); return; }
      const h0 = S / 2 - holeW / 2, h1 = S / 2 + holeW / 2;
      // mirror u for back side so the hole stays aligned
      seg(0, h0, 0, CEIL); seg(h1, S, 0, CEIL);
      seg(h0, h1, holeY1, CEIL);
      if (holeY0 > 0) seg(h0, h1, 0, holeY0);
    };
    face(matC, +1);
    face(matA, -1);

    // collision slabs
    const T = 0.13;
    const addSlab = (u0, u1, y = CEIL) => {
      if (u1 - u0 <= 0) return;
      if (dir === 'h') this.addSolid(x * S + u0, z * S - T, x * S + u1, z * S + T, y, 'wall');
      else this.addSolid(x * S - T, z * S + u0, x * S + T, z * S + u1, y, 'wall');
    };
    if (!holeW || (feat && feat.kind === 'window')) addSlab(0, S);
    else { addSlab(0, S / 2 - holeW / 2); addSlab(S / 2 + holeW / 2, S); }

    b.at(cx, cz, ry);
    if (feat && (feat.kind === 'door' || feat.kind === 'opening')) {
      const trim = feat.kind === 'door' && (feat.def.type === 'metal' || feat.def.type === 'exit') ? M.metalDark : M.wood;
      for (const s of [-1, 1]) b.box(trim, s * (holeW / 2 + 0.04), holeY1 / 2, 0, 0.1, holeY1, 0.3);
      b.box(trim, 0, holeY1 + 0.05, 0, holeW + 0.18, 0.1, 0.3);
      if (feat.kind === 'door') this.makeDoor(feat.def, cx, cz, ry, holeW, holeY1, dir, a, c);
    }
    if (feat && feat.kind === 'window') {
      const outSide = c ? -1 : 1; // void side
      for (const s of [-1, 1]) b.box(M.metalDark, s * (holeW / 2 + 0.03), (holeY0 + holeY1) / 2, 0, 0.06, holeY1 - holeY0, 0.28);
      b.box(M.metalDark, 0, holeY0 - 0.03, 0, holeW + 0.1, 0.06, 0.34);
      b.box(M.metalDark, 0, holeY1 + 0.03, 0, holeW + 0.1, 0.06, 0.28);
      b.box(M.metalDark, 0, (holeY0 + holeY1) / 2, 0, 0.04, holeY1 - holeY0, 0.06);
      for (let i = 0; i < 6; i++) b.cyl(M.metalRust, -holeW / 2 + 0.15 + i * (holeW - 0.3) / 5, (holeY0 + holeY1) / 2, outSide * 0.12, 0.015, 0.015, holeY1 - holeY0, 6);
      // shattered glass remains + shards on the floor
      for (let i = 0; i < 5; i++) b.box(M.brokenGlass, rnd(-0.7, 0.7), holeY0 + rnd(0.05, 0.3), 0, rnd(0.1, 0.35), rnd(0.15, 0.4), 0.01, 0, 0, rnd(-0.5, 0.5));
      for (let i = 0; i < 4; i++) b.box(M.brokenGlass, rnd(-0.6, 0.6), holeY1 - rnd(0.05, 0.3), 0, rnd(0.1, 0.3), rnd(0.15, 0.35), 0.01, 0, 0, rnd(-0.5, 0.5));
      for (let i = 0; i < 7; i++) b.box(M.brokenGlass, rnd(-1, 1), 0.01, -outSide * rnd(0.3, 1.2), rnd(0.05, 0.2), 0.004, rnd(0.05, 0.2), 0, rnd(0, 3), 0);
      // night sky backdrop behind the bars
      b.plane(M.sky, 0, (holeY0 + holeY1) / 2, outSide * 1.2, holeW + 1.5, 2.2, 0, outSide > 0 ? Math.PI : 0, 0);
      // moonlight pool on the floor inside
      b.plane(M.moonPool, 0, 0.02, -outSide * 1.3, 2.4, 2.6, -Math.PI / 2, 0, 0);
    }
  }

  makeDoor(def, cx, cz, ry, holeW, holeH, dir, a, c) {
    const M = this.M;
    const root = new THREE.Group(); root.position.set(cx, 0, cz); root.rotation.y = ry;
    this.group.add(root);
    const leaves = [];
    const mkLeaf = (w, hingeX, sign) => {
      const pivot = new THREE.Group(); pivot.position.set(hingeX, 0, 0); root.add(pivot);
      const mat = def.type === 'metal' ? M.metalDark : def.type === 'exit' ? M.redLight : def.type === 'double' ? M.doorPaint : M.woodDoor;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, holeH - 0.02, 0.06), mat);
      slab.position.set(sign * w / 2, holeH / 2, 0); slab.castShadow = slab.receiveShadow = true; pivot.add(slab);
      // handle + kick plate + window
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), M.chrome);
      h.position.set(sign * (w - 0.12), 1.0, 0); pivot.add(h);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.25, 0.07), M.metal);
      kick.position.set(sign * w / 2, 0.15, 0); pivot.add(kick);
      if (def.type === 'double' || def.type === 'wood') {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.07), M.glass);
        win.position.set(sign * w / 2, 1.6, 0); pivot.add(win);
      }
      if (def.type === 'exit') {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.08, 0.1), M.chrome);
        bar.position.set(sign * w / 2, 1.05, 0.05); pivot.add(bar);
      }
      leaves.push({ pivot, sign });
    };
    if (def.type === 'double' || def.type === 'exit') { mkLeaf(holeW / 2, -holeW / 2, 1); mkLeaf(holeW / 2, holeW / 2, -1); }
    else mkLeaf(holeW, -holeW / 2, 1);
    if (def.chained) {
      const ch = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10), M.chrome);
        l.position.set(-0.4 + i * 0.1, 1.05 + Math.sin(i * 0.7) * 0.06, (c ? 1 : -1) * 0.08); l.rotation.y = i % 2 ? Math.PI / 2 : 0; ch.add(l);
      }
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), M.metalRust); lock.position.set(0, 0.95, (c ? 1 : -1) * 0.1); ch.add(lock);
      root.add(ch);
    }
    // collision slab while closed
    const T = 0.1;
    let solid;
    if (dir === 'h') solid = this.addSolid(cx - holeW / 2, cz - T, cx + holeW / 2, cz + T, CEIL, 'door');
    else solid = this.addSolid(cx - T, cz - holeW / 2, cx + T, cz + holeW / 2, CEIL, 'door');
    const door = {
      id: def.id, def, root, leaves, solid, open: 0, target: 0, dir, holeW,
      locked: !!def.key || !!def.sealed, key: def.key, sealed: !!def.sealed, label: def.label || 'Door',
      pos: new THREE.Vector3(cx, 1.1, cz), swingSign: 1, speed: 1.8, cell: def.cell,
    };
    this.doors.push(door); this.doorById[def.id] = door;
    return door;
  }

  setDoorOpen(door, open, fromPos) {
    if (open && fromPos && door.target === 0) {
      // swing away from whoever opened it
      const local = door.root.worldToLocal(fromPos.clone());
      door.swingSign = local.z > 0 ? -1 : 1;
    }
    door.target = open ? 1 : 0;
  }

  updateDoors(dt) {
    for (const d of this.doors) {
      if (d.open !== d.target) {
        const sp = d.speed * dt;
        d.open = d.target > d.open ? Math.min(d.target, d.open + sp) : Math.max(d.target, d.open - sp);
        const e = d.open < 1 ? 1 - Math.pow(1 - d.open, 2) : 1;
        for (const l of d.leaves) l.pivot.rotation.y = -l.sign * d.swingSign * e * 1.75;
      }
      d.solid.enabled = d.open < 0.6;
    }
  }

  /* ------------------------------------------------------------ lights */
  addFixture(x, z, { state = 'on', color = 0xdfeeff, intensity = 5.5, range = 11, kind = 'tube', hang = false } = {}) {
    const M = this.M;
    const g = new THREE.Group(); g.position.set(x, CEIL, z);
    const mat = state === 'dead' ? M.tubeOff : (kind === 'red' ? M.redLight.clone() : kind === 'bulb' ? M.lampWarm.clone() : M.tubeOn.clone());
    if (kind === 'tube') {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.34), M.metalDark); housing.position.y = -0.04;
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.22), mat); tube.position.y = -0.09;
      g.add(housing, tube);
      if (hang) { g.rotation.z = 0.5; g.position.y -= 0.45; }
    } else if (kind === 'bulb') {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 4), M.rubber); cord.position.y = -0.3;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat); bulb.position.y = -0.62;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 14, 1, true), M.metalDark); shade.position.y = -0.56;
      g.add(cord, bulb, shade);
    } else { // red emergency light on the wall-top
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.14), mat); box.position.y = -0.2; g.add(box);
    }
    g.children.forEach((m) => { m.castShadow = false; });
    this.group.add(g);
    const f = { pos: new THREE.Vector3(x, CEIL - 0.25, z), mesh: g, mat, state, color: new THREE.Color(color), base: intensity, range, level: state === 'dead' ? 0 : 1, kind, phase: rng() * 100, emissiveBase: mat.emissiveIntensity || 0 };
    this.fixtures.push(f);
    if (state !== 'dead') this.b.at(x, z), this.b.plane(M.lightPool, 0, 0.02, 0, range * 0.45, range * 0.45, -Math.PI / 2, 0, 0);
    return f;
  }

  updateFixtures(t, dt) {
    for (const f of this.fixtures) {
      let L = 0;
      if (f.state === 'on') L = 1;
      else if (f.state === 'flicker') {
        const n = Math.sin(t * 13 + f.phase) + Math.sin(t * 31.7 + f.phase * 2) + Math.sin(t * 2.1 + f.phase);
        L = n > 1.2 ? 0.05 : (n > -0.5 ? 1 : 0.6);
        if (Math.sin(t * 0.7 + f.phase) > 0.75) L *= (Math.random() < 0.5 ? 0 : 1);
      } else if (f.state === 'strobe') L = (Math.sin(t * 9 + f.phase) > 0.6) ? 1 : 0.02;
      else if (f.state === 'pulse') L = 0.35 + 0.65 * Math.max(0, Math.sin(t * 3.2 + f.phase));
      f.level = L;
      if (f.mat.emissiveIntensity !== undefined && f.state !== 'dead') f.mat.emissiveIntensity = f.emissiveBase * (0.05 + L);
    }
  }

  /* ------------------------------------------------------------ queries */
  nearSolids(px, pz, r, out) {
    out.length = 0; const st = ++this._stamp;
    const x0 = Math.floor((px - r) / S), x1 = Math.floor((px + r) / S), z0 = Math.floor((pz - r) / S), z1 = Math.floor((pz + r) / S);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const l = this.cellSolids.get(z * 1000 + x); if (!l) continue;
      for (const s of l) if (s.stamp !== st) { s.stamp = st; out.push(s); }
    }
    return out;
  }

  // Resolve a vertical cylinder against static + door colliders. Mutates pos.
  collide(pos, r, feetY = 0, list = this._tmpList || (this._tmpList = [])) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      this.nearSolids(pos.x, pos.z, r + 0.5, list);
      let moved = false;
      for (const s of list) {
        if (!s.enabled || feetY > s.h - 0.05) continue;
        const nx = Math.max(s.minx, Math.min(pos.x, s.maxx));
        const nz = Math.max(s.minz, Math.min(pos.z, s.maxz));
        let dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-8) {
          // centre inside box: push along smallest axis
          const l = pos.x - s.minx, rr2 = s.maxx - pos.x, u = pos.z - s.minz, dd = s.maxz - pos.z;
          const m = Math.min(l, rr2, u, dd);
          if (m === l) pos.x = s.minx - r; else if (m === rr2) pos.x = s.maxx + r; else if (m === u) pos.z = s.minz - r; else pos.z = s.maxz + r;
        } else {
          const d = Math.sqrt(d2), push = r - d;
          pos.x += dx / d * push; pos.z += dz / d * push;
        }
        moved = hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  // Ray vs every AABB (3D: y 0..h) + floor/ceiling. Returns {t, normal, solid}
  raycast(o, d, maxT = 60) {
    let best = maxT, nrm = new THREE.Vector3(), bestS = null;
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t < best) { best = t; nrm.set(0, 1, 0); bestS = 'floor'; } }
    if (d.y > 1e-6) { const t = (CEIL - o.y) / d.y; if (t < best) { best = t; nrm.set(0, -1, 0); bestS = 'ceil'; } }
    for (const s of this.solids) {
      if (!s.enabled) continue;
      let tmin = 0, tmax = best, axis = -1, sign = 0;
      const test = (oo, dd, mn, mx, ax) => {
        if (Math.abs(dd) < 1e-9) return oo >= mn && oo <= mx;
        let t1 = (mn - oo) / dd, t2 = (mx - oo) / dd, sg = -1;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; }
        if (t1 > tmin) { tmin = t1; axis = ax; sign = sg; }
        if (t2 < tmax) tmax = t2;
        return tmin <= tmax;
      };
      if (!test(o.x, d.x, s.minx, s.maxx, 0)) continue;
      if (!test(o.y, d.y, 0, s.h, 1)) continue;
      if (!test(o.z, d.z, s.minz, s.maxz, 2)) continue;
      if (tmin < best && tmin > 0) {
        best = tmin; bestS = s;
        nrm.set(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0);
      }
    }
    return { t: best, normal: nrm, solid: bestS };
  }

  /* ----------------------------------------------------- nav + sight */
  buildNav() {
    const NW = this.W * NAVK, NH = this.H * NAVK;
    this.NW = NW; this.NH = NH;
    this.navBlock = new Uint8Array(NW * NH);   // 1 = static block
    this.navDoor = new Int16Array(NW * NH).fill(-1);
    this.sightBlock = new Uint8Array(NW * NH);
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const px = (i + 0.5) * NAV, pz = (j + 0.5) * NAV;
      if (!this.roomAtWorld(px, pz)) { this.navBlock[j * NW + i] = 1; this.sightBlock[j * NW + i] = 1; }
    }
    const R = 0.3;
    for (const s of this.solids) {
      const isDoor = s.kind === 'door';
      const tall = s.h > 1.6;
      const i0 = Math.max(0, Math.floor((s.minx - R) / NAV)), i1 = Math.min(NW - 1, Math.floor((s.maxx + R) / NAV));
      const j0 = Math.max(0, Math.floor((s.minz - R) / NAV)), j1 = Math.min(NH - 1, Math.floor((s.maxz + R) / NAV));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * NAV, pz = (j + 0.5) * NAV;
        const inside = px > s.minx - R && px < s.maxx + R && pz > s.minz - R && pz < s.maxz + R;
        if (!inside) continue;
        const k = j * NW + i;
        if (isDoor) { if (!this.navBlock[k]) this.navDoor[k] = this.doors.findIndex((d) => d.solid === s); }
        else this.navBlock[k] = 1;
        const tight = px > s.minx - 0.25 && px < s.maxx + 0.25 && pz > s.minz - 0.25 && pz < s.maxz + 0.25;
        if (tall && tight && !isDoor) this.sightBlock[k] = 1;
      }
    }
    // door cells that also touch a wall stay blocked; clear door marks from blocked cells
    for (let k = 0; k < NW * NH; k++) if (this.navBlock[k]) this.navDoor[k] = -1;
  }

  navIdx(px, pz) {
    const i = Math.floor(px / NAV), j = Math.floor(pz / NAV);
    if (i < 0 || j < 0 || i >= this.NW || j >= this.NH) return -1;
    return j * this.NW + i;
  }
  navFree(k, ai = true) {
    if (k < 0 || this.navBlock[k]) return false;
    const d = this.navDoor[k];
    if (d >= 0) { const door = this.doors[d]; if (ai ? (door.locked && door.open < 0.6) : door.open < 0.6) return false; }
    return true;
  }
  sightFree(k) {
    if (k < 0 || this.sightBlock[k]) return false;
    const d = this.navDoor[k];
    if (d >= 0 && this.doors[d].open < 0.4) return false;
    return true;
  }

  lineClear(ax, az, bx, bz, sight = true) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const n = Math.ceil(L / 0.2);
    for (let s = 1; s < n; s++) {
      const t = s / n, k = this.navIdx(ax + dx * t, az + dz * t);
      if (sight ? !this.sightFree(k) : !this.navFree(k)) return false;
    }
    return true;
  }

  // A* on the nav grid (8-connected). Returns array of Vector3 waypoints.
  findPath(ax, az, bx, bz, maxNodes = 7000) {
    const NW = this.NW;
    let s = this.navIdx(ax, az), g = this.navIdx(bx, bz);
    if (s < 0 || g < 0) return null;
    if (!this.navFree(g)) g = this.nearestFree(g); if (g < 0) return null;
    if (!this.navFree(s)) s = this.nearestFree(s); if (s < 0) return null;
    const N = this.NW * this.NH;
    if (!this._g || this._g.length !== N) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._seen = new Uint32Array(N); this._closed = new Uint32Array(N); this._gen = 0; }
    const gen = ++this._gen;
    const G = this._g, F = this._from, seen = this._seen, closed = this._closed;
    const gx = g % NW, gz = (g / NW) | 0;
    const h = (k) => { const x = k % NW, z = (k / NW) | 0, dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz); };
    const heap = new MinHeap();
    G[s] = 0; seen[s] = gen; F[s] = -1; heap.push(s, h(s));
    let expanded = 0, found = false;
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1], C = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue; closed[cur] = gen;
      if (cur === g) { found = true; break; }
      if (++expanded > maxNodes) break;
      const cx = cur % NW, cz = (cur / NW) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], nz = cz + DZ[d];
        if (nx < 0 || nz < 0 || nx >= NW || nz >= this.NH) continue;
        const nk = nz * NW + nx;
        if (!this.navFree(nk)) continue;
        if (d >= 4 && (!this.navFree(cz * NW + nx) || !this.navFree(nz * NW + cx))) continue; // no corner cutting
        const ng = G[cur] + C[d];
        if (seen[nk] !== gen || ng < G[nk]) { seen[nk] = gen; G[nk] = ng; F[nk] = cur; heap.push(nk, ng + h(nk)); }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let k = g; k !== -1; k = F[k]) raw.push(k);
    raw.reverse();
    // string-pull
    const pts = raw.map((k) => new THREE.Vector3((k % NW + 0.5) * NAV, 0, (((k / NW) | 0) + 0.5) * NAV));
    const out = [pts[0]];
    let anchor = pts[0];
    for (let i = 2; i < pts.length; i++) {
      if (!this.lineClear(anchor.x, anchor.z, pts[i].x, pts[i].z, false)) { anchor = pts[i - 1]; out.push(anchor); }
    }
    out.push(pts[pts.length - 1]);
    out.shift();
    return out;
  }

  nearestFree(k) {
    const NW = this.NW, x = k % NW, z = (k / NW) | 0;
    for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= NW || nz >= this.NH) continue;
      const nk = nz * NW + nx; if (this.navFree(nk)) return nk;
    }
    return -1;
  }

  randomFreePointNear(px, pz, radius) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const k = this.navIdx(x, z);
      if (this.navFree(k) && this.roomAtWorld(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  finalize() {
    this.staticMeshes = this.batch.build(this.group);
  }
}

function rnd(a, b) { return a + rng() * (b - a); }

const quadCache = new Map();
function wallQuad(u0, u1, y0, y1) {
  const key = [u0, u1, y0, y1].map((n) => Math.round(n * 1000)).join(',');
  let g = quadCache.get(key);
  if (g) return g;
  g = new THREE.PlaneGeometry(u1 - u0, y1 - y0);
  const uv = g.attributes.uv;
  // PlaneGeometry uv order: (0,1),(1,1),(0,0),(1,0)
  const U0 = u0 / S, U1 = u1 / S, V0 = y0 / CEIL, V1 = y1 / CEIL;
  uv.setXY(0, U0, V1); uv.setXY(1, U1, V1); uv.setXY(2, U0, V0); uv.setXY(3, U1, V0);
  quadCache.set(key, g);
  return g;
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p; k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) { const pa = (i - 1) >> 1; if (p[pa] <= p[i]) break; [k[pa], k[i]] = [k[i], k[pa]]; [p[pa], p[i]] = [p[i], p[pa]]; i = pa; }
  }
  pop() {
    const k = this.k, p = this.p; const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]]; i = m;
      }
    }
    return top;
  }
}
