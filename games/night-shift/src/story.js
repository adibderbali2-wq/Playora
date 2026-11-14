// Chapters, objectives, pickups, documents, triggers and scripted scares.
import * as THREE from 'three';

export const CHAPTERS = [
  null,
  { n: 1, title: 'THE AWAKENING', sub: 'Ward B — 03:12 AM' },
  { n: 2, title: 'FIRST CONTACT', sub: 'Main Reception' },
  { n: 3, title: 'THE HUNT', sub: 'East Wing' },
  { n: 4, title: 'THE TRUTH', sub: 'Sub-Level B2 — Halvorsen Research' },
];

export const DOCS = {
  doc1: { title: 'Patient Log — Room 103', text: `Night nurse log, Ward B.\n\n01:40 — Mr. Okafor (102) running a fever of 41.2. Pupils fixed. Still talking. Kept asking me to switch the lights off because they "hurt to hear".\n\n02:15 — Dr. Weiss came up from B2 with two men from Halvorsen. They took his chart. They did not take his temperature.\n\n02:50 — Okafor is not breathing. Okafor is sitting up.\n\nI'm locking the ward. Key stays at the station. God forgive me, there are still patients in here.` },
  doc2: { title: 'Security Memo #44', text: `TO: All night staff\nFROM: Head of Security, St. Aldric Memorial\n\nEffective immediately the main entrance will be chained from the OUTSIDE by order of the county health authority. Nobody leaves until the Halvorsen team clears the building.\n\nThe East Wing door is on the security key. The ER is on red access cards only.\n\nIf a patient is aggressive, DO NOT restrain them. Do not let them bite. Noise draws them. Light draws them. Stay quiet.` },
  doc3: { title: 'Surgeon\'s Note — OR 1', text: `Third one tonight. Massive tissue regeneration around the wound — the bullet hole CLOSED while I was looking at it.\n\nCause of death on all three: cardiac arrest. Time between death and "reanimation": 4 to 9 minutes.\n\nThe Halvorsen people call it NS-7. They told us it was a trial for burn victims. Burn victims don't scream like that.\n\nRed card is in the tray. Whoever finds it: the basement key is with Dr. Weiss in the ER. He was bitten.` },
  doc4: { title: 'ER Triage Board', text: `TRIAGE — NIGHT SHIFT\n\nBed 1 — bite, left forearm — DECEASED 02:31 — (moved?)\nBed 2 — bite, neck — DECEASED 02:40 — RESTRAINED\nBed 3 — fever, aggression — sedated x3 — no effect\nBed 4 — Dr. A. Weiss — bite, hand. Refuses treatment. Says "they need to see what's in B2".\n\nStairwell B leads down to the research sub-level. Basement key only.` },
  doc5: { title: 'Halvorsen Biotech — Project LAZARUS', text: `CONFIDENTIAL — PHASE II SUMMARY\n\nCompound NS-7 ("Night Shift") restores cellular activity in recently deceased tissue. Subjects regain motor function within minutes of clinical death.\n\nSide effects: total loss of higher cognition, extreme photosensitivity, hyper-acute hearing, persistent aggression.\n\nSubjects are drawn toward sound and light sources. Destruction of the brain stem is the only reliable means of termination.\n\nPhase III approved for live patients at St. Aldric under the "burn trial" cover.` },
  doc6: { title: 'Virology — Incident Report', text: `Containment breach, Tube 2, 23:58.\n\nSubject L-09 shattered reinforced glass with bare hands. Tissue density is now 3x baseline. L-09 has grown. Mass approx. 190 kg.\n\nL-09 does not respond to tranquilisers. L-09 does not respond to pain.\n\nWe have sealed it in the Containment Hall. The seal releases automatically if main power is restored.\n\nDO NOT RESTORE MAIN POWER.` },
  doc7: { title: 'Dr. Weiss — Personal Recording (transcript)', text: `"If anyone hears this... the infection is airborne in the sub-level vents, but it only turns you if you die. So don't die.\n\nThe emergency exit at the end of B2 opens to the loading bay, outside the quarantine fence. It needs power. The generator panel is missing its fuse — I hid it in cold storage so the Halvorsen men couldn't evacuate without us.\n\nWhen you restore power, the containment seal opens. L-09 will come.\n\nRun. Don't look behind you."` },
};

