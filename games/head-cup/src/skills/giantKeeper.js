// GIANT KEEPER: a giant glove-wall guards your goal for 4 s.
import { W, GROUND, CROSSBAR_Y, GOAL_LINE } from '../config.js';

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };

/** Goalkeeper glove icon, also used to draw the wall in the renderer. */
export function glove(ctx, r, color = '#2fd1c4') {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = '#1d1230'; ctx.lineWidth = r * 0.1; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) { const x = -r * 0.45 + i * r * 0.3; rr(ctx, x - r * 0.12, -r * 0.85, r * 0.24, r * 0.8, r * 0.12); ctx.fill(); ctx.stroke(); }
  rr(ctx, -r * 0.6, -r * 0.25, r * 1.2, r * 1.0, r * 0.3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-r * 0.72, r * 0.1, r * 0.18, r * 0.38, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-r * 0.6, r * 0.5, r * 1.2, r * 0.2);
  ctx.restore();
}

export default {
  id: 'giantKeeper', color: '#2fd1c4', cooldown: 9, duration: 4, uses: 1, sfx: 'keeper',
  name: { en: 'Giant Keeper', fr: 'Gardien géant', ar: 'الحارس العملاق' },
  desc: { en: 'A giant glove blocks your goal for 4 seconds.', fr: 'Un gant géant bloque votre but pendant 4 secondes.', ar: 'قفاز عملاق يسد مرماك لمدة 4 ثوانٍ.' },
  activate(game, p, s) {
    const w = 46, x = p.team === 0 ? GOAL_LINE - w + 14 : W - GOAL_LINE - 14;
    s.data.wall = { x, y: CROSSBAR_Y + 10, w, h: GROUND - CROSSBAR_Y - 10, t: 0, life: 4, team: p.team };
    game.walls.push(s.data.wall);
  },
  update(game, p, s, dt) { if (s.data.wall) s.data.wall.t += dt; },
  end(game, p, s) { game.walls = game.walls.filter((w) => w !== s.data.wall); },
  icon(ctx, r) { glove(ctx, r * 0.9); },
};
