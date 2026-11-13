// MAGNET: the ball is pulled toward your head for 3 s.
import { parts } from '../physics.js';
import { stroke } from './util.js';

export default {
  id: 'magnet', color: '#ff4d6d', cooldown: 7, duration: 3, uses: 1, sfx: 'magnet',
  name: { en: 'Magnet', fr: 'Aimant', ar: 'مغناطيس' },
  desc: { en: 'Pull the ball toward your head for 3 seconds.', fr: 'Attirez le ballon vers votre tête pendant 3 secondes.', ar: 'اجذب الكرة نحو رأسك لمدة 3 ثوانٍ.' },
  activate() {},
  update(game, p, s, dt) {
    const q = parts(p), b = game.ball;
    const dx = q.headX + p.facing * q.headR * 0.4 - b.x, dy = q.headY - q.headR - b.y, d = Math.hypot(dx, dy) || 1;
    if (d < 30) { b.vx *= 0.9; b.vy *= 0.9; return; }
    const pull = 3200 * Math.min(1, 220 / d + 0.35);
    b.vx += (dx / d) * pull * dt; b.vy += (dy / d) * pull * dt - 1550 * dt * 0.6; // cancels part of gravity
    const sp = Math.hypot(b.vx, b.vy); if (sp > 900) { b.vx *= 900 / sp; b.vy *= 900 / sp; }
  },
  icon(ctx, r) {
    ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.6, Math.PI, 0); ctx.lineTo(r * 0.6, r * 0.7); ctx.moveTo(-r * 0.6, -r * 0.05); ctx.lineTo(-r * 0.6, r * 0.7);
    stroke(ctx, '#ff4d6d', r * 0.42);
    ctx.fillStyle = '#e6e6f0'; ctx.fillRect(-r * 0.81, r * 0.45, r * 0.42, r * 0.4); ctx.fillRect(r * 0.39, r * 0.45, r * 0.42, r * 0.4);
  },
};