// Pickups placed in the world. ch = chapter from which it exists (all start present).
export const PICKUPS = [
  { id: 'flashlight', kind: 'flashlight', pos: [0.62, 0.86, 1.25], label: 'Flashlight' },
  { id: 'pistol', kind: 'pistol', pos: [13.6, 0.03, 5.6], label: 'Pistol (9mm)' },
  { id: 'ammo1', kind: 'ammo', amount: 12, pos: [17.4, 0.86, 1.2], label: 'Pistol ammo' },
  { id: 'doc1', kind: 'doc', doc: 'doc1', pos: [25.4, 0.78, 1.8], label: 'Patient Log' },
  { id: 'bat1', kind: 'battery', pos: [26.25, 0.67, 6.6], label: 'Battery' },
  { id: 'wardKey', kind: 'key', key: 'wardKey', pos: [31.0, 1.16, 4.3], label: 'Ward B Key' },
  { id: 'med0', kind: 'medkit', pos: [35.3, 0.74, 2.2], label: 'Medkit' },
  // reception / security
  { id: 'ammo2', kind: 'ammo', amount: 12, pos: [43.6, 1.16, 7.0], label: 'Pistol ammo' },
  { id: 'securityKey', kind: 'key', key: 'securityKey', pos: [44.0, 0.79, 20.5], label: 'Security Key' },
  { id: 'doc2', kind: 'doc', doc: 'doc2', pos: [45.1, 0.79, 20.2], label: 'Security Memo' },
  { id: 'med1', kind: 'medkit', pos: [49.5, 0.74, 23.3], label: 'Medkit' },
  { id: 'bat2', kind: 'battery', pos: [37.2, 0.05, 15.6], label: 'Battery' },
  // east wing
  { id: 'ammo3', kind: 'ammo', amount: 18, pos: [34.0, 0.74, 19.0], label: 'Pistol ammo' },
  { id: 'bat3', kind: 'battery', pos: [37.6, 0.74, 19.0], label: 'Battery' },
  { id: 'med2', kind: 'medkit', pos: [35.1, 0.98, 26.4], label: 'Medkit' },
  { id: 'redCard', kind: 'key', key: 'redCard', card: true, pos: [45.9, 0.98, 26.4], label: 'Red Access Card' },
  { id: 'doc3', kind: 'doc', doc: 'doc3', pos: [47.0, 1.04, 28.5], label: 'Surgeon\'s Note' },
  { id: 'ammo4', kind: 'ammo', amount: 12, pos: [41.4, 0.9, 25.0], label: 'Pistol ammo' },
  { id: 'ammo5', kind: 'ammo', amount: 12, pos: [29.0, 0.74, 29.4], label: 'Pistol ammo' },
  { id: 'doc4', kind: 'doc', doc: 'doc4', pos: [16.0, 1.16, 28.5], label: 'Triage Board' },
  { id: 'basementKey', kind: 'key', key: 'basementKey', pos: [7.6, 0.9, 28.25], label: 'Basement Key' },
  { id: 'med3', kind: 'medkit', pos: [22.6, 0.74, 25.0], label: 'Medkit' },
  // lab
  { id: 'doc5', kind: 'doc', doc: 'doc5', pos: [4.2, 0.94, 49.4], label: 'Project LAZARUS' },
  { id: 'ammo6', kind: 'ammo', amount: 18, pos: [7.8, 0.94, 55.6], label: 'Pistol ammo' },
  { id: 'doc6', kind: 'doc', doc: 'doc6', pos: [18.4, 0.94, 49.4], label: 'Incident Report' },
  { id: 'med4', kind: 'medkit', pos: [12.4, 0.94, 49.4], label: 'Medkit' },
  { id: 'doc7', kind: 'doc', doc: 'doc7', pos: [27.2, 0.79, 54.6], label: 'Weiss Recording' },
  { id: 'bat4', kind: 'battery', pos: [26.6, 0.79, 54.4], label: 'Battery' },
  { id: 'ammo7', kind: 'ammo', amount: 24, pos: [40.6, 0.74, 54.5], label: 'Pistol ammo' },
  { id: 'fuse', kind: 'fuse', pos: [2.0, 0.74, 63.0], label: 'Fuse' },
  { id: 'med5', kind: 'medkit', pos: [6.0, 0.91, 63.4], label: 'Medkit' },
  { id: 'ammo8', kind: 'ammo', amount: 18, pos: [12.0, 0.05, 59.4], label: 'Pistol ammo' },
];

