// FREEZE: opponents are frozen in an ice block for 2 s.
import { opponents, stroke } from './util.js';

export default {
  id: 'freeze', color: '#7fe3ff', cooldown: 9, duration: 0, uses: 1, sfx: 'freeze',
  name: { en: 'Freeze', fr: 'Gel', ar: 'تجميد' },
  desc: { en: 'Freeze your opponents solid for 2 seconds.', fr: 'Gelez vos adversaires pendant 2 secondes.', ar: 'جمّد خصومك لمدة ثانيتين.' },
  activate(game, p) {
    for (const o of opponents(game, p)) { o.frozen = 2; o.vx = 0; o.kick.t = 0; game.emit('fx', { kind: 'ice', x: o.x, y: o.y - 80 }); }
  },
  icon(ctx, r) {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r); stroke(ctx, '#e6fbff', r * 0.16);
      for (const s of [-1, 1]) {
        const bx = Math.cos(a) * r * 0.6 * s, by = Math.sin(a) * r * 0.6 * s;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.8) * r * 0.3 * s, by + Math.sin(a + 0.8) * r * 0.3 * s);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.8) * r * 0.3 * s, by + Math.sin(a - 0.8) * r * 0.3 * s); stroke(ctx, '#e6fbff', r * 0.12);
      }
    }
  },
};
