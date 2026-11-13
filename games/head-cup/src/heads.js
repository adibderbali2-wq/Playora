// Cartoon heads drawn in code from a character's `look` (see characters.json), or a custom PNG if supplied.
// Everything is drawn facing right, then mirrored for players facing left.

const OUT = '#1d1230'; // outline colour

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
export function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function facePath(ctx, shape, r) {
  ctx.beginPath();
  if (shape === 'square') {
    const w = r * 0.93, t = -r * 0.96, b = r * 0.98, k = r * 0.45;
    ctx.moveTo(-w + k, t); ctx.lineTo(w - k, t); ctx.quadraticCurveTo(w, t, w, t + k);
    ctx.lineTo(w, b - k); ctx.quadraticCurveTo(w, b, w - k, b); ctx.lineTo(-w + k, b);
    ctx.quadraticCurveTo(-w, b, -w, b - k); ctx.lineTo(-w, t + k); ctx.quadraticCurveTo(-w, t, -w + k, t);
  } else if (shape === 'long') ctx.ellipse(0, r * 0.04, r * 0.84, r * 1.04, 0, 0, Math.PI * 2);
  else if (shape === 'oval') ctx.ellipse(0, r * 0.02, r * 0.9, r, 0, 0, Math.PI * 2);
  else ctx.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2);
  ctx.closePath();
}

const blob = (ctx, x, y, rx, ry = rx) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };

/** Hair cap over the top of the head, with a fringe line at `fy` (fraction of r). */
function cap(ctx, r, fy = -0.42, bumps = 0, extend = 1.06) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.98, r * 0.05);
  ctx.bezierCurveTo(-r * 1.08, -r * 1.25, r * 1.08, -r * 1.25, r * 0.98, -r * 0.05);
  // fringe back across the forehead
  const steps = bumps || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = r * (0.98 - t * 1.96);
    const y = r * (fy + (bumps ? (i % 2 ? 0.1 : 0) : 0)) + Math.sin(t * Math.PI) * -r * 0.08;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(-r * 0.98, r * 0.05);
  ctx.closePath();
  ctx.fill();
  if (extend) { /* reserved for thickness tweaks */ }
}