const V = (x, z) => new THREE.Vector3(x, 0, z);

// Infected that exist from a chapter's start.
export const SPAWNS = {
  2: [
    { id: 'lobbyRunner', type: 'runner', pos: V(39.6, 10.4), ry: Math.PI / 2, look: 3, dormant: true },
    { id: 'secWalker', type: 'walker', pos: V(47.0, 22.2), ry: Math.PI, look: 2, feed: true },
  ],
  3: [
    { id: 'eastPatrol', type: 'walker', pos: V(40.5, 21), look: 0, patrol: [V(40.5, 21), V(40.5, 34)] },
    { id: 'storWalker', type: 'walker', pos: V(36.4, 22.6), ry: 2, look: 4, feed: true },
    { id: 'or2Runner', type: 'runner', pos: V(37.6, 32.0), ry: -2.4, look: 1, dormant: true },
    { id: 'corrFeeder', type: 'walker', pos: V(20.5, 37.9), ry: 0, look: 3, feed: true },
    { id: 'corrRunner', type: 'runner', pos: V(9.6, 36.6), ry: Math.PI / 2, look: 2, dormant: true },
    { id: 'erWalker', type: 'walker', pos: V(14, 30), look: 0, patrol: [V(10, 30), V(20, 30), V(20, 26), V(10, 26)] },
  ],
  4: [
    { id: 'labPatrol', type: 'walker', pos: V(22, 58.5), look: 1, patrol: [V(6, 58.5), V(38, 58.5)] },
    { id: 'labAFeed', type: 'walker', pos: V(4.0, 54.6), ry: 0.5, look: 4, feed: true },
    { id: 'labBRunner', type: 'runner', pos: V(17.0, 55.9), ry: Math.PI, look: 3, dormant: true },
    { id: 'archWalker', type: 'walker', pos: V(25, 52), look: 2, patrol: [V(23, 52.5), V(28.5, 52.5), V(28.5, 56), V(23, 56)] },
    { id: 'coldRunner', type: 'runner', pos: V(9.6, 66.5), ry: -Math.PI / 2, look: 0, dormant: true },
  ],
};

export const START = { pos: [3.9, 4.6], yaw: 2.4 };
export const CH_START = {
  2: { pos: [34.5, 10.5], yaw: -Math.PI / 2 },
  3: { pos: [40.5, 16.0], yaw: Math.PI },
  4: { pos: [2.2, 58.5], yaw: -Math.PI / 2 },
};

/* Objective text per story step */
export const OBJ = {
  light: 'Find a light source.',
  search: 'Search the ward for anything you can use.',
  wardKey: 'Find the key to the Ward B exit.',
  wardDoor: 'Unlock the Ward B exit at the east end of the corridor.',
  lobby: 'Find a way out of the hospital.',
  security: 'Search the Security Office for keys.',
  southDoor: 'Unlock the East Wing door (south side of reception).',
  redCard: 'Find a red access card for the Emergency Department.',
  erDoor: 'Unlock the Emergency Department (west corridor).',
  basement: 'Find the basement key. Dr. Weiss was taken to the ER.',
  run: 'RUN! Reach Stairwell B at the far west end of the corridor.',
  explore: 'Explore Sub-Level B2. Find a way out.',
  power: 'Restore power to the emergency exit (Generator Room).',
  fuse: 'Find a replacement fuse.',
  insert: 'Insert the fuse into the generator panel.',
  escape: 'ESCAPE through the Emergency Exit at the east end of B2!',
};

