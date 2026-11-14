// DOM HUD: bars, ammo, prompts, objective, toasts, chapter cards, damage markers.
const $ = (id) => document.getElementById(id);
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), obj: $('objText'), chTag: $('chTag'), prompt: $('prompt'), hint: $('hint'), toast: $('toast'),
      hp: $('hpBar'), hpTxt: $('hpTxt'), bat: $('batBar'), batTxt: $('batTxt'), batStat: $('batStat'), stam: $('stamBar'),
      ammoBox: $('ammoBox'), mag: $('ammoMag'), res: $('ammoRes'), reload: $('reload'), ring: $('reloadRing'), rHint: $('reloadHint'),
      cross: $('crosshair'), hurt: $('hurt'), dirs: $('dmgDirs'), chapter: $('chapter'), med: $('medTxt'),
    };
    this.toastT = 0; this.hintT = 0; this.last = {};
  }
  show(on) { this.el.hud.hidden = !on; }
  objective(text) {
    this.el.obj.textContent = text;
    this.el.obj.classList.remove('flash'); void this.el.obj.offsetWidth; this.el.obj.classList.add('flash');
  }
  chapterCard(ch) {
    if (!ch) return;
    const c = this.el.chapter;
    $('chNum').textContent = 'CHAPTER ' + ROMAN[ch.n];
    $('chTitle').textContent = ch.title; $('chSub').textContent = ch.sub;
    this.el.chTag.textContent = 'CHAPTER ' + ROMAN[ch.n] + ' · ' + ch.title;
    c.hidden = true; void c.offsetWidth; c.hidden = false;
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
  }
  toast(msg, dur = 3.5) { this.el.toast.textContent = msg; this.el.toast.classList.add('show'); this.toastT = dur; }
  hint(html, dur = 5) { this.el.hint.innerHTML = html; this.el.hint.hidden = false; this.hintT = dur; }
  prompt(html) {
    if (html === this.last.prompt) return; this.last.prompt = html;
    if (!html) { this.el.prompt.hidden = true; return; }
    this.el.prompt.innerHTML = html; this.el.prompt.hidden = false;
  }
  damage(angle) {
    const d = document.createElement('div'); d.className = 'dmgdir';
    d.style.transform = `rotate(${-angle + Math.PI}rad)`;
    this.el.dirs.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 1000);
  }
  hitMarker(head) {
    const c = this.el.cross; c.classList.remove('hit', 'head'); void c.offsetWidth;
    c.classList.add(head ? 'head' : 'hit');
    clearTimeout(this._hm); this._hm = setTimeout(() => c.classList.remove('hit', 'head'), 140);
  }
  update(dt, p) {
    const e = this.el;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.remove('show'); }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) e.hint.hidden = true; }
    const set = (k, v, fn) => { if (this.last[k] !== v) { this.last[k] = v; fn(v); } };
    set('hp', Math.ceil(p.health), (v) => { e.hp.style.transform = `scaleX(${v / 100})`; e.hpTxt.textContent = v; });
    set('bat', p.hasFlashlight ? Math.ceil(p.battery) : -1, (v) => {
      e.batStat.style.opacity = v < 0 ? 0.25 : 1;
      e.bat.style.transform = `scaleX(${Math.max(0, v) / 100})`; e.batTxt.textContent = v < 0 ? '--' : v + '%';
      e.bat.parentElement.classList.toggle('low', v >= 0 && v < 18);
    });
    set('stam', Math.round(p.stamina), (v) => { e.stam.style.transform = `scaleX(${v / 100})`; e.stam.parentElement.parentElement.classList.toggle('show', v < 99); });
    set('med', p.medkits, (v) => { e.med.textContent = v ? `MEDKITS ×${v}  [H]` : ''; });
    set('gun', p.hasPistol, (v) => { e.ammoBox.hidden = !v; });
    set('mag', p.ammo, (v) => { e.mag.textContent = v; e.mag.classList.toggle('low', v <= 3); });
    set('res', p.reserve, (v) => { e.res.textContent = v; });
    const rl = p.reloading > 0;
    set('rl', rl, (v) => { e.reload.hidden = !v; });
    if (rl) e.ring.style.strokeDashoffset = String(100.5 * (p.reloading / 1.55));
    set('rh', p.hasPistol && !rl && p.ammo === 0 && p.reserve > 0, (v) => { e.rHint.hidden = !v; });
    const hurt = Math.max(p.hurtT / 0.6, p.health < 30 ? 0.35 + 0.15 * Math.sin(performance.now() / 260) : 0);
    e.hurt.style.opacity = String(Math.min(1, hurt));
  }
}
