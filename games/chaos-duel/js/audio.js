// Audio: every sound effect and both music tracks are synthesised with the Web Audio API,
// so the game ships no audio files. Music and SFX have separate volume controls.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.musicVol = 0.5; this.sfxVol = 0.8;
    this.track = null; this.step = 0; this.nextTime = 0; this.timer = null; this.intensity = 0;
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.comp = this.ctx.createDynamicsCompressor(); this.comp.connect(this.master);
      this.music = this.ctx.createGain(); this.music.connect(this.comp);
      this.musicFilter = this.ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 9000;
      this.musicFilter.connect(this.music);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.comp);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes(this.musicVol, this.sfxVol);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  suspend(on) { if (this.ctx) on ? this.ctx.suspend() : this.ctx.resume(); }

  // ------------------------------------------------------------ primitives
  tone(type, f0, f1, dur, vol, when = 0, dest = this.sfx) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, freq, q = 1, type = 'bandpass', when = 0, freqEnd, dest = this.sfx) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const T = this.tone.bind(this), N = this.noise.bind(this);
    switch (name) {
      case 'whoosh': N(0.12, 0.25, 1800, 1.2, 'bandpass', 0, 4000); break;
      case 'whooshHeavy': N(0.25, 0.3, 500, 1, 'bandpass', 0, 2200); break;
      case 'punch': case 'jab': case 'hit': T('sine', 180, 60, 0.12, 0.7); N(0.08, 0.5, 2500, 0.8); break;
      case 'hitHeavy': T('sine', 140, 40, 0.28, 0.9); N(0.2, 0.6, 900, 0.7, 'lowpass'); T('square', 90, 50, 0.1, 0.15); break;
      case 'block': T('square', 1200, 900, 0.07, 0.15); N(0.05, 0.3, 5000, 2); break;
      case 'armor': T('triangle', 300, 200, 0.12, 0.35); N(0.06, 0.3, 3000, 3); break;
      case 'guardBreak': T('sawtooth', 600, 80, 0.35, 0.3); N(0.3, 0.5, 3000, 0.5); break;
      case 'jump': T('sine', 260, 620, 0.14, 0.3); break;
      case 'boing': T('sine', 180, 520, 0.18, 0.35); T('triangle', 360, 900, 0.12, 0.12, 0.03); break;
      case 'dash': N(0.22, 0.4, 900, 0.8, 'bandpass', 0, 5000); break;
      case 'slamStart': T('sawtooth', 120, 420, 0.3, 0.12); break;
      case 'slam': T('sine', 90, 28, 0.6, 1); N(0.6, 0.8, 300, 0.6, 'lowpass', 0, 60); N(0.25, 0.4, 2400, 0.5); break;
      case 'boost': [0, 4, 7, 12, 16].forEach((n, i) => T('sawtooth', NOTE(64 + n), NOTE(64 + n), 0.09, 0.14, i * 0.045)); N(0.4, 0.25, 1500, 1, 'bandpass', 0, 8000); break;
      case 'boostEnd': T('sawtooth', 600, 200, 0.2, 0.1); break;
      case 'thud': T('sine', 100, 40, 0.2, 0.6); N(0.12, 0.3, 400, 0.7, 'lowpass'); break;
      case 'siren': for (let i = 0; i < 4; i++) { T('square', 660, 660, 0.2, 0.09, i * 0.42); T('square', 880, 880, 0.2, 0.09, i * 0.42 + 0.21); } break;
      case 'chaosStart': T('sawtooth', 110, 55, 0.5, 0.25); [57, 60, 64, 69].forEach((n) => T('square', NOTE(n), NOTE(n), 0.35, 0.06)); N(0.5, 0.35, 600, 0.5, 'bandpass', 0, 6000); break;
      case 'meteorFall': N(0.7, 0.12, 3000, 2, 'bandpass', 0, 300); break;
      case 'explode': T('sine', 120, 30, 0.45, 0.8); N(0.45, 0.6, 1200, 0.5, 'lowpass', 0, 100); break;
      case 'zap': T('sawtooth', 1400, 200, 0.15, 0.2); N(0.12, 0.35, 6000, 3); break;
      case 'beep': T('square', 660, 660, 0.12, 0.15); break;
      case 'fight': T('square', 990, 990, 0.3, 0.16); T('sawtooth', 110, 110, 0.4, 0.2); N(0.4, 0.3, 4000, 0.4); break;
      case 'roundStart': N(0.6, 0.2, 400, 0.6, 'bandpass', 0, 3000); break;
      case 'ko': T('sine', 200, 30, 1, 0.9); N(0.8, 0.5, 2000, 0.5, 'lowpass', 0, 80); T('sawtooth', 440, 110, 0.8, 0.12); break;
      case 'timeUp': [72, 67, 64].forEach((n, i) => T('square', NOTE(n), NOTE(n), 0.18, 0.12, i * 0.16)); break;
      case 'victory': [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => T('square', NOTE(n), NOTE(n), i === 6 ? 0.6 : 0.14, 0.12, i * 0.13)); [48, 55].forEach((n) => T('triangle', NOTE(n), NOTE(n), 1, 0.2, 0.78)); break;
      case 'defeat': [64, 63, 62, 58].forEach((n, i) => T('triangle', NOTE(n), NOTE(n) * 0.98, i === 3 ? 0.8 : 0.3, 0.2, i * 0.3)); break;
      case 'ui': T('square', 880, 880, 0.04, 0.06); break;
      case 'select': T('square', 660, 1320, 0.1, 0.1); break;
      case 'confirm': [72, 79].forEach((n, i) => T('square', NOTE(n), NOTE(n), 0.12, 0.1, i * 0.07)); break;
      case 'back': T('square', 500, 300, 0.08, 0.08); break;
      case 'denied': T('square', 160, 140, 0.12, 0.1); break;
    }
  }

  // ----------------------------------------------------------------- music
  /** track: 'menu' | 'fight' | null */
  playMusic(track) {
    if (this.track === track) return;
    this.track = track;
    clearInterval(this.timer); this.timer = null;
    if (!track || !this.ctx) return;
    this.step = 0; this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setIntensity(on) {
    this.intensity = on ? 1 : 0;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(on ? 12000 : 9000, this.ctx.currentTime, 0.2);
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fight = this.track === 'fight';
    const bpm = fight ? 148 : 104;
    const dt = 60 / bpm / 4;
    // i - VI - III - VII in A minor
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const bass = [45, 41, 36, 43];
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const s = this.step % 16, bar = Math.floor(this.step / 16) % 4, t = this.nextTime - this.ctx.currentTime;
      const out = this.musicFilter;
      if (fight) {
        if (s % 4 === 0) this.tone('sine', 150, 45, 0.16, 0.9, t, out);
        if (s === 4 || s === 12) this.noise(0.12, 0.35, 1800, 0.7, 'bandpass', t, null, out);
        if (s % 2 === 1 || this.intensity) this.noise(0.03, 0.12, 9000, 1, 'highpass', t, null, out);
        if (s % 2 === 0) this.tone('sawtooth', NOTE(bass[bar] + (s % 8 === 6 ? 12 : 0)), NOTE(bass[bar]), dt * 1.6, 0.16, t, out);
        const ch = chords[bar];
        if ([0, 3, 6, 10, 12].includes(s)) this.tone('square', NOTE(ch[(s / 3 | 0) % 3] + 12), NOTE(ch[(s / 3 | 0) % 3] + 12), dt * 0.9, 0.045 + this.intensity * 0.02, t, out);
      } else {
        if (s % 8 === 0) this.tone('sine', 120, 50, 0.2, 0.5, t, out);
        if (s === 8) this.noise(0.1, 0.12, 2000, 0.7, 'bandpass', t, null, out);
        if (s % 4 === 2) this.noise(0.02, 0.06, 9000, 1, 'highpass', t, null, out);
        if (s === 0) this.tone('triangle', NOTE(bass[bar]), NOTE(bass[bar]), dt * 7, 0.22, t, out);
        const ch = chords[bar];
        this.tone('square', NOTE(ch[s % 3] + 12 + (s % 6 === 5 ? 12 : 0)), NOTE(ch[s % 3] + 12), dt * 0.8, 0.03, t, out);
      }
      this.nextTime += dt; this.step++;
    }
  }
}
