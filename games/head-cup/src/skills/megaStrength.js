// MEGA STRENGTH (hurricane kick): for 5 s your kicks are twice as strong and the ball swirls like a tornado.
import { stroke } from './util.js';

export default {
  id: 'megaStrength', color: '#ff3d5a', cooldown: 8, duration: 5, uses: 1, sfx: 'mega',
  name: { en: 'Mega Strength', fr: 'Méga force', ar: 'قوة الإعصار' },
  desc: { en: 'Double kick power for 5 s, and shots swirl like a tornado.', fr: 'Puissance de tir doublée 5 s, le ballon tourbillonne.', ar: 'ضعف قوة الركل 5 ثوانٍ والكرة تدور كالإعصار.' },
  activate() {},
  modify(game, p, mods) { mods.kickMul *= 2; },
  onKick(game, p, ball) { ball.tornado = 1.4; ball.spin = -p.facing * 30; game.emit('fx', { kind: 'tornado', x: ball.x, y: ball.y }); },
  icon(ctx, r) {
    for (let i = 0; i < 4; i++) {
      const y = -r * 0.7 + i * r * 0.45, w = r * (1 - i * 0.2);
      ctx.beginPath(); ctx.moveTo(-w + i * r * 0.1, y); ctx.quadraticCurveTo(0, y + r * 0.2, w + i * r * 0.1, y); stroke(ctx, i % 2 ? '#ffb3c0' : '#ffffff', r * 0.16);
    }
  },
};
