// REVERSE CONTROLS: opponents' left and right are swapped for 4 s.
import { opponents, path, fill, stroke } from './util.js';

export function reverseIcon(ctx, r, color = '#ff9a3d') {
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI * 1.15, Math.PI * 1.95); stroke(ctx, color, r * 0.18);
  path(ctx, [[r * 0.75, -r * 0.45], [r * 0.4, -r * 0.05], [r * 0.85, r * 0.05]]); fill(ctx, color);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI * 0.15, Math.PI * 0.95); stroke(ctx, color, r * 0.18);
  path(ctx, [[-r * 0.75, r * 0.45], [-r * 0.4, r * 0.05], [-r * 0.85, -r * 0.05]]); fill(ctx, color);
}

export default {
  id: 'reverseControls', color: '#ff9a3d', cooldown: 8, duration: 0, uses: 1, sfx: 'reverse',
  name: { en: 'Reverse Controls', fr: 'Contrôles inversés', ar: 'عكس التحكم' },
  desc: { en: 'Swap your opponents’ left and right for 4 seconds.', fr: 'Inverse la gauche et la droite des adversaires pendant 4 secondes.', ar: 'يعكس اليمين واليسار لدى الخصوم لمدة 4 ثوانٍ.' },
  activate(game, p) { for (const o of opponents(game, p)) { o.reversed = 4; game.emit('fx', { kind: 'reverse', x: o.x, y: o.y - 110 }); } },
  icon(ctx, r) { reverseIcon(ctx, r); },
};
