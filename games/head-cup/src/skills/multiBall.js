// MULTI-BALL: two extra balls burst out of the ball for 7 s. Every ball can score.
import { makeBall } from '../physics.js';
import { ballIcon } from './util.js';

export default {
  id: 'multiBall', color: '#c8ff4d', cooldown: 10, duration: 0, uses: 1, sfx: 'multi',
  name: { en: 'Multi-ball', fr: 'Multi-ballons', ar: 'كرات متعددة' },
  desc: { en: 'Two extra balls join the game for 7 seconds. All of them count!', fr: 'Deux ballons en plus pendant 7 secondes. Ils comptent tous !', ar: 'كرتان إضافيتان لمدة 7 ثوانٍ، وكلها تُحتسب!' },
  activate(game) {
    const b = game.ball;
    if (game.balls.length > 1) return false;
    for (const dir of [-1, 1]) {
      const e = makeBall(b.x, Math.min(b.y, 520));
      e.vx = dir * (350 + game.rng() * 200); e.vy = -650 - game.rng() * 200; e.extra = true; e.life = 7;
      e.r = b.r; e.gravityMul = b.gravityMul;
      game.balls.push(e);
    }
    game.emit('fx', { kind: 'multi', x: b.x, y: b.y });
  },
  icon(ctx, r) { ballIcon(ctx, -r * 0.48, r * 0.3, r * 0.42); ballIcon(ctx, r * 0.48, r * 0.3, r * 0.42); ballIcon(ctx, 0, -r * 0.42, r * 0.46); },
};