// ------------------------------------------------------------------ back layer
function backHair(ctx, L, r) {
  const h = L.hair, col = h.color, acc = L.accessory;
  ctx.fillStyle = col;
  switch (h.style) {
    case 'afro':
      for (let i = 0; i < 16; i++) { const a = Math.PI + (i / 15) * Math.PI; blob(ctx, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.9 - r * 0.15, r * 0.38); }
      blob(ctx, 0, -r * 0.55, r * 1.05, r * 0.75);
      break;
    case 'mane':
      for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; blob(ctx, Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.05, r * 0.32); }
      break;
    case 'long':
      ctx.beginPath(); ctx.moveTo(-r * 1.02, -r * 0.2); ctx.quadraticCurveTo(-r * 1.25, r * 0.9, -r * 0.9, r * 1.25);
      ctx.lineTo(r * 0.2, r * 1.15); ctx.lineTo(r * 0.85, r * 0.6); ctx.lineTo(r * 1.02, -r * 0.2); ctx.closePath(); ctx.fill();
      break;
    case 'ponytail': {
      ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.55); ctx.quadraticCurveTo(-r * 1.7, -r * 0.4, -r * 1.55, r * 0.75);
      ctx.quadraticCurveTo(-r * 1.25, r * 0.2, -r * 0.75, -r * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = (L.accessory && L.accessory.color) || '#2fd1c4'; blob(ctx, -r * 0.92, -r * 0.42, r * 0.12);
      break;
    }
    case 'dreads':
      ctx.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const x = -r * 0.95 + i * r * 0.19, len = r * (0.9 + (i % 3) * 0.12);
        ctx.strokeStyle = col; ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.moveTo(x, -r * 0.7); ctx.quadraticCurveTo(x - r * 0.15, r * 0.2, x - r * 0.08 + (i % 2) * r * 0.06, len); ctx.stroke();
        if (h.beads && i % 2 === 0) { ctx.fillStyle = h.beads; blob(ctx, x - r * 0.08, len - r * 0.05, r * 0.07); }
      }
      break;
    case 'bun':
      blob(ctx, -r * 0.35, -r * 1.05, r * 0.32);
      ctx.fillStyle = shade(col, 0.25); blob(ctx, -r * 0.42, -r * 1.12, r * 0.1);
      break;
  }
  if (acc.type === 'nemes') {
    // pharaoh headdress lappets behind the face
    const g = acc.color || '#e7b928', b = acc.color2 || '#1f4fa8';
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.6); ctx.lineTo(-r * 1.35, r * 1.2); ctx.lineTo(r * 1.15, r * 1.2); ctx.lineTo(r * 1.05, -r * 0.6); ctx.closePath();
    ctx.clip(); ctx.fillStyle = g; ctx.fillRect(-r * 1.6, -r * 1.2, r * 3.2, r * 2.6);
    ctx.fillStyle = b; for (let y = -r * 0.5; y < r * 1.3; y += r * 0.22) ctx.fillRect(-r * 1.6, y, r * 3.2, r * 0.1);
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.6); ctx.lineTo(-r * 1.35, r * 1.2); ctx.lineTo(r * 1.15, r * 1.2); ctx.lineTo(r * 1.05, -r * 0.6); ctx.stroke();
  }
  if (acc.type === 'headband' || acc.type === 'ninja') {
    // knot tails fluttering behind the head
    ctx.fillStyle = acc.type === 'ninja' ? acc.color2 || '#d8263a' : acc.color;
    ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.45); ctx.quadraticCurveTo(-r * 1.4, -r * 0.6, -r * 1.65, -r * 0.2); ctx.lineTo(-r * 1.5, -r * 0.1); ctx.quadraticCurveTo(-r * 1.3, -r * 0.4, -r * 0.88, -r * 0.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.4); ctx.quadraticCurveTo(-r * 1.3, -r * 0.2, -r * 1.45, r * 0.15); ctx.lineTo(-r * 1.3, r * 0.2); ctx.quadraticCurveTo(-r * 1.2, -r * 0.1, -r * 0.88, -r * 0.28); ctx.fill();
  }
}

// ------------------------------------------------------------------ features
function eyes(ctx, L, r, o) {
  const look = o.look || { x: 0, y: 0 };
  const em = o.emotion;
  const pos = [[-r * 0.2, -r * 0.06, 0.92], [r * 0.4, -r * 0.06, 0.82]];
  const ew = r * 0.19, eh = r * 0.22;
  for (const [x, y, k] of pos) {
    const w = ew * k, h = eh * k;
    if (em === 'happy') { // closed, smiling eyes
      ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y + h * 0.3, w * 0.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.clip();
    const ix = x + look.x * w * 0.45, iy = y + look.y * h * 0.4;
    ctx.fillStyle = em === 'frozen' ? '#8fe3ff' : L.eyes; blob(ctx, ix, iy, w * 0.62);
    ctx.fillStyle = '#0b0710'; blob(ctx, ix, iy, w * 0.33);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; blob(ctx, ix - w * 0.22, iy - h * 0.25, w * 0.17);
    // eyelids: blink / effort squint / sad droop
    const lid = Math.max(o.blink || 0, em === 'effort' ? 0.42 : em === 'sad' ? 0.35 : 0);
    if (lid > 0) { ctx.fillStyle = shade(L.skin, -0.08); ctx.fillRect(x - w - 1, y - h - 1, w * 2 + 2, h * 2 * lid + 1); }
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.04;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.stroke();
    if (L.liner) { ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - h * 1.2, x + w * 1.5, y - h * 0.2); ctx.stroke(); }
    if (L.lashes) { ctx.lineWidth = r * 0.035; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + w * (0.2 + i * 0.3), y - h * 0.85); ctx.lineTo(x + w * (0.35 + i * 0.35), y - h * 1.25); ctx.stroke(); } }
  }
}

