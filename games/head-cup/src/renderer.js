// Renderer: stadium, pitch, goals, players, balls, skill visuals and the in-match HUD.
// Draws in world units (1280 x 720) and interpolates between physics steps for smooth motion.
import { W, H, GROUND, GOAL_LINE, CROSSBAR_Y, ROOF, BAR_R } from './config.js';
import { parts } from './physics.js';
import { drawHead, shade } from './heads.js';
import { drawFlagBadge } from './teams.js';
import { SKILLS } from './skills/index.js';

export const FONT = '"Unbounded", "Segoe UI", Tahoma, system-ui, sans-serif';
const OUT = '#1d1230';
const lerp = (a, b, t) => a + (b - a) * t;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.scale = 1; this.bg = null; this.t = 0;
    this.crowd = Array.from({ length: 260 }, (_, i) => ({ x: (i * 97) % W, row: i % 5, c: ['#ff5c7a', '#ffd23d', '#3ddcff', '#c8ff4d', '#ffffff', '#ff9a3d', '#b98bff'][i % 7], p: Math.random() * 6 }));
    this.blinks = new Map();
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.round(cssW * dpr); this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / W; this.bg = null;
  }

  // ------------------------------------------------------------- background
  buildBackground() {
    const k = this.scale, c = document.createElement('canvas');
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d'); g.scale(k, k);
    // night sky
    let gr = g.createLinearGradient(0, 0, 0, 420);
    gr.addColorStop(0, '#0a0b2a'); gr.addColorStop(0.6, '#1b1d5a'); gr.addColorStop(1, '#3b2a7a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.3 + Math.random() * 0.6; g.fillStyle = '#fff'; g.fillRect(Math.random() * W, Math.random() * 150, 1.5, 1.5); }
    g.globalAlpha = 1;
    // stadium roof ring
    g.fillStyle = '#121232';
    g.beginPath(); g.moveTo(0, 210); g.quadraticCurveTo(W / 2, 40, W, 210); g.lineTo(W, 250); g.quadraticCurveTo(W / 2, 90, 0, 250); g.closePath(); g.fill();
    g.strokeStyle = '#c8ff4d'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 250); g.quadraticCurveTo(W / 2, 90, W, 250); g.stroke();
    // light towers
    for (let i = 0; i < 9; i++) { const x = 70 + i * 142, y = 215 - Math.sin((i / 8) * Math.PI) * 125; g.fillStyle = '#fffbe6'; g.beginPath(); g.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,250,220,0.25)'; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill(); }
    // stands: tiers with seats
    const tiers = [['#2a2470', 255], ['#241f63', 300], ['#1e1a56', 345], ['#191549', 390]];
    for (const [col, y] of tiers) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(W / 2, y - 120 + (y - 255) * 0.5, W, y); g.lineTo(W, y + 50); g.quadraticCurveTo(W / 2, y - 70 + (y - 255) * 0.5, 0, y + 50); g.closePath(); g.fill();
    }
    // LED ad ring
    g.fillStyle = '#0c0a24'; g.fillRect(0, 432, W, 30);
    gr = g.createLinearGradient(0, 432, W, 432); gr.addColorStop(0, '#ff5cc8'); gr.addColorStop(0.5, '#3ddcff'); gr.addColorStop(1, '#c8ff4d');
    g.fillStyle = gr; g.globalAlpha = 0.9; g.fillRect(0, 432, W, 3); g.fillRect(0, 459, W, 3); g.globalAlpha = 1;
    g.font = `800 16px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ads = ['HEAD CUP', 'PLAYORA', 'PLAY MORE', 'HAVE FUN'];
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#c8ff4d', '#ffffff', '#3ddcff', '#ff5cc8'][i % 4]; g.fillText(ads[i % 4], 80 + i * 160, 447); }
    // pitch (seen slightly from above): far edge at 462, front edge at H
    const top = 462;
    for (let i = 0; i < 12; i++) {
      const y0 = top + Math.pow(i / 12, 1.3) * (H - top), y1 = top + Math.pow((i + 1) / 12, 1.3) * (H - top);
      g.fillStyle = i % 2 ? '#2f9e44' : '#37b24d'; g.fillRect(0, y0, W, y1 - y0 + 1);
    }
    gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = gr; g.fillRect(0, top, W, H - top);
    // pitch lines
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(40, top + 8); g.lineTo(W - 40, top + 8); g.stroke();
    g.beginPath(); g.moveTo(W / 2, top + 8); g.lineTo(W / 2, H); g.stroke();
    g.beginPath(); g.ellipse(W / 2, 600, 120, 42, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(W / 2, 600, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) { const x = s < 0 ? 0 : W; g.beginPath(); g.moveTo(x + s * -40, top + 30); g.lineTo(x + s * -230, top + 30); g.lineTo(x + s * -280, H - 30); g.lineTo(x + s * -10, H - 30); g.stroke(); }
    // goals: back nets (drawn behind everything)
    for (const s of [0, 1]) this.drawGoalBack(g, s);
    this.bg = c;
  }

  /** Back half of a goal: back frame, side and roof netting. */
  drawGoalBack(g, side) {
    g.save();
    if (side === 1) { g.translate(W, 0); g.scale(-1, 1); }
    const backX = 6, backTop = ROOF.y0 - 30;
    // net panel
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath(); g.moveTo(backX, backTop); g.lineTo(ROOF.x1, ROOF.y1 - 4); g.lineTo(GOAL_LINE + 6, GROUND); g.lineTo(backX, GROUND - 20); g.closePath(); g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.2;
    for (let i = -40; i < 280; i += 12) { g.beginPath(); g.moveTo(backX + i, backTop - 20); g.lineTo(backX + i - 120, GROUND + 20); g.stroke(); g.beginPath(); g.moveTo(backX + i - 120, backTop - 20); g.lineTo(backX + i, GROUND + 20); g.stroke(); }
    g.restore();
    // back posts
    g.strokeStyle = '#e8e8f0'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(backX, backTop); g.lineTo(backX, GROUND - 20); g.stroke();
    g.beginPath(); g.moveTo(backX, GROUND - 20); g.lineTo(GOAL_LINE + 6, GROUND); g.stroke();
    g.beginPath(); g.moveTo(backX, backTop); g.lineTo(ROOF.x0 + 8, ROOF.y0); g.stroke();
    g.restore();
  }

  /** Front of a goal (post + crossbar), drawn over the ball so balls inside look inside. */
  drawGoalFront(ctx, side, glow) {
    ctx.save();
    if (side === 1) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = BAR_R * 2 + 4;
    ctx.beginPath(); ctx.moveTo(ROOF.x0, ROOF.y0); ctx.lineTo(ROOF.x1, ROOF.y1); ctx.lineTo(GOAL_LINE + 6, GROUND); ctx.stroke();
    ctx.strokeStyle = glow || '#ffffff'; ctx.lineWidth = BAR_R * 2;
    ctx.beginPath(); ctx.moveTo(ROOF.x0, ROOF.y0); ctx.lineTo(ROOF.x1, ROOF.y1); ctx.lineTo(GOAL_LINE + 6, GROUND); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ROOF.x0, ROOF.y0 + 4); ctx.lineTo(ROOF.x1 + 3, ROOF.y1 + 4); ctx.lineTo(GOAL_LINE + 9, GROUND); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ frame
  /** alpha = interpolation factor between the previous and current physics step. */
  draw(game, fx, alpha, ui) {
    const ctx = this.ctx, k = this.scale;
    if (!this.bg) this.buildBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    const [sx, sy] = fx.offset();
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    this.drawCrowd(ctx, game);
    this.drawSpotlights(ctx);
    if (game.world.gravityMul !== 1 || game.balls.some((b) => b.gravityMul < 0)) { ctx.fillStyle = 'rgba(140,90,255,0.12)'; ctx.fillRect(0, 0, W, H); }
    // shadows
    for (const p of game.players) this.drawShadow(ctx, lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha), 34 * p.size * p.scale);
    for (const b of game.balls) if (b.ghost <= 0) this.drawShadow(ctx, lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), b.r * 1.1);
    // giant keeper walls behind players
    for (const wall of game.walls) this.drawWall(ctx, wall);
    for (const p of game.players) this.drawPlayer(ctx, game, p, alpha);
    for (const b of game.balls) this.drawBall(ctx, b, alpha, fx);
    this.drawGoalFront(ctx, 0, ui.goalGlow === 0 ? '#c8ff4d' : null);
    this.drawGoalFront(ctx, 1, ui.goalGlow === 1 ? '#c8ff4d' : null);
    fx.draw(ctx);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (fx.flash > 0) { ctx.globalAlpha = fx.flash * 0.6; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawHud(ctx, game, ui);
    this.drawBanner(ctx, fx.banner);
    this.t += ui.dt || 0;
  }

  drawCrowd(ctx, game) {
    const hype = game.phase === 'goal' ? 1 : 0.25;
    for (const c of this.crowd) {
      const y = 280 + c.row * 30 - Math.sin((c.x / W) * Math.PI) * (110 - c.row * 8);
      const jump = Math.max(0, Math.sin(this.t * (game.phase === 'goal' ? 14 : 3) + c.p)) * 8 * hype;
      ctx.fillStyle = shade(c.c, -0.55 + c.row * 0.05);
      ctx.beginPath(); ctx.arc(c.x, y - jump, 7, 0, Math.PI * 2); ctx.fill();
      if (c.p > 5.3) { ctx.fillStyle = c.c; ctx.fillRect(c.x - 1, y - jump - 22, 2, 14); ctx.fillRect(c.x + 1, y - jump - 22, 12, 8); } // flags
    }
  }

  drawSpotlights(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = 180 + i * 300, sway = Math.sin(this.t * 0.6 + i) * 120;
      const g = ctx.createLinearGradient(x, 120, x + sway, GROUND);
      g.addColorStop(0, 'rgba(180,220,255,0.12)'); g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 10, 120); ctx.lineTo(x + 10, 120); ctx.lineTo(x + sway + 120, GROUND); ctx.lineTo(x + sway - 120, GROUND); ctx.fill();
    }
    ctx.restore();
  }

  drawShadow(ctx, x, y, r) {
    const h = Math.max(0, GROUND - y);
    const k = Math.max(0.3, 1 - h / 500);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
    ctx.beginPath(); ctx.ellipse(x, GROUND + 4, r * k, r * 0.28 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawWall(ctx, wall) {
    const k = Math.min(1, wall.t * 5, (wall.life - wall.t) * 5);
    ctx.save(); ctx.globalAlpha = Math.max(0, k);
    const g = ctx.createLinearGradient(wall.x, 0, wall.x + wall.w, 0);
    g.addColorStop(0, 'rgba(61,220,255,0.15)'); g.addColorStop(0.5, 'rgba(61,220,255,0.45)'); g.addColorStop(1, 'rgba(61,220,255,0.15)');
    ctx.fillStyle = g; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = '#3ddcff'; ctx.lineWidth = 3; ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    // big glove
    ctx.font = `${wall.w * 1.4}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧤', wall.x + wall.w / 2, wall.y + wall.h * 0.35);
    ctx.restore();
  }

  drawPlayer(ctx, game, p, alpha) {
    const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
    const saved = { x: p.x, y: p.y }; p.x = x; p.y = y;
    const q = parts(p);
    p.x = saved.x; p.y = saved.y;
    const s = p.size * p.scale, kit = p.kit, f = p.facing;
    ctx.save();
    if (p.frozen > 0) ctx.filter = 'none';
    // legs
    const legW = 11 * Math.max(0.7, s);
    const standX = q.hipX - f * 9 * s;
    ctx.lineCap = 'round';
    // standing leg
    ctx.strokeStyle = kit.socks || kit.shirt; ctx.lineWidth = legW;
    ctx.beginPath(); ctx.moveTo(standX, q.hipY); ctx.lineTo(standX - f * 2, y - 6); ctx.stroke();
    this.boot(ctx, standX - f * 2, y - 4, f, s);
    // kicking leg
    ctx.strokeStyle = kit.socks || kit.shirt;
    ctx.beginPath(); ctx.moveTo(q.hipX, q.hipY); ctx.lineTo(q.footX, q.footY); ctx.stroke();
    this.boot(ctx, q.footX, q.footY + 2, f, s, p.kick.t > 0 && p.kick.t < 0.16);
    // shorts
    ctx.fillStyle = kit.shorts; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    roundRect(ctx, x - 17 * s, q.hipY - 10 * s, 34 * s, 16 * s, 5 * s); ctx.fill(); ctx.stroke();
    // torso (jersey)
    const torsoTop = q.headY + q.headR * 0.7, torsoBot = q.hipY - 4 * s;
    ctx.fillStyle = kit.shirt;
    roundRect(ctx, x - 19 * s, torsoTop, 38 * s, torsoBot - torsoTop, 9 * s); ctx.fill();
    if (kit.stripes) { ctx.save(); roundRect(ctx, x - 19 * s, torsoTop, 38 * s, torsoBot - torsoTop, 9 * s); ctx.clip(); ctx.fillStyle = kit.stripes; for (let i = -2; i <= 2; i += 2) ctx.fillRect(x + i * 7 * s - 3 * s, torsoTop, 6 * s, torsoBot - torsoTop); ctx.restore(); }
    ctx.stroke();
    ctx.fillStyle = kit.trim; ctx.fillRect(x - 19 * s, torsoTop + 2, 38 * s, 3 * s);
    // arms swinging
    const swing = p.onGround ? Math.sin(game.time * 20) * Math.min(1, Math.abs(p.vx) / 300) * 0.8 : -0.9;
    for (const [side, ph] of [[-1, 0], [1, Math.PI]]) {
      const ax = x + side * 17 * s, ay = torsoTop + 8 * s;
      const a = swing * (ph ? -1 : 1);
      const hx = ax + Math.sin(a) * 16 * s * f + side * 4 * s, hy = ay + Math.cos(a) * 18 * s;
      ctx.strokeStyle = kit.shirt; ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = p.char.look.skin; ctx.beginPath(); ctx.arc(hx, hy, 5.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    }
    // head (eyes follow the nearest ball)
    const ball = game.balls[0];
    const dx = ball.x - q.headX, dy = ball.y - q.headY, d = Math.hypot(dx, dy) || 1;
    let bl = this.blinks.get(p.id) || { next: 2 + Math.random() * 3, t: 0 };
    bl.next -= 1 / 60; if (bl.next < 0) { bl.t = 0.14; bl.next = 2 + Math.random() * 4; } bl.t = Math.max(0, bl.t - 1 / 60);
    this.blinks.set(p.id, bl);
    const emotion = p.frozen > 0 ? 'frozen' : p.emotion !== 'normal' ? p.emotion : p.kick.t > 0 ? 'effort' : p.stun > 0 ? 'sad' : 'normal';
    drawHead(ctx, p.char, q.headX, q.headY, q.headR, { facing: f, look: { x: dx / d, y: dy / d }, blink: bl.t > 0 ? 1 : 0, emotion });
    // status visuals
    if (p.frozen > 0) {
      ctx.fillStyle = 'rgba(170,230,255,0.45)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      roundRect(ctx, x - q.headR * 1.15, q.headY - q.headR * 1.2, q.headR * 2.3, y - q.headY + q.headR * 1.2, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - q.headR * 0.8, q.headY - q.headR, 6, (y - q.headY) * 0.8);
    }
    if (p.reversed > 0) { ctx.font = '700 24px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🔄', x, q.headY - q.headR - 14); }
    if (p.stun > 0) { for (let i = 0; i < 3; i++) { const a = game.time * 6 + (i * Math.PI * 2) / 3; ctx.font = '16px system-ui'; ctx.fillText('⭐', x + Math.cos(a) * 30, q.headY - q.headR - 6 + Math.sin(a) * 8); } }
    // player tag
    const tag = p.controller === 'ai' ? 'CPU' : p.tag || '';
    if (tag && game.phase !== 'end') {
      ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = p.team === 0 ? '#c8ff4d' : '#3ddcff';
      ctx.fillText(tag, x, q.headY - q.headR - (p.reversed > 0 ? 36 : 10));
    }
    ctx.restore();
  }

  boot(ctx, x, y, f, s, kicking) {
    ctx.fillStyle = kicking ? '#fff35c' : '#111';
    ctx.beginPath(); ctx.ellipse(x + f * 5 * s, y, 11 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x + f * 2 * s - 4 * s, y - 2 * s, 8 * s, 2 * s);
  }

  drawBall(ctx, b, alpha, fx) {
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha), r = b.r;
    if (b.fire > 0) for (let i = 0; i < 2; i++) fx.trail(x, y, i ? '#ffd23d' : '#ff5a1f', 'fire', r * 0.7);
    if (b.tornado > 0) fx.trail(x, y, 'rgba(200,230,255,0.6)', 'puff', r * 0.4);
    ctx.save();
    if (b.ghost > 0) ctx.globalAlpha = 0.06 + 0.06 * Math.sin(this.t * 40);
    ctx.translate(x, y);
    if (b.extra) { ctx.shadowColor = '#c8ff4d'; ctx.shadowBlur = 14; }
    ctx.rotate(b.angle);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1b1b2a';
    pent(ctx, 0, 0, r * 0.36, 0);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; pent(ctx, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.32, a + Math.PI / 5); }
    ctx.restore();
    ctx.rotate(-b.angle);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,40,0.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    if (b.fire > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,30,0.5)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------- HUD
  drawHud(ctx, game, ui) {
    const t = ui.t || ((k) => k);
    // timer (top centre)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    panel(ctx, W / 2 - 74, 12, 148, 70, 16, '#ff7a1a', '#ffd23d');
    ctx.fillStyle = '#fff'; ctx.font = `800 13px ${FONT}`;
    ctx.fillText(game.golden ? t('golden') : t('time'), W / 2, 30);
    const secs = Math.ceil(game.clock);
    ctx.font = `900 32px ${FONT}`;
    ctx.fillStyle = secs <= 10 && game.phase === 'play' && !game.golden && Math.floor(this.t * 4) % 2 ? '#1d1230' : '#fff';
    ctx.fillText(game.golden ? '⚡' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, 60);
    // scoreboard (bottom centre)
    const sy = H - 54;
    panel(ctx, W / 2 - 120, sy - 30, 240, 64, 16, '#ff7a1a', '#ffd23d');
    ctx.fillStyle = '#fff'; ctx.font = `900 40px ${FONT}`;
    ctx.fillText(`${game.score[0]} : ${game.score[1]}`, W / 2, sy + 3);
    drawFlagBadge(ctx, game.teams[0].flag, W / 2 - 150, sy, 26);
    drawFlagBadge(ctx, game.teams[1].flag, W / 2 + 150, sy, 26);
    // skill buttons: each human player's skill at their side; AI skills shown smaller
    const side = [0, 0];
    for (const p of game.players) {
      const st = game.skills.get(p); if (!st || !st.def) continue;
      const n = side[p.team]++;
      const r = p.controller === 'ai' ? 24 : 32;
      const x = p.team === 0 ? 56 + n * 78 : W - 56 - n * 78, y = H - 52;
      this.drawSkillButton(ctx, st, x, y, r, p);
    }
  }

  drawSkillButton(ctx, st, x, y, r, p) {
    const def = st.def, ready = st.uses > 0 && st.charge <= 0 && !st.active;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,40,0.85)'; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.fill();
    // charge / duration ring
    let k = st.active ? 1 - st.t / def.duration : st.uses > 0 ? 1 - st.charge / Math.max(0.001, def.cooldown) : 0;
    ctx.strokeStyle = st.active ? '#fff' : ready ? def.color : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, k)); ctx.stroke();
    ctx.globalAlpha = st.uses > 0 ? (ready || st.active ? 1 : 0.45) : 0.2;
    ctx.fillStyle = shade(def.color, -0.45); ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y); def.icon(ctx, r * 0.72); ctx.translate(-x, -y);
    ctx.globalAlpha = 1;
    if (ready) { ctx.shadowColor = def.color; ctx.shadowBlur = 10 + Math.sin(this.t * 8) * 6; ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
    ctx.font = `900 ${Math.round(r * 0.5)}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.textAlign = 'center';
    ctx.strokeText(`X${st.uses}`, x + r * 0.7, y - r * 0.85); ctx.fillText(`X${st.uses}`, x + r * 0.7, y - r * 0.85);
    ctx.restore();
  }

  drawBanner(ctx, b) {
    if (!b) return;
    const k = b.t / b.life;
    const pop = b.t < 0.25 ? 1 - Math.pow(1 - b.t / 0.25, 3) : 1;
    const out = k > 0.82 ? (k - 0.82) / 0.18 : 0;
    ctx.save();
    ctx.translate(W / 2, H * 0.36);
    ctx.rotate(-0.06);
    ctx.scale((0.3 + pop * 0.7) * (1 + out * 0.4), (0.3 + pop * 0.7) * (1 + out * 0.4));
    ctx.globalAlpha = 1 - out;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `900 ${b.size}px ${FONT}`;
    ctx.lineWidth = b.size * 0.24; ctx.strokeStyle = '#3a2bd8'; ctx.strokeText(b.text, 6, 8);
    ctx.lineWidth = b.size * 0.14; ctx.strokeStyle = OUT; ctx.strokeText(b.text, 0, 0);
    const g = ctx.createLinearGradient(0, -b.size / 2, 0, b.size / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, b.color === '#fff' ? '#d9e6ff' : b.color);
    ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = `800 ${b.size * 0.24}px ${FONT}`; ctx.lineWidth = 8; ctx.strokeText(b.sub, 0, b.size * 0.75); ctx.fillStyle = '#ffd23d'; ctx.fillText(b.sub, 0, b.size * 0.75); }
    ctx.restore();
  }
}

function panel(ctx, x, y, w, h, r, fill, edge) {
  ctx.fillStyle = OUT; roundRect(ctx, x - 4, y - 4, w + 8, h + 8, r + 3); ctx.fill();
  ctx.fillStyle = edge; roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r + 2); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(fill, 0.15)); g.addColorStop(1, shade(fill, -0.15));
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, r); ctx.fill();
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function pent(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}
export { panel };
