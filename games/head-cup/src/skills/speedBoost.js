// SPEED BOOST (lightning): 1.8x running speed for 5 s with a lightning trail.
import { path, fill } from './util.js';

export function bolt(ctx, r, color = '#ffe14d') {
  path(ctx, [[r * 0.2, -r], [-r * 0.5, r * 0.1], [-r * 0.02, r * 0.1], [-r * 0.25, r], [r * 0.55, -r * 0.15], [r * 0.05, -r * 0.15]]); fill(ctx, color);
}

export default {
  id: 'speedBoost', color: '#ffe14d', cooldown: 6, duration: 5, uses: 1, sfx: 'speed',
  name: { en: 'Speed Boost', fr: 'Turbo', ar: 'سرعة البرق' },
  desc: { en: 'Run 1.8x faster for 5 seconds.', fr: 'Courez 1,8 fois plus vite pendant 5 secondes.', ar: 'اركض أسرع بنسبة 80% لمدة 5 ثوانٍ.' },
  activate() {},
  modify(game, p, mods) { mods.speedMul *= 1.8; mods.jumpMul *= 1.08; },
  icon(ctx, r) { bolt(ctx, r); },
};
