// Input: keyboard (two players on one keyboard), Gamepad API (up to 4 pads) and on-screen touch buttons.
// Every source writes the same intent object: { left, right, jump, kick, skill }.
import { KEYS } from './config.js';

const ACTIONS = ['left', 'right', 'jump', 'kick', 'skill'];
const GAME_CODES = new Set(Object.values(KEYS).flatMap((m) => Object.values(m).flat()));

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { kb1: {}, kb2: {} }; // touch buttons act like the matching keyboard player
    this.listeners = [];
    this.layout = null;
    addEventListener('keydown', (e) => {
      if (GAME_CODES.has(e.code) || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.listeners.forEach((fn) => fn(e));
    }, { passive: false });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.clear());
    if (navigator.keyboard?.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { this.layout = m; }).catch(() => {});
    this.padPrev = [];
  }

  clear() { this.keys.clear(); this.touch = { kb1: {}, kb2: {} }; }
  onKey(fn) { this.listeners.push(fn); }

  /** Connected gamepads (standard mapping), compacted. */
  pads() { return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean); }

  /** Fill `target` from a controller id: 'kb1' | 'kb2' | 'pad0'..'pad3'. */
  read(controller, target) {
    if (controller === 'kb1' || controller === 'kb2') {
      const map = KEYS[controller === 'kb1' ? 'p1' : 'p2'], t = this.touch[controller];
      for (const a of ACTIONS) target[a] = map[a].some((c) => this.keys.has(c)) || t[a] > 0;
      return;
    }
    if (controller && controller.startsWith('pad')) {
      const pad = this.pads()[+controller.slice(3)];
      for (const a of ACTIONS) target[a] = false;
      if (!pad) return;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const ax = pad.axes[0] || 0;
      target.left = ax < -0.4 || b(14);
      target.right = ax > 0.4 || b(15);
      target.jump = b(0) || b(12) || (pad.axes[1] || 0) < -0.6; // A / d-pad up / stick up
      target.kick = b(2) || b(1) || b(7); // X / B / RT
      target.skill = b(3) || b(5) || b(6); // Y / RB / LT
    }
  }

  /** Gamepad button edges for menus: returns list of { pad, button } pressed this frame. */
  padPresses() {
    const out = [];
    this.pads().forEach((pad, i) => {
      const prev = this.padPrev[i] || [];
      pad.buttons.forEach((btn, j) => { if (btn.pressed && !prev[j]) out.push({ pad: i, button: j }); });
      this.padPrev[i] = pad.buttons.map((b) => b.pressed);
    });
    return out;
  }

  label(code) {
    const named = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftRight: 'Shift', ShiftLeft: 'Shift', Numpad0: '0', NumpadEnter: 'Enter', Escape: 'Esc', Space: 'Space', Enter: 'Enter' };
    if (named[code]) return named[code];
    if (this.layout && this.layout.get(code)) return this.layout.get(code).toUpperCase();
    return code.replace(/^Key|^Digit/, '');
  }

  /** Touch buttons: elements with data-c (kb1/kb2) and data-a (action). */
  bindTouch(root) {
    const active = new Map();
    root.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-a]'); if (!el) return;
      e.preventDefault(); el.setPointerCapture?.(e.pointerId);
      const c = el.dataset.c, a = el.dataset.a;
      active.set(e.pointerId, [c, a, el]);
      this.touch[c][a] = (this.touch[c][a] || 0) + 1; el.classList.add('on');
    });
    const up = (e) => {
      const v = active.get(e.pointerId); if (!v) return;
      const [c, a, el] = v; active.delete(e.pointerId);
      this.touch[c][a] = Math.max(0, (this.touch[c][a] || 1) - 1);
      if (!this.touch[c][a]) el.classList.remove('on');
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(ev, up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
