// Shared helpers for skill modules (not a skill itself).
export const opponents = (game, p) => game.players.filter((q) => q.team !== p.team);

// ---- tiny vector icon kit (all icons are drawn centred at 0,0 inside radius r)
export function path(ctx, pts, close = true) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath();
}
export function ballIcon(ctx, x, y, r) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b2a'; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.lineTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); }
  ctx.fill();
  ctx.strokeStyle = '#1b1b2a'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
export function stroke(ctx, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
export function fill(ctx, color) { ctx.fillStyle = color; ctx.fill(); }
