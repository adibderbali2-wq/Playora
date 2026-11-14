// Procedural audio: every sound is synthesised at load (no audio files to ship),
// played through HRTF panners so you can hear where the infected are.
let SR = 44100;

function buf(ctx, seconds, fn, channels = 1) {
  const n = Math.floor(seconds * SR);
  const b = ctx.createBuffer(channels, n, SR);
  for (let c = 0; c < channels; c++) {
    const d = b.getChannelData(c);
    fn(d, n, c);
  }
  return b;
}

// tiny DSP helpers
function lowpass(d, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0; for (let i = 0; i < d.length; i++) { y = (1 - a) * d[i] + a * y; d[i] = y; } }
function highpass(d, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0, px = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - px); px = x; d[i] = y; } }
function resonator(input, freqFn, q) {
  // 2-pole resonant bandpass with time-varying frequency
  const out = new Float32Array(input.length); let y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const f = freqFn(i / SR); const w = 2 * Math.PI * f / SR; const r = Math.exp(-w / (2 * q));
    const y = (1 - r) * input[i] + 2 * r * Math.cos(w) * y1 - r * r * y2;
    y2 = y1; y1 = y; out[i] = y;
  }
  return out;
}
function normalize(d, peak = 0.9) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; }
const R = (a, b) => a + Math.random() * (b - a);

// Glottal-pulse "voice" through formants: groans, growls, screams.
function voice(dur, { f0 = 90, f0End = 70, jitter = 0.15, formants = [[500, 6], [1100, 8], [2500, 10]], vowelMorph = 0.3, noise = 0.2, env = null, vib = 0, vibRate = 6, harsh = 0 }) {
  const n = Math.floor(dur * SR); const src = new Float32Array(n);
  let ph = 0, jit = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = t / dur;
    if (i % 400 === 0) jit = (Math.random() - 0.5) * jitter;
    const f = (f0 + (f0End - f0) * k) * (1 + jit + vib * Math.sin(2 * Math.PI * vibRate * t));
    ph += f / SR; if (ph > 1) ph -= 1;
    let s = ph < 0.6 ? Math.sin(Math.PI * ph / 0.6) ** 3 : 0; // glottal pulse
    s += (Math.random() - 0.5) * noise;
    if (harsh) s = Math.tanh(s * (1 + harsh * 4));
    src[i] = s;
  }
  let out = new Float32Array(n);
  formants.forEach(([f, q], idx) => {
    const r = resonator(src, (t) => f * (1 + vowelMorph * Math.sin(t * 2.3 + idx) * 0.5), q);
    for (let i = 0; i < n; i++) out[i] += r[i] / (idx + 1);
  });
  for (let i = 0; i < n; i++) { const k = i / n; out[i] *= env ? env(k) : Math.sin(Math.PI * Math.min(1, k * 4)) * (1 - k) ** 0.6; }
  normalize(out, 0.9);
  return out;
}