// Story controller. All mutation goes through game APIs.
export class Story {
  constructor(game) {
    this.game = game;
    this.flags = {};
    this.fired = new Set();
    this.timers = [];
  }

  snapshot() { return { flags: { ...this.flags }, fired: [...this.fired] }; }
  restore(s) { this.flags = { ...s.flags }; this.fired = new Set(s.fired); this.timers = []; }

  after(sec, fn) { this.timers.push({ t: sec, fn }); }

  update(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    const g = this.game, p = g.player.pos;
    const inRect = (x0, z0, x1, z1) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
    const once = (id, cond, fn) => { if (!this.fired.has(id) && cond) { this.fired.add(id); fn(); } };
    const ch = this.flags.chapter;

    if (ch === 1) {
      once('corrSteps', inRect(0, 9, 12, 12), () => {
        // footsteps behind you
        const behind = new THREE.Vector3(Math.sin(g.player.yaw) * 5, 0, Math.cos(g.player.yaw) * 5).add(p);
        for (let i = 0; i < 4; i++) this.after(0.4 + i * 0.55, () => g.audio.play3D('zstep', behind, { vol: 0.9 }));
        this.after(2.8, () => g.audio.play3D('whisper', behind, { vol: 0.6 }));
      });
      once('door103', inRect(16, 9, 22, 12), () => {
        const d = g.world.doorById.d103; d.speed = 0.35; g.world.setDoorOpen(d, true, new THREE.Vector3(22.5, 0, 10.5));
        g.audio.play3D('creak', d.pos, { vol: 1.2, rate: 0.8 });
      });
      once('phantom', inRect(25, 9, 30, 12) && g.player.hasPistol, () => {
        const ph = g.spawnZombie('walker', { pos: V(34.9, 10.5), ry: -Math.PI / 2, look: 4, phantom: true, id: 'phantom1' });
        g.world.fixtures.forEach((f) => { if (f.pos.x > 30 && f.pos.z < 13) f.state = 'strobe'; });
        g.audio.play('sting', { vol: 0.5 });
        this.after(1.4, () => { g.removeZombie(ph); g.world.fixtures.forEach((f) => { if (f.pos.x > 30 && f.pos.z < 13 && f.state === 'strobe') f.state = 'flicker'; }); g.audio.play3D('zstep', V(36, 10.5), { vol: 0.7 }); });
      });
      once('nurseFall', inRect(27, 2, 36, 9), () => {
        g.dropObjects(new THREE.Vector3(35.2, 1.9, 2.2), 6);
        g.audio.play3D('clatter', new THREE.Vector3(35.2, 1.4, 2.2), { vol: 1.4 });
        g.player.shake = 0.4;
      });
    }
    if (ch === 2) {
      once('lobbyEnter', inRect(36, 0, 51, 18), () => {
        g.audio.play3D('knock', new THREE.Vector3(52, 1.4, 10.5), { vol: 1.6 });
        this.after(1.5, () => g.audio.play3D('knock', new THREE.Vector3(52, 1.4, 10.5), { vol: 1.8, rate: 0.9 }));
        this.after(5, () => g.audio.play3D('scream1', new THREE.Vector3(60, 2, -10), { vol: 0.8, rate: 0.8 }));
      });
    }
    if (ch === 3) {
      once('eastScream', inRect(39, 26, 42, 36), () => g.audio.play3D('scream0', new THREE.Vector3(10, 1.6, 37.5), { vol: 1, rate: 0.85 }));
      once('orStrobe', inRect(42, 24, 51, 33), () => { g.audio.play3D('buzz', new THREE.Vector3(46.5, 2.8, 26), { vol: 1.0 }); });
      once('glassBreak', inRect(0, 36, 30, 39) && this.flags.erOpen, () => g.audio.play3D('glass', new THREE.Vector3(6, 2, 25), { vol: 1.2 }));
    }
    if (ch === 4) {
      once('labLights', inRect(5, 57, 14, 60), () => {
        const fs = g.world.fixtures.filter((f) => f.pos.z > 57 && f.pos.z < 60 && f.state !== 'dead' && f.kind !== 'red').sort((a, b) => b.pos.x - a.pos.x);
        fs.forEach((f, i) => this.after(0.5 + i * 0.6, () => { f.state = 'dead'; g.audio.play3D('buzz', f.pos, { vol: 0.6 }); }));
        this.after(4, () => g.audio.play3D('knock', new THREE.Vector3(28.5, 1.4, 61), { vol: 1.4, rate: 0.7 }));
      });
      once('labWhisper', inRect(21, 48, 30, 57), () => g.audio.play3D('whisper', new THREE.Vector3(30, 1.5, 50), { vol: 0.8 }));
    }
  }

