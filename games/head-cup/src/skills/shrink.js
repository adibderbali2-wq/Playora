// SHRINK: opponents shrink for 5 s: smaller head and body (harder to defend) and weaker jumps.
import { opponents, path, fill } from './util.js';

export default {
  id: 'shrink', color: '#b98bff', cooldown: 8, duration: 5, uses: 1, sfx: 'shrink',
  name: { en: 'Shrink', fr: 'Rétrécir', ar: 'تقليص' },
  desc: { en: 'Opponents shrink for 5 s: tiny heads, weak jumps.', fr: 'Les adversaires rétrécissent 5 s : petite tête, sauts faibles.', ar: 'يتقلص الخصوم 5 ثوانٍ: رأس صغير وقفز ضعيف.' },
  activate(game, p) { for (const o of opponents(game, p)) { o.shrunk = 5; game.emit('fx', { kind: 'shrink', x: o.x, y: o.y - 80 }); } },
  icon(ctx, r) {
    for (const s of [-1, 1]) {
      path(ctx, [[s * r, -r * 0.15], [s * r * 0.35, -r * 0.15], [s * r * 0.35, -r * 0.45], [s * r * 0.05, 0], [s * r * 0.35, r * 0.45], [s * r * 0.35, r * 0.15], [s * r, r * 0.15]]);
      fill(ctx, '#d9c6ff');
    }
  },
};
