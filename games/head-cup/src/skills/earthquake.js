// EARTHQUAKE: the pitch shakes. Opponents standing on the ground are stunned for 1.2 s. Jump to dodge it!
import { GROUND } from '../config.js';
import { opponents, path, fill, stroke } from './util.js';

export default {
  id: 'earthquake', color: '#c08a4a', cooldown: 8, duration: 0, uses: 1, sfx: 'quake',
  name: { en: 'Earthquake', fr: 'Séisme', ar: 'زلزال' },
  desc: { en: 'Stuns opponents standing on the ground for 1.2 s. Jumping dodges it.', fr: 'Étourdit 1,2 s les adversaires au sol. Sautez pour l’éviter.', ar: 'يصعق الخصوم الواقفين على الأرض 1.2 ثانية. القفز يتفاداه.' },
  activate(game, p) {
    for (const o of opponents(game, p)) if (o.onGround) { o.stun = 1.2; o.vy = -420; o.onGround = false; }
    for (const b of game.balls) if (b.y > GROUND - b.r - 30) b.vy = -650;
    game.world.shake = 24;
    game.emit('fx', { kind: 'quake', x: p.x, y: GROUND });
  },
  icon(ctx, r) {
    path(ctx, [[-r, r * 0.25], [r, r * 0.25], [r, r * 0.9], [-r, r * 0.9]]); fill(ctx, '#8a6a4a');
    ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.25); ctx.lineTo(r * 0.15, r * 0.5); ctx.lineTo(-r * 0.1, r * 0.65); ctx.lineTo(r * 0.1, r * 0.9); stroke(ctx, '#1d1230', r * 0.12);
    for (const x of [-r * 0.6, 0, r * 0.6]) { ctx.beginPath(); ctx.moveTo(x - r * 0.15, -r * 0.1); ctx.lineTo(x + r * 0.15, -r * 0.1); ctx.moveTo(x - r * 0.1, -r * 0.45); ctx.lineTo(x + r * 0.1, -r * 0.45); stroke(ctx, '#ffd9a0', r * 0.1); }
  },
};