function brows(ctx, L, r, o) {
  const col = L.beard.style !== 'none' && L.hair.style === 'none' ? L.beard.color : L.hair.style === 'bald' ? shade(L.hair.color, -0.4) : L.hair.color || '#222';
  const em = o.emotion;
  const th = { thick: 0.11, thin: 0.04, angry: 0.08, normal: 0.07 }[L.brows] || 0.07;
  let tilt = L.brows === 'angry' ? 0.14 : 0;
  if (em === 'sad') tilt = -0.16; else if (em === 'effort') tilt = 0.2; else if (em === 'happy') tilt = -0.05;
  ctx.strokeStyle = col === '#000' ? '#111' : shade(col, -0.15); ctx.lineCap = 'round'; ctx.lineWidth = r * th;
  for (const [x, k] of [[-r * 0.2, 0.92], [r * 0.4, 0.82]]) {
    const w = r * 0.2 * k, y = -r * 0.33;
    const inner = x < 0 ? 1 : -1; // inner end is toward the nose (between the eyes)
    ctx.beginPath();
    ctx.moveTo(x - w, y - tilt * r * 0.5 * -inner);
    ctx.quadraticCurveTo(x, y - r * 0.06, x + w, y - tilt * r * 0.5 * inner);
    ctx.stroke();
  }
}

function nose(ctx, L, r) {
  const x = r * 0.14, y = r * 0.17;
  ctx.fillStyle = shade(L.skin, -0.12); ctx.strokeStyle = shade(L.skin, -0.4); ctx.lineWidth = r * 0.04;
  switch (L.nose) {
    case 'big': blob(ctx, x + r * 0.04, y, r * 0.17, r * 0.14); ctx.fillStyle = shade(L.skin, 0.25); blob(ctx, x, y - r * 0.05, r * 0.05); break;
    case 'round': blob(ctx, x, y, r * 0.12, r * 0.1); ctx.fillStyle = shade(L.skin, 0.25); blob(ctx, x - r * 0.03, y - r * 0.03, r * 0.04); break;
    case 'small': ctx.beginPath(); ctx.arc(x, y, r * 0.07, 0.2, Math.PI - 0.2); ctx.stroke(); break;
    default: ctx.beginPath(); ctx.moveTo(x - r * 0.02, y - r * 0.22); ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.02, x - r * 0.04, y + r * 0.06); ctx.stroke();
  }
}

function mouth(ctx, L, r, o) {
  const em = o.emotion;
  const style = em === 'happy' ? 'grin' : em === 'sad' ? 'frown' : em === 'effort' ? 'teeth' : em === 'frozen' ? 'o' : L.mouth;
  const x = r * 0.1, y = r * 0.5;
  ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.055;
  switch (style) {
    case 'grin': case 'open': {
      const w = style === 'grin' ? r * 0.36 : r * 0.24, h = style === 'grin' ? r * 0.26 : r * 0.22;
      ctx.fillStyle = '#5a1020';
      ctx.beginPath(); ctx.moveTo(x - w, y - h * 0.2); ctx.quadraticCurveTo(x, y - h * 0.5, x + w, y - h * 0.2); ctx.quadraticCurveTo(x, y + h * 1.3, x - w, y - h * 0.2); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - w, y - h * 0.55, w * 2, h * 0.42);
      ctx.fillStyle = '#ff6a7d'; blob(ctx, x, y + h * 0.75, w * 0.55, h * 0.4);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(x - w, y - h * 0.2); ctx.quadraticCurveTo(x, y - h * 0.5, x + w, y - h * 0.2); ctx.quadraticCurveTo(x, y + h * 1.3, x - w, y - h * 0.2); ctx.stroke();
      break;
    }
    case 'teeth': {
      const w = r * 0.28, h = r * 0.15;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w, y - h / 2, w * 2, h, h * 0.4) : ctx.rect(x - w, y - h / 2, w * 2, h); ctx.fill(); ctx.stroke();
      ctx.lineWidth = r * 0.025; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y);
      for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * w * 0.38, y - h / 2); ctx.lineTo(x + i * w * 0.38, y + h / 2); }
      ctx.stroke();
      break;
    }
    case 'frown': ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.22, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); break;
    case 'o': ctx.fillStyle = '#5a1020'; blob(ctx, x, y, r * 0.1, r * 0.12); ctx.stroke(); break;
    case 'smirk': ctx.beginPath(); ctx.moveTo(x - r * 0.22, y + r * 0.02); ctx.quadraticCurveTo(x + r * 0.05, y + r * 0.1, x + r * 0.26, y - r * 0.08); ctx.stroke(); break;
    default: ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 0.24, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
}

