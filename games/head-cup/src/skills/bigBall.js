// BIG BALL: the ball grows to almost double size for 6 s.
import { ballIcon, stroke } from './util.js';

export default {
  id: 'bigBall', color: '#ffd23d', cooldown: 8, duration: 6, uses: 1, sfx: 'big',
  name: { en: 'Big Ball', fr: 'Ballon géant', ar: 'الكرة العملاقة' },
  desc: { en: 'The ball grows to almost double size for 6 seconds.', fr: 'Le ballon double presque de taille pendant 6 secondes.', ar: 'تكبر الكرة إلى ضعف حجمها تقريباً لمدة 6 ثوانٍ.' },
  activate(game) { for (const b of game.balls) b.r = b.baseR * 1.85; },
  update(game) { for (const b of game.balls) b.r = b.baseR * 1.85; },
  end(game) { for (const b of game.balls) b.r = b.baseR; },
  icon(ctx, r) {
    ballIcon(ctx, 0, 0, r * 0.55);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.moveTo(x * r * 0.62, y * r * 0.62); ctx.lineTo(x * r * 0.95, y * r * 0.95); stroke(ctx, '#ffd23d', r * 0.14); }
  },
};
