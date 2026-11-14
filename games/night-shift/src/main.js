// NIGHT SHIFT: The Abandoned Hospital — game orchestrator.
import * as THREE from 'three';
import { buildMaterials, paperCanvas, setSeed } from './textures.js';
import { World, S, CEIL } from './level.js';
import { LAYOUT, dress } from './layout.js';
import { Player, MAG, MAX_RESERVE } from './player.js';
import { Zombie, ST, TYPES, createZombieModel } from './zombie.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Story, PICKUPS, DOCS, START, CH_START } from './story.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'nightshift.save.v1';
const SET_KEY = 'nightshift.settings.v1';
const KEY_NAMES = { wardKey: 'Ward B Key', securityKey: 'Security Key', redCard: 'Red Access Card', basementKey: 'Basement Key', power: 'main power' };
// yield so the loading bar can paint; setTimeout fallback keeps loading going in background tabs
const nextFrame = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); });

function reportError(msg) {
  try { parent.postMessage({ playora: 'error', message: msg }, '*'); } catch (e) { /* standalone */ }
  $('errText').textContent = msg;
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
  $('error').classList.add('show');
}

class Game {
  constructor() {
    this.settings = Object.assign({ master: 0.8, sfx: 0.9, music: 0.6, sens: 1, brightness: 1, quality: 'high', difficulty: 'normal', invert: false }, safeJSON(localStorage.getItem(SET_KEY)));
    this.mode = 'loading';
    this.input = { k: {}, mdx: 0, mdy: 0, jump: false, lastMdx: 0, lastMdy: 0 };
    this.zombies = []; this.pickups = []; this.dropped = [];
    this.stats = { time: 0, kills: 0, shots: 0, hits: 0, deaths: 0 };
    this.clock = new THREE.Clock();
    this.t = 0;
  }

