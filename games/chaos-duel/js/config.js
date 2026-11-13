// Global tuning for CHAOS DUEL. World units are pixels of a fixed 1280 x 720 stage.
export const W = 1280;
export const H = 720;
export const GROUND = 618;
export const ARENA_LEFT = 70;
export const ARENA_RIGHT = 1210;

export const GRAVITY = 2900;
export const MAX_FALL = 1700;
export const STEP = 1 / 120; // fixed logic timestep

export const ROUNDS_TO_WIN = 2;
export const MAX_HP = 100;

export const CHAOS = {
  interval: 15, // seconds between event starts
  warning: 2.5, // warning shown before the event starts
};

// Physical key codes (KeyboardEvent.code), so they work on QWERTY and AZERTY alike.
export const CONTROLS = {
  p1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', attack: 'KeyF', heavy: 'KeyG', special: 'KeyH' },
  p2: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', attack: 'KeyK', heavy: 'KeyL', special: 'Semicolon' },
};

export const MODES = {
  chaos: { id: 'chaos', name: 'Chaos Duel', chaos: true, rounds: true },
  classic: { id: 'classic', name: 'Classic Duel', chaos: false, rounds: true },
  // Free Fight: Bruno vs Zippy, one fight, no rounds, no timer, no events. Ends on a K.O. or when players quit.
  free: { id: 'free', name: 'Free Fight', chaos: false, rounds: false, fixedChars: ['bruno', 'zippy'] },
};
