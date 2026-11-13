// TELEPORT: instantly appear right behind the ball, ready to strike toward goal.
import { W, GROUND } from '../config.js';
import { stroke } from './util.js';

export default {
  id: 'teleport', color: '#3ddcff', cooldown: 6, duration: 0, uses: 1, sfx: 'teleport',
  name: { en: 'Teleport', fr: 'Téléportation', ar: 'انتقال فوري' },
  desc: { en: 'Warp right behind the ball, facing the goal.', fr: 'Apparaissez juste derrière le ballon, face au but.', ar: 'انتقل فوراً خلف الكرة باتجاه المرمى.' },
  activate(game, p) {
    const b = game.ball;
    game.emit('fx', { kind: 'portal', x: p.x, y: p.y - 70 });
    p.x = Math.max(40, Math.min(W - 40, b.x - p.facing * 58));
    p.y = Math.min(GROUND, Math.max(b.y + 40, GROUND - 260));
    p.vx = 0; p.vy = 0; p.px = p.x; p.py = p.y;
    p.onGround = p.y >= GROUND;
    game.emit('fx', { kind: 'portal', x: p.x, y: p.y - 70 });
  },
  icon(ctx, r) {
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.95, 0, 0, Math.PI * 2); stroke(ctx, '#3ddcff', r * 0.18);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.6, 0, 0, Math.PI * 2); stroke(ctx, '#b4f2ff', r * 0.14);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.2, r * 0.25, 0, 0, Math.PI * 2); stroke(ctx, '#ffffff', r * 0.1);
  },
};
