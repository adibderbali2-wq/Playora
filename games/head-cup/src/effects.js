// Visual effects: particles (dust, sparks, confetti, fire, ice, lightning), rings, floating text, screen shake.
export class Effects {
  constructor() { this.reset(); this.shakeOn = true; }
  reset() { this.parts = []; this.rings = []; this.texts = []; this.banner = null; this.shake = 0; this.flash = 0; this.flashColor = '#fff'; }

  dust(x, y, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 30, y: y - 4, vx: (dir || Math.random() - 0.5) * (40 + Math.random() * 120), vy: -30 - Math.random() * 80, g: 100, t: 0, life: 0.35 + Math.random() * 0.3, size: 5 + Math.random() * 7, color: 'rgba(235,240,220,0.6)', kind: 'puff' });
  }
  sparks(x, y, color, n = 10, speed = 320) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random()); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, t: 0, life: 0.25 + Math.random() * 0.3, size: 2 + Math.random() * 3, color, kind: 'spark' }); }
  }
  ring(x, y, color, max = 90, w = 6, life = 0.35) { this.rings.push({ x, y, r: 8, max, w, color, t: 0, life }); }
  confetti(x, y, colors, n = 140) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 300 + Math.random() * 700;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 600, drag: 1.6, t: 0, life: 2 + Math.random() * 1.2, size: 5 + Math.random() * 5, color: colors[i % colors.length], kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18 });
    }
  }
  trail(x, y, color, kind = 'fire', size = 10) { this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 60, g: kind === 'fire' ? -150 : 0, t: 0, life: 0.3 + Math.random() * 0.2, size, color, kind }); }
  text(x, y, text, color = '#fff', size = 26) { this.texts.push({ x, y, text, color, size, t: 0, life: 1, vy: -70 }); }
  show(text, opts = {}) { this.banner = { text, t: 0, life: opts.life || 1.6, color: opts.color || '#fff', size: opts.size || 120, sub: opts.sub || '' }; }
  addShake(v) { if (this.shakeOn) this.shake = Math.min(26, Math.max(this.shake, v)); }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt; p.vy += (p.g || 0) * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt * 0.4; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter((r) => r.t < r.life);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; } this.texts = this.texts.filter((t) => t.t < t.life);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    this.shake = Math.max(0, this.shake - dt * 45);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  offset() { return this.shake ? [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake] : [0, 0]; }

  draw(ctx) {
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.max - r.r) * (1 - Math.pow(1 - k, 3)), 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of this.parts) {
      const k = p.t / p.life;
      ctx.globalAlpha = p.kind === 'confetti' ? Math.min(1, (1 - k) * 3) : 1 - k;
      ctx.fillStyle = p.color;
      if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.rot * 2)) + 1); ctx.restore(); }
      else if (p.kind === 'puff' || p.kind === 'fire' || p.kind === 'ice' || p.kind === 'smoke') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'fire' ? 1 - k * 0.7 : 0.6 + k), 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'bolt') { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 8, p.y + 12); ctx.lineTo(p.x + 4, p.y + 14); ctx.lineTo(p.x - 4, p.y + 28); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}
