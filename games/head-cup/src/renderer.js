// Renderer: stadium, pitch, goals, players, balls, skill visuals and the in-match HUD.
// Draws in world units (1280 x 720) and interpolates between physics steps for smooth motion.
import { W, H, GROUND, GOAL_LINE, CROSSBAR_Y, ROOF, BAR_R } from './config.js';
import { parts } from './physics.js';
import { drawHead, shade } from './heads.js';
import { drawFlagBadge } from './teams.js';
import { SKILLS } from './skills/index.js';
import { reverseIcon } from './skills/reverseControls.js';
import { glove } from './skills/giantKeeper.js';

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
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // stadium shell
    let gr = g.createLinearGradient(0, 0, 0, 440);
    gr.addColorStop(0, '#0d3a8a'); gr.addColorStop(1, '#1d63c9');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // roof edge with floodlights
    g.fillStyle = '#0a2a66'; g.fillRect(0, 0, W, 26);
    for (let x = 30; x < W; x += 64) { g.fillStyle = '#eaf6ff'; g.fillRect(x, 8, 26, 9); g.fillStyle = 'rgba(234,246,255,0.18)'; g.beginPath(); g.moveTo(x - 6, 18); g.lineTo(x + 32, 18); g.lineTo(x + 50, 70); g.lineTo(x - 24, 70); g.fill(); }
    // two tiers of stands with seated spectators
    const tier = (y0, rows, rowH, scale, seat) => {
      for (let r = 0; r < rows; r++) {
        const y = y0 + r * rowH;
        g.fillStyle = r % 2 ? shade(seat, -0.12) : seat; g.fillRect(0, y, W, rowH);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + rowH - 3, W, 3);
        for (let x = 10 + (r % 2) * 11 * scale; x < W; x += 23 * scale) {
          if (rnd() < 0.12) { g.fillStyle = shade(seat, 0.18); g.fillRect(x - 7 * scale, y + rowH - 14 * scale, 14 * scale, 10 * scale); continue; } // empty seat
          const shirt = ['#e63946', '#f1faee', '#ffd23d', '#2a9d8f', '#ff7a1a', '#7b2cbf', '#118ab2', '#06d6a0', '#ef476f', '#ffffff'][Math.floor(rnd() * 10)];
          const skin = ['#f2d0b1', '#d9a066', '#a8714a', '#7a4a2a', '#5c3a21', '#e8b98a'][Math.floor(rnd() * 6)];
          const hair = ['#1b1b1b', '#5a3a22', '#c8a040', '#8a3a1a', '#2a1a10'][Math.floor(rnd() * 5)];
          const by = y + rowH - 4;
          g.fillStyle = shirt; g.beginPath(); g.ellipse(x, by - 6 * scale, 8 * scale, 8 * scale, 0, Math.PI, 0); g.fill();
          g.fillStyle = skin; g.beginPath(); g.arc(x, by - 16 * scale, 5.5 * scale, 0, Math.PI * 2); g.fill();
          g.fillStyle = hair; g.beginPath(); g.arc(x, by - 18 * scale, 5.5 * scale, Math.PI * 1.05, Math.PI * 1.95); g.fill();
          if (rnd() < 0.08) { g.fillStyle = shirt; g.fillRect(x + 4 * scale, by - 34 * scale, 3 * scale, 14 * scale); g.fillRect(x + 7 * scale, by - 34 * scale, 12 * scale, 8 * scale); } // flag
        }
      }
    };
    tier(30, 6, 26, 0.8, '#2f6fd0');
    g.fillStyle = '#123f8f'; g.fillRect(0, 186, W, 16); g.fillStyle = '#9fd0ff'; g.fillRect(0, 186, W, 3); // walkway + railing
    for (let x = 0; x < W; x += 40) g.fillRect(x, 186, 2, 16);
    tier(202, 5, 40, 1.15, '#3a7fe0');
    // the players' tunnel in the middle of the lower tier
    g.fillStyle = '#0c2a5c'; g.fillRect(W / 2 - 70, 330, 140, 72); g.fillStyle = '#071a3a'; g.fillRect(W / 2 - 52, 346, 104, 56);
    // LED advertising boards
    g.fillStyle = '#081633'; g.fillRect(0, 402, W, 40);
    gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#ff5cc8'); gr.addColorStop(0.5, '#3ddcff'); gr.addColorStop(1, '#c8ff4d');
    g.fillStyle = gr; g.fillRect(0, 402, W, 3); g.fillRect(0, 439, W, 3);
    g.font = `800 17px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['HEAD CUP', 'PLAYORA', 'PLAY MORE', 'HAVE FUN'].forEach((t, i) => { for (let j = 0; j < 2; j++) { g.fillStyle = ['#c8ff4d', '#ffffff', '#3ddcff', '#ff9ae6'][i]; g.fillText(t, 90 + (i + j * 4) * 157, 422); } });

    // pitch: far edge y=442, front edge y=668, seen from slightly above
    const far = 442, front = 668;
    const edgeX = (y) => 150 - ((y - far) / (front - far)) * 40; // sidelines lean out a little
    g.fillStyle = '#2e8b3d'; g.fillRect(0, far, W, H - far);
    for (let i = 0; i < 16; i++) { // mowing stripes
      g.fillStyle = i % 2 ? '#34a046' : '#3cb24f';
      const x0 = (W / 16) * i, x1 = (W / 16) * (i + 1), cx = W / 2;
      g.beginPath(); g.moveTo(cx + (x0 - cx) * 0.86, far); g.lineTo(cx + (x1 - cx) * 0.86, far); g.lineTo(cx + (x1 - cx) * 1.08, front); g.lineTo(cx + (x0 - cx) * 1.08, front); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 3; g.lineJoin = 'round';
    const L = edgeX(far), Lf = edgeX(front);
    g.beginPath(); g.moveTo(L, far + 6); g.lineTo(W - L, far + 6); g.lineTo(W - Lf, front - 8); g.lineTo(Lf, front - 8); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(W / 2, far + 6); g.lineTo(W / 2, front - 8); g.stroke();
    g.beginPath(); g.ellipse(W / 2, 560, 120, 40, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(W / 2, 560, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) { // penalty + goal boxes in perspective
      const sx = (x) => (s < 0 ? x : W - x);
      g.beginPath(); g.moveTo(sx(edgeX(far + 30)), far + 30); g.lineTo(sx(330), far + 30); g.lineTo(sx(350), front - 34); g.lineTo(sx(edgeX(front - 34)), front - 34); g.stroke();
      g.beginPath(); g.moveTo(sx(edgeX(far + 62)), far + 62); g.lineTo(sx(220), far + 62); g.lineTo(sx(228), front - 66); g.lineTo(sx(edgeX(front - 66)), front - 66); g.stroke();
      g.beginPath(); g.ellipse(sx(338), 556, 34, 36, 0, s < 0 ? -1.35 : Math.PI - 1.8, s < 0 ? 1.8 - 0.45 : Math.PI + 1.35); g.stroke();
    }
    // front face of the pitch: grass lip + earth
    g.fillStyle = '#2a7a35'; g.fillRect(0, front, W, 10);
    gr = g.createLinearGradient(0, front + 10, 0, H); gr.addColorStop(0, '#8a5530'); gr.addColorStop(1, '#5e3a20');
    g.fillStyle = gr; g.fillRect(0, front + 10, W, H - front - 10);
    for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.5 ? '#6e4426' : '#a36a40'; g.beginPath(); g.ellipse(rnd() * W, front + 18 + rnd() * (H - front - 22), 3 + rnd() * 7, 2 + rnd() * 4, 0, 0, Math.PI * 2); g.fill(); }
    // raised grass banks that carry the goals (front face = earth cross-section)
    for (const s of [0, 1]) {
      g.save(); if (s) { g.translate(W, 0); g.scale(-1, 1); }
      const bw = 190;
      g.fillStyle = '#3cb24f';
      g.beginPath(); g.moveTo(0, far + 2); g.lineTo(bw - 40, far + 2); g.quadraticCurveTo(bw - 8, far + 4, bw - 4, far + 40); g.lineTo(bw + 6, GROUND - 6); g.quadraticCurveTo(bw + 4, GROUND + 8, bw - 16, GROUND + 8); g.lineTo(0, GROUND + 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, far + 2 + i * 30); g.lineTo(bw - 6 + i * 2, far + 2 + i * 30); g.stroke(); }
      g.fillStyle = '#2a7a35'; g.fillRect(0, GROUND + 8, bw - 6, 12);
      gr = g.createLinearGradient(0, GROUND + 20, 0, H); gr.addColorStop(0, '#9a6036'); gr.addColorStop(1, '#5e3a20');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, GROUND + 20); g.lineTo(bw - 6, GROUND + 20); g.quadraticCurveTo(bw + 14, GROUND + 50, bw + 10, H); g.lineTo(0, H); g.closePath(); g.fill();
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 3 ? '#7a4a2a' : '#b07a4a'; g.beginPath(); g.ellipse(rnd() * (bw - 20), GROUND + 34 + rnd() * 70, 5 + rnd() * 8, 3 + rnd() * 5, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    for (const s of [0, 1]) this.drawGoalBack(g, s);
    this.bg = c;
  }

  /** Back half of a goal: frame depth plus hexagon netting. */
  drawGoalBack(g, side) {
    g.save();
    if (side === 1) { g.translate(W, 0); g.scale(-1, 1); }
    const bx = 18, bTop = ROOF.y0 - 34, bBot = GROUND - 26;
    // net area (back + roof + side)
    g.beginPath(); g.moveTo(bx, bTop); g.lineTo(ROOF.x1, ROOF.y1 - 2); g.lineTo(GOAL_LINE + 6, GROUND); g.lineTo(bx, bBot); g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2;
    const hs = 9, hw = hs * Math.sqrt(3);
    for (let row = 0, y = bTop - 20; y < GROUND + 20; row++, y += hs * 1.5) {
      for (let x = bx - 30 + (row % 2) * hw / 2; x < GOAL_LINE + 40; x += hw) {
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(x + Math.cos(a) * hs, y + Math.sin(a) * hs); }
        g.closePath(); g.stroke();
      }
    }
    g.restore();
    // depth frame
    g.strokeStyle = '#dfe6f0'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx, bTop); g.lineTo(bx, bBot); g.lineTo(GOAL_LINE + 6, GROUND); g.stroke();
    g.beginPath(); g.moveTo(bx, bTop); g.lineTo(ROOF.x0 + 4, ROOF.y0); g.stroke();
    g.restore();
  }

  /** Front of a goal (post + crossbar), drawn over the ball so balls inside look inside. */
  drawGoalFront(ctx, side, glow) {
    ctx.save();
    if (side === 1) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const post = () => { ctx.beginPath(); ctx.moveTo(ROOF.x0, ROOF.y0); ctx.lineTo(ROOF.x1, ROOF.y1); ctx.lineTo(GOAL_LINE + 6, GROUND); };
    ctx.strokeStyle = OUT; ctx.lineWidth = BAR_R * 2 + 5; post(); ctx.stroke();
    ctx.strokeStyle = glow || '#ffffff'; ctx.lineWidth = BAR_R * 2; post(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,140,170,0.35)'; ctx.lineWidth = 4;
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
    if (game.phase !== 'goal') return;
    ctx.save(); ctx.globalAlpha = 0.5;
    for (const c of this.crowd) { const y = 60 + c.row * 70 + Math.abs(Math.sin(this.t * 12 + c.p)) * -10; ctx.fillStyle = c.c; ctx.fillRect(c.x, y, 3, 10); }
    ctx.restore();
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
    ctx.translate(wall.x + wall.w / 2, wall.y + wall.h * 0.32); ctx.scale(wall.team === 0 ? 1 : -1, 1); glove(ctx, wall.w * 0.95);
    ctx.restore();
  }

  drawPlayer(ctx, game, p, alpha) {
    const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
    const sx0 = p.x, sy0 = p.y; p.x = x; p.y = y;
    const q = parts(p);
    p.x = sx0; p.y = sy0;
    const s = Math.max(0.7, p.size * p.scale), kit = p.kit, f = p.facing, skin = p.char.look.skin;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const running = p.onGround && Math.abs(p.vx) > 40;
    // speed-boost lightning trail / skill aura
    if (p.aura && p.aura.id === 'speedBoost' && Math.abs(p.vx) > 100) {
      ctx.strokeStyle = 'rgba(255,225,77,0.8)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const yy = q.hipY - 20 - i * 22; ctx.beginPath(); ctx.moveTo(x - f * 20, yy); ctx.lineTo(x - f * 50, yy + 8); ctx.lineTo(x - f * 42, yy - 4); ctx.lineTo(x - f * 80, yy + 6); ctx.stroke(); }
    }
    if (p.aura) {
      const g = ctx.createRadialGradient(x, q.headY, 10, x, q.headY, q.headR * 2.1);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, hexA(p.aura.color, 0.0)); g.addColorStop(0.85, hexA(p.aura.color, 0.35)); g.addColorStop(1, hexA(p.aura.color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, q.headY, q.headR * 2.1, 0, Math.PI * 2); ctx.fill();
    }
    // legs: the front leg is the physics kicking leg, the back leg mirrors it while running
    const L = Math.hypot(q.footX - q.hipX, q.footY - q.hipY);
    const backA = running ? 0.3 - (p.legAngle - 0.15) : p.onGround ? -0.1 : -0.45;
    const backHip = { x: q.hipX - f * 7 * s, y: q.hipY };
    const backFoot = { x: backHip.x + Math.sin(backA) * L * f, y: backHip.y + Math.cos(backA) * L };
    this.leg(ctx, backHip.x, backHip.y, backFoot.x, backFoot.y, kit, skin, s, f, true, false);
    this.leg(ctx, q.hipX + f * 3 * s, q.hipY, q.footX, q.footY, kit, skin, s, f, false, p.kick.t > 0 && p.kick.t < 0.16);
    // shorts
    ctx.fillStyle = kit.shorts; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 15 * s, q.hipY - 9 * s); ctx.lineTo(x + 15 * s, q.hipY - 9 * s); ctx.lineTo(x + 17 * s, q.hipY + 8 * s); ctx.lineTo(x + 2 * s, q.hipY + 8 * s); ctx.lineTo(x, q.hipY + 2 * s); ctx.lineTo(x - 2 * s, q.hipY + 8 * s); ctx.lineTo(x - 17 * s, q.hipY + 8 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    // arms behind/in front of the torso swing against the legs
    const armSwing = running ? Math.sin(game.time * 22) * 0.9 : p.onGround ? 0.15 : -1.1;
    const torsoTop = q.headY + q.headR * 0.78, shoulderY = torsoTop + 5 * s;
    this.arm(ctx, x - f * 14 * s, shoulderY, -armSwing, f, s, kit, skin, true);
    // torso: jersey with short sleeves, collar and side trim
    ctx.fillStyle = kit.shirt; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 17 * s, torsoTop + 2 * s); ctx.quadraticCurveTo(x, torsoTop - 3 * s, x + 17 * s, torsoTop + 2 * s);
    ctx.lineTo(x + 15 * s, q.hipY - 7 * s); ctx.lineTo(x - 15 * s, q.hipY - 7 * s); ctx.closePath(); ctx.fill();
    if (kit.stripes) { ctx.save(); ctx.clip(); ctx.fillStyle = kit.stripes; for (let i = -2; i <= 2; i += 2) ctx.fillRect(x + i * 6 * s - 2.5 * s, torsoTop - 4, 5 * s, 80); ctx.restore(); }
    ctx.stroke();
    ctx.strokeStyle = kit.trim; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(x - 6 * s, torsoTop + 1); ctx.lineTo(x, torsoTop + 7 * s); ctx.lineTo(x + 6 * s, torsoTop + 1); ctx.stroke(); // V collar
    ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x - 15.5 * s, torsoTop + 8 * s); ctx.lineTo(x - 15 * s, q.hipY - 8 * s); ctx.moveTo(x + 15.5 * s, torsoTop + 8 * s); ctx.lineTo(x + 15 * s, q.hipY - 8 * s); ctx.stroke();
    this.arm(ctx, x + f * 14 * s, shoulderY, armSwing, f, s, kit, skin, false);
    // neck
    ctx.fillStyle = shade(skin, -0.12); ctx.fillRect(x - 6 * s, q.headY + q.headR * 0.5, 12 * s, torsoTop - (q.headY + q.headR * 0.5) + 3);
    // head (eyes follow the ball)
    const ball = game.balls[0];
    const dx = ball.x - q.headX, dy = ball.y - q.headY, d = Math.hypot(dx, dy) || 1;
    const bl = this.blinks.get(p.id) || { next: 2 + Math.random() * 3, t: 0 };
    bl.next -= 1 / 60; if (bl.next < 0) { bl.t = 0.14; bl.next = 2 + Math.random() * 4; } bl.t = Math.max(0, bl.t - 1 / 60);
    this.blinks.set(p.id, bl);
    const emotion = p.frozen > 0 ? 'frozen' : p.emotion !== 'normal' ? p.emotion : p.kick.t > 0 ? 'effort' : p.stun > 0 ? 'sad' : 'normal';
    drawHead(ctx, p.char, q.headX, q.headY, q.headR, { facing: f, look: { x: dx / d, y: dy / d }, blink: bl.t > 0 ? 1 : 0, emotion });
    // status visuals
    if (p.frozen > 0) {
      const top = q.headY - q.headR * 1.2;
      ctx.fillStyle = 'rgba(170,230,255,0.42)'; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
      roundRect(ctx, x - q.headR * 1.2, top, q.headR * 2.4, y - top + 4, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x - q.headR * 0.85, top + 10, 6, (y - top) * 0.7); ctx.fillRect(x - q.headR * 0.6, top + 10, 3, (y - top) * 0.4);
    }
    if (p.reversed > 0) { ctx.save(); ctx.translate(x, q.headY - q.headR - 22); ctx.rotate(game.time * 3); reverseIcon(ctx, 14); ctx.restore(); }
    if (p.stun > 0) { for (let i = 0; i < 3; i++) { const a = game.time * 6 + (i * Math.PI * 2) / 3; starShape(ctx, x + Math.cos(a) * 30, q.headY - q.headR - 6 + Math.sin(a) * 8, 8, '#ffd23d'); } }
    // player tag
    const tag = p.controller === 'ai' ? 'CPU' : p.tag || '';
    if (tag && game.phase !== 'end') {
      ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = p.team === 0 ? '#c8ff4d' : '#3ddcff';
      ctx.fillText(tag, x, q.headY - q.headR - (p.reversed > 0 ? 44 : 10));
    }
    ctx.restore();
  }

  leg(ctx, hx, hy, fx, fy, kit, skin, s, f, back, kicking) {
    const kx = hx + (fx - hx) * 0.42, ky = hy + (fy - hy) * 0.42;
    ctx.strokeStyle = OUT; ctx.lineWidth = 11 * s + 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = back ? shade(skin, -0.15) : skin; ctx.lineWidth = 11 * s;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = back ? shade(kit.socks || '#fff', -0.15) : kit.socks || '#fff';
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    // boot pointing along the facing direction, studs underneath
    const a = Math.atan2(fy - hy, fx - hx) - Math.PI / 2 * f;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(a * 0.5);
    ctx.fillStyle = kicking ? '#ffe14d' : back ? '#20242e' : '#2b3040';
    ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(f * 6 * s, 1, 12 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(f * 2 * s - 5 * s, -2 * s, 10 * s, 2 * s);
    ctx.restore();
  }

  arm(ctx, sx, sy, a, f, s, kit, skin, back) {
    const ex = sx + Math.sin(a) * 18 * s * f, ey = sy + Math.cos(a) * 19 * s;
    ctx.strokeStyle = OUT; ctx.lineWidth = 9 * s + 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = back ? shade(kit.shirt, -0.15) : kit.shirt; ctx.lineWidth = 10 * s; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (ex - sx) * 0.38, sy + (ey - sy) * 0.38); ctx.stroke(); // sleeve
    ctx.strokeStyle = back ? shade(skin, -0.15) : skin; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(sx + (ex - sx) * 0.38, sy + (ey - sy) * 0.38); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = back ? shade(skin, -0.15) : skin; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, 5.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function starShape(ctx, x, y, r, color) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); }
function pent(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = rot - Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}
export { panel };