  /* ========================================================== boot */
  async boot() {
    const canvas = $('view');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    } catch (e) { reportError('WebGL is not available in this browser. Try enabling hardware acceleration or another browser.'); return; }
    const r = this.renderer;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.autoClear = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); reportError('The graphics context was lost. Reload the page to continue.'); });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020203);
    this.scene.fog = new THREE.FogExp2(0x030405, 0.075);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
    this.scene.add(this.camera);
    this.hemi = new THREE.HemisphereLight(0x5a6a80, 0x1a1410, 0.06); this.scene.add(this.hemi);

    const prog = async (p, txt) => { $('loadBar').style.transform = `scaleX(${p})`; $('loadTxt').textContent = txt; await nextFrame(); };
    await prog(0.05, 'Mixing disinfectant…');
    this.M = buildMaterials(r.capabilities.getMaxAnisotropy());
    await prog(0.3, 'Building the ward…');
    this.world = new World(this.scene, this.M, LAYOUT);
    this.world.build();
    await prog(0.45, 'Abandoning equipment…');
    dress(this.world, this.M);
    this.world.finalize();
    this.world.buildNav();
    this.fixtureInit = this.world.fixtures.map((f) => f.state);
    await prog(0.6, 'Waking the patients…');
    // warm character geometry for every type/look
    for (const t of Object.keys(TYPES)) for (let l = 0; l < 5; l++) createZombieModel(t, l, this.M.grimeDetail).root.clear();
    this.hud = new HUD();
    this.fx = new FX(this);
    this.player = new Player(this);
    this.story = new Story(this);
    this.audio = new Audio();
    await prog(0.72, 'Recording the screams…');
    try { this.audio.init(); } catch (e) { console.warn('audio init failed', e); }
    this.audio.vol = { master: this.settings.master, sfx: this.settings.sfx, music: this.settings.music }; this.audio.applyVolumes();
    await prog(0.82, 'Placing the evidence…');
    this.buildPickups();
    this.buildLightPool();
    this.buildPost();
    this.muzzleLight = new THREE.PointLight(0xffaa55, 0, 9, 2); this.scene.add(this.muzzleLight);
    this.applyQuality();
    this.onResize();
    await prog(0.92, 'Compiling shaders…');
    try { r.compile(this.scene, this.camera); } catch (e) { /* optional */ }
    await prog(1, 'Ready.');
    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    if (window.ResizeObserver) new ResizeObserver(() => this.onResize()).observe(document.getElementById('stage'));
    this.toMenu();
    r.setAnimationLoop(() => this.frame());
  }

  applyQuality() {
    const q = this.settings.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'medium' ? 1.0 : 0.75);
    this.renderer.setPixelRatio(dpr);
    this.player.spot.shadow.mapSize.setScalar(q === 'high' ? 1024 : 512);
    if (this.player.spot.shadow.map) { this.player.spot.shadow.map.dispose(); this.player.spot.shadow.map = null; }
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.usePost = q !== 'low';
    this.onResize();
  }

  onResize() {
    // the PLAYORA player iframe can be collapsed (0x0) while it lays out: never size buffers to zero
    const w = Math.max(1, window.innerWidth || this.renderer.domElement.clientWidth), h = Math.max(1, window.innerHeight || this.renderer.domElement.clientHeight);
    this.viewOK = w > 8 && h > 8;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.player.vm.cam.aspect = w / h; this.player.vm.cam.updateProjectionMatrix();
    if (this.rt) { const pr = this.renderer.getPixelRatio(); this.rt.setSize(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr))); }
  }

  /* ---------------------------------------------------- post FX */
  buildPost() {
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uTime: { value: 0 }, uHurt: { value: 0 }, uLow: { value: 0 }, uBright: { value: 1 }, uFlash: { value: 0 }, uFear: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uHurt, uLow, uBright, uFlash, uFear; varying vec2 vUv;
        vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0)*43758.5453); }
        void main(){
          vec2 dc = vUv - 0.5;
          float ab = 0.0012 + uHurt*0.008 + uFear*0.002;
          vec3 col;
          col.r = texture2D(tDiffuse, vUv + dc*ab).r;
          col.g = texture2D(tDiffuse, vUv).g;
          col.b = texture2D(tDiffuse, vUv - dc*ab).b;
          col *= 0.75 + uBright*0.45;
          col = aces(col);
          float lum = dot(col, vec3(0.299,0.587,0.114));
          col = mix(col, vec3(lum)*vec3(1.15,0.85,0.85), uLow*0.65);
          float v = smoothstep(0.92, 0.28, length(dc*vec2(1.15,1.0)));
          col *= mix(0.35, 1.0, v);
          col = mix(col, vec3(0.45,0.0,0.0), (1.0-v)*uHurt*0.8);
          col = pow(col, vec3(1.0/2.2));
          col += (hash(vUv*vec2(1920.0,1080.0)) - 0.5) * 0.035;
          col = mix(col, vec3(1.0), uFlash);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.postScene = new THREE.Scene();
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
  }

  /* ----------------------------------------------- light pool */
  buildLightPool() {
    this.pool = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 12, 1.6);
      this.scene.add(l); this.pool.push({ light: l, fix: null, cur: 0 });
    }
    this.poolT = 0;
  }
  updateLightPool(dt) {
    const n = { low: 3, medium: 5, high: 6 }[this.settings.quality];
    const cp = this.camera.position;
    this.poolT -= dt;
    if (this.poolT <= 0) {
      this.poolT = 0.25;
      const cand = this.world.fixtures.filter((f) => f.state !== 'dead').map((f) => ({ f, d: f.pos.distanceToSquared(cp) })).filter((x) => x.d < 30 * 30).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.f);
      // keep existing assignments when possible
      const free = this.pool.slice(0, n).filter((p) => !cand.includes(p.fix));
      for (const f of cand) if (!this.pool.some((p) => p.fix === f)) { const p = free.shift(); if (p) { p.fix = f; p.cur = 0; p.light.position.copy(f.pos); p.light.color.copy(f.color); p.light.distance = f.range; } }
      for (const p of free) p.fix = null;
      for (let i = n; i < this.pool.length; i++) this.pool[i].fix = null;
    }
    let level = 0;
    for (const p of this.pool) {
      const want = p.fix && p.fix.state !== 'dead' ? p.fix.base * p.fix.level : 0;
      p.cur += (want - p.cur) * Math.min(1, dt * 20);
      p.light.intensity = p.cur;
      p.light.visible = p.cur > 0.01 || !!p.fix;
      if (p.fix) { const d2 = p.light.position.distanceToSquared(cp); level += p.cur / Math.max(4, d2); }
    }
    this.player.lightLevel = level;
  }

  /* ---------------------------------------------------- pickups */
  buildPickups() {
    const M = this.M;
    const glintMat = new THREE.SpriteMaterial({ map: M.glowTex, color: 0xffe6b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
    for (const def of PICKUPS) {
      const g = new THREE.Group();
      const mesh = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
      const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (r, h) => new THREE.CylinderGeometry(r, r, h, 12);
      switch (def.kind) {
        case 'flashlight': mesh(C(0.018, 0.17), M.plasticDark, 0, 0.02, 0, 0, 0, Math.PI / 2); mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.05, 14), M.redLight, 0.1, 0.02, 0, 0, 0, Math.PI / 2); break;
        case 'pistol': mesh(B(0.2, 0.034, 0.032), M.metalDark, 0, 0.03, 0); mesh(B(0.05, 0.03, 0.11), M.plasticDark, 0.07, 0.018, 0.05, 0, 0.25, Math.PI / 2 - 0.1); break;
        case 'ammo': mesh(B(0.16, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0x3b4a2a, roughness: 0.8 }), 0, 0.04, 0); for (let i = 0; i < 4; i++) mesh(C(0.006, 0.03), M.chrome, -0.04 + i * 0.025, 0.095, 0); break;
        case 'battery': for (let i = 0; i < 2; i++) { mesh(C(0.016, 0.06), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.4 }), i * 0.04, 0.03, 0); mesh(C(0.016, 0.012), new THREE.MeshStandardMaterial({ color: 0xc78a2a, metalness: 0.8, roughness: 0.3 }), i * 0.04, 0.066, 0); } break;
        case 'medkit': mesh(B(0.26, 0.09, 0.18), new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.6 }), 0, 0.045, 0); mesh(B(0.12, 0.004, 0.035), new THREE.MeshStandardMaterial({ color: 0xc01818 }), 0, 0.092, 0); mesh(B(0.035, 0.004, 0.12), new THREE.MeshStandardMaterial({ color: 0xc01818 }), 0, 0.092, 0); break;
        case 'key':
          if (def.card) { mesh(B(0.086, 0.003, 0.054), new THREE.MeshStandardMaterial({ color: 0xb01020, roughness: 0.4, emissive: 0x300004 }), 0, 0.003, 0, 0, 0.4); mesh(B(0.086, 0.0035, 0.01), M.chrome, 0, 0.003, -0.012, 0, 0.4); }
          else { mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16), M.chrome, 0, 0.004, 0, Math.PI / 2); mesh(B(0.07, 0.006, 0.01), new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.3 }), 0.055, 0.004, 0); mesh(B(0.012, 0.006, 0.018), new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.3 }), 0.08, 0.004, 0.01); }
          break;
        case 'doc': {
          const doc = DOCS[def.doc];
          const t = new THREE.CanvasTexture(paperCanvas([doc.title.slice(0, 28), '', 'St. Aldric Memorial'])); t.colorSpace = THREE.SRGBColorSpace;
          mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshStandardMaterial({ map: t, roughness: 1, side: THREE.DoubleSide }), 0, 0.004, 0, -Math.PI / 2, 0, 0.3);
          break;
        }
        case 'fuse': mesh(C(0.02, 0.09), M.glass, 0, 0.02, 0, 0, 0, Math.PI / 2); mesh(C(0.022, 0.02), M.chrome, 0.045, 0.02, 0, 0, 0, Math.PI / 2); mesh(C(0.022, 0.02), M.chrome, -0.045, 0.02, 0, 0, 0, Math.PI / 2); mesh(C(0.004, 0.08), M.screenRed, 0, 0.02, 0, 0, 0, Math.PI / 2); break;
      }
      const glint = new THREE.Sprite(glintMat.clone()); glint.scale.setScalar(0.25); glint.position.y = 0.08; g.add(glint);
      g.position.set(def.pos[0], def.pos[1], def.pos[2]);
      this.scene.add(g);
      this.pickups.push({ def, obj: g, glint, taken: false, pos: new THREE.Vector3(def.pos[0], def.pos[1] + 0.05, def.pos[2]) });
    }
    // generator panel interactable
    this.panel = { pos: new THREE.Vector3(36.0, 1.3, 50.95) };
    const pm = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.12), M.metalDark); pm.add(box);
    this.panelLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), M.redLight.clone()); this.panelLight.position.set(0.15, 0.2, 0.07); pm.add(this.panelLight);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), M.chrome); lever.position.set(-0.1, 0, 0.09); lever.rotation.z = 0.5; pm.add(lever); this.panelLever = lever;
    pm.position.copy(this.panel.pos).add(new THREE.Vector3(0, 0, 0.0));
    this.scene.add(pm);
  }

  /* ====================================================== flow */
  toMenu() {
    this.mode = 'menu';
    this.hud.show(false);
    this.showScreen('menu');
    $('btnContinue').disabled = !localStorage.getItem(SAVE_KEY);
    this.audio.stopAllLoops();
    this.music('drone');
    if (document.pointerLockElement) document.exitPointerLock();
    // dress the menu scene: corridor, flickering lights, a figure at the end
    this.resetDynamic();
    this.menuZ = this.spawnZombie('walker', { pos: new THREE.Vector3(35, 0, 10.6), ry: -Math.PI / 2, look: 4, phantom: true, id: 'menuZ' });
    this.menuT = 0;
    this.player.flashlightOn = false; this.player.hasFlashlight = true; this.player.battery = 100;
  }

  music(kind) {
    const a = this.audio; if (!a.ready) return;
    if (kind === 'drone') { a.stopLoop('chase'); a.loop('drone', 'drone', 0.55); a.stopLoop('amb'); }
    if (kind === 'game') { a.stopLoop('drone'); a.stopLoop('chase'); a.loop('amb', 'ambience', 0.55); a.loop('drone', 'drone', 0.12); }
    if (kind === 'chase') { a.loop('chase', 'chase', 0.45); this.chaseHold = 8; }
  }

  newGame() {
    localStorage.removeItem(SAVE_KEY);
    this.resetDynamic();
    this.player.reset();
    this.player.pos.set(START.pos[0], 0, START.pos[1]); this.player.yaw = START.yaw; this.player.pitch = 0;
    this.player.wakeT = 6;
    this.stats = { time: 0, kills: 0, shots: 0, hits: 0, deaths: 0 };
    this.story = new Story(this);
    this.startPlay();
    this.story.startChapter(1);
    this.hud.hint('<b>WASD</b> move · <b>Mouse</b> look · <b>E</b> interact · <b>Esc</b> pause', 7);
    this.audio.play('sting', { vol: 0.35, rate: 0.7 });
  }

  startPlay() {
    this.mode = 'play';
    this.showScreen(null);
    this.hud.show(true);
    this.music('game');
    this.lock();
  }

  continueGame() {
    const s = safeJSON(localStorage.getItem(SAVE_KEY));
    if (!s) { this.newGame(); return; }
    this.loadSave(s);
  }

  loadSave(s) {
    this.resetDynamic();
    this.story = new Story(this);
    this.story.restore(s.story);
    this.player.restore(s.player);
    this.stats = { ...s.stats };
    for (const pk of this.pickups) if (s.taken.includes(pk.def.id)) { pk.taken = true; pk.obj.visible = false; }
    for (const d of this.world.doors) {
      const ds = s.doors[d.id]; if (!ds) continue;
      d.locked = ds.locked; d.sealed = ds.sealed; d.open = d.target = ds.open ? 1 : 0;
      for (const l of d.leaves) l.pivot.rotation.y = -l.sign * d.swingSign * (ds.open ? 1.75 : 0);
    }
    for (const z of s.zombies) this.spawnZombie(z.type, { id: z.id, pos: new THREE.Vector3(z.x, 0, z.z), ry: z.ry, look: z.look, dormant: z.dormant, feed: z.feed, patrol: z.patrol ? z.patrol.map((p) => new THREE.Vector3(p[0], 0, p[1])) : null });
    this.startPlay();
    this.story.startChapter(s.chapter, true);
    if (s.story.flags.obj) this.story.setObj(s.story.flags.obj);
    if (this.story.flags.powered) { this.story.flags.powered = 0; this.player.items.add('fuse'); this.player.keys.delete('power'); }
  }

  checkpoint() {
    if (this.player.dead) return;
    const s = {
      chapter: this.story.flags.chapter, player: this.player.snapshot(), story: this.story.snapshot(), stats: { ...this.stats },
      taken: this.pickups.filter((p) => p.taken).map((p) => p.def.id),
      doors: Object.fromEntries(this.world.doors.map((d) => [d.id, { locked: d.locked, sealed: d.sealed, open: d.target > 0.5 }])),
      zombies: this.zombies.filter((z) => z.alive && z.state !== ST.PHANTOM).map((z) => ({ id: z.id, type: z.type, look: z.lookIdx, x: z.home.x, z: z.home.z, ry: z.heading, dormant: z.state === ST.DORMANT, feed: z.feed, patrol: z.patrol ? z.patrol.map((p) => [p.x, p.z]) : null })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
    this.lastSave = s;
    this.hud.toast('Checkpoint reached.', 2.5);
  }

  loadCheckpoint() {
    const s = this.lastSave || safeJSON(localStorage.getItem(SAVE_KEY));
    if (s) this.loadSave(s); else this.newGame();
  }

  resetDynamic() {
    for (const z of [...this.zombies]) z.dispose();
    this.zombies = [];
    this.fx.clear();
    for (const o of this.dropped) this.scene.remove(o.mesh);
    this.dropped = [];
    for (const pk of this.pickups) { pk.taken = false; pk.obj.visible = true; }
    this.world.doors.forEach((d) => {
      d.locked = !!d.def.key || !!d.def.sealed; d.sealed = !!d.def.sealed; d.open = d.target = 0; d.speed = 1.8;
      for (const l of d.leaves) l.pivot.rotation.y = 0;
    });
    this.world.updateDoors(0);
    this.world.fixtures.forEach((f, i) => { f.state = this.fixtureInit[i]; });
    this.audio.stopLoop('alarm'); this.audio.stopLoop('chase');
    this.noiseQ = [];
    this.chaseHold = 0; this.heartT = 0; this.ambT = 20;
    this.dangerLevel = 0;
  }

  descend() {
    if (this.story.flags.chapter >= 4 || this.mode !== 'play') return;
    const fo = $('flashout'); fo.style.opacity = '1';
    this.mode = 'cutscene';
    this.audio.play('creak', { vol: 0.7, rate: 0.6 });
    for (let i = 0; i < 8; i++) this.audio.play('step' + (i % 4), { vol: 0.4, when: 0.3 + i * 0.32, rate: 0.85 });
    setTimeout(() => {
      // leave the ground floor behind
      for (const z of [...this.zombies]) if (z.pos.z < 45) this.removeZombie(z);
      this.audio.stopLoop('alarm'); this.audio.stopLoop('chase');
      this.player.pos.set(CH_START[4].pos[0], 0, CH_START[4].pos[1]); this.player.yaw = CH_START[4].yaw; this.player.vel.set(0, 0, 0);
      this.mode = 'play';
      this.story.startChapter(4);
      fo.style.opacity = '0';
    }, 3000);
  }

  victory() {
    this.mode = 'victory';
    this.audio.stopAllLoops();
    this.audio.play('power', { vol: 0.6, rate: 0.7 });
    $('flashout').style.opacity = '1';
    localStorage.removeItem(SAVE_KEY);
    setTimeout(() => {
      $('flashout').style.opacity = '0';
      this.hud.show(false);
      const t = this.stats.time, mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      const acc = this.stats.shots ? Math.round(this.stats.hits / this.stats.shots * 100) : 0;
      $('stats').innerHTML = `<div>TIME<b>${mm}:${String(ss).padStart(2, '0')}</b></div><div>KILLS<b>${this.stats.kills}</b></div><div>ACCURACY<b>${acc}%</b></div><div>DOCUMENTS<b>${this.player.docs.size}/7</b></div>`;
      this.showScreen('victory');
      if (document.pointerLockElement) document.exitPointerLock();
      this.music('drone');
    }, 1800);
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.audio.play('sting', { vol: 0.7, rate: 0.6 });
    this.audio.stopLoop('chase'); this.audio.stopLoop('alarm');
    const tips = ['Aim for the head — one clean shot drops most of them.', 'Sprinting and gunfire carry far. The infected hunt by sound.', 'Runners lie still until you get close. Give them a wide berth or shoot first.', 'A lit flashlight can be seen from much further away.', 'Keep a medkit for emergencies — press H to heal.', 'Doors slow them down. Close them behind you.'];
    $('deadTip').textContent = tips[(Math.random() * tips.length) | 0];
    setTimeout(() => { if (this.player.dead) { this.mode = 'dead'; this.showScreen('dead'); if (document.pointerLockElement) document.exitPointerLock(); } }, 2400);
  }

  /* ====================================================== entities */
  spawnZombie(type, o) {
    const z = new Zombie(this, type, o);
    z.lookIdx = o.look || 0;
    this.zombies.push(z);
    return z;
  }
  removeZombie(z) { z.dispose(); this.zombies = this.zombies.filter((x) => x !== z); }
  onZombieAlert(z) { if (Math.hypot(z.pos.x - this.player.pos.x, z.pos.z - this.player.pos.z) < 26) this.music('chase'); }
  onZombieKilled(z) { this.stats.kills++; void z; }

  emitNoise(x, z, r, type, src = null) {
    for (const zb of this.zombies) if (zb !== src) zb.hear({ x, z, r, type });
  }

  dropObjects(at, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(i % 2 ? new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8) : new THREE.BoxGeometry(0.2, 0.12, 0.16), i % 2 ? this.M.glass : this.M.cardboard);
      m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.3, (Math.random() - 0.5) * 0.6));
      m.castShadow = true;
      this.scene.add(m);
      this.dropped.push({ mesh: m, v: new THREE.Vector3(-1.5 - Math.random() * 1.5, Math.random(), (Math.random() - 0.5) * 2), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
    }
  }

  /* ====================================================== input */
  bindInput() {
    const I = this.input, canvas = $('view');
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (this.mode === 'play' && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      I.k[e.code] = true;
      if (e.repeat) return;
      if (this.mode === 'reader' && (e.code === 'KeyE' || e.code === 'Escape')) { this.closeDoc(); return; }
      if (this.mode === 'inventory' && (e.code === 'Tab' || e.code === 'Escape')) { this.resume(); return; }
      if (this.mode !== 'play') return;
      if (e.code === 'Space') I.jump = true;
      if (e.code === 'KeyF') this.player.toggleFlashlight();
      if (e.code === 'KeyR') this.player.tryReload();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyH') { if (!this.player.heal()) this.hud.toast(this.player.medkits ? 'Health is full.' : 'No medkits.', 1.5); }
      if (e.code === 'Tab') this.openInventory();
    });
    addEventListener('keyup', (e) => { I.k[e.code] = false; });
    addEventListener('blur', () => { I.k = {}; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.mode !== 'play') return;
      const dx = Math.max(-200, Math.min(200, e.movementX)), dy = Math.max(-200, Math.min(200, e.movementY)) * (this.settings.invert ? -1 : 1);
      I.mdx += dx; I.mdy += dy; I.lastMdx = dx; I.lastMdy = dy;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode !== 'play') return;
      if (document.pointerLockElement !== canvas) { this.lock(); return; }
      if (e.button === 0) this.shoot();
    });
    $('lockMsg').addEventListener('click', () => this.lock());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      $('lockMsg').hidden = true;
      if (!locked && this.mode === 'play' && !this.player.dead) this.pause();
    });
    document.addEventListener('pointerlockerror', () => { if (this.mode === 'play') $('lockMsg').hidden = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play') this.pause(); });

    // menu buttons
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { this.audio.resume(); this.audio.play('click', { vol: 0.4 }); this.menuAction(b.dataset.act); }));
    $('btnFull').addEventListener('click', () => { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {}); else d.exitFullscreen?.(); });
    // settings bindings
    const bind = (id, key, fn = Number) => {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = !!this.settings[key]; else el.value = this.settings[key];
      el.addEventListener('input', () => {
        this.settings[key] = el.type === 'checkbox' ? el.checked : fn(el.value);
        try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
        this.audio.vol = { master: this.settings.master, sfx: this.settings.sfx, music: this.settings.music }; this.audio.applyVolumes();
        if (key === 'quality') this.applyQuality();
      });
    };
    bind('sMaster', 'master'); bind('sSfx', 'sfx'); bind('sMusic', 'music'); bind('sSens', 'sens'); bind('sBright', 'brightness');
    bind('sQuality', 'quality', String); bind('sDiff', 'difficulty', String); bind('sInvert', 'invert');
    addEventListener('pointerdown', () => this.audio.resume(), { once: false });
  }

  menuAction(a) {
    if (a === 'new') this.newGame();
    else if (a === 'continue') this.continueGame();
    else if (a === 'settings') { this.prevScreen = this.curScreen; this.showScreen('settings'); }
    else if (a === 'howto') { this.prevScreen = this.curScreen; this.showScreen('howto'); }
    else if (a === 'back') this.showScreen(this.prevScreen || 'menu');
    else if (a === 'resume') this.resume();
    else if (a === 'checkpoint') this.loadCheckpoint();
    else if (a === 'quit') this.toMenu();
    else if (a === 'closeDoc') this.closeDoc();
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
    this.curScreen = id;
  }

  lock() {
    const c = $('view');
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => { $('lockMsg').hidden = false; }); } catch (e) { $('lockMsg').hidden = false; }
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'paused'; this.showScreen('pause');
    this.audio.ctx?.suspend?.();
  }
  resume() {
    this.audio.resume();
    this.mode = 'play'; this.showScreen(null); this.lock();
  }

  openInventory() {
    this.mode = 'inventory';
    const p = this.player;
    const items = [];
    if (p.hasFlashlight) items.push(['Flashlight', `Battery ${Math.ceil(p.battery)}%`]);
    if (p.hasPistol) items.push(['9mm Pistol', `${p.ammo} / ${p.reserve} rounds`]);
    if (p.medkits) items.push(['Medkit', `×${p.medkits} — press H`]);
    if (p.items.has('fuse')) items.push(['Fuse', 'Generator panel fuse']);
    for (const k of p.keys) if (k !== 'power') items.push([KEY_NAMES[k], 'Key item', true]);
    $('invGrid').innerHTML = items.length ? items.map(([a, b, k]) => `<div class="inv-item${k ? ' key' : ''}"><b>${a}</b>${b}</div>`).join('') : '<p>Nothing yet.</p>';
    const docs = [...p.docs];
    $('docCount').textContent = `${docs.length}/7`;
    $('docList').innerHTML = docs.map((d) => `<button data-doc="${d}">${DOCS[d].title}</button>`).join('') || '<p>No documents found.</p>';
    $('docList').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.readerReturn = 'inventory'; this.openDoc(b.dataset.doc); }));
    this.showScreen('inventory');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  openDoc(id) {
    this.mode = 'reader';
    $('docTitle').textContent = DOCS[id].title; $('docText').textContent = DOCS[id].text;
    this.showScreen('reader');
    this.audio.play('note', { vol: 0.8 });
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeDoc() {
    if (this.readerReturn === 'inventory') { this.readerReturn = null; this.openInventory(); return; }
    this.resume();
  }

  /* ================================================== interaction */
  findInteractable() {
    const cam = this.camera, cp = cam.position;
    const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    let best = null, bestScore = -1;
    const consider = (pos, maxD, obj, kind, minDot = 0.9) => {
      const dx = pos.x - cp.x, dy = pos.y - cp.y, dz = pos.z - cp.z, d = Math.hypot(dx, dy, dz);
      if (d > maxD) return;
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
      const need = d < 0.9 ? 0.55 : minDot;
      if (dot < need) return;
      const score = dot - d * 0.05;
      if (score > bestScore) { bestScore = score; best = { obj, kind }; }
    };
    for (const pk of this.pickups) if (!pk.taken) consider(pk.pos, 2.75, pk, 'pickup', 0.92);
    for (const d of this.world.doors) consider(d.pos, 2.6, d, 'door', 0.8);
    consider(this.panel.pos, 2.4, this.panel, 'panel', 0.85);
    // must not be through a wall
    if (best) {
      const p = best.kind === 'pickup' ? best.obj.pos : best.obj.pos;
      // test sight to a point just in front of the item, so the shelf/desk it sits on doesn't block it
      const dx = p.x - cp.x, dz = p.z - cp.z, dl = Math.hypot(dx, dz) || 1, back = Math.min(0.7, dl * 0.5);
      if (best.kind !== 'door' && !this.world.lineClear(cp.x, cp.z, p.x - dx / dl * back, p.z - dz / dl * back, true)) return null;
    }
    return best;
  }

  promptFor(it) {
    if (!it) return null;
    const p = this.player;
    if (it.kind === 'pickup') return `<kbd>E</kbd>${it.obj.def.kind === 'doc' ? 'Read' : 'Take'} ${it.obj.def.label}`;
    if (it.kind === 'panel') return `<kbd>E</kbd>${this.story.flags.powered ? 'Main power: ON' : 'Generator panel'}`;
    const d = it.obj;
    if (d.id === 'main') return `<kbd>E</kbd>Main Entrance`;
    if (d.id === 'exit') return `<kbd>E</kbd>${p.keys.has('power') ? 'ESCAPE' : 'Emergency Exit (no power)'}`;
    if (d.id === 'stairs' && !d.locked) return `<kbd>E</kbd>Descend to Sub-Level B2`;
    if (d.id === 'stairs' && p.keys.has('basementKey')) return `<kbd>E</kbd>Unlock &amp; descend — Stairwell B`;
    if (d.sealed) return `<kbd>E</kbd>${d.label} (sealed)`;
    if (d.locked) return p.keys.has(d.key) ? `<kbd>E</kbd>Unlock ${d.label} <span style="opacity:.6">(${KEY_NAMES[d.key]})</span>` : `<kbd>E</kbd>${d.label} <span style="color:#ff5a62">locked</span>`;
    return `<kbd>E</kbd>${d.target > 0.5 ? 'Close' : 'Open'} ${d.label}`;
  }

  interact() {
    const it = this.findInteractable(); if (!it) return;
    const p = this.player, a = this.audio;
    if (it.kind === 'pickup') { this.take(it.obj); return; }
    if (it.kind === 'panel') { this.story.onPanel(); if (this.story.flags.powered) { this.panelLever.rotation.z = -0.5; this.panelLight.material.emissive.setHex(0x20ff60); } return; }
    const d = it.obj;
    if (['main', 'labStairs', 'contain', 'exit', 'stairs'].includes(d.id) && this.story.onSpecialDoor(d)) return;
    if (d.locked) {
      if (d.key && p.keys.has(d.key)) {
        d.locked = false; a.play3D('unlock', d.pos, { vol: 1 });
        this.hud.toast(`Unlocked with the ${KEY_NAMES[d.key]}.`, 2.5);
        this.story.onDoorUnlocked(d);
        if (d.target === 0) { this.world.setDoorOpen(d, true, p.pos); a.play3D('doorOpen', d.pos); }
      } else {
        a.play3D('locked', d.pos, { vol: 0.9 });
        this.hud.toast(d.key ? `Locked. Requires the ${KEY_NAMES[d.key]}.` : 'It won\'t budge.', 2.5);
      }
      return;
    }
    const open = d.target < 0.5;
    this.world.setDoorOpen(d, open, p.pos);
    a.play3D(open ? 'doorOpen' : 'doorBang', d.pos, { vol: open ? 0.8 : 0.5 });
    if (open && Math.random() < 0.4) a.play3D('creak', d.pos, { vol: 0.5, rate: 1 + Math.random() * 0.3 });
    this.emitNoise(d.pos.x, d.pos.z, open ? 4 : 6, 'door');
  }

  take(pk) {
    const p = this.player, d = pk.def;
    switch (d.kind) {
      case 'flashlight': p.hasFlashlight = true; p.flashlightOn = true; p.battery = 100; break;
      case 'pistol': p.hasPistol = true; p.ammo = 8; break;
      case 'ammo':
        if (p.reserve >= MAX_RESERVE) { this.hud.toast('You can\'t carry more ammunition.', 2); return; }
        p.reserve = Math.min(MAX_RESERVE, p.reserve + d.amount); break;
      case 'battery': p.battery = Math.min(100, p.battery + 45); if (!p.hasFlashlight) p.items.add('battery'); break;
      case 'medkit': p.medkits++; break;
      case 'key': p.keys.add(d.key); break;
      case 'fuse': p.items.add('fuse'); break;
      case 'doc': p.docs.add(d.doc); break;
    }
    pk.taken = true; pk.obj.visible = false;
    this.audio.play(d.kind === 'doc' ? 'note' : 'pickup', { vol: 0.7 });
    if (d.kind !== 'doc') this.hud.toast(`${d.label}${d.kind === 'ammo' ? ` (+${d.amount})` : d.kind === 'battery' ? ' (+45%)' : ''}`, 2);
    this.story.onPickup(d);
    if (d.kind === 'doc') this.openDoc(d.doc);
  }

  /* ====================================================== combat */
  shoot() {
    const p = this.player;
    if (!p.hasPistol || p.dead || p.reloading > 0 || p.fireCd > 0) return;
    if (p.sprinting) return;
    if (p.ammo <= 0) { this.audio.play('dry', { vol: 0.8 }); p.fireCd = 0.25; if (p.reserve > 0) p.tryReload(); return; }
    p.ammo--; p.fireCd = 0.16; this.stats.shots++;
    p.vm.fire();
    p.recoil += 0.035 + Math.random() * 0.015; p.recoilYaw += (Math.random() - 0.5) * 0.02;
    this.audio.play('shot', { vol: 1, rate: 0.95 + Math.random() * 0.1, reverb: 0.7 });
    this.muzzleLight.position.copy(this.camera.position).add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.7));
    this.muzzleLight.intensity = 25; this.muzzleT = 0.05;
    this.emitNoise(p.pos.x, p.pos.z, 32, 'shot');

    const o = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const spread = p.speed2d > 1 ? 0.018 : 0.004;
    dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread; dir.normalize();
    const wh = this.world.raycast(o, dir, 70);
    let bestZ = null, bestHit = null;
    for (const z of this.zombies) {
      if (!z.alive || z.state === ST.PHANTOM) continue;
      if (z.pos.distanceTo(o) > wh.t + 1.5) continue;
      const h = z.rayHit(o, dir, wh.t);
      if (h && (!bestHit || h.t < bestHit.t)) { bestHit = h; bestZ = z; }
    }
    if (bestZ) {
      const pt = o.clone().addScaledVector(dir, bestHit.t);
      const T = bestZ.type;
      let dmg = bestHit.head ? (T === 'tank' ? 110 : 160) : bestHit.leg ? 24 : bestHit.arm ? 18 : 36;
      this.stats.hits++;
      bestZ.damage(dmg, bestHit.head, pt, dir);
      this.hud.hitMarker(bestHit.head);
    } else if (wh.solid) {
      const pt = o.clone().addScaledVector(dir, wh.t);
      this.fx.impact(pt, wh.normal);
      this.audio.play3D(Math.random() < 0.3 ? 'ricochet' : 'impact', pt, { vol: 0.6 });
    }
  }

  /* ====================================================== loop */
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const p = this.player;
    if (this.mode === 'menu') this.updateMenu(dt);
    if (this.mode === 'play' || this.mode === 'cutscene') {
      this.stats.time += dt;
      if (this.mode === 'play') p.update(dt, this.input); else { p.updateCamera(dt); p.updateFlashlight(dt); }
      this.story.update(dt);
      if (this.mode === 'play') for (const z of this.zombies) z.update(dt);
      this.world.updateDoors(dt);
      this.updatePickups(dt);
      this.updateDropped(dt);
      this.fx.update(dt);
      this.updateAtmosphere(dt);
      const it = this.mode === 'play' && !p.dead ? this.findInteractable() : null;
      this.hud.prompt(this.promptFor(it));
      this.hud.update(dt, p);
      this.audio.updateListener(this.camera);
    } else if (this.mode === 'dead') {
      p.update(dt, this.input);
      for (const z of this.zombies) z.update(dt);
    }
    this.world.updateFixtures(this.t, dt);
    this.updateLightPool(dt);
    this.muzzleT = Math.max(0, (this.muzzleT || 0) - dt);
    if (this.muzzleT <= 0) this.muzzleLight.intensity = 0;
    this.hemi.intensity = 0.035 + this.settings.brightness * 0.03;
    this.render(dt);
  }

  updateMenu(dt) {
    this.menuT += dt;
    const t = this.menuT;
    const cam = this.camera;
    const x = 12 + Math.sin(t * 0.05) * 3 + t * 0.15 % 6;
    cam.position.set(x, 1.55 + Math.sin(t * 0.6) * 0.02, 10.4 + Math.sin(t * 0.13) * 0.3);
    cam.rotation.set(-0.02 + Math.sin(t * 0.21) * 0.02, -Math.PI / 2 + Math.sin(t * 0.17) * 0.12, Math.sin(t * 0.3) * 0.01, 'YXZ');
    cam.updateMatrixWorld();
    // fake flashlight sweep in the menu
    const sp = this.player.spot;
    sp.position.copy(cam.position).add(new THREE.Vector3(0, -0.3, 0.2));
    sp.target.position.set(cam.position.x + 10, 1.0 + Math.sin(t * 0.4) * 0.4, cam.position.z + Math.sin(t * 0.25) * 1.2);
    sp.target.updateMatrixWorld();
    const flick = Math.sin(t * 3.1) + Math.sin(t * 7.7) > 1.6 ? 0.2 : 1;
    sp.intensity = 55 * flick; sp.castShadow = this.settings.quality !== 'low';
    this.player.beam.visible = false;
    this.menuZ.update(dt);
    this.player.lightLevel = 0;
  }

  updatePickups(dt) {
    const cp = this.camera.position;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const d = pk.pos.distanceTo(cp);
      pk.glint.visible = d < 9;
      if (pk.glint.visible) { pk.glint.material.opacity = (0.25 + 0.25 * Math.sin(this.t * 3 + pk.pos.x)) * Math.min(1, (9 - d) / 3); }
    }
  }

  updateDropped(dt) {
    for (const o of this.dropped) {
      if (o.rest) continue;
      o.v.y -= 9.8 * dt; o.mesh.position.addScaledVector(o.v, dt);
      o.mesh.rotation.x += o.w.x * dt; o.mesh.rotation.y += o.w.y * dt; o.mesh.rotation.z += o.w.z * dt;
      if (o.mesh.position.y < 0.06) { o.mesh.position.y = 0.06; o.v.y *= -0.35; o.v.x *= 0.6; o.v.z *= 0.6; o.w.multiplyScalar(0.5); if (Math.abs(o.v.y) < 0.3) { o.rest = true; o.mesh.rotation.x = Math.round(o.mesh.rotation.x / (Math.PI / 2)) * Math.PI / 2; o.mesh.rotation.z = Math.round(o.mesh.rotation.z / (Math.PI / 2)) * Math.PI / 2; } }
    }
  }

  updateAtmosphere(dt) {
    const p = this.player, a = this.audio;
    // danger = closest hunting infected
    let danger = 0;
    for (const z of this.zombies) {
      if (!z.alive || z.state === ST.PHANTOM || z.state === ST.DORMANT) continue;
      const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      const hunting = [ST.CHASE, ST.ATTACK, ST.ALERT].includes(z.state);
      const lvl = hunting ? Math.max(0, 1 - d / 22) : Math.max(0, 1 - d / 9) * 0.5;
      danger = Math.max(danger, lvl);
    }
    if (p.health < 35) danger = Math.max(danger, 0.55);
    this.dangerLevel += (danger - this.dangerLevel) * Math.min(1, dt * 2);
    // heartbeat
    this.heartT -= dt;
    if (this.dangerLevel > 0.15 && this.heartT <= 0 && !p.dead) {
      this.heartT = 1.15 - this.dangerLevel * 0.7;
      a.play('heart', { vol: 0.25 + this.dangerLevel * 0.6, reverb: 0 });
    }
    // breathing when exhausted or terrified
    const breath = Math.max((100 - p.stamina) / 100, this.dangerLevel * 0.8);
    if (breath > 0.25 && !p.dead) a.loop('breath', 'breath', breath * 0.5, 'sfx', 0.6); else a.loopVol('breath', 0, 0.6);
    // chase music fades out once nothing is hunting
    const anyHunt = this.zombies.some((z) => z.alive && [ST.CHASE, ST.ATTACK, ST.ALERT].includes(z.state) && Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < 30);
    if (anyHunt) this.chaseHold = 6; else this.chaseHold -= dt;
    if (this.chaseHold <= 0 && a.loops.chase) a.stopLoop('chase', 4);
    // distant ambient events
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 22 + Math.random() * 35;
      const ang = Math.random() * Math.PI * 2, r = 14 + Math.random() * 12;
      const at = new THREE.Vector3(p.pos.x + Math.cos(ang) * r, 1.5, p.pos.z + Math.sin(ang) * r);
      const ev = ['scream0', 'clatter', 'knock', 'groan2', 'doorBang', 'whisper', 'scream1'][(Math.random() * 7) | 0];
      a.play3D(ev, at, { vol: ev.startsWith('scream') ? 0.5 : 0.7, rate: 0.75 + Math.random() * 0.2, reverb: 0.9 });
    }
  }

  render(dt) {
    if (!this.viewOK) return;
    const r = this.renderer, pm = this.postMat.uniforms;
    const vm = this.player.vm;
    vm.cam.aspect = this.camera.aspect;
    const showVM = this.mode !== 'menu' && !this.player.dead;
    if (this.usePost) {
      r.setRenderTarget(this.rt); r.clear();
      r.render(this.scene, this.camera);
      if (showVM) { r.clearDepth(); r.render(vm.scene, vm.cam); }
      r.setRenderTarget(null); r.clear();
      pm.uTime.value = this.t; pm.uHurt.value = Math.min(1, this.player.hurtT / 0.6 + (this.player.dead ? 0.6 : 0));
      pm.uLow.value = this.mode === 'menu' ? 0.2 : Math.max(0, (40 - this.player.health) / 40);
      pm.uBright.value = this.settings.brightness; pm.uFear.value = this.dangerLevel || 0;
      r.render(this.postScene, this.postCam);
    } else {
      r.toneMappingExposure = 0.75 + this.settings.brightness * 0.45;
      r.setRenderTarget(null); r.clear();
      r.render(this.scene, this.camera);
      if (showVM) { r.clearDepth(); r.render(vm.scene, vm.cam); }
    }
    void dt;
  }
}

function safeJSON(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

const game = new Game();
window.__ns = game; // debug/testing handle
game.boot().catch((e) => { console.error(e); reportError('Failed to load: ' + (e && e.message ? e.message : e)); });
void S; void CEIL; void setSeed;