function beard(ctx, L, r, shapeClip) {
  const b = L.beard; if (!b || b.style === 'none') return;
  const col = b.color || '#222';
  ctx.save();
  if (b.style === 'stubble') {
    shapeClip(); ctx.clip();
    ctx.fillStyle = col; ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.moveTo(-r, r * 0.05); ctx.quadraticCurveTo(-r * 0.5, r * 0.32, 0, r * 0.3); ctx.quadraticCurveTo(r * 0.5, r * 0.32, r, r * 0.05); ctx.lineTo(r, r * 1.2); ctx.lineTo(-r, r * 1.2); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = col;
  if (b.style === 'full' || b.style === 'braided') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.92, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.95, 0, r * 1.18);
    ctx.quadraticCurveTo(r * 0.95, r * 0.95, r * 0.92, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.7, r * 0.4, r * 0.4, r * 0.32);
    ctx.quadraticCurveTo(r * 0.1, r * 0.22, -r * 0.2, r * 0.32);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.4, -r * 0.92, -r * 0.05);
    ctx.fill();
    // texture strands
    ctx.strokeStyle = shade(col, 0.2); ctx.lineWidth = r * 0.03;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.2, r * 0.55); ctx.lineTo(i * r * 0.22, r * 0.85); ctx.stroke(); }
    if (b.style === 'braided') {
      for (const bx of [-r * 0.25, r * 0.3]) {
        ctx.fillStyle = col;
        for (let k = 0; k < 3; k++) blob(ctx, bx, r * (1.15 + k * 0.17), r * 0.1, r * 0.1);
        ctx.fillStyle = '#c8a040'; ctx.fillRect(bx - r * 0.1, r * 1.12, r * 0.2, r * 0.05);
      }
    }
    ctx.restore(); return;
  }
  if (b.style === 'goatee') {
    ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.84, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (b.style === 'mustache' || b.style === 'goatee') {
    const w = b.style === 'mustache' ? r * 0.36 : r * 0.24;
    ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.3);
    ctx.quadraticCurveTo(r * 0.1 + w, r * 0.22, r * 0.1 + w * 1.15, r * 0.48);
    ctx.quadraticCurveTo(r * 0.1 + w * 0.5, r * 0.36, r * 0.1, r * 0.4);
    ctx.quadraticCurveTo(r * 0.1 - w * 0.5, r * 0.36, r * 0.1 - w * 1.15, r * 0.48);
    ctx.quadraticCurveTo(r * 0.1 - w, r * 0.22, r * 0.1, r * 0.3); ctx.fill();
  }
  ctx.restore();
}

