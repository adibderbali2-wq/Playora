// Character definitions. Add a new fighter (e.g. BOOM, VOLT) by adding one entry here plus its sprite
// strips in assets/characters/<id>/ and a line in assets/characters/atlas.json. Nothing else needs to change,
// except a new `special.type` if the fighter brings a brand-new special (see specials in fighter.js).
//
// Boxes are in world pixels relative to the fighter's feet: x forward, y up (negative), w/h size.
// Move phases (seconds): startup -> active (hitbox live) -> recovery. `frames` maps each phase to sprite frames.

export const CHARACTERS = {
  bruno: {
    id: 'bruno',
    name: 'BRUNO',
    title: 'The Tank',
    color: '#3D8BFF',
    accent: '#FF8A2B',
    scale: 2.6,
    body: { w: 90, h: 170 },
    stats: { power: 5, speed: 2, defense: 5, mobility: 2 },
    blurb: 'Heavy hitter with thick armour. Slow on his feet, brutal up close.',
    walk: 205,
    run: 300,
    accel: 5200,
    jump: 1060,
    weight: 1.35, // divides knockback received
    defense: 0.8, // multiplies damage received (acts like extra health)
    blockReduction: 0.88, // share of damage stopped by blocking
    guardMax: 130,
    dash: { speed: 880, time: 0.2, cooldown: 0.9, armor: true, invuln: 0 },
    moves: {
      normal: {
        startup: 0.12, active: 0.08, recovery: 0.2, cooldown: 0.12,
        damage: 7, guard: 14, hitstun: 0.32, kb: [300, 0], chain: 3,
        box: { x: 23, y: -138, w: 104, h: 63 },
        frames: { startup: [0, 1, 2], active: [3], recovery: [4] }, anim: 'normal_attack', sfx: 'punch',
      },
      heavy: {
        startup: 0.3, active: 0.1, recovery: 0.4, cooldown: 0.65,
        damage: 15, guard: 36, hitstun: 0.55, kb: [640, -420], knockdown: true,
        box: { x: 23, y: -147, w: 133, h: 79 },
        frames: { startup: [0, 1, 2, 3, 4], active: [5], recovery: [6] }, anim: 'heavy_attack', sfx: 'heavy',
      },
    },
    special: {
      type: 'earthSlam', name: 'Earth Slam', cooldown: 9,
      desc: 'Leaps and slams the ground. The shockwave damages and stuns anyone nearby on the ground. Jump to dodge it!',
      damage: 16, guard: 45, radius: 250, stun: 1.1, kb: [520, -520],
    },
    anims: {
      idle: { fps: 9 }, run: { fps: 13 }, walk: { anim: 'run', fps: 9 },
      jump: { frames: [1, 2, 3, 4] }, fall: { frames: [0, 1, 2, 3], fps: 8 }, land: { anim: 'fall', frames: [4] },
      block: { frames: [1, 2], hold: true }, hit: { fps: 14, once: true }, dash: { frames: [0, 1, 2, 3], fps: 16 },
      victory: { fps: 8, once: true, loopFrom: 3 }, defeat: { fps: 9, once: true }, knockdown: { anim: 'defeat', fps: 10, once: true },
      special: { frames: [0, 1, 2, 3, 4, 5] },
    },
  },

  zippy: {
    id: 'zippy',
    name: 'ZIPPY',
    title: 'The Speed',
    color: '#FF3B3B',
    accent: '#FF9A1F',
    scale: 2.65,
    body: { w: 70, h: 156 },
    stats: { power: 2, speed: 5, defense: 2, mobility: 5 },
    blurb: 'Lightning-fast rabbit. Quick strikes, the best dash in the arena, but fragile.',
    walk: 300,
    run: 470,
    accel: 7200,
    jump: 1140,
    weight: 0.95,
    defense: 1.1,
    blockReduction: 0.75,
    guardMax: 90,
    dash: { speed: 1250, time: 0.2, cooldown: 0.5, armor: false, invuln: 0.14, air: true },
    moves: {
      normal: {
        startup: 0.07, active: 0.07, recovery: 0.15, cooldown: 0.08,
        damage: 4, guard: 9, hitstun: 0.27, kb: [240, 0], chain: 3,
        box: { x: 16, y: -127, w: 88, h: 56 },
        frames: { startup: [0, 1, 2], active: [3], recovery: [4, 5] }, anim: 'normal_attack', sfx: 'jab',
      },
      heavy: {
        startup: 0.2, active: 0.1, recovery: 0.32, cooldown: 0.5,
        damage: 10, guard: 26, hitstun: 0.45, kb: [560, -330], knockdown: true,
        box: { x: 18, y: -136, w: 118, h: 72 },
        frames: { startup: [0, 1, 2, 3, 4], active: [5], recovery: [4] }, anim: 'heavy_attack', sfx: 'heavy',
      },
    },
    special: {
      type: 'speedBoost', name: 'Speed Boost', cooldown: 10,
      desc: 'Overcharges for 4.5 seconds: much faster movement, faster attacks and an almost instant dash.',
      duration: 4.5, moveMul: 1.45, attackSpeed: 1.45, dashCooldownMul: 0.35,
    },
    anims: {
      idle: { fps: 10 }, run: { fps: 15 }, walk: { anim: 'run', fps: 10 },
      jump: { frames: [1, 2, 3, 4] }, fall: { frames: [0, 1, 2], fps: 8 }, land: { anim: 'fall', frames: [3] },
      block: { frames: [1, 2], hold: true }, hit: { fps: 14, once: true }, dash: { fps: 18 },
      victory: { fps: 8, once: true, loopFrom: 3 }, defeat: { fps: 9, once: true }, knockdown: { anim: 'defeat', fps: 10, once: true },
      special: { fps: 14, once: true },
    },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