export class Audio {
  constructor() {
    this.ctx = null; this.ready = false; this.buffers = {};
    this.vol = { master: 0.8, sfx: 0.9, music: 0.6 };
    this.loops = {};
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    SR = ctx.sampleRate;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    // shared reverb bus — long hospital corridors
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = buf(ctx, 2.8, (d, n) => { for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }, 2);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain); this.revGain.connect(this.sfx);
    this.applyVolumes();
    this.generate();
    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfx.gain.value = this.vol.sfx;
    this.music.gain.value = this.vol.music;
  }

  generate() {
    const c = this.ctx, B = this.buffers;
    const mk = (dur, fn) => buf(c, dur, fn);
    B.shot = mk(1.2, (d, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const crack = (Math.random() * 2 - 1) * Math.exp(-t * 90);
        const body = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.6;
        const thump = Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 12) * 1.2;
        const tail = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.12;
        d[i] = crack + body + thump + tail;
      }
      lowpass(d, 5200); normalize(d, 1);
    });
    B.dry = mk(0.12, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 300) + Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 200) * 0.5; } normalize(d, 0.5); });
    const click = (f, decay, amp) => (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = ((Math.random() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * f * t)) * Math.exp(-t * decay) * amp; } };
    B.magOut = mk(0.25, click(900, 60, 0.6));
    B.magIn = mk(0.25, (d, n) => { click(700, 50, 0.8)(d, n); for (let i = Math.floor(0.05 * SR); i < n; i++) { const t = i / SR - 0.05; d[i] += (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.7; } });
    B.slide = mk(0.35, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const a = t < 0.12 ? (Math.random() * 2 - 1) * 0.3 : 0; const b = t > 0.15 ? ((Math.random() * 2 - 1) * 0.8 + Math.sin(2 * Math.PI * 1300 * t) * 0.5) * Math.exp(-(t - 0.15) * 70) : 0; d[i] = a + b; } normalize(d, 0.7); });
    B.click = mk(0.08, click(3000, 160, 0.6));
    B.shell = mk(0.5, (d, n) => { for (let k = 0; k < 3; k++) { const o = Math.floor((0.0 + k * 0.11) * SR); for (let i = o; i < n; i++) { const t = (i - o) / SR; d[i] += (Math.sin(2 * Math.PI * 4200 * t) + Math.sin(2 * Math.PI * 6900 * t) * 0.6) * Math.exp(-t * 60) * (0.5 / (k + 1)); } } });
    // footsteps (4 variations) on tiles
    for (let v = 0; v < 4; v++) B['step' + v] = mk(0.22, (d, n) => { const f = R(70, 110); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * R(40, 60)) * 0.7 + Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 35); } lowpass(d, R(1500, 2600)); normalize(d, 0.5); });
    B.zstep = mk(0.35, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20) * (t < 0.12 ? 1 : 0.4); } lowpass(d, 900); normalize(d, 0.5); });
    B.stomp = mk(0.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * (45 + 30 * Math.exp(-t * 20)) * t) * Math.exp(-t * 9) + (Math.random() * 2 - 1) * Math.exp(-t * 25) * 0.4; } lowpass(d, 600); normalize(d, 0.9); });
    B.land = mk(0.3, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 18) + (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.5; } lowpass(d, 1200); normalize(d, 0.6); });
    B.flesh = mk(0.3, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 25) * (1 + Math.sin(2 * Math.PI * 30 * t)); } lowpass(d, 1400); normalize(d, 0.8); });
    B.ricochet = mk(0.4, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 80) + Math.sin(2 * Math.PI * (3200 - 2000 * t) * t) * Math.exp(-t * 14) * 0.25; } normalize(d, 0.5); });
    B.impact = mk(0.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 70); } lowpass(d, 3000); normalize(d, 0.6); });
    // zombie vocals
    B.groan0 = this.f32(voice(2.2, { f0: 85, f0End: 62, formants: [[450, 5], [900, 7], [2300, 9]], noise: 0.4, harsh: 0.3 }));
    B.groan1 = this.f32(voice(1.8, { f0: 105, f0End: 75, formants: [[600, 5], [1000, 6], [2500, 9]], noise: 0.5, harsh: 0.5, vowelMorph: 0.6 }));
    B.groan2 = this.f32(voice(2.6, { f0: 70, f0End: 90, formants: [[380, 5], [800, 6], [2200, 9]], noise: 0.35, harsh: 0.6 }));
    B.growl0 = this.f32(voice(1.1, { f0: 75, f0End: 60, formants: [[700, 4], [1200, 6], [2600, 8]], noise: 0.9, harsh: 0.9, jitter: 0.4, env: (k) => Math.min(1, k * 8) * (1 - k) }));
    B.growl1 = this.f32(voice(0.9, { f0: 95, f0End: 70, formants: [[650, 4], [1250, 6], [2400, 8]], noise: 0.9, harsh: 1.0, jitter: 0.5, env: (k) => Math.min(1, k * 10) * (1 - k) }));
    B.scream0 = this.f32(voice(1.6, { f0: 330, f0End: 230, formants: [[900, 6], [1400, 8], [2900, 9]], noise: 0.8, harsh: 1.2, vib: 0.06, vibRate: 9, jitter: 0.25, env: (k) => Math.min(1, k * 10) * Math.pow(1 - k, 0.8) }));
    B.scream1 = this.f32(voice(1.4, { f0: 420, f0End: 280, formants: [[1000, 6], [1600, 8], [3100, 9]], noise: 0.9, harsh: 1.4, vib: 0.08, vibRate: 11, jitter: 0.3, env: (k) => Math.min(1, k * 12) * Math.pow(1 - k, 0.7) }));
    B.roar = this.f32(voice(2.2, { f0: 60, f0End: 42, formants: [[380, 4], [800, 5], [1900, 7]], noise: 1.0, harsh: 1.5, jitter: 0.4, env: (k) => Math.min(1, k * 6) * Math.pow(1 - k, 0.6) }));
    B.pain = this.f32(voice(0.5, { f0: 160, f0End: 110, formants: [[700, 5], [1200, 7], [2600, 9]], noise: 0.7, harsh: 0.8, env: (k) => Math.min(1, k * 15) * (1 - k) }));
    B.death = this.f32(voice(1.6, { f0: 120, f0End: 50, formants: [[550, 5], [950, 6], [2400, 9]], noise: 0.6, harsh: 0.6, env: (k) => Math.min(1, k * 8) * Math.pow(1 - k, 1.4) }));
    B.swing = mk(0.35, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t / 0.35) ** 2; } highpass(d, 600); lowpass(d, 2500); normalize(d, 0.4); });
    // player
    B.hurt = this.f32(voice(0.45, { f0: 140, f0End: 100, formants: [[650, 6], [1100, 8], [2500, 10]], noise: 0.4, env: (k) => Math.min(1, k * 20) * (1 - k) }));
    B.heart = mk(0.6, (d, n) => { for (const o of [0, 0.22]) { const s0 = Math.floor(o * SR); for (let i = s0; i < n; i++) { const t = (i - s0) / SR; d[i] += Math.sin(2 * Math.PI * (48 - t * 30) * t) * Math.exp(-t * 18) * (o ? 0.7 : 1); } } lowpass(d, 200); normalize(d, 0.9); });
    B.breath = mk(3.2, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; const cyc = (t % 1.6) / 1.6; const e = cyc < 0.45 ? Math.sin(Math.PI * cyc / 0.45) : (cyc < 0.95 ? Math.sin(Math.PI * (cyc - 0.45) / 0.5) * 0.7 : 0); d[i] = (Math.random() * 2 - 1) * e * e; } highpass(d, 300); lowpass(d, 2200); normalize(d, 0.5); });
    // world
    B.creak = mk(1.6, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 140 + 60 * Math.sin(t * 3) + 25 * Math.sin(t * 17) + (Math.random() - 0.5) * 20; ph += f / SR; const s = (ph % 1) < 0.15 ? 1 : -0.1; d[i] = s * Math.sin(Math.PI * t / 1.6); } const r = resonator(d, () => 900, 3); d.set(r); normalize(d, 0.5); });
    B.doorBang = mk(0.8, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 10) + (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.7 + Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 14) * 0.3; } lowpass(d, 1800); normalize(d, 0.9); });
    B.doorOpen = mk(0.6, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = ((Math.random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 1800 * t) * 0.3) * Math.exp(-t * 40) + Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t * 8) * 0.3; } normalize(d, 0.5); });
    B.locked = mk(0.35, (d, n) => { for (const o of [0, 0.12]) { const s0 = Math.floor(o * SR); for (let i = s0; i < n; i++) { const t = (i - s0) / SR; d[i] += ((Math.random() * 2 - 1) * 0.5 + Math.sin(2 * Math.PI * 900 * t)) * Math.exp(-t * 50); } } normalize(d, 0.5); });
    B.unlock = mk(0.5, (d, n) => { for (const o of [0, 0.15, 0.22]) { const s0 = Math.floor(o * SR); for (let i = s0; i < n; i++) { const t = (i - s0) / SR; d[i] += (Math.sin(2 * Math.PI * 2100 * t) + (Math.random() * 2 - 1) * 0.5) * Math.exp(-t * 70); } } normalize(d, 0.6); });
    B.clatter = mk(1.8, (d, n) => { for (let k = 0; k < 9; k++) { const o = Math.floor(R(0, 0.9) * SR); const f = R(600, 4500); const amp = R(0.3, 1); for (let i = o; i < n; i++) { const t = (i - o) / SR; d[i] += (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.48 * t) * 0.5 + (Math.random() - 0.5) * 0.4) * Math.exp(-t * R(8, 25)) * amp; } } normalize(d, 0.8); });
    B.pickup = mk(0.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 660 * t) * 0.5 + Math.sin(2 * Math.PI * 990 * t) * 0.3) * Math.exp(-t * 8) * Math.min(1, t * 200); } normalize(d, 0.35); });
    B.note = mk(0.6, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t / 0.6) * 0.5; } highpass(d, 1500); normalize(d, 0.3); });
    B.sting = mk(3.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (const f of [61.7, 65.4, 92.5, 138.6, 277.2, 293.7]) s += Math.sin(2 * Math.PI * f * t + Math.sin(t * 7) * 2); d[i] = s * Math.exp(-t * 1.1) * Math.min(1, t * 30) + (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.6; } normalize(d, 1); });
    B.whisper = mk(2.4, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7)) * Math.sin(Math.PI * t / 2.4); } const r = resonator(d, (t) => 1800 + 900 * Math.sin(t * 5), 4); d.set(r); normalize(d, 0.4); });
    B.knock = mk(1.2, (d, n) => { for (const o of [0, 0.28, 0.5]) { const s0 = Math.floor(o * SR); for (let i = s0; i < n; i++) { const t = (i - s0) / SR; d[i] += Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 30) + (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.4; } } lowpass(d, 1500); normalize(d, 0.9); });
    B.glass = mk(1.4, (d, n) => { for (let k = 0; k < 14; k++) { const o = Math.floor(R(0, 0.5) * SR); const f = R(2500, 7500); for (let i = o; i < n; i++) { const t = (i - o) / SR; d[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * R(12, 30)) * R(0.2, 0.6); } } for (let i = 0; i < n; i++) d[i] += (Math.random() * 2 - 1) * Math.exp(-i / SR * 20) * 0.6; normalize(d, 0.7); });
    B.buzz = mk(1.0, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 100 * t) * 0.6 + Math.sin(2 * Math.PI * 200 * t) * 0.3 + (Math.random() - 0.5) * 0.15) * (0.5 + 0.5 * Math.sign(Math.sin(t * 40))); } normalize(d, 0.25); });
    B.power = mk(3.0, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 30 + 90 * Math.min(1, t / 2); ph += f / SR; d[i] = (Math.sin(2 * Math.PI * ph) + Math.sin(4 * Math.PI * ph) * 0.4) * Math.min(1, t * 2) * (1 - Math.max(0, t - 2.2) / 0.8); } normalize(d, 0.8); });
    B.alarm = mk(2.0, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = t % 1 < 0.5 ? 880 : 660; ph += f / SR; d[i] = (ph % 1 < 0.5 ? 1 : -1) * 0.35; } lowpass(d, 3000); });
    // ambience: low hospital hum + air handling + distant rumble (seamless loop)
    B.ambience = buf(c, 12, (d, n, ch) => {
      let lp = 0, lp2 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const hum = Math.sin(2 * Math.PI * 50 * t) * 0.05 + Math.sin(2 * Math.PI * 100 * t) * 0.02;
        lp = lp * 0.995 + (Math.random() * 2 - 1) * 0.005; lp2 = lp2 * 0.9995 + (Math.random() * 2 - 1) * 0.0008;
        const wind = lp * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 12 + ch)) * 4;
        d[i] = hum + wind + lp2 * 8;
      }
      const fade = 2000; for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[n - 1 - i] *= k; }
    }, 2);
    // menu / tension drone: detuned minor cluster with slow beating
    B.drone = buf(c, 16, (d, n, ch) => {
      for (let i = 0; i < n; i++) {
        const t = i / SR; let s = 0;
        for (const [f, a] of [[55, 0.3], [55.4, 0.25], [65.4, 0.18], [82.4, 0.12], [110.2, 0.08], [164.8, 0.04], [233.1, 0.03]]) s += Math.sin(2 * Math.PI * f * t + ch) * a * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 16 * (1 + a * 3)));
        d[i] = s * 0.6;
      }
    }, 2);
    B.chase = buf(c, 4, (d, n, ch) => {
      for (let i = 0; i < n; i++) {
        const t = i / SR, beat = t % 0.5;
        let s = Math.sin(2 * Math.PI * 45 * t) * Math.exp(-beat * 9) * 0.9;
        s += Math.sin(2 * Math.PI * (440 + ch * 3) * t) * Math.sin(2 * Math.PI * 466 * t) * 0.06 * (0.5 + 0.5 * Math.sin(t * 3));
        s += (Math.random() * 2 - 1) * Math.exp(-((t + 0.25) % 0.5) * 30) * 0.15;
        d[i] = s;
      }
    }, 2);
  }

  f32(arr) { const b = this.ctx.createBuffer(1, arr.length, SR); b.getChannelData(0).set(arr); return b; }

  updateListener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position;
    const f = cam.getWorldDirection(this._f || (this._f = cam.position.clone()));
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }

  play(name, { vol = 1, rate = 1, reverb = 0.3, when = 0 } = {}) {
    if (!this.ready) return null;
    const b = this.buffers[name]; if (!b) return null;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.sfx);
    if (reverb) { const rg = this.ctx.createGain(); rg.gain.value = reverb; g.connect(rg); rg.connect(this.reverb); }
    s.start(this.ctx.currentTime + when);
    return { src: s, gain: g };
  }

  play3D(name, pos, { vol = 1, rate = 1, ref = 2, rolloff = 1.3, reverb = 0.45, max = 60 } = {}) {
    if (!this.ready) return null;
    const b = this.buffers[name]; if (!b) return null;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol;
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = max;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1.2, pos.z);
    s.connect(g); g.connect(p); p.connect(this.sfx);
    const rg = c.createGain(); rg.gain.value = reverb; g.connect(rg); rg.connect(this.reverb);
    s.start();
    return { src: s, gain: g, panner: p };
  }

  zombie(z, kind) {
    const pos = z.headPos.clone();
    const rate = z.type === 'tank' ? 0.65 : z.type === 'runner' ? 1.1 + Math.random() * 0.1 : 0.9 + Math.random() * 0.2;
    let name;
    if (kind === 'groan') name = 'groan' + ((Math.random() * 3) | 0);
    else if (kind === 'growl') name = 'growl' + ((Math.random() * 2) | 0);
    else if (kind === 'scream') name = z.type === 'tank' ? 'roar' : 'scream' + ((Math.random() * 2) | 0);
    else name = kind;
    const vol = kind === 'scream' ? 1.4 : kind === 'groan' ? 0.75 : 1;
    if (z.voice && kind !== 'death' && kind !== 'scream') { try { if (z.voice.src) return; } catch (e) { /* ignore */ } }
    const h = this.play3D(name, pos, { vol, rate: kind === 'swing' ? 1 : rate, ref: kind === 'scream' ? 5 : 2.5 });
    if (h && kind !== 'swing') { z.voice = h; h.src.onended = () => { if (z.voice === h) z.voice = null; }; }
  }

  loop(name, bufName, vol = 1, bus = 'music', fade = 1.5) {
    if (!this.ready) return;
    if (this.loops[name]) { this.loops[name].gain.gain.setTargetAtTime(vol, this.ctx.currentTime, fade / 3); return; }
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[bufName]; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(vol, this.ctx.currentTime, fade / 3);
    s.connect(g); g.connect(bus === 'music' ? this.music : this.sfx); s.start();
    this.loops[name] = { src: s, gain: g };
  }
  loopVol(name, vol, tc = 0.3) { const l = this.loops[name]; if (l) l.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, tc); }
  stopLoop(name, fade = 1) {
    const l = this.loops[name]; if (!l) return;
    l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    const s = l.src; setTimeout(() => { try { s.stop(); } catch (e) { /* stopped */ } }, fade * 1500);
    delete this.loops[name];
  }
  stopAllLoops() { for (const k of Object.keys(this.loops)) this.stopLoop(k, 0.5); }
}