function frontHair(ctx, L, r) {
  const h = L.hair, col = h.color;
  ctx.fillStyle = col;
  switch (h.style) {
    case 'buzz': ctx.globalAlpha = 0.85; cap(ctx, r, -0.5); ctx.globalAlpha = 1; break;
    case 'short': cap(ctx, r, -0.45, 6); break;
    case 'slick': case 'sidepart': {
      cap(ctx, r, -0.5);
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.95); ctx.quadraticCurveTo(r * 0.5, -r * 1.1, r * 0.98, -r * 0.35); ctx.quadraticCurveTo(r * 0.4, -r * 0.6, -r * 0.3, -r * 0.55); ctx.fill();
      ctx.strokeStyle = shade(col, 0.35); ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.2, r * 0.7, -2.4, -1.4); ctx.stroke();
      if (h.style === 'sidepart') { ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.98); ctx.lineTo(-r * 0.3, -r * 0.6); ctx.stroke(); }
      break;
    }
    case 'spiky': {
      cap(ctx, r, -0.45);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 1.05 + (i / 6) * Math.PI * 0.95, bx = Math.cos(a) * r * 0.85, by = Math.sin(a) * r * 0.85;
        const tx = Math.cos(a - 0.12) * r * 1.38, ty = Math.sin(a - 0.12) * r * 1.38;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(bx - r * 0.3, by + r * 0.08); ctx.lineTo(tx, ty); ctx.lineTo(bx + r * 0.3, by + r * 0.08); ctx.fill();
        if (h.tips) { ctx.fillStyle = h.tips; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + (bx - tx) * 0.3 - r * 0.05, ty + (by - ty) * 0.3); ctx.lineTo(tx + (bx - tx) * 0.3 + r * 0.05, ty + (by - ty) * 0.3); ctx.fill(); }
      }
      break;
    }
    case 'mohawk': {
      ctx.globalAlpha = 0.35; cap(ctx, r, -0.5); ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        const x = -r * 0.75 + i * r * 0.32;
        ctx.beginPath(); ctx.moveTo(x - r * 0.16, -r * 0.82 + Math.abs(x) * 0.15); ctx.lineTo(x - r * 0.1, -r * 1.55 + Math.abs(x) * 0.3); ctx.lineTo(x + r * 0.18, -r * 0.85 + Math.abs(x) * 0.15); ctx.fill();
      }
      break;
    }
    case 'afro': cap(ctx, r, -0.42, 8); for (let i = 0; i < 7; i++) blob(ctx, -r * 0.8 + i * r * 0.27, -r * 0.62 - Math.sin((i / 6) * Math.PI) * r * 0.12, r * 0.2); break;
    case 'mane': cap(ctx, r, -0.4, 8); for (let i = 0; i < 6; i++) blob(ctx, -r * 0.75 + i * r * 0.3, -r * 0.6, r * 0.2); break;
    case 'long': cap(ctx, r, -0.42); ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 1.0); ctx.quadraticCurveTo(r * 0.1, -r * 0.7, -r * 0.1, -r * 0.45); ctx.stroke(); break;
    case 'ponytail': cap(ctx, r, -0.48); ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.1, r * 0.75, -2.5, -1.3); ctx.stroke(); break;
    case 'dreads': cap(ctx, r, -0.5, 10); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = r * 0.15; for (const x of [r * 0.85, r * 0.6]) { ctx.beginPath(); ctx.moveTo(x, -r * 0.4); ctx.quadraticCurveTo(x + r * 0.15, r * 0.1, x + r * 0.05, r * 0.45); ctx.stroke(); } break;
    case 'bun': cap(ctx, r, -0.5); break;
    case 'bald': {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; blob(ctx, r * 0.15, -r * 0.7, r * 0.3, r * 0.12);
      ctx.fillStyle = col; blob(ctx, -r * 0.88, -r * 0.1, r * 0.2, r * 0.28); blob(ctx, r * 0.9, -r * 0.1, r * 0.12, r * 0.24);
      break;
    }
  }
}

