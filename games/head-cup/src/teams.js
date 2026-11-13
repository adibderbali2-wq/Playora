// Teams: country flags drawn in code (no image files) and the kit colours each team wears.
export const TEAMS = [
  { id: 'tunisia', name: { en: 'Tunisia', fr: 'Tunisie', ar: 'تونس' }, kit: { shirt: '#e70013', shorts: '#ffffff', socks: '#e70013', trim: '#ffffff' } },
  { id: 'morocco', name: { en: 'Morocco', fr: 'Maroc', ar: 'المغرب' }, kit: { shirt: '#c1272d', shorts: '#006233', socks: '#c1272d', trim: '#006233' } },
  { id: 'algeria', name: { en: 'Algeria', fr: 'Algérie', ar: 'الجزائر' }, kit: { shirt: '#ffffff', shorts: '#006233', socks: '#006233', trim: '#d21034' } },
  { id: 'egypt', name: { en: 'Egypt', fr: 'Égypte', ar: 'مصر' }, kit: { shirt: '#ce1126', shorts: '#ffffff', socks: '#000000', trim: '#c09300' } },
  { id: 'senegal', name: { en: 'Senegal', fr: 'Sénégal', ar: 'السنغال' }, kit: { shirt: '#ffffff', shorts: '#00853f', socks: '#00853f', trim: '#fdef42' } },
  { id: 'nigeria', name: { en: 'Nigeria', fr: 'Nigeria', ar: 'نيجيريا' }, kit: { shirt: '#008751', shorts: '#ffffff', socks: '#008751', trim: '#ffffff' } },
  { id: 'brazil', name: { en: 'Brazil', fr: 'Brésil', ar: 'البرازيل' }, kit: { shirt: '#ffdc02', shorts: '#002776', socks: '#ffffff', trim: '#009b3a' } },
  { id: 'argentina', name: { en: 'Argentina', fr: 'Argentine', ar: 'الأرجنتين' }, kit: { shirt: '#75aadb', shorts: '#1b1b1b', socks: '#ffffff', trim: '#ffffff', stripes: '#ffffff' } },
  { id: 'france', name: { en: 'France', fr: 'France', ar: 'فرنسا' }, kit: { shirt: '#1f3a8a', shorts: '#ffffff', socks: '#e1000f', trim: '#ffffff' } },
  { id: 'spain', name: { en: 'Spain', fr: 'Espagne', ar: 'إسبانيا' }, kit: { shirt: '#c60b1e', shorts: '#1b2a6b', socks: '#1b2a6b', trim: '#ffc400' } },
  { id: 'germany', name: { en: 'Germany', fr: 'Allemagne', ar: 'ألمانيا' }, kit: { shirt: '#ffffff', shorts: '#111111', socks: '#ffffff', trim: '#dd0000' } },
  { id: 'italy', name: { en: 'Italy', fr: 'Italie', ar: 'إيطاليا' }, kit: { shirt: '#0a5ec2', shorts: '#ffffff', socks: '#0a5ec2', trim: '#ffffff' } },
  { id: 'japan', name: { en: 'Japan', fr: 'Japon', ar: 'اليابان' }, kit: { shirt: '#0b1f6b', shorts: '#ffffff', socks: '#0b1f6b', trim: '#bc002d' } },
  { id: 'portugal', name: { en: 'Portugal', fr: 'Portugal', ar: 'البرتغال' }, kit: { shirt: '#b5121b', shorts: '#046a38', socks: '#b5121b', trim: '#ffe000' } },
];
export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

function star(ctx, x, y, r, points = 5, inner = 0.4, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points, rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function crescent(ctx, x, y, r, color, bg, offset = 0.28) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x + r * offset, y, r * 0.8, 0, Math.PI * 2); ctx.fill();
}
const bandsV = (ctx, x, y, w, h, cols) => cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + (w / cols.length) * i, y, w / cols.length + 0.5, h); });
const bandsH = (ctx, x, y, w, h, cols, weights) => {
  const tot = weights ? weights.reduce((a, b) => a + b) : cols.length; let yy = y;
  cols.forEach((c, i) => { const hh = (h * (weights ? weights[i] : 1)) / tot; ctx.fillStyle = c; ctx.fillRect(x, yy, w, hh + 0.5); yy += hh; });
};