  /* ----------------------------------------------- chapter starts */
  startChapter(n, fromLoad = false) {
    const g = this.game;
    this.flags.chapter = n;
    g.hud.chapterCard(CHAPTERS[n]);
    if (!fromLoad && SPAWNS[n]) for (const s of SPAWNS[n]) g.spawnZombie(s.type, s);
    if (n === 1) this.setObj(this.game.player.hasFlashlight ? OBJ.search : OBJ.light);
    if (n === 2) this.setObj(OBJ.lobby);
    if (n === 3) this.setObj(OBJ.redCard);
    if (n === 4) this.setObj(OBJ.explore);
    if (!fromLoad) g.checkpoint();
  }

  setObj(text) { this.flags.obj = text; this.game.hud.objective(text); }

  /* ----------------------------------------------- events from game */
  onPickup(pk) {
    const g = this.game, ch = this.flags.chapter;
    if (pk.id === 'flashlight') { this.setObj(OBJ.search); g.hud.hint('Press <b>F</b> to toggle the flashlight. Battery is limited.', 6); }
    if (pk.id === 'pistol') { this.setObj(g.player.keys.has('wardKey') ? OBJ.wardDoor : OBJ.wardKey); g.hud.hint('<b>Left click</b> to shoot · <b>R</b> to reload · Aim for the head.', 7); }
    if (pk.id === 'wardKey') this.setObj(g.player.hasPistol ? OBJ.wardDoor : OBJ.search);
    if (pk.id === 'securityKey') this.setObj(OBJ.southDoor);
    if (pk.id === 'redCard') this.setObj(OBJ.erDoor);
    if (pk.id === 'basementKey') this.chaseSequence();
    if (pk.id === 'fuse') this.setObj(this.flags.panelSeen ? OBJ.insert : OBJ.power);
    if (pk.kind === 'doc' && ch === 4 && pk.id === 'doc7' && !this.flags.panelSeen) this.setObj(OBJ.power);
    if (pk.id === 'medkit' || pk.kind === 'medkit') { if (!this.flags.medHint) { this.flags.medHint = 1; g.hud.hint('Press <b>H</b> to use a medkit.', 5); } }
  }

  onDoorUnlocked(door) {
    const g = this.game;
    if (door.id === 'ward') { g.world.setDoorOpen(door, true, g.player.pos); this.startChapter(2); }
    if (door.id === 'south') { g.world.setDoorOpen(door, true, g.player.pos); this.startChapter(3); }
    if (door.id === 'er') { this.flags.erOpen = 1; this.setObj(OBJ.basement); g.world.setDoorOpen(door, true, g.player.pos); }
  }