function accessory(ctx, L, r) {
  const a = L.accessory; if (!a || a.type === 'none') return;
  ctx.lineCap = 'round';
  switch (a.type) {
    case 'headband': case 'sweatband': {
      const th = a.type === 'headband' ? r * 0.2 : r * 0.16;
      ctx.save(); facePath(ctx, L.face, r * 1.02); ctx.clip();
      ctx.fillStyle = a.color; ctx.fillRect(-r * 1.1, -r * 0.62, r * 2.2, th);
      if (a.type === 'sweatband') { ctx.fillStyle = '#fff'; ctx.fillRect(-r * 1.1, -r * 0.62 + th * 0.4, r * 2.2, th * 0.2); }
      ctx.restore();
      break;
    }
    case 'sunglasses': {
      ctx.fillStyle = a.color || '#111';
      for (const [x, k] of [[-r * 0.2, 0.95], [r * 0.4, 0.85]]) { ctx.beginPath(); ctx.ellipse(x, -r * 0.05, r * 0.24 * k, r * 0.17 * k, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = a.color || '#111'; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(-r * 0.02, -r * 0.1); ctx.lineTo(r * 0.2, -r * 0.1); ctx.moveTo(-r * 0.42, -r * 0.1); ctx.lineTo(-r * 0.9, -r * 0.15); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; blob(ctx, -r * 0.27, -r * 0.1, r * 0.06, r * 0.035); blob(ctx, r * 0.34, -r * 0.1, r * 0.05, r * 0.03);
      break;
    }
    case 'glasses':
      ctx.strokeStyle = a.color || '#222'; ctx.lineWidth = r * 0.05;
      for (const [x, k] of [[-r * 0.2, 0.95], [r * 0.4, 0.85]]) { ctx.beginPath(); ctx.arc(x, -r * 0.06, r * 0.24 * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(r * 0.03, -r * 0.08); ctx.lineTo(r * 0.2, -r * 0.08); ctx.moveTo(-r * 0.43, -r * 0.08); ctx.lineTo(-r * 0.9, -r * 0.12); ctx.stroke();
      ctx.fillStyle = 'rgba(200,230,255,0.25)'; for (const [x, k] of [[-r * 0.2, 0.95], [r * 0.4, 0.85]]) blob(ctx, x, -r * 0.06, r * 0.22 * k);
      break;
    case 'viking': {
      // horns
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#f3e3c0'; ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.04;
        ctx.beginPath(); ctx.moveTo(s * r * 0.75, -r * 0.6); ctx.quadraticCurveTo(s * r * 1.45, -r * 0.7, s * r * 1.35, -r * 1.45);
        ctx.quadraticCurveTo(s * r * 1.15, -r * 0.95, s * r * 0.7, -r * 0.88); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, -r * 1.1, 0, -r * 0.4);
      g.addColorStop(0, '#e6ecf2'); g.addColorStop(1, a.color || '#9aa4b0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.42); ctx.bezierCurveTo(-r * 1.0, -r * 1.35, r * 1.0, -r * 1.35, r * 1.0, -r * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7d6a3a'; ctx.fillRect(-r * 1.02, -r * 0.55, r * 2.04, r * 0.16); ctx.strokeRect(-r * 1.02, -r * 0.55, r * 2.04, r * 0.16);
      ctx.fillStyle = '#d9c27a'; for (let i = -3; i <= 3; i++) blob(ctx, i * r * 0.28, -r * 0.47, r * 0.035);
      ctx.fillStyle = shade(a.color || '#9aa4b0', -0.2); ctx.fillRect(r * 0.05, -r * 0.42, r * 0.12, r * 0.42); // nose guard
      break;
    }
    case 'ninja': {
      ctx.fillStyle = a.color || '#20222b';
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.06, r * 1.04, 0, 0, Math.PI * 2);
      ctx.rect(r * 1.0, -r * 0.33, -r * 1.75, r * 0.5); // eye slit (reverse winding = hole)
      ctx.fill('evenodd');
      ctx.fillStyle = a.color2 || '#d8263a'; ctx.fillRect(-r * 1.0, -r * 0.62, r * 2.0, r * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; blob(ctx, r * 0.3, -r * 0.8, r * 0.4, r * 0.12);
      break;
    }
    case 'nemes':
      ctx.fillStyle = a.color || '#e7b928'; ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.04;
      ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.45); ctx.bezierCurveTo(-r * 1.05, -r * 1.3, r * 1.05, -r * 1.3, r * 1.05, -r * 0.45); ctx.lineTo(r * 0.9, -r * 0.45); ctx.quadraticCurveTo(0, -r * 0.62, -r * 0.9, -r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = a.color2 || '#1f4fa8'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -r * (0.62 + i * 0.13), r * (0.95 - i * 0.05), r * 0.045, 0, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = '#e7b928'; blob(ctx, r * 0.1, -r * 0.68, r * 0.08, r * 0.12); // uraeus
      break;
    case 'earring':
      ctx.strokeStyle = a.color || '#ffd23d'; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(-r * 0.86, r * 0.25, r * 0.08, 0, Math.PI * 2); ctx.stroke();
      break;
  }
}

/**
 * Draw a head centred at x,y with radius r.
 * o: { facing: 1|-1, look: {x,y} (-1..1), blink: 0..1, emotion: 'normal'|'happy'|'sad'|'effort'|'frozen', alpha }
 */
export function drawHead(ctx, ch, x, y, r, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if ((o.facing || 1) < 0) ctx.scale(-1, 1);
  const look = o.look ? { x: o.look.x * (o.facing || 1), y: o.look.y } : { x: 0.3, y: 0 };
  if (ch.img) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(ch.img, -r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = r * 0.06; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  const L = ch.look;
  const oo = { ...o, look };
  backHair(ctx, L, r);
  // ears
  ctx.fillStyle = shade(L.skin, -0.05); ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.05;
  blob(ctx, -r * 0.84, r * 0.06, r * 0.17, r * 0.22); ctx.stroke();
  // face with soft shading
  const g = ctx.createRadialGradient(r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, shade(L.skin, 0.22)); g.addColorStop(0.55, L.skin); g.addColorStop(1, shade(L.skin, -0.22));
  ctx.fillStyle = g; facePath(ctx, L.face, r); ctx.fill();
  // cheeks + freckles
  ctx.fillStyle = 'rgba(255,90,90,0.18)'; blob(ctx, -r * 0.42, r * 0.28, r * 0.17, r * 0.1); blob(ctx, r * 0.66, r * 0.28, r * 0.13, r * 0.09);
  if (L.freckles) { ctx.fillStyle = 'rgba(150,70,30,0.55)'; for (const [fx, fy] of [[-0.45, 0.12], [-0.35, 0.2], [-0.5, 0.24], [0.6, 0.14], [0.68, 0.22], [0.52, 0.22]]) blob(ctx, fx * r, fy * r, r * 0.025); }
  beard(ctx, L, r, () => facePath(ctx, L.face, r));
  eyes(ctx, L, r, oo);
  if (L.accessory.type !== 'ninja') { brows(ctx, L, r, oo); nose(ctx, L, r); mouth(ctx, L, r, oo); }
  if (L.beard.style === 'mustache' || L.beard.style === 'goatee') beard(ctx, { ...L, beard: { ...L.beard, style: L.beard.style === 'goatee' ? 'goatee' : 'mustache' } }, r, () => {});
  // cartoon outline, then hair and accessories on top of it
  ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.055; facePath(ctx, L.face, r); ctx.stroke();
  frontHair(ctx, L, r);
  accessory(ctx, L, r);
  if (o.emotion === 'frozen') { ctx.fillStyle = 'rgba(160,230,255,0.35)'; facePath(ctx, L.face, r * 1.08); ctx.fill(); }
  ctx.restore();
}
