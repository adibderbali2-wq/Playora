// FIREBALL: your next kick (within 6 s) becomes a blazing shot. A burning ball knocks back the first opponent it hits.
import { path, fill } from './util.js';

export default {
  id: 'fireball', color: '#ff6a1f', cooldown: 8, duration: 6, uses: 1, sfx: 'fireball',
  name: { en: 'Fireball', fr: 'Boule de feu', ar: 'كرة نارية' },
  desc: { en: 'Your next kick becomes a blazing, super-fast shot.', fr: 'Votre prochain tir devient une frappe enflammée ultra rapide.', ar: 'تصبح ركلتك التالية تسديدة نارية فائقة السرعة.' },
  activate(game, p, s) { s.data.armed = true; },
  onKick(game, p, ball, s) {
    if (!s.data.armed) return;
    s.data.armed = false;
    ball.vx *= 1.65; ball.vy *= 0.7;
    ball.fire = 1.8; ball.fireTeam = p.team;
    game.emit('fx', { kind: 'fireKick', x: ball.x, y: ball.y });
    game.skills.stop(p);
  },
  onBallTouch(game, ball, p) {
    if (ball.fire > 0 && p.team !== ball.fireTeam) {
      ball.fire = 0;
      p.stun = 0.8; p.vx = (ball.vx > 0 ? 1 : -1) * 520; p.vy = -380; p.onGround = false;
      game.emit('fx', { kind: 'burn', x: p.x, y: p.y - 90 });
    }
  },
  icon(ctx, r) {
    path(ctx, [[0, -r], [r * 0.55, -r * 0.1], [r * 0.6, r * 0.45], [0, r], [-r * 0.6, r * 0.45], [-r * 0.5, -r * 0.15], [-r * 0.2, r * 0.1]]); fill(ctx, '#ff5a1f');
    path(ctx, [[0, -r * 0.3], [r * 0.3, r * 0.25], [0, r * 0.7], [-r * 0.3, r * 0.25]]); fill(ctx, '#ffd23d');
  },
};
