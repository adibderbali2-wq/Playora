// Keyboard + touch input. Keys are tracked by physical code in one shared Set, so any number of keys
// from both players can be held together (true hardware "ghosting" limits on cheap keyboards aside).
import { CONTROLS } from './config.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'heavy', 'special'];
const GAME_CODES = new Set(Object.values(CONTROLS).flatMap((c) => Object.values(c)));

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = [{}, {}]; // touch[player][action] = number of fingers on that button
    this.listeners = [];
    this.layout = null;
    addEventListener('keydown', (e) => {
      if (GAME_CODES.has(e.code) || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) for (const fn of this.listeners) fn(e);
    }, { passive: false });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
    // show the real key labels on AZERTY / QWERTZ keyboards when the browser can tell us
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { this.layout = m; }).catch(() => {});
  }

  clear() { this.keys.clear(); this.touch = [{}, {}]; }

  onKey(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }

  /** Write held state into a fighter's input object. */
  read(player, target) {
    const map = CONTROLS[player === 0 ? 'p1' : 'p2'];
    const t = this.touch[player];
    for (const a of ACTIONS) target[a] = this.keys.has(map[a]) || t[a] > 0;
  }

  label(code) {
    const named = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Semicolon: ';', Space: 'Space', Escape: 'Esc' };
    if (this.layout && this.layout.get(code)) return this.layout.get(code).toUpperCase();
    return named[code] || code.replace(/^Key|^Digit/, '');
  }

  /** Binds on-screen touch buttons: elements with data-p (0/1) and data-a (action). */
  bindTouch(root) {
    const active = new Map(); // pointerId -> [player, action]
    const press = (el, id) => {
      const p = +el.dataset.p, a = el.dataset.a;
      active.set(id, [p, a, el]);
      this.touch[p][a] = (this.touch[p][a] || 0) + 1;
      el.classList.add('on');
    };
    const release = (id) => {
      const v = active.get(id); if (!v) return;
      const [p, a, el] = v; active.delete(id);
      this.touch[p][a] = Math.max(0, (this.touch[p][a] || 1) - 1);
      if (!this.touch[p][a]) el.classList.remove('on');
    };
    root.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-a]'); if (!el) return;
      e.preventDefault(); el.setPointerCapture?.(e.pointerId); press(el, e.pointerId);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(ev, (e) => release(e.pointerId));
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
