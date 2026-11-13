// GRAVITY FLIP: for 4 s the balls fall upward.
import { path, fill } from './util.js';

export default {
  id: 'gravityFlip', color: '#8f6bff', cooldown: 9, duration: 4, uses: 1, sfx: 'gravity',
  name: { en: 'Gravity Flip', fr: 'Gravité inversée', ar: 'قلب الجاذبية' },
  desc: { en: 'For 4 seconds the ball falls upward.', fr: 'Pendant 4 secondes, le ballon tombe vers le haut.', ar: 'لمدة 4 ثوانٍ تسقط الكرة نحو الأعلى.' },
  activate(game) { for (const b of game.balls) { b.gravityMul = -0.55; b.vy -= 200; } },
  update(game) { for (const b of game.balls) b.gravityMul = -0.55; },
  end(game) { for (const b of game.balls) b.gravityMul = 1; },
  icon(ctx, r) {
    path(ctx, [[-r * 0.35, r * 0.9], [-r * 0.35, -r * 0.2], [-r * 0.75, -r * 0.2], [-r * 0.2, -r * 0.9], [r * 0.15, -r * 0.2], [-r * 0.1, -r * 0.2], [-r * 0.1, r * 0.9]]); fill(ctx, '#d8ccff');
    path(ctx, [[r * 0.35, -r * 0.9], [r * 0.35, r * 0.2], [r * 0.75, r * 0.2], [r * 0.2, r * 0.9], [-r * 0.15, r * 0.2], [r * 0.1, r * 0.2], [r * 0.1, -r * 0.9]]); fill(ctx, '#8f6bff');
  },
};