/** Draw a flag filling the rectangle x,y,w,h (3:2 recommended). */
export function drawFlag(ctx, id, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const cx = x + w / 2, cy = y + h / 2;
  switch (id) {
    case 'tunisia': {
      ctx.fillStyle = '#e70013'; ctx.fillRect(x, y, w, h);
      const r = h * 0.25;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      crescent(ctx, cx, cy, r * 0.75, '#e70013', '#fff', 0.3);
      ctx.fillStyle = '#e70013'; star(ctx, cx + r * 0.22, cy, r * 0.4, 5, 0.4, Math.PI); ctx.fill();
      break;
    }
    case 'morocco':
      ctx.fillStyle = '#c1272d'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#006233'; ctx.lineWidth = h * 0.05; star(ctx, cx, cy + h * 0.02, h * 0.28, 5, 0.38); ctx.stroke();
      break;
    case 'algeria':
      bandsV(ctx, x, y, w, h, ['#006233', '#ffffff']);
      crescent(ctx, cx + w * 0.02, cy, h * 0.27, '#d21034', '#ffffff', 0.26);
      ctx.fillStyle = '#d21034'; star(ctx, cx + w * 0.08, cy, h * 0.12, 5, 0.4, Math.PI); ctx.fill();
      break;
    case 'egypt':
      bandsH(ctx, x, y, w, h, ['#ce1126', '#ffffff', '#000000']);
      ctx.fillStyle = '#c09300'; ctx.beginPath(); ctx.ellipse(cx, cy, h * 0.08, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - h * 0.16, cy - h * 0.02); ctx.lineTo(cx, cy + h * 0.08); ctx.lineTo(cx + h * 0.16, cy - h * 0.02); ctx.lineTo(cx, cy + h * 0.02); ctx.fill();
      break;
    case 'senegal':
      bandsV(ctx, x, y, w, h, ['#00853f', '#fdef42', '#e31b23']);
      ctx.fillStyle = '#00853f'; star(ctx, cx, cy + h * 0.02, h * 0.17); ctx.fill();
      break;
    case 'nigeria': bandsV(ctx, x, y, w, h, ['#008751', '#ffffff', '#008751']); break;
    case 'brazil':
      ctx.fillStyle = '#009b3a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fedf00'; ctx.beginPath(); ctx.moveTo(x + w * 0.08, cy); ctx.lineTo(cx, y + h * 0.1); ctx.lineTo(x + w * 0.92, cy); ctx.lineTo(cx, y + h * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#002776'; ctx.beginPath(); ctx.arc(cx, cy, h * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = h * 0.04; ctx.beginPath(); ctx.arc(cx + h * 0.05, cy + h * 0.4, h * 0.45, -2.1, -1.05); ctx.stroke();
      break;
    case 'argentina':
      bandsH(ctx, x, y, w, h, ['#75aadb', '#ffffff', '#75aadb']);
      ctx.fillStyle = '#f6b40e'; ctx.beginPath(); ctx.arc(cx, cy, h * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f6b40e'; ctx.lineWidth = h * 0.025;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * h * 0.11, cy + Math.sin(a) * h * 0.11); ctx.lineTo(cx + Math.cos(a) * h * 0.16, cy + Math.sin(a) * h * 0.16); ctx.stroke(); }
      break;
    case 'france': bandsV(ctx, x, y, w, h, ['#0055a4', '#ffffff', '#ef4135']); break;
    case 'spain': bandsH(ctx, x, y, w, h, ['#c60b1e', '#ffc400', '#c60b1e'], [1, 2, 1]); break;
    case 'germany': bandsH(ctx, x, y, w, h, ['#000000', '#dd0000', '#ffce00']); break;
    case 'italy': bandsV(ctx, x, y, w, h, ['#009246', '#ffffff', '#ce2b37']); break;
    case 'japan':
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(cx, cy, h * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'portugal':
      ctx.fillStyle = '#046a38'; ctx.fillRect(x, y, w * 0.4, h); ctx.fillStyle = '#da291c'; ctx.fillRect(x + w * 0.4, y, w * 0.6, h);
      ctx.strokeStyle = '#ffe000'; ctx.lineWidth = h * 0.05; ctx.beginPath(); ctx.arc(x + w * 0.4, cy, h * 0.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#da291c'; ctx.fillRect(x + w * 0.4 - h * 0.09, cy - h * 0.11, h * 0.18, h * 0.2);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + w * 0.4 - h * 0.06, cy - h * 0.07, h * 0.12, h * 0.12);
      break;
    default: ctx.fillStyle = '#888'; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Round flag badge (used on the scoreboard and select screen). */
export function drawFlagBadge(ctx, id, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  drawFlag(ctx, id, x - r * 1.5, y - r, r * 3, r * 2);
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
