// Visual effects: particles, shockwaves, hit sparks, damage numbers, announcer text and screen shake.
import { GROUND } from './config.js';

export class Effects {
  constructor() { this.reset(); this.shakeEnabled = true; }

  reset() {
    this.parts = []; this.rings = []; this.texts = []; this.sparks = [];
    this.shake = 0; this.announce = null; this.flash = 0;
  }

  handle(type, d) {
    if (type === 'shake') { if (this.shakeEnabled) this.shake = Math.min(24, Math.max(this.shake, d)); return; }
    if (type === 'announce') { this.announce = { ...d, t: 0, life: d.big ? 1.3 : 0.7 }; if (d.small) this.announce.life = 1; return; }
    if (type === 'damage') {
      this.texts.push({ x: d.x + (Math.random() - 0.5) * 30, y: d.y, vy: -90, t: 0, life: 0.8, text: d.amount.toFixed(d.amount < 10 ? 1 : 0), color: '#fff' });
      return;
    }
    if (type === 'chaosStart') { this.flash = 0.35; this.flashColor = d.def.color; return; }
    if (type !== 'fx') return;
    const R = Math.random;
    switch (d.kind) {
      case 'dust':
        for (let i = 0; i < d.n; i++) this.parts.push({ x: d.x + (R() - 0.5) * 40, y: d.y - 4, vx: (d.dir || (R() - 0.5) * 2) * (60 + R() * 120), vy: -40 - R() * 90, g: 120, life: 0.4 + R() * 0.3, t: 0, size: 6 + R() * 8, color: 'rgba(220,210,255,0.55)', shape: 'puff' });
        break;
      case 'hit': case 'impact': {
        const big = d.kind === 'impact';
        this.sparks.push({ x: d.x, y: d.y, t: 0, life: big ? 0.28 : 0.18, size: big ? 90 : 56, color: d.color, dir: d.dir });
        for (let i = 0; i < (big ? 18 : 9); i++) {
          const a = R() * Math.PI * 2, s = (big ? 380 : 260) * (0.4 + R());
          this.parts.push({ x: d.x, y: d.y, vx: Math.cos(a) * s + (d.dir || 0) * 120, vy: Math.sin(a) * s, g: 500, life: 0.25 + R() * 0.25, t: 0, size: 3 + R() * 4, color: i % 3 ? '#fff6c8' : d.color, shape: 'spark' });
        }
        if (big) this.rings.push({ x: d.x, y: d.y, r: 10, max: 110, t: 0, life: 0.3, color: '#ffffff', w: 6 });
        break;
      }
      case 'block':
        this.rings.push({ x: d.x, y: d.y, r: 18, max: 60, t: 0, life: 0.2, color: d.color, w: 5 });
        for (let i = 0; i < 6; i++) { const a = R() * Math.PI * 2; this.parts.push({ x: d.x, y: d.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, g: 0, life: 0.2, t: 0, size: 3, color: d.color, shape: 'spark' }); }
        break;
      case 'burst':
        for (let i = 0; i < d.n; i++) { const a = R() * Math.PI * 2, s = 140 + R() * 260; this.parts.push({ x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: -60, life: 0.4 + R() * 0.4, t: 0, size: 4 + R() * 6, color: R() < 0.5 ? d.color : '#ffe9a8', shape: 'spark' }); }
        this.rings.push({ x: d.x, y: d.y, r: 20, max: 150, t: 0, life: 0.35, color: d.color, w: 8 });
        break;
      case 'shockwave':
        this.rings.push({ x: d.x, y: d.y - 8, r: 20, max: d.radius, t: 0, life: 0.45, color: d.color, w: 14, flat: true });
        this.rings.push({ x: d.x, y: d.y - 8, r: 10, max: d.radius * 0.7, t: 0, life: 0.35, color: '#ffffff', w: 6, flat: true });
        break;
      case 'debris':
        for (let i = 0; i < d.n; i++) this.parts.push({ x: d.x + (R() - 0.5) * 120, y: d.y - 6, vx: (R() - 0.5) * 520, vy: -300 - R() * 520, g: 1700, life: 0.6 + R() * 0.5, t: 0, size: 6 + R() * 9, color: R() < 0.5 ? '#8a6a4a' : '#b08a5e', shape: 'rock', rot: R() * 6 });
        break;
      case 'explosion':
        this.rings.push({ x: d.x, y: d.y, r: 10, max: 95, t: 0, life: 0.35, color: d.color, w: 12 });
        for (let i = 0; i < 18; i++) { const a = -Math.PI * R(), s = 150 + R() * 380; this.parts.push({ x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, life: 0.4 + R() * 0.4, t: 0, size: 5 + R() * 8, color: R() < 0.5 ? '#ffb347' : '#ff5a2a', shape: 'spark' }); }
        for (let i = 0; i < 8; i++) this.parts.push({ x: d.x + (R() - 0.5) * 60, y: d.y, vx: (R() - 0.5) * 80, vy: -60 - R() * 80, g: -20, life: 0.8 + R() * 0.4, t: 0, size: 16 + R() * 16, color: 'rgba(60,40,50,0.5)', shape: 'puff' });
        break;
      case 'zap':
        this.sparks.push({ x: d.x, y: d.y, t: 0, life: 0.2, size: 70, color: '#C8FF4D', zap: true });
        break;
    }
  }

  update(dt) {
    const step = (arr) => arr.filter((p) => (p.t += dt) < p.life);
    for (const p of this.parts) { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.shape === 'rock' && p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; p.vx *= 0.6; } if (p.rot != null) p.rot += dt * 8; }
    for (const t of this.texts) { t.y += t.vy * dt; t.vy *= 0.94; }
    this.parts = step(this.parts); this.rings = step(this.rings); this.texts = step(this.texts); this.sparks = step(this.sparks);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt);
    if (this.announce) { this.announce.t += dt; if (this.announce.t > this.announce.life) this.announce = null; }
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  shakeOffset() {
    if (!this.shake) return [0, 0];
    return [(Math.random() - 0.5) * this.shake * 1.6, (Math.random() - 0.5) * this.shake * 1.6];
  }

  /** World-space effects (drawn with the camera shake). */
  draw(ctx) {
    for (const r of this.rings) {
      const k = r.t / r.life, rad = r.r + (r.max - r.r) * easeOut(k);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k * 0.6);
      ctx.beginPath();
      if (r.flat) ctx.ellipse(r.x, r.y, rad, rad * 0.22, 0, 0, Math.PI * 2); else ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke(); ctx.restore();
    }
    for (const p of this.parts) {
      const k = p.t / p.life;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      if (p.shape === 'puff') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'rock') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.7), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const s of this.sparks) {
      const k = s.t / s.life;
      ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = 1 - k;
      if (s.zap) {
        ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(0, -s.size); let y = -s.size; let x = 0; while (y < s.size) { y += 18; x = (Math.random() - 0.5) * 40; ctx.lineTo(x, y); } }
        ctx.stroke();
      } else {
        // comic "POW" star burst
        const n = 10, r1 = s.size * (0.6 + k * 0.6), r2 = r1 * 0.45;
        ctx.rotate(k * 0.6);
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fillStyle = '#fff7d6'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = s.color; ctx.stroke();
      }
      ctx.restore();
    }
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.t / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '800 26px Unbounded, system-ui, sans-serif';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1a1030'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
