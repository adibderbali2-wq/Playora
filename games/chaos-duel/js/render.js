// Draws the arena, fighters, hazards and the in-fight HUD onto the canvas (world space 1280 x 720).
import { W, H, GROUND, ARENA_LEFT, ARENA_RIGHT, MAX_HP } from './config.js';
import { drawFrame } from './sprites.js';
import { EVENTS } from './chaos.js';
import { easeOut } from './effects.js';

const FONT = 'Unbounded, system-ui, sans-serif';
const BODY = 'Manrope, system-ui, sans-serif';
const P_COLORS = ['#C8FF4D', '#3DDCFF'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null; this.t = 0;
    this.shown = [MAX_HP, MAX_HP]; // lagging "recent damage" bars
    this.lights = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: 455 + Math.random() * 110, c: ['#C8FF4D', '#FF5CC8', '#3DDCFF', '#FFB547'][Math.random() * 4 | 0], p: Math.random() * 6 }));
    this.floaters = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.5, v: 20 + Math.random() * 40 }));
  }

  resize(cssW, cssH, dpr) {
    const c = this.canvas;
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    this.scale = c.width / W;
    this.bg = null; // re-render background at the new resolution
  }

  // --------------------------------------------------------------- arena art
  buildBackground() {
    const k = this.scale;
    const c = document.createElement('canvas');
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    // sky
    let gr = g.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, '#0b0820'); gr.addColorStop(0.55, '#1d1145'); gr.addColorStop(1, '#3a1a5c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // stars
    for (let i = 0; i < 120; i++) { g.globalAlpha = 0.3 + Math.random() * 0.6; g.fillStyle = '#fff'; g.fillRect(Math.random() * W, Math.random() * 260, 1.6, 1.6); }
    g.globalAlpha = 1;
    // stadium back structure
    g.fillStyle = '#160d33';
    g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(W / 2, 170, W, 330); g.lineTo(W, GROUND); g.lineTo(0, GROUND); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(185,139,255,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(W / 2, 170, W, 330); g.stroke();
    for (let i = 1; i < 12; i++) { const x = (W / 12) * i; g.globalAlpha = 0.25; g.beginPath(); g.moveTo(x, 300 - Math.sin((i / 12) * Math.PI) * 120); g.lineTo(x, 440); g.stroke(); }
    g.globalAlpha = 1;
    // big screen
    const sx = W / 2 - 190, sy = 205, sw = 380, sh = 150;
    g.fillStyle = '#0a0718'; roundRect(g, sx - 8, sy - 8, sw + 16, sh + 16, 18); g.fill();
    gr = g.createLinearGradient(sx, sy, sx + sw, sy + sh); gr.addColorStop(0, '#2a0f4a'); gr.addColorStop(1, '#0f1e4a');
    g.fillStyle = gr; roundRect(g, sx, sy, sw, sh, 12); g.fill();
    g.strokeStyle = '#B98BFF'; g.lineWidth = 3; roundRect(g, sx, sy, sw, sh, 12); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#FF5CC8'; g.shadowBlur = 18;
    g.font = `900 52px ${FONT}`; g.fillStyle = '#fff'; g.fillText('CHAOS', W / 2, sy + 52);
    g.shadowColor = '#C8FF4D'; g.fillStyle = '#C8FF4D'; g.fillText('DUEL', W / 2, sy + 106);
    g.shadowBlur = 0;
    g.font = `700 13px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('A  P L A Y O R A  A R E N A', W / 2, sy + sh + 26);
    // crowd
    for (let row = 0; row < 4; row++) {
      const y = 470 + row * 34;
      g.fillStyle = ['#241544', '#1e1139', '#180e2f', '#130b26'][row];
      for (let x = -20; x < W + 20; x += 22 + Math.random() * 8) {
        const r = 11 + Math.random() * 4, hy = y - Math.random() * 8;
        g.beginPath(); g.arc(x, hy, r, 0, Math.PI * 2); g.fill();
        g.fillRect(x - r * 1.2, hy + r * 0.6, r * 2.4, 40);
      }
    }
    // barrier
    g.fillStyle = '#0d0820'; g.fillRect(0, GROUND - 40, W, 40);
    gr = g.createLinearGradient(0, GROUND - 40, 0, GROUND - 34); gr.addColorStop(0, '#FF5CC8'); gr.addColorStop(1, 'rgba(255,92,200,0)');
    g.fillStyle = gr; g.fillRect(0, GROUND - 40, W, 6);
    g.font = `800 16px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 90; x < W; x += 260) g.fillText('PLAYORA', x, GROUND - 18);
    // floor
    gr = g.createLinearGradient(0, GROUND, 0, H); gr.addColorStop(0, '#2b1d55'); gr.addColorStop(1, '#0c0820');
    g.fillStyle = gr; g.fillRect(0, GROUND, W, H - GROUND);
    g.strokeStyle = 'rgba(185,139,255,0.25)'; g.lineWidth = 1.5;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(W / 2 + i * 50, GROUND); g.lineTo(W / 2 + i * 150, H); g.stroke(); }
    for (let j = 1; j < 5; j++) { const y = GROUND + (H - GROUND) * Math.pow(j / 5, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#C8FF4D'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();
    // centre emblem
    g.strokeStyle = 'rgba(200,255,77,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(W / 2, GROUND + 50, 150, 26, 0, 0, Math.PI * 2); g.stroke();
    // side pillars
    for (const x of [ARENA_LEFT - 30, ARENA_RIGHT + 30]) {
      g.fillStyle = '#120a28'; g.fillRect(x - 22, 380, 44, GROUND - 380);
      g.fillStyle = '#B98BFF'; g.fillRect(x - 22, 380, 44, 6);
    }
    this.bg = c;
  }

  // ------------------------------------------------------------------ frame
  draw(match, fx, dt, ui = {}) {
    const ctx = this.ctx, k = this.scale;
    this.t += dt;
    if (!this.bg) this.buildBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    const [sx, sy] = fx.shakeOffset();
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

    const ev = match.chaos.current;
    this.drawCrowdLights(ctx, ev);
    this.drawEventBack(ctx, match, ev, dt);
    this.drawWalls(ctx, match);
    this.drawMeteorShadows(ctx, match);
    // fighters: the one attacking is drawn on top
    const order = match.fighters.slice().sort((a, b) => (a.move ? 1 : 0) - (b.move ? 1 : 0));
    for (const f of order) this.drawFighter(ctx, match, f);
    this.drawMeteors(ctx, match);
    fx.draw(ctx);
    if (ui.debug) this.drawBoxes(ctx, match);

    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.drawEventFront(ctx, ev);
    if (fx.flash > 0) { ctx.globalAlpha = fx.flash * 0.5; ctx.fillStyle = fx.flashColor || '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawHud(ctx, match, dt);
    this.drawChaosBanner(ctx, match);
    this.drawAnnounce(ctx, fx.announce);
  }

  drawCrowdLights(ctx, ev) {
    const t = this.t, hype = ev ? 1 : 0.4;
    for (const l of this.lights) {
      const a = (Math.sin(t * 3 + l.p) * 0.5 + 0.5) * hype;
      ctx.globalAlpha = a; ctx.fillStyle = l.c;
      ctx.fillRect(l.x, l.y - Math.abs(Math.sin(t * 4 + l.p)) * 8, 3, 9);
    }
    ctx.globalAlpha = 1;
  }

  drawEventBack(ctx, match, ev, dt) {
    if (!ev) return;
    const id = ev.id, fade = Math.min(1, ev.t * 3, (ev.def.duration - ev.t) * 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, fade);
    if (id === 'ice') {
      const g = ctx.createLinearGradient(0, GROUND, 0, H); g.addColorStop(0, 'rgba(160,240,255,0.75)'); g.addColorStop(1, 'rgba(60,140,200,0.45)');
      ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const x = (i * 157 + 40) % W; ctx.beginPath(); ctx.moveTo(x, GROUND + 14 + (i % 3) * 22); ctx.lineTo(x + 70, GROUND + 6 + (i % 3) * 22); ctx.stroke(); }
    } else if (id === 'bounce') {
      const p = Math.sin(this.t * 10) * 4;
      ctx.fillStyle = 'rgba(255,92,200,0.35)'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.strokeStyle = '#FF5CC8'; ctx.lineWidth = 4;
      for (let x = 30; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x - 16, GROUND + 30 + p); ctx.lineTo(x, GROUND + 16 + p); ctx.lineTo(x + 16, GROUND + 30 + p); ctx.stroke(); }
    } else if (id === 'lowGravity') {
      ctx.fillStyle = 'rgba(120,80,220,0.16)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d9c8ff';
      for (const f of this.floaters) { f.y -= f.v * dt; if (f.y < 0) f.y = H; ctx.globalAlpha = fade * 0.7; ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill(); }
    } else if (id === 'meteors') {
      const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, 'rgba(255,90,40,0.35)'); g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
    } else if (id === 'giantFists') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760); g.addColorStop(0, 'rgba(255,181,71,0)'); g.addColorStop(1, 'rgba(255,140,40,0.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  drawEventFront(ctx, ev) {
    if (!ev) return;
    if (ev.id === 'ice') { // frosty vignette
      const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 800); g.addColorStop(0, 'rgba(180,240,255,0)'); g.addColorStop(1, 'rgba(180,240,255,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  drawWalls(ctx, match) {
    const w = match.world;
    if (w.left <= ARENA_LEFT + 1 && w.right >= ARENA_RIGHT - 1) return;
    ctx.fillStyle = 'rgba(5,3,12,0.55)';
    ctx.fillRect(0, 0, w.left, H); ctx.fillRect(w.right, 0, W - w.right, H);
    for (const x of [w.left, w.right]) {
      ctx.save();
      ctx.shadowColor = '#C8FF4D'; ctx.shadowBlur = 20; ctx.strokeStyle = w.electricWalls ? '#C8FF4D' : 'rgba(200,255,77,0.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, 120);
      for (let y = 120; y < GROUND; y += 24) ctx.lineTo(x + (Math.random() - 0.5) * (w.electricWalls ? 18 : 4), y);
      ctx.lineTo(x, GROUND); ctx.stroke();
      ctx.restore();
    }
  }

  drawMeteorShadows(ctx, match) {
    for (const m of match.meteors) {
      const k = m.warn > 0 ? 1 - m.warn / 0.6 : 1;
      const near = Math.max(0, Math.min(1, (m.y + 100) / (GROUND + 100)));
      ctx.fillStyle = `rgba(255,60,40,${0.25 + near * 0.35})`;
      ctx.beginPath(); ctx.ellipse(m.x, GROUND + 4, 30 + near * 50, 8 + near * 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,200,120,${0.4 + 0.4 * Math.sin(this.t * 20)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, GROUND + 4, 24 + 56 * k, 7 + 10 * k, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawMeteors(ctx, match) {
    for (const m of match.meteors) {
      if (m.warn > 0) continue;
      ctx.save();
      const g = ctx.createLinearGradient(m.x, m.y - 120, m.x, m.y);
      g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,200,80,0.9)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(m.x - m.r * 0.8, m.y); ctx.lineTo(m.x, m.y - 130); ctx.lineTo(m.x + m.r * 0.8, m.y); ctx.fill();
      ctx.fillStyle = '#5a3a2e'; ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3c2620'; ctx.beginPath(); ctx.arc(m.x - 7, m.y - 5, 6, 0, Math.PI * 2); ctx.arc(m.x + 8, m.y + 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawFighter(ctx, match, f) {
    const def = f.def;
    const alt = match.chars[0] === match.chars[1] && f.index === 1;
    // shadow
    const air = Math.max(0, GROUND - f.y);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0.3, 1 - air / 400)})`;
    ctx.beginPath(); ctx.ellipse(f.x, GROUND + 3, def.body.w * 0.7 * Math.max(0.5, 1 - air / 500), 10, 0, 0, Math.PI * 2); ctx.fill();
    // afterimages
    const trailColor = f.boosted ? '#ff3b3b' : def.color;
    for (const t of f.trail) {
      drawFrame(ctx, def, t.frame.anim, t.frame.index, t.x, t.y, { facing: t.facing, alpha: Math.max(0, t.life / 0.22) * 0.45, tint: trailColor, alt });
    }
    // boost aura
    if (f.boosted) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const r = 70 + Math.sin(this.t * 30) * 6;
      const g = ctx.createRadialGradient(f.x, f.y - 70, 10, f.x, f.y - 70, r * 1.3);
      g.addColorStop(0, 'rgba(255,80,40,0.35)'); g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - r * 1.4, f.y - 70 - r * 1.4, r * 2.8, r * 2.8);
      ctx.restore();
    }
    const blink = f.invuln > 0 && f.state !== 'dash' && Math.floor(this.t * 20) % 2 === 0;
    const fr = f.frame();
    drawFrame(ctx, def, fr.anim, fr.index, f.x, f.y, { facing: f.facing, alpha: blink ? 0.45 : 1, flash: f.flash > 0 ? 0.85 : 0, alt });
    // giant fists: glowing fist on the active hitbox
    const hb = f.hitbox();
    if (hb && match.world.attackScale > 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cx = hb.x + hb.w / 2 + f.facing * hb.w * 0.25, cy = hb.y + hb.h / 2;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, hb.h * 0.9);
      g.addColorStop(0, 'rgba(255,220,120,0.95)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, hb.h * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // stun stars
    if (f.state === 'stun') {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 6 + (i * Math.PI * 2) / 3;
        star(ctx, f.x + Math.cos(a) * 34, f.y - def.body.h - 16 + Math.sin(a) * 9, 9, '#FFD23D');
      }
    }
    // player tag
    if (!f.ko && match.phase !== 'matchEnd') {
      const tag = `P${f.index + 1}`;
      const y = f.y - def.body.h - 26 - (f.state === 'stun' ? 20 : 0);
      ctx.font = `800 14px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = P_COLORS[f.index];
      ctx.fillText(tag, f.x, y);
      ctx.beginPath(); ctx.moveTo(f.x - 6, y + 5); ctx.lineTo(f.x + 6, y + 5); ctx.lineTo(f.x, y + 12); ctx.fill();
    }
  }

  drawBoxes(ctx, match) {
    for (const f of match.fighters) {
      const h = f.hurtbox(); if (h) { ctx.strokeStyle = '#3DDCFF'; ctx.lineWidth = 2; ctx.strokeRect(h.x, h.y, h.w, h.h); }
      const a = f.hitbox(); if (a) { ctx.strokeStyle = '#FF3B3B'; ctx.strokeRect(a.x, a.y, a.w, a.h); }
    }
  }

  // -------------------------------------------------------------------- HUD
  drawHud(ctx, match, dt) {
    const barW = 470, barH = 26, top = 30, gap = 86;
    match.fighters.forEach((f, i) => {
      const left = i === 0;
      const x0 = left ? W / 2 - gap - barW : W / 2 + gap;
      const frac = Math.max(0, f.hp / MAX_HP);
      this.shown[i] = Math.max(frac, this.shown[i] - dt * 0.45);
      if (this.shown[i] > 1 || match.phase === 'intro') this.shown[i] = frac;
      // frame
      ctx.fillStyle = '#0d0820'; skew(ctx, x0 - 6, top - 6, barW + 12, barH + 12, left);
      ctx.fillStyle = '#2a1b45'; skew(ctx, x0, top, barW, barH, left);
      // lagging damage
      ctx.fillStyle = '#ff4d6d';
      const wLag = barW * this.shown[i];
      skew(ctx, left ? x0 + barW - wLag : x0, top, wLag, barH, left);
      // health
      const g = ctx.createLinearGradient(0, top, 0, top + barH);
      const col = frac > 0.5 ? ['#d8ff6b', '#8fd12a'] : frac > 0.25 ? ['#ffd85a', '#f0a020'] : ['#ff7a6a', '#e02b3b'];
      g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g;
      const wHp = barW * frac;
      skew(ctx, left ? x0 + barW - wHp : x0, top, wHp, barH, left);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; skew(ctx, left ? x0 + barW - wHp : x0, top + 3, wHp, 5, left);
      // guard bar
      const gf = f.guard / f.def.guardMax;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(left ? x0 + barW - 220 : x0, top + barH + 9, 220, 6);
      ctx.fillStyle = gf < 0.3 ? '#ff7a3d' : '#9fe7ff'; ctx.fillRect(left ? x0 + barW - 220 * gf : x0, top + barH + 9, 220 * gf, 6);
      // portrait
      const px = left ? x0 - 46 : x0 + barW + 46, py = top + 14;
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, 38, 0, Math.PI * 2); ctx.fillStyle = '#0d0820'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = P_COLORS[i]; ctx.stroke(); ctx.clip();
      if (f.def.banner) {
        ctx.translate(px, py); if (!left) ctx.scale(-1, 1);
        ctx.drawImage(f.def.banner, 262, 0, 150, 126, -44, -40, 105, 88);
      }
      ctx.restore();
      // name
      ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
      ctx.font = `900 22px ${FONT}`; ctx.fillStyle = '#fff';
      const nx = left ? x0 : x0 + barW;
      ctx.fillText(f.def.name, nx, top + barH + 40);
      ctx.font = `700 12px ${BODY}`; ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`P${i + 1} · ${f.def.title.toUpperCase()}`, nx, top + barH + 58);
      // round wins
      if (match.mode.rounds) for (let r = 0; r < 2; r++) {
        const cx = left ? x0 + barW - 16 - r * 30 : x0 + 16 + r * 30;
        star(ctx, cx, top + barH + 30, 11, r < match.wins[i] ? '#FFD23D' : 'rgba(255,255,255,0.18)');
      }
      // special meter
      const sx = left ? x0 + 200 : x0 + barW - 200, sy = top + barH + 30;
      const cdMax = f.def.special.cooldown + (f.def.special.duration || 0);
      const ready = f.specialReady;
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fillStyle = '#0d0820'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const fr = f.boosted ? f.boost / f.def.special.duration : ready ? 1 : 1 - f.cd.special / cdMax;
      ctx.arc(sx, sy, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fr); ctx.fillStyle = ready ? f.def.accent : f.boosted ? '#ff3b3b' : 'rgba(255,255,255,0.35)'; ctx.fill();
      if (ready) { ctx.shadowColor = f.def.accent; ctx.shadowBlur = 14 + Math.sin(this.t * 8) * 6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      ctx.font = `800 10px ${FONT}`; ctx.fillStyle = ready ? '#fff' : 'rgba(255,255,255,0.5)'; ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(f.boosted ? 'BOOST!' : ready ? f.def.special.name.toUpperCase() : 'CHARGING', left ? sx + 22 : sx - 22, sy + 4);
    });
    // timer
    ctx.fillStyle = '#0d0820'; roundRect(ctx, W / 2 - 62, 14, 124, 72, 16); ctx.fill();
    ctx.strokeStyle = '#B98BFF'; ctx.lineWidth = 3; roundRect(ctx, W / 2 - 62, 14, 124, 72, 16); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tv = Number.isFinite(match.timer) ? Math.ceil(match.timer) : '∞';
    ctx.font = `900 40px ${FONT}`; ctx.fillStyle = tv <= 10 && match.phase === 'fight' && Math.floor(this.t * 4) % 2 ? '#ff4d6d' : '#fff';
    ctx.fillText(String(tv), W / 2, tv === '∞' ? 46 : 50);
    ctx.font = `800 11px ${FONT}`; ctx.fillStyle = '#C8FF4D';
    ctx.fillText(match.mode.rounds ? `ROUND ${match.round}` : 'FREE FIGHT', W / 2, 100);
    ctx.textBaseline = 'alphabetic';
  }

  drawChaosBanner(ctx, match) {
    const c = match.chaos;
    if (c.state === 'warning') {
      const def = EVENTS[c.next];
      const pulse = Math.floor(this.t * 6) % 2;
      const y = 150;
      ctx.save();
      ctx.fillStyle = pulse ? 'rgba(255,40,80,0.9)' : 'rgba(120,10,40,0.9)';
      roundRect(ctx, W / 2 - 230, y - 34, 460, 84, 18); ctx.fill();
      ctx.strokeStyle = '#FFD23D'; ctx.lineWidth = 3; roundRect(ctx, W / 2 - 230, y - 34, 460, 84, 18); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `900 15px ${FONT}`; ctx.fillStyle = '#FFD23D';
      ctx.fillText(`⚠ CHAOS INCOMING · ${Math.ceil(c.warnT)}`, W / 2, y - 8);
      ctx.font = `900 30px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(def.name, W / 2, y + 30);
      ctx.restore();
    } else if (c.state === 'active' && c.current) {
      const def = c.current.def, k = c.remaining / def.duration;
      const intro = Math.min(1, c.current.t * 4);
      const y = 140;
      ctx.save();
      ctx.globalAlpha = intro;
      ctx.fillStyle = 'rgba(13,8,32,0.88)'; roundRect(ctx, W / 2 - 200, y - 26, 400, 64, 16); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 3; roundRect(ctx, W / 2 - 200, y - 26, 400, 64, 16); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `900 22px ${FONT}`; ctx.fillStyle = def.color; ctx.fillText(def.name, W / 2, y + 2);
      ctx.font = `700 12px ${BODY}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(def.desc, W / 2, y + 22);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - 180, y + 30, 360, 4);
      ctx.fillStyle = def.color; ctx.fillRect(W / 2 - 180, y + 30, 360 * k, 4);
      ctx.restore();
    }
  }

  drawAnnounce(ctx, a) {
    if (!a) return;
    const k = a.t / a.life;
    const pop = a.t < 0.18 ? easeOut(a.t / 0.18) : 1;
    const scale = (a.big ? 1 : 0.8) * (0.4 + pop * 0.6) * (1 + Math.max(0, k - 0.8) * 1.5);
    const alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.save();
    const y = a.small ? 300 : 340;
    ctx.translate(a.small ? (a.side === 0 ? W * 0.27 : W * 0.73) : W / 2, y);
    ctx.scale(scale, scale); ctx.rotate(-0.04);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = a.small ? 40 : a.text.length > 8 ? 80 : 110;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1a0b33'; ctx.strokeText(a.text, 0, 0);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    if (a.ko) { g.addColorStop(0, '#fff3a8'); g.addColorStop(1, '#ff5a2a'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#C8FF4D'); }
    ctx.fillStyle = g; ctx.fillText(a.text, 0, 0);
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function skew(ctx, x, y, w, h, left) {
  if (w <= 0) return;
  const s = 10;
  ctx.beginPath();
  if (left) { ctx.moveTo(x + s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - s, y + h); ctx.lineTo(x, y + h); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + w - s, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + s, y + h); }
  ctx.closePath(); ctx.fill();
}
function star(ctx, x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