  // returns true if the interaction was consumed
  onSpecialDoor(door) {
    const g = this.game;
    if (door.id === 'main') {
      g.hud.toast('Chained shut from the outside. Something is pounding on the other side.');
      g.audio.play3D('knock', new THREE.Vector3(52, 1.4, 10.5), { vol: 1.4 });
      if (this.flags.chapter === 2 && !this.flags.mainSeen) { this.flags.mainSeen = 1; this.setObj(OBJ.security); }
      return true;
    }
    if (door.id === 'stairs' && g.player.keys.has('basementKey')) {
      g.audio.play3D('unlock', door.pos, { vol: 1 });
      g.descend();
      return true;
    }
    if (door.id === 'labStairs') { g.hud.toast('The stairwell collapsed behind you. There is no way back up.'); return true; }
    if (door.id === 'contain') { g.hud.toast('CONTAINMENT SEAL ACTIVE. Something heavy breathes behind the door.'); g.audio.play3D('roar', door.pos, { vol: 0.4, rate: 0.6 }); return true; }
    if (door.id === 'exit' && !g.player.keys.has('power')) {
      g.hud.toast('EMERGENCY EXIT — NO POWER. Restore main power in the Generator Room.');
      if (!this.flags.panelSeen) this.setObj(OBJ.power);
      return true;
    }
    if (door.id === 'exit' && g.player.keys.has('power')) { g.victory(); return true; }
    return false;
  }

  onPanel() {
    const g = this.game;
    if (this.flags.powered) { g.hud.toast('Power is on. Get to the exit!'); return; }
    this.flags.panelSeen = 1;
    if (!g.player.items.has('fuse')) { g.hud.toast('The main breaker is missing its fuse.'); this.setObj(OBJ.fuse); g.audio.play('locked', { vol: 0.6 }); return; }
    g.player.items.delete('fuse');
    this.flags.powered = 1;
    g.player.keys.add('power');
    g.audio.play('power', { vol: 1 });
    g.hud.toast('Main power restored. Emergency exit unlocked.');
    this.setObj(OBJ.escape);
    g.audio.loop('alarm', 'alarm', 0.25, 'sfx');
    g.world.fixtures.forEach((f) => { if (f.pos.z > 47) { if (f.kind === 'red') f.state = 'strobe'; else if (f.state === 'dead' && Math.random() < 0.6) f.state = 'flicker'; } });
    const exitDoor = g.world.doorById.exit; exitDoor.locked = false;
    // the seal releases — L-09 is coming
    this.after(3.0, () => {
      const d = g.world.doorById.contain; d.sealed = false; d.locked = false; d.speed = 2.5;
      g.world.setDoorOpen(d, true, new THREE.Vector3(28.5, 0, 63));
      g.audio.play3D('doorBang', d.pos, { vol: 2 });
      g.spawnZombie('tank', { pos: V(28.5, 63.5), ry: Math.PI, look: 2, id: 'tank', aggro: true });
      g.spawnZombie('walker', { pos: V(24, 64), look: 0, id: 'cw1', aggro: true });
      g.spawnZombie('runner', { pos: V(33, 64), look: 1, id: 'cr1', aggro: true });
      g.hud.toast('L-09 HAS BEEN RELEASED');
      g.music('chase');
    });
  }

  chaseSequence() {
    const g = this.game;
    this.setObj(OBJ.run);
    g.audio.play('sting', { vol: 0.8 });
    g.player.shake = 0.6;
    g.audio.loop('alarm', 'alarm', 0.22, 'sfx');
    g.world.fixtures.forEach((f) => { if (f.pos.z > 18 && f.pos.z < 40) f.state = f.kind === 'red' ? 'strobe' : (Math.random() < 0.5 ? 'dead' : 'strobe'); });
    const sb = g.world.doorById.storB;
    this.after(1.2, () => {
      g.world.setDoorOpen(sb, true, new THREE.Vector3(25.5, 0, 31)); g.audio.play3D('doorBang', sb.pos, { vol: 2 });
      g.spawnZombie('runner', { pos: V(26.5, 33.5), look: 0, id: 'chaseR1', aggro: true });
      g.spawnZombie('runner', { pos: V(28.5, 31.5), look: 4, id: 'chaseR2', aggro: true });
    });
    this.after(0.3, () => {
      g.spawnZombie('walker', { pos: V(12.4, 33.5), look: 1, id: 'chaseW1', aggro: true });
      g.spawnZombie('walker', { pos: V(20.2, 23.2), look: 3, id: 'chaseW2', aggro: true });
    });
    this.after(4, () => g.spawnZombie('runner', { pos: V(40.5, 37.5), look: 2, id: 'chaseR3', aggro: true }));
    g.music('chase');
  }
}
