// First-person player: movement/collision, flashlight, hands + pistol viewmodel.
import * as THREE from 'three';
import { CEIL } from './level.js';

const EYE = 1.62, RADIUS = 0.32;
const WALK = 3.0, SPRINT = 5.7, ACCEL = 14, AIR = 3, GRAV = 22, JUMP = 6.0;
export const MAG = 12, MAX_RESERVE = 90;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.onGround = true;
    this.cam = game.camera;
    this.reset();
    this.buildFlashlight();
    this.vm = new ViewModel(game);
  }

  reset() {
    this.health = 100; this.stamina = 100; this.battery = 100;
    this.flashlightOn = false; this.hasFlashlight = false; this.hasPistol = false;
    this.ammo = 0; this.reserve = 0; this.medkits = 0;
    this.keys = new Set(); this.docs = new Set(); this.items = new Set();
    this.dead = false; this.exhausted = false; this.staminaDelay = 0;
    this.bobT = 0; this.stepDist = 0; this.landT = 0; this.shake = 0; this.hurtT = 0; this.recoil = 0; this.recoilYaw = 0;
    this.reloading = 0; this.fireCd = 0; this.speed2d = 0; this.sprinting = false; this.flickerT = 0;
    this.deathT = 0; this.wakeT = 0; this.lightLevel = 0;
    this.vel.set(0, 0, 0);
  }

  snapshot() {
    return {
      pos: [this.pos.x, this.pos.z], yaw: this.yaw, health: this.health, battery: this.battery,
      hasFlashlight: this.hasFlashlight, hasPistol: this.hasPistol, ammo: this.ammo, reserve: this.reserve,
      medkits: this.medkits, keys: [...this.keys], docs: [...this.docs], items: [...this.items], flashlightOn: this.flashlightOn,
    };
  }
  restore(s) {
    this.reset();
    this.pos.set(s.pos[0], 0, s.pos[1]); this.yaw = s.yaw; this.pitch = 0;
    Object.assign(this, { health: Math.max(60, s.health), battery: Math.max(35, s.battery), hasFlashlight: s.hasFlashlight, hasPistol: s.hasPistol, ammo: s.ammo, reserve: s.reserve, medkits: s.medkits });
    if (s.hasPistol && this.ammo + this.reserve < 24) this.reserve = 24 - this.ammo;
    this.keys = new Set(s.keys); this.docs = new Set(s.docs); this.items = new Set(s.items);
    this.flashlightOn = s.hasFlashlight && s.flashlightOn !== false;
  }

  buildFlashlight() {
    const g = this.game;
    const spot = this.spot = new THREE.SpotLight(0xfff0d8, 0, 34, 0.5, 0.72, 1.5);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.2; spot.shadow.camera.far = 34;
    spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.03;
    g.scene.add(spot); g.scene.add(spot.target);
    // volumetric-looking beam: additive cone, fades with distance and at the rim
    const len = 9, rad = Math.tan(0.44) * len;
    const geo = new THREE.ConeGeometry(rad, len, 32, 8, true);
    geo.translate(0, -len / 2, 0); geo.rotateX(-Math.PI / 2); // apex at origin, opening along +Z (Object3D.lookAt aims +Z)
    const mat = this.beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uInt: { value: 0 }, uLen: { value: len }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
        void main(){ vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uInt; uniform float uLen; uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float d = clamp(vP.z/uLen, 0.0, 1.0);
          float rim = pow(abs(dot(vN, vV)), 1.6);
          float dust = 0.85 + 0.15*sin(vP.z*3.0 + uTime*0.7 + vP.x*5.0);
          float a = uInt * (1.0-d)*(1.0-d) * rim * dust * 0.06;
          gl_FragColor = vec4(vec3(1.0,0.94,0.82)*a, a); }`,
    });
    this.beam = new THREE.Mesh(geo, mat);
    this.beam.frustumCulled = false; this.beam.renderOrder = 5;
    g.scene.add(this.beam);
    this.flashIntensity = 0;
  }

  get eye() { return this.pos.y + EYE; }

  update(dt, input) {
    const g = this.game;
    if (this.dead) { this.deathT += dt; this.updateCamera(dt); this.updateFlashlight(dt); return; }
    // look
    const sens = g.settings.sens * 0.0022;
    this.yaw -= input.mdx * sens; this.pitch -= input.mdy * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    input.mdx = input.mdy = 0;

    // movement intent
    let fx = 0, fz = 0;
    if (input.k.KeyW || input.k.ArrowUp) fz -= 1;
    if (input.k.KeyS || input.k.ArrowDown) fz += 1;
    if (input.k.KeyA || input.k.ArrowLeft) fx -= 1;
    if (input.k.KeyD || input.k.ArrowRight) fx += 1;
    const moving = fx || fz;
    const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
    const wantSprint = (input.k.ShiftLeft || input.k.ShiftRight) && fz < 0 && !this.exhausted && this.reloading <= 0;
    this.sprinting = wantSprint && moving && this.stamina > 0;
    const maxSp = this.sprinting ? SPRINT : WALK * (this.health < 25 ? 0.8 : 1);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const wx = fx * c + fz * s, wz = -fx * s + fz * c;
    const acc = this.onGround ? ACCEL : AIR;
    this.vel.x += (wx * maxSp - this.vel.x) * Math.min(1, acc * dt);
    this.vel.z += (wz * maxSp - this.vel.z) * Math.min(1, acc * dt);

    // stamina
    if (this.sprinting) { this.stamina -= 17 * dt; this.staminaDelay = 1.1; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; } }
    else { this.staminaDelay -= dt; if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + 15 * dt); }
    if (this.exhausted && this.stamina > 35) this.exhausted = false;

    // jump + gravity
    if (input.jump && this.onGround) { this.vel.y = JUMP; this.onGround = false; g.emitNoise(this.pos.x, this.pos.z, 5, 'step'); }
    input.jump = false;
    this.vel.y -= GRAV * dt;
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    if (this.pos.y + EYE + 0.15 > CEIL) { this.pos.y = CEIL - EYE - 0.15; if (this.vel.y > 0) this.vel.y = 0; }
    if (this.pos.y <= 0) {
      if (!this.onGround && this.vel.y < -4) { g.audio.play('land', { vol: 0.6 }); this.landT = 0.25; g.emitNoise(this.pos.x, this.pos.z, 6, 'step'); }
      this.pos.y = 0; this.vel.y = 0; this.onGround = true;
    }
    void prevY;
    g.world.collide(this.pos, RADIUS, this.pos.y);

    this.speed2d = Math.hypot(this.vel.x, this.vel.z);
    // footsteps + noise for the infected
    if (this.onGround && this.speed2d > 0.6) {
      this.bobT += dt * this.speed2d * 2.1;
      this.stepDist += this.speed2d * dt;
      const stride = this.sprinting ? 2.0 : 1.55;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        g.audio.play('step' + ((Math.random() * 4) | 0), { vol: this.sprinting ? 0.55 : 0.32, rate: 0.9 + Math.random() * 0.2, reverb: 0.25 });
        g.emitNoise(this.pos.x, this.pos.z, this.sprinting ? 10 : 3.2, 'step');
      }
    } else this.bobT += dt * 0.6;

    this.updateFlashlight(dt);
    // weapon
    this.fireCd -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const need = MAG - this.ammo, take = Math.min(need, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.updateCamera(dt);
    this.vm.update(dt, this, input);
  }

  updateFlashlight(dt) {
    const on = this.flashlightOn && this.hasFlashlight && this.battery > 0 && !this.dead;
    if (on) this.battery = Math.max(0, this.battery - dt * (100 / 480));
    if (this.battery <= 0 && this.flashlightOn) { this.flashlightOn = false; this.game.hud.toast('Flashlight battery dead. Find batteries.'); }
    let target = on ? 1 : 0;
    // low battery flicker
    if (on && this.battery < 18) {
      this.flickerT -= dt;
      if (this.flickerT <= 0) { this.flickerT = Math.random() * (this.battery < 8 ? 0.4 : 1.2); this.flick = Math.random() < 0.45 ? Math.random() * 0.3 : 1; }
      target *= this.flick ?? 1;
      target *= 0.55 + this.battery / 40;
    }
    this.flashIntensity += (target - this.flashIntensity) * Math.min(1, dt * 18);
    const q = this.game.settings.quality;
    // auto-exposure: what the beam hits up close would otherwise blow out to white
    if (this.flashIntensity > 0.01) {
      const cam = this.cam, o = cam.position, d = cam.getWorldDirection(this._fd || (this._fd = new THREE.Vector3()));
      let D = this.game.world.raycast(o, d, 12).t;
      for (const z of this.game.zombies) {
        if (!z.alive) continue;
        const zx = z.pos.x - o.x, zz = z.pos.z - o.z, along = zx * d.x + zz * d.z;
        if (along > 0 && along < D && Math.abs(zx * d.z - zz * d.x) < 0.6) D = along;
      }
      this.beamDist = (this.beamDist ?? D) + (D - (this.beamDist ?? D)) * Math.min(1, dt * 8);
    }
    const expo = Math.max(0.16, Math.min(1, Math.pow((this.beamDist ?? 6) / 5.5, 1.25)));
    this.spot.intensity = this.flashIntensity * 62 * expo;
    this.spot.castShadow = q !== 'low';
    this.beamMat.uniforms.uInt.value = this.flashIntensity;
    this.beamMat.uniforms.uTime.value += dt;
    this.beam.visible = this.flashIntensity > 0.02;
  }

  updateCamera(dt) {
    const cam = this.cam;
    const bobAmt = this.onGround ? Math.min(1, this.speed2d / WALK) : 0;
    const bobY = Math.sin(this.bobT * 2) * 0.045 * bobAmt * (this.sprinting ? 1.5 : 1) - this.landT * 0.25;
    const bobX = Math.cos(this.bobT) * 0.03 * bobAmt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    let eye = EYE, roll = Math.cos(this.bobT) * 0.006 * bobAmt + (Math.random() - 0.5) * sh * 0.06;
    let pitch = this.pitch + this.recoil + (Math.random() - 0.5) * sh * 0.08;
    // wake-up: start lying, slowly rise
    if (this.wakeT > 0) { this.wakeT = Math.max(0, this.wakeT - dt); const k = this.wakeT / 6; eye = EYE - k * 1.0; roll += k * 0.9; pitch += k * 0.5; }
    if (this.dead) { const k = Math.min(1, this.deathT / 1.1); eye = EYE - k * 1.35; roll += k * 1.25; pitch -= k * 0.3; }
    this.recoil *= Math.pow(0.0005, dt); this.recoilYaw *= Math.pow(0.001, dt);
    cam.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.pos.y + eye + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    cam.rotation.set(pitch, this.yaw + this.recoilYaw, roll, 'YXZ');
    cam.updateMatrixWorld();
    // flashlight follows the left hand, slightly lagging behind the view
    const f = this.spot;
    const off = new THREE.Vector3(-0.22, -0.28, -0.25).applyQuaternion(cam.quaternion);
    f.position.copy(cam.position).add(off);
    const fwd = new THREE.Vector3(0.02, 0.05, -1).applyQuaternion(cam.quaternion);
    if (!this._lightDir) this._lightDir = fwd.clone();
    this._lightDir.lerp(fwd, Math.min(1, dt * 16)).normalize();
    f.target.position.copy(f.position).addScaledVector(this._lightDir, 10);
    f.target.updateMatrixWorld();
    this.beam.position.copy(f.position);
    this.beam.lookAt(f.target.position);
  }

  damage(amount, from, knock = 2) {
    if (this.dead || this.game.mode !== 'play') return;
    const g = this.game;
    if (g.settings.difficulty === 'easy') amount *= 0.6;
    this.health -= amount; this.hurtT = 0.6; this.shake = Math.min(1.3, this.shake + 0.7);
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.vel.x += dx / d * knock; this.vel.z += dz / d * knock;
    g.audio.play('hurt', { vol: 0.8, rate: 0.9 + Math.random() * 0.2 });
    g.hud.damage(Math.atan2(from.x - this.pos.x, from.z - this.pos.z) - this.yaw);
    if (this.health <= 0) { this.health = 0; this.dead = true; this.deathT = 0; g.onPlayerDeath(); }
  }

  heal() {
    if (this.medkits <= 0 || this.health >= 100) return false;
    this.medkits--; this.health = Math.min(100, this.health + 45);
    this.game.audio.play('pickup', { vol: 0.5, rate: 0.7 }); return true;
  }

  toggleFlashlight() {
    if (!this.hasFlashlight) return;
    this.game.audio.play('click', { vol: 0.6 });
    if (this.battery <= 0) { this.game.hud.toast('No battery.'); this.flashlightOn = false; return; }
    this.flashlightOn = !this.flashlightOn;
  }

  tryReload() {
    if (!this.hasPistol || this.reloading > 0 || this.ammo >= MAG) return;
    if (this.reserve <= 0) { this.game.hud.toast('No spare ammunition.'); return; }
    this.reloading = 1.55; this.vm.startReload();
    const a = this.game.audio;
    a.play('magOut', { vol: 0.7, when: 0.15 }); a.play('magIn', { vol: 0.8, when: 0.85 }); a.play('slide', { vol: 0.8, when: 1.2 });
    this.game.emitNoise(this.pos.x, this.pos.z, 4, 'step');
  }
}

/* ===================================================== VIEW MODEL */
class ViewModel {
  constructor(game) {
    this.game = game;
    const scene = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0x8090a0, 0x201810, 0.4); scene.add(this.hemi);
    this.key = new THREE.PointLight(0xfff0d8, 0, 3, 1.5); this.key.position.set(-0.25, 0.0, -0.4); scene.add(this.key);
    this.flash = new THREE.PointLight(0xffb060, 0, 3, 1.5); this.flash.position.set(0.15, -0.05, -0.75); scene.add(this.flash);
    this.envLight = new THREE.PointLight(0xdfe8ff, 0, 4, 1.2); this.envLight.position.set(0.2, 1.0, 0.3); scene.add(this.envLight);
    const M = game.M;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8c6c58, roughness: 0.75, map: M.grimeDetail });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.9, map: M.grimeDetail });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x3a3c41, roughness: 0.42, metalness: 0.35 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.8, metalness: 0.05 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.3, metalness: 0.5 });

    // ---------- pistol + right hand
    const gun = this.gun = new THREE.Group();
    const box = (w, h, d, m, x, y, z, rx = 0, parent = gun) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; parent.add(o); return o; };
    const cyl = (r, l, m, x, y, z, parent = gun) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 14), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); parent.add(o); return o; };
    // side-profile shapes extruded with a bevel: shape +x = forward (-z), extrusion = width (x)
    const extrude = (pts, holes, depth, mat, parent) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0022, bevelSegments: 2, curveSegments: 4 });
      g.rotateY(Math.PI / 2); g.translate(-depth / 2, 0, 0); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); parent.add(m); return m;
    };
    this.slide = new THREE.Group(); gun.add(this.slide);
    extrude([[-0.058, 0.012], [0.145, 0.012], [0.147, 0.034], [0.14, 0.042], [-0.05, 0.042], [-0.058, 0.035]], [], 0.026, gunMat, this.slide);
    for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) box(0.002, 0.022, 0.0025, steel, sx * 0.0155, 0.027, 0.022 + i * 0.0055, 0, this.slide); // rear serrations
    box(0.005, 0.007, 0.008, steel, 0, 0.0465, -0.135, 0, this.slide); // front sight
    box(0.007, 0.008, 0.008, steel, -0.0075, 0.0465, 0.048, 0, this.slide); box(0.007, 0.008, 0.008, steel, 0.0075, 0.0465, 0.048, 0, this.slide); // rear notch
    box(0.003, 0.012, 0.03, gripMat, 0.0157, 0.031, -0.01, 0, this.slide); // ejection port
    cyl(0.0085, 0.006, steel, 0, 0.026, -0.1475, this.slide);
    extrude([[-0.05, 0.014], [0.13, 0.014], [0.13, -0.004], [0.062, -0.006], [0.058, -0.03], [0.0, -0.034], [-0.012, -0.02], [-0.034, -0.118], [-0.074, -0.118], [-0.07, -0.098], [-0.056, 0.0]],
      [[[0.004, -0.009], [0.05, -0.009], [0.047, -0.026], [0.006, -0.028]]], 0.024, gunMat, gun);
    const panel = box(0.029, 0.085, 0.032, gripMat, 0, -0.06, 0.052, -0.3); void panel; // textured grip panels
    box(0.004, 0.017, 0.005, steel, 0, -0.016, -0.026, 0.2); // trigger
    box(0.01, 0.012, 0.01, gunMat, 0, 0.044, 0.062, 0.5); // hammer
    this.mag = box(0.026, 0.012, 0.044, steel, 0, -0.123, 0.054, -0.3);
    // shooting hand: three fingers curl around the front strap, index on the trigger, thumb along the frame
    const hand = new THREE.Group(); gun.add(hand);
    for (let i = 0; i < 3; i++) {
      const y = -0.046 - i * 0.022;
      const f = new THREE.Mesh(new THREE.TorusGeometry(0.0235, 0.0094 - i * 0.0007, 8, 14, Math.PI * 1.22), skinMat);
      f.rotation.set(-Math.PI / 2, 0, 0.15); f.position.set(0.001, y, 0.03 - (y + 0.03) * 0.33); hand.add(f);
    }
    const idx1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0088, 0.03, 4, 8), skinMat); idx1.rotation.x = Math.PI / 2; idx1.position.set(0.017, -0.014, -0.006); hand.add(idx1);
    const idx2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, 0.018, 4, 8), skinMat); idx2.rotation.set(Math.PI / 2, 0.9, 0); idx2.position.set(0.009, -0.016, -0.028); hand.add(idx2);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0098, 0.04, 4, 8), skinMat); thumb.rotation.set(Math.PI / 2 + 0.15, 0, 0); thumb.position.set(-0.019, -0.006, 0.006); hand.add(thumb);
    const rback = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), skinMat); rback.scale.set(0.62, 1.15, 0.95); rback.position.set(0.02, -0.064, 0.058); rback.rotation.x = -0.3; hand.add(rback);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.12, 12), skinMat); wrist.position.set(0.02, -0.115, 0.1); wrist.rotation.x = -0.95; hand.add(wrist);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.36, 14), sleeveMat); sleeve.position.set(0.035, -0.19, 0.24); sleeve.rotation.x = -1.1; hand.add(sleeve);
    gun.position.set(0.115, -0.115, -0.31);
    this.gunBase = gun.position.clone();
    scene.add(gun);
    // muzzle flash
    this.muzzle = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: M.muzzleTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.muzzle.position.set(0, 0.026, -0.2); this.muzzle.visible = false; gun.add(this.muzzle);
    this.muzzle2 = this.muzzle.clone(); this.muzzle2.rotation.y = Math.PI / 2; this.muzzle2.scale.set(0.6, 1, 1); this.muzzle2.position.z = -0.25; gun.add(this.muzzle2);

    // ---------- left hand + flashlight
    const fl = this.fl = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 16), new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.45, metalness: 0.6 }));
    body.rotation.x = Math.PI / 2; fl.add(body);
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.002, 4, 16), gripMat); r.position.z = 0.01 + i * 0.012; fl.add(r); }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 18), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.4, metalness: 0.5 }));
    head.rotation.x = Math.PI / 2; head.position.z = -0.1; fl.add(head);
    this.lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 18), this.lensMat); lens.position.z = -0.1255; lens.rotation.y = Math.PI; fl.add(lens);
    const lhand = new THREE.Group(); fl.add(lhand);
    // fist: four curled fingers wrapping the barrel, knuckles on top, thumb along the side
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.TorusGeometry(0.0275, 0.0086 - i * 0.0005, 8, 14, Math.PI * 1.25), skinMat);
      f.position.z = -0.012 + i * 0.0205; f.rotation.z = -0.35; lhand.add(f);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), skinMat);
      nail.position.set(Math.cos(Math.PI * 1.25 - 0.35) * 0.0285, Math.sin(Math.PI * 1.25 - 0.35) * 0.0285, f.position.z); lhand.add(nail);
    }
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), skinMat); back.scale.set(0.75, 1.0, 1.25); back.position.set(0.026, -0.022, 0.018); lhand.add(back);
    const lthumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.045, 4, 8), skinMat); lthumb.position.set(-0.022, 0.012, -0.004); lthumb.rotation.set(Math.PI / 2, 0, 0.3); lhand.add(lthumb);
    const lwrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.12, 12), skinMat); lwrist.position.set(0.028, -0.07, 0.07); lwrist.rotation.set(-0.9, 0, -0.25); lhand.add(lwrist);
    const lsleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.4, 14), sleeveMat); lsleeve.position.set(0.05, -0.17, 0.23); lsleeve.rotation.set(-1.05, 0, -0.25); lhand.add(lsleeve);
    fl.position.set(-0.2, -0.165, -0.47); fl.rotation.set(0.04, 0.06, 0.05);
    this.flBase = fl.position.clone();
    scene.add(fl);

    this.kick = 0; this.slideT = 0; this.reloadT = 0; this.swayX = 0; this.swayY = 0; this.lower = 0; this.raise = 1; this.shells = [];
    this.shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.018, 8);
    this.shellMat = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.9, roughness: 0.3 });
  }

  fire() {
    this.kick = 1; this.slideT = 0.07; this.muzzleT = 0.05;
    this.muzzle.rotation.z = Math.random() * Math.PI; this.muzzle2.rotation.x = Math.random() * Math.PI;
    const s = new THREE.Mesh(this.shellGeo, this.shellMat);
    s.position.set(0.19, -0.13, -0.38); s.userData.v = new THREE.Vector3(0.6 + Math.random() * 0.3, 0.9 + Math.random() * 0.3, 0.2); s.userData.t = 0.6;
    s.rotation.z = Math.PI / 2; this.scene.add(s); this.shells.push(s);
  }
  startReload() { this.reloadT = 1.55; }

  update(dt, p, input) {
    const g = this.game;
    this.gun.visible = p.hasPistol; this.fl.visible = p.hasFlashlight;
    // sway from mouse movement + bob
    this.swayX += ((input.lastMdx || 0) * -0.00025 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += ((input.lastMdy || 0) * 0.00025 - this.swayY) * Math.min(1, dt * 10);
    input.lastMdx = 0; input.lastMdy = 0;
    const bobAmt = p.onGround ? Math.min(1, p.speed2d / WALK) : 0.2;
    const bx = Math.cos(p.bobT) * 0.012 * bobAmt, by = Math.abs(Math.sin(p.bobT)) * 0.012 * bobAmt;
    const breathe = Math.sin(performance.now() / 900) * 0.003;
    this.lower += ((p.sprinting ? 1 : 0) - this.lower) * Math.min(1, dt * 8);
    this.kick = Math.max(0, this.kick - dt * 9);
    this.slideT = Math.max(0, this.slideT - dt);
    this.muzzleT = Math.max(0, (this.muzzleT || 0) - dt);
    const k = this.kick;
    // reload choreography
    let rx = 0, rz = 0, ry = 0, magY = -0.12, magVis = true, slideBack = this.slideT > 0 ? 0.045 : 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt; const t = 1.55 - this.reloadT;
      const tilt = Math.min(1, t / 0.25) * (1 - Math.max(0, (t - 1.3) / 0.25));
      rz = tilt * 0.6; rx = tilt * 0.35; ry = -tilt * 0.2;
      if (t > 0.15 && t < 0.55) { magY = -0.12 - (t - 0.15) * 0.8; magVis = t < 0.5; }
      else if (t >= 0.55 && t < 0.85) { magY = -0.32 + (t - 0.55) * 0.66; }
      if (t > 1.15 && t < 1.35) slideBack = 0.045;
      if (this.reloadT <= 0) this.reloadT = 0;
    }
    this.mag.position.y = magY; this.mag.visible = magVis;
    this.slide.position.z = slideBack;
    this.gun.position.set(this.gunBase.x + bx + this.swayX + this.lower * 0.04, this.gunBase.y - by + breathe + this.swayY - this.lower * 0.07, this.gunBase.z + k * 0.07);
    this.gun.rotation.set(0.03 + k * 0.28 + rx + this.lower * -0.45, 0.1 + ry + this.lower * 0.6, rz + this.lower * 0.2);
    this.fl.position.set(this.flBase.x + bx * 0.8 + this.swayX * 1.2, this.flBase.y - by * 0.8 + breathe + this.swayY, this.flBase.z);
    this.fl.rotation.set(0.05 + this.lower * -0.3, 0.08, 0.15 + this.lower * 0.2);
    this.muzzle.visible = this.muzzle2.visible = this.muzzleT > 0;
    this.flash.intensity = this.muzzleT > 0 ? 3 : 0;
    this.lensMat.emissiveIntensity = p.flashIntensity * 3;
    this.key.intensity = p.flashIntensity * 0.35;
    // environment light on the hands follows world lighting near the player
    this.envLight.intensity = Math.min(1.2, p.lightLevel * 0.9);
    this.hemi.intensity = 0.12 + Math.min(0.5, p.lightLevel * 0.3) + g.settings.brightness * 0.05;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]; const v = s.userData.v;
      v.y -= 6 * dt; s.position.addScaledVector(v, dt); s.rotation.x += dt * 20; s.userData.t -= dt;
      if (s.userData.t <= 0) { this.scene.remove(s); this.shells.splice(i, 1); if (Math.random() < 0.7) g.audio.play('shell', { vol: 0.25, rate: 0.9 + Math.random() * 0.3 }); }
    }
  }
}
