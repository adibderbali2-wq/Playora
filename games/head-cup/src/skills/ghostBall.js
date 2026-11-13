// GHOST BALL: your next kick (within 6 s) turns the ball nearly invisible while it flies.
import { fill } from './util.js';

export default {
  id: 'ghostBall', color: '#d9d4ff', cooldown: 8, duration: 6, uses: 1, sfx: 'ghost',
  name: { en: 'Ghost Ball', fr: 'Ballon fantôme', ar: 'الكرة الشبح' },
  desc: { en: 'Your next kick makes the ball almost invisible in flight.', fr: 'Votre prochain tir rend le ballon presque invisible.', ar: 'ركلتك التالية تجعل الكرة شبه مخفية أثناء طيرانها.' },
  activate(game, p, s) { s.data.armed = true; },
  onKick(game, p, ball, s) {
    if (!s.data.armed) return;
    s.data.armed = false; ball.ghost = 1.4;
    game.emit('fx', { kind: 'ghost', x: ball.x, y: ball.y });
    game.skills.stop(p);
  },
  icon(ctx, r) {
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.9); ctx.lineTo(-r * 0.7, -r * 0.1); ctx.arc(0, -r * 0.1, r * 0.7, Math.PI, 0);
    ctx.lineTo(r * 0.7, r * 0.9); ctx.lineTo(r * 0.35, r * 0.6); ctx.lineTo(0, r * 0.9); ctx.lineTo(-r * 0.35, r * 0.6); ctx.closePath(); fill(ctx, '#f4f2ff');
    ctx.fillStyle = '#1d1230'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.arc(r * 0.25, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
  },
};
