// Audio, fully synthesised with the Web Audio API (no sound files needed): sound effects,
// a looping crowd ambience that swells on chances and goals, a whistle, and two music loops.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() { this.ctx = null; this.music = 0.5; this.sfx = 0.8; this.muted = false; this.track = null; this.timer = null; }

  /** Must run inside a user gesture (autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(comp);
      this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
      this.crowdBus = c.createGain(); this.crowdBus.gain.value = 0; this.crowdBus.connect(comp);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  set(music, sfx, muted) { this.music = music; this.sfx = sfx; this.muted = muted; this.apply(); }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.music * 0.45, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfx, t, 0.05);
  }
  get ok() { return this.ctx && this.ctx.state === 'running'; }

  tone(type, f0, f1, dur, vol, when = 0, dest = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  hiss(dur, vol, freq, q = 1, type = 'bandpass', when = 0, freqEnd, dest = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.03);
  }

  /** Referee whistle: two detuned high tones with a fast trill. */
  whistle(len = 0.35, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    for (const f of [2900, 3020]) {
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 28; lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.setValueAtTime(0.08, t + len - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(this.sfxBus); o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
    }
  }

  /** Crowd: band-passed noise loop whose volume follows the excitement level. */
  crowd(on) {
    if (!this.ctx) return;
    if (on && !this.crowdSrc) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter();
      s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6; f2.type = 'lowpass'; f2.frequency.value = 2200;
      s.connect(f); f.connect(f2); f2.connect(this.crowdBus); s.start(); this.crowdSrc = s;
    }
    this.crowdBus.gain.setTargetAtTime(on ? 0.07 : 0, this.ctx.currentTime, 0.4);
    if (!on && this.crowdSrc) { const s = this.crowdSrc; this.crowdSrc = null; setTimeout(() => { try { s.stop(); } catch { /* already stopped */ } }, 1500); }
  }
  cheer(level = 1, dur = 2.5) {
    if (!this.ok || !this.crowdSrc) return;
    const g = this.crowdBus.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(0.07 + 0.25 * level, t, 0.08); g.setTargetAtTime(0.07, t + dur, 0.8);
  }

  play(name, v = 1) {
    if (!this.ok) return;
    const T = this.tone.bind(this), N = this.hiss.bind(this);
    switch (name) {
      case 'kick': T('sine', 160, 55, 0.14, 0.9 * v); N(0.07, 0.5 * v, 1800, 0.8); break;
      case 'head': T('sine', 260, 120, 0.1, 0.6); N(0.05, 0.35, 2600, 1); break;
      case 'body': T('sine', 180, 90, 0.08, 0.4); break;
      case 'bounce': T('sine', 120, 70, 0.09, Math.min(0.5, 0.15 + v * 0.0004)); break;
      case 'post': T('triangle', 820, 780, 0.5, 0.35); T('sine', 1640, 1600, 0.35, 0.12); N(0.05, 0.3, 4000, 2); break;
      case 'net': N(0.35, 0.35, 1200, 0.5, 'bandpass', 0, 400); break;
      case 'jump': T('sine', 300, 560, 0.1, 0.18); break;
      case 'land': N(0.06, 0.2, 500, 0.8, 'lowpass'); break;
      case 'swing': N(0.09, 0.18, 2500, 1.4, 'bandpass', 0, 5000); break;
      case 'goal': // stadium horn + whistle
        for (const f of [196, 247, 294]) T('sawtooth', f, f, 1.1, 0.12);
        this.whistle(0.6, 0.05); break;
      case 'countdown': T('square', 660, 660, 0.12, 0.12); break;
      case 'go': T('square', 990, 990, 0.25, 0.14); break;
      case 'end': this.whistle(0.3); this.whistle(0.3, 0.38); this.whistle(0.9, 0.76); break;
      case 'victory': [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => T('square', NOTE(n), NOTE(n), i === 6 ? 0.7 : 0.15, 0.1, i * 0.13)); break;
      case 'ui': T('square', 880, 880, 0.04, 0.05); break;
      case 'select': T('square', 660, 1320, 0.08, 0.08); break;
      case 'confirm': [72, 79].forEach((n, i) => T('square', NOTE(n), NOTE(n), 0.1, 0.08, i * 0.07)); break;
      case 'back': T('square', 500, 300, 0.08, 0.07); break;
      case 'denied': T('square', 170, 150, 0.12, 0.08); break;
      // skills
      case 'fireball': N(0.6, 0.5, 600, 0.6, 'lowpass', 0, 3000); T('sawtooth', 90, 200, 0.5, 0.12); break;
      case 'fireKick': N(0.5, 0.6, 3000, 0.5, 'bandpass', 0, 300); T('sine', 120, 40, 0.4, 0.8); break;
      case 'teleport': T('sine', 300, 1800, 0.25, 0.2); T('sine', 1800, 300, 0.25, 0.15, 0.2); break;
      case 'shrink': T('square', 900, 200, 0.4, 0.1); break;
      case 'mega': T('sawtooth', 80, 160, 0.5, 0.2); N(0.6, 0.35, 400, 1, 'bandpass', 0, 2000); break;
      case 'freeze': for (let i = 0; i < 6; i++) T('sine', 2000 + i * 300, 2400 + i * 300, 0.12, 0.08, i * 0.04); N(0.4, 0.2, 7000, 3); break;
      case 'keeper': T('triangle', 140, 280, 0.35, 0.3); T('triangle', 280, 560, 0.25, 0.15, 0.1); break;
      case 'magnet': T('sawtooth', 110, 110, 0.6, 0.08); T('sine', 220, 440, 0.6, 0.1); break;
      case 'speed': for (let i = 0; i < 3; i++) N(0.08, 0.4, 5000, 3, 'bandpass', i * 0.05); T('sawtooth', 400, 1600, 0.3, 0.08); break;
      case 'ghost': T('sine', 600, 300, 0.7, 0.12); T('sine', 610, 290, 0.7, 0.12); break;
      case 'multi': [0, 4, 7].forEach((n, i) => T('square', NOTE(72 + n), NOTE(72 + n), 0.12, 0.09, i * 0.06)); break;
      case 'gravity': T('sine', 900, 150, 0.6, 0.15); T('sine', 150, 900, 0.6, 0.1, 0.3); break;
      case 'quake': T('sine', 60, 30, 0.9, 0.9); N(0.9, 0.6, 200, 0.5, 'lowpass'); break;
      case 'reverse': T('square', 400, 800, 0.15, 0.08); T('square', 800, 400, 0.15, 0.08, 0.15); break;
      case 'big': T('sine', 120, 60, 0.4, 0.4); T('triangle', 240, 480, 0.3, 0.1); break;
      case 'burn': N(0.3, 0.4, 2000, 0.6); T('sine', 200, 80, 0.2, 0.4); break;
    }
  }

  /** Music: 'menu' (laid-back) | 'match' (light, under the crowd) | null */
  playMusic(track) {
    if (this.track === track) return;
    this.track = track; clearInterval(this.timer); this.timer = null;
    if (!track || !this.ctx) return;
    this.step = 0; this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  schedule() {
    if (!this.ok) return;
    const menu = this.track === 'menu', bpm = menu ? 112 : 128, dt = 60 / bpm / 4;
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass = [48, 45, 41, 43];
    while (this.next < this.ctx.currentTime + 0.12) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4, t = this.next - this.ctx.currentTime, out = this.musicBus;
      if (s % 4 === 0) this.tone('sine', 140, 50, 0.15, menu ? 0.6 : 0.4, t, out);
      if (s === 4 || s === 12) this.hiss(0.1, 0.18, 1800, 0.7, 'bandpass', t, null, out);
      if (s % 2) this.hiss(0.025, 0.06, 9000, 1, 'highpass', t, null, out);
      if (s % 4 === 2 || s === 0) this.tone('triangle', NOTE(bass[bar]), NOTE(bass[bar]), dt * 1.8, 0.2, t, out);
      if (menu && [0, 3, 6, 8, 11, 14].includes(s)) { const n = chords[bar][s % 3] + 12; this.tone('square', NOTE(n), NOTE(n), dt * 0.9, 0.035, t, out); }
      if (!menu && s % 8 === 0) for (const n of chords[bar]) this.tone('triangle', NOTE(n), NOTE(n), dt * 7, 0.025, t, out);
      this.next += dt; this.step++;
    }
  }
}
