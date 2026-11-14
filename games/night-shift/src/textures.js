// Procedural texture + material library. Everything is generated at load time on
// canvases so the game ships no image files and every surface has grime, stains
// and wear instead of flat colours.
import * as THREE from 'three';

let seed = 1337;
export function rng() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + rng() * (b - a);
export function setSeed(s) { seed = s; }

function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Per-pixel noise pass: cheap, adds the "film" of dirt on every surface.
function speckle(ctx, w, h, amt, mono = true) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amt;
    if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    else { d[i] += n; d[i + 1] += (rng() - 0.5) * amt; d[i + 2] += (rng() - 0.5) * amt; }
  }
  ctx.putImageData(img, 0, 0);
}

function blobs(ctx, w, h, n, color, rMin, rMax, aMin, aMax) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h, r = rr(rMin, rMax);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = rr(aMin, aMax);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * rr(0.5, 1), rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drips(ctx, w, h, n, color, fromTop = true) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, len = rr(h * 0.05, h * 0.45), wd = rr(1, 5);
    const g = ctx.createLinearGradient(0, fromTop ? 0 : h, 0, fromTop ? len : h - len);
    g.addColorStop(0, `rgba(${color},${rr(0.25, 0.6)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, fromTop ? 0 : h - len, wd, len);
  }
}

function cracks(ctx, w, h, n, color = 'rgba(10,10,10,0.55)') {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    let x = rng() * w, y = rng() * h;
    ctx.lineWidth = rr(0.6, 1.8);
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 6 + rng() * 14;
    let a = rng() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      a += rr(-0.7, 0.7); x += Math.cos(a) * rr(4, 14); y += Math.sin(a) * rr(4, 14);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function bloodSplat(ctx, x, y, r, alpha = 0.85) {
  ctx.fillStyle = `rgba(${60 + rng() * 30 | 0},${4 + rng() * 6 | 0},${4 + rng() * 6 | 0},${alpha})`;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = r * rr(0.6, 2.4), rs = r * rr(0.04, 0.28);
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rs, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, d = r * rr(0.8, 1.5);
    ctx.lineWidth = r * rr(0.05, 0.18); ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke();
  }
}

function tex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Greyscale version of a colour canvas, used as bump map (cracks/grout read in 3D).
function bumpFrom(c) {
  const [b, x] = cv(c.width, c.height);
  x.filter = 'grayscale(1) contrast(1.4)';
  x.drawImage(c, 0, 0);
  return b;
}

/* ---------------------------------------------------------------- floors */
function floorTiles(base, alt, size = 512, tiles = 4, dirt = 1) {
  const [c, x] = cv(size);
  const t = size / tiles;
  for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) {
    const useAlt = (i + j) % 2 === 1;
    const col = useAlt ? alt : base;
    const v = rr(-12, 12);
    x.fillStyle = `rgb(${col[0] + v},${col[1] + v},${col[2] + v})`;
    x.fillRect(i * t, j * t, t, t);
  }
  x.strokeStyle = 'rgba(20,22,20,0.8)'; x.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, size); x.stroke();
    x.beginPath(); x.moveTo(0, i * t); x.lineTo(size, i * t); x.stroke();
  }
  blobs(x, size, size, 40 * dirt, '30,26,18', 10, 90, 0.08, 0.35);
  blobs(x, size, size, 12 * dirt, '12,10,8', 20, 70, 0.15, 0.4);
  cracks(x, size, size, 10 * dirt);
  // broken / missing tile chips (few + subtle: this texture repeats every cell)
  for (let k = 0; k < Math.round(1.2 * dirt); k++) {
    const i = (rng() * tiles) | 0, j = (rng() * tiles) | 0;
    x.fillStyle = 'rgba(60,58,52,0.45)';
    x.beginPath();
    x.moveTo(i * t + rr(0, t), j * t);
    x.lineTo(i * t + t, j * t + rr(0, t));
    x.lineTo(i * t + rr(t * 0.5, t), j * t + rr(t * 0.5, t));
    x.fill();
  }
  speckle(x, size, size, 26);
  return c;
}

function concrete(size = 512, tint = [92, 92, 90]) {
  const [c, x] = cv(size);
  x.fillStyle = `rgb(${tint})`; x.fillRect(0, 0, size, size);
  blobs(x, size, size, 90, '40,40,38', 10, 80, 0.05, 0.25);
  blobs(x, size, size, 40, '140,140,135', 10, 60, 0.04, 0.12);
  cracks(x, size, size, 16, 'rgba(20,20,20,0.6)');
  speckle(x, size, size, 40);
  return c;
}

/* ----------------------------------------------------------------- walls */
// Wall map covers one 2.5 m wide x 3 m high bay: v=0 floor, v=1 ceiling.
function paintedWall(top, bottom, size = 512, graffiti = null, blood = 0) {
  const [c, x] = cv(size);
  const band = size * 0.66; // canvas y where wainscot starts (y grows down)
  x.fillStyle = `rgb(${top})`; x.fillRect(0, 0, size, band);
  x.fillStyle = `rgb(${bottom})`; x.fillRect(0, band, size, size - band);
  // hand rail / bumper
  x.fillStyle = 'rgb(70,58,44)'; x.fillRect(0, band - 14, size, 14);
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, band - 14, size, 3);
  // skirting
  x.fillStyle = 'rgb(38,36,34)'; x.fillRect(0, size - 18, size, 18);
  blobs(x, size, size, 50, '50,44,30', 10, 80, 0.05, 0.25);
  drips(x, size, size, 30, '60,50,30', true);
  drips(x, size, size, 20, '25,22,15', false);
  // peeling paint: irregular flakes exposing the darker plaster
  for (let i = 0; i < 9; i++) {
    const px = rng() * size, py = rng() * band, r = rr(4, 22);
    x.fillStyle = `rgba(${90 + rng() * 30 | 0},${88 + rng() * 25 | 0},${74 + rng() * 20 | 0},${rr(0.25, 0.45)})`;
    x.beginPath();
    const n = 7 + (rng() * 6 | 0);
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rad = r * rr(0.4, 1.3); const qx = px + Math.cos(a) * rad, qy = py + Math.sin(a) * rad * 0.7; k ? x.lineTo(qx, qy) : x.moveTo(qx, qy); }
    x.fill();
  }
  cracks(x, size, band, 6);
  if (blood) {
    for (let i = 0; i < blood; i++) {
      // smeared hand prints and drag marks
      const hx = rr(40, size - 40), hy = rr(band * 0.4, band + 40);
      x.fillStyle = `rgba(${70 + rng() * 30 | 0},6,6,0.8)`;
      for (let f = 0; f < 4; f++) x.fillRect(hx + f * 9, hy - 22 - rng() * 6, 6, 22);
      x.beginPath(); x.ellipse(hx + 14, hy + 8, 18, 16, 0, 0, Math.PI * 2); x.fill();
      const g = x.createLinearGradient(0, hy, 0, hy + 140);
      g.addColorStop(0, 'rgba(80,6,6,0.75)'); g.addColorStop(1, 'rgba(80,6,6,0)');
      x.fillStyle = g; x.fillRect(hx, hy, 36, 140);
    }
  }
  if (graffiti) {
    x.save();
    x.translate(size * 0.5, band * 0.45); x.rotate(rr(-0.08, 0.08));
    x.font = `bold ${graffiti.size || 54}px "Trebuchet MS", sans-serif`;
    x.textAlign = 'center';
    x.fillStyle = graffiti.color || 'rgba(110,8,8,0.85)';
    const lines = graffiti.text.split('\n');
    lines.forEach((l, i) => x.fillText(l, 0, i * (graffiti.size || 54) * 1.05));
    x.restore();
    drips(x, size, band, 10, '90,6,6', true);
  }
  speckle(x, size, size, 22);
  return c;
}

function tiledWall(size = 512, color = [190, 196, 192], blood = 0) {
  const [c, x] = cv(size);
  const t = size / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const v = rr(-14, 10);
    x.fillStyle = `rgb(${color[0] + v},${color[1] + v},${color[2] + v})`;
    x.fillRect(i * t, j * t, t, t);
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i * t + 2, j * t + 2, t - 4, 4);
  }
  x.strokeStyle = 'rgba(60,64,58,0.9)'; x.lineWidth = 2.5;
  for (let i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, size); x.stroke();
    x.beginPath(); x.moveTo(0, i * t); x.lineTo(size, i * t); x.stroke();
  }
  blobs(x, size, size, 50, '60,56,30', 10, 70, 0.06, 0.3);
  drips(x, size, size, 40, '70,60,30', true);
  drips(x, size, size, 25, '30,26,20', false);
  cracks(x, size, size, 10);
  for (let i = 0; i < blood; i++) bloodSplat(x, rr(50, size - 50), rr(120, size - 80), rr(14, 30), 0.8);
  if (blood) drips(x, size, size, 16 * blood, '90,6,6', true);
  speckle(x, size, size, 22);
  return c;
}

function ceilingTiles(size = 512, dark = false) {
  const [c, x] = cv(size);
  x.fillStyle = dark ? 'rgb(60,60,58)' : 'rgb(150,148,138)'; x.fillRect(0, 0, size, size);
  const t = size / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    if (rng() < 0.12) { x.fillStyle = 'rgb(8,8,8)'; x.fillRect(i * t, j * t, t, t); continue; } // missing panel
    for (let k = 0; k < 220; k++) {
      x.fillStyle = `rgba(80,76,70,${rr(0.1, 0.4)})`;
      x.fillRect(i * t + rng() * t, j * t + rng() * t, 2, 2);
    }
  }
  blobs(x, size, size, 14, '110,84,40', 20, 100, 0.15, 0.45); // water stains
  blobs(x, size, size, 10, '40,34,20', 10, 50, 0.2, 0.5);
  x.strokeStyle = 'rgb(70,70,66)'; x.lineWidth = 8;
  for (let i = 0; i <= 2; i++) {
    x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, size); x.stroke();
    x.beginPath(); x.moveTo(0, i * t); x.lineTo(size, i * t); x.stroke();
  }
  speckle(x, size, size, 18);
  return c;
}

/* ------------------------------------------------------------ misc mats */
function metal(size = 256, base = [120, 124, 126], rust = 0.3) {
  const [c, x] = cv(size);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    x.strokeStyle = `rgba(255,255,255,${rr(0.02, 0.08)})`;
    const y = rng() * size; x.beginPath(); x.moveTo(0, y); x.lineTo(size, y + rr(-3, 3)); x.stroke();
  }
  blobs(x, size, size, 40 * rust, '110,52,20', 4, 30, 0.2, 0.6);
  blobs(x, size, size, 20, '20,20,20', 4, 30, 0.1, 0.4);
  speckle(x, size, size, 20);
  return c;
}

function wood(size = 256, base = [96, 64, 38]) {
  const [c, x] = cv(size);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${rng() < 0.5 ? '30,18,8' : '150,110,70'},${rr(0.08, 0.3)})`;
    x.lineWidth = rr(0.5, 2.5);
    const y0 = rng() * size;
    x.beginPath(); x.moveTo(0, y0);
    for (let s = 0; s <= 8; s++) x.lineTo(s * size / 8, y0 + Math.sin(s + i) * rr(1, 5));
    x.stroke();
  }
  blobs(x, size, size, 20, '20,14,8', 4, 30, 0.1, 0.4);
  speckle(x, size, size, 18);
  return c;
}

function fabric(size = 256, base = [180, 190, 196], blood = 0, stripes = false) {
  const [c, x] = cv(size);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, size, size);
  if (stripes) {
    for (let i = 0; i < size; i += 16) { x.fillStyle = 'rgba(40,60,90,0.25)'; x.fillRect(i, 0, 5, size); }
  }
  for (let i = 0; i < size; i += 2) { x.fillStyle = `rgba(0,0,0,${rr(0.02, 0.06)})`; x.fillRect(0, i, size, 1); }
  blobs(x, size, size, 30, '80,70,40', 6, 40, 0.1, 0.35);
  for (let i = 0; i < blood; i++) bloodSplat(x, rng() * size, rng() * size, rr(6, 22), 0.75);
  speckle(x, size, size, 16);
  return c;
}

function grimeDetail(size = 256) {
  // Neutral-ish detail map multiplied over vertex colours on characters.
  const [c, x] = cv(size);
  x.fillStyle = 'rgb(200,200,200)'; x.fillRect(0, 0, size, size);
  blobs(x, size, size, 80, '90,80,70', 3, 22, 0.15, 0.5);
  blobs(x, size, size, 26, '70,60,64', 3, 16, 0.15, 0.45);   // bruises / mottling
  for (let i = 0; i < 90; i++) {                              // veins / scratches
    x.strokeStyle = `rgba(${rng() < 0.6 ? '60,55,85' : '70,40,40'},${rr(0.15, 0.4)})`;
    x.lineWidth = rr(0.5, 1.5);
    let px = rng() * size, py = rng() * size; x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 6; s++) { px += rr(-10, 10); py += rr(-10, 10); x.lineTo(px, py); }
    x.stroke();
  }
  speckle(x, size, size, 30);
  return c;
}

function decalBlood(size = 256, kind = 'splat') {
  const [c, x] = cv(size);
  if (kind === 'trail') {
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${55 + rng() * 25 | 0},4,4,${rr(0.3, 0.8)})`;
      const yy = i * size / 40;
      x.beginPath(); x.ellipse(size / 2 + Math.sin(i * 0.3) * 20, yy, rr(20, 46), rr(6, 14), 0, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(60,4,4,0.5)'; x.fillRect(size / 2 + rr(-50, 50), rng() * size, rr(1, 3), rr(10, 40)); }
  } else if (kind === 'pool') {
    x.fillStyle = 'rgba(48,3,3,0.92)';
    x.beginPath();
    for (let a = 0; a <= 24; a++) {
      const ang = a / 24 * Math.PI * 2, r = size * rr(0.32, 0.46);
      const px = size / 2 + Math.cos(ang) * r, py = size / 2 + Math.sin(ang) * r;
      a ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.fill();
    x.fillStyle = 'rgba(120,20,20,0.25)';
    x.beginPath(); x.ellipse(size * 0.45, size * 0.42, size * 0.15, size * 0.08, 0.4, 0, Math.PI * 2); x.fill();
  } else {
    bloodSplat(x, size / 2, size / 2, size * 0.16, 0.9);
  }
  return c;
}

function bulletHole(size = 64) {
  const [c, x] = cv(size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.18, 'rgba(10,10,10,0.95)');
  g.addColorStop(0.35, 'rgba(40,36,30,0.6)'); g.addColorStop(1, 'rgba(40,36,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

function radial(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, x] = cv(size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

function muzzle(size = 128) {
  const [c, x] = cv(size);
  x.translate(size / 2, size / 2);
  for (let i = 0; i < 7; i++) {
    x.rotate(Math.PI * 2 / 7 + rr(-0.2, 0.2));
    const g = x.createLinearGradient(0, 0, size / 2, 0);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.4, 'rgba(255,170,60,0.8)'); g.addColorStop(1, 'rgba(255,90,10,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -6); x.lineTo(size * rr(0.32, 0.5), 0); x.lineTo(0, 6); x.fill();
  }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, size * 0.25);
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(1, 'rgba(255,160,40,0)');
  x.fillStyle = g; x.fillRect(-size / 2, -size / 2, size, size);
  return c;
}

function nightSky(w = 256, h = 256) {
  const [c, x] = cv(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05080f'); g.addColorStop(0.7, '#0e1626'); g.addColorStop(1, '#16202f');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  blobs(x, w, h * 0.6, 6, '60,70,90', 30, 90, 0.08, 0.2); // clouds
  for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(200,210,255,${rr(0.1, 0.5)})`; x.fillRect(rng() * w, rng() * h * 0.5, 1, 1); }
  // ragged tree-line silhouette
  x.fillStyle = '#020306';
  x.beginPath(); x.moveTo(0, h);
  for (let px = 0; px <= w; px += 3) x.lineTo(px, h * 0.62 - Math.abs(Math.sin(px * 0.05) * 18 + Math.sin(px * 0.21) * 8 + (rng() - 0.5) * 10) - (Math.sin(px * 0.013) + 1) * 20);
  x.lineTo(w, h); x.fill();
  // distant sodium street lamp glow
  const lg = x.createRadialGradient(w * 0.7, h * 0.7, 0, w * 0.7, h * 0.7, 40);
  lg.addColorStop(0, 'rgba(255,170,80,0.5)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = lg; x.fillRect(0, 0, w, h);
  return c;
}

export function signCanvas(text, { w = 512, h = 128, bg = '#13361f', fg = '#e8f2e8', border = true, font = 'bold 64px "Trebuchet MS", sans-serif', dirt = 1 } = {}) {
  const [c, x] = cv(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20); }
  x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = text.split('\n');
  const lh = h / (lines.length + 0.6);
  lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  blobs(x, w, h, 20 * dirt, '30,26,18', 6, 40, 0.15, 0.5);
  speckle(x, w, h, 30);
  return c;
}

export function paperCanvas(lines, w = 256, h = 340) {
  const [c, x] = cv(w, h);
  x.fillStyle = '#d8d0bb'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(40,40,60,0.85)'; x.font = '14px Georgia, serif';
  lines.forEach((l, i) => x.fillText(l, 18, 30 + i * 18));
  for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(40,40,60,0.35)'; x.fillRect(18, 120 + i * 14, rr(120, 220), 2); }
  blobs(x, w, h, 8, '120,90,40', 10, 50, 0.1, 0.3);
  if (rng() < 0.6) bloodSplat(x, rr(40, 200), rr(40, 300), rr(6, 14), 0.7);
  speckle(x, w, h, 18);
  return c;
}

/* ---------------------------------------------------------- materials */
export function buildMaterials(maxAniso = 8) {
  const T = (c, o = {}) => tex(c, { aniso: maxAniso, ...o });
  const M = {};
  const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.0, ...o });

  // Floors (world-UV, 1 repeat per 2.5 m cell)
  const fl = floorTiles([150, 152, 140], [118, 124, 116]);
  M.floorWard = std(T(fl), { bumpMap: T(bumpFrom(fl), { srgb: false }), bumpScale: 0.6, roughness: 0.55 });
  const fl2 = floorTiles([120, 122, 128], [92, 96, 104], 512, 4, 1.4);
  M.floorLobby = std(T(fl2), { bumpMap: T(bumpFrom(fl2), { srgb: false }), bumpScale: 0.6, roughness: 0.5 });
  const fl3 = floorTiles([160, 166, 166], [150, 156, 156], 512, 8, 1.6);
  M.floorClinic = std(T(fl3), { bumpMap: T(bumpFrom(fl3), { srgb: false }), bumpScale: 0.5, roughness: 0.45 });
  const cc = concrete();
  M.floorConcrete = std(T(cc), { bumpMap: T(bumpFrom(cc), { srgb: false }), bumpScale: 1.2, roughness: 0.92 });
  const lf = floorTiles([70, 74, 78], [62, 66, 70], 512, 2, 1.2);
  M.floorLab = std(T(lf), { bumpMap: T(bumpFrom(lf), { srgb: false }), bumpScale: 0.5, roughness: 0.4, metalness: 0.2 });

  // Walls
  const mk = (c, o = {}) => std(T(c), { bumpMap: T(bumpFrom(c), { srgb: false }), bumpScale: 0.8, ...o });
  M.wallWard = mk(paintedWall([150, 160, 138], [86, 110, 100]));
  M.wallWardBlood = mk(paintedWall([150, 160, 138], [86, 110, 100], 512, null, 2));
  M.wallWardMsg = mk(paintedWall([150, 160, 138], [86, 110, 100], 512, { text: "DON'T LOOK\nBEHIND YOU" }));
  M.wallLobby = mk(paintedWall([156, 146, 124], [96, 78, 62]));
  M.wallLobbyMsg = mk(paintedWall([156, 146, 124], [96, 78, 62], 512, { text: 'THEY HEAR\nYOU', size: 70 }, 1));
  M.wallOffice = mk(paintedWall([130, 134, 140], [70, 74, 86]));
  M.wallClinic = mk(tiledWall(512, [176, 190, 186]));
  M.wallClinicBlood = mk(tiledWall(512, [176, 190, 186], 3));
  M.wallStorage = mk(concrete(512, [96, 98, 92]));
  M.wallLab = mk(tiledWall(512, [120, 134, 140]), { roughness: 0.5 });
  M.wallLabMsg = mk(paintedWall([110, 120, 126], [60, 66, 72], 512, { text: 'NS-7\nKILL IT', size: 80, color: 'rgba(130,10,10,0.9)' }));

  // Ceilings
  const ce = ceilingTiles();
  M.ceiling = std(T(ce), { bumpMap: T(bumpFrom(ce), { srgb: false }), bumpScale: 0.6 });
  M.ceilingDark = std(T(ceilingTiles(512, true)), { roughness: 0.95 });

  // Props
  M.metal = std(T(metal()), { metalness: 0.6, roughness: 0.45 });
  M.metalDark = std(T(metal(256, [60, 62, 66], 0.6)), { metalness: 0.5, roughness: 0.6 });
  M.metalRust = std(T(metal(256, [100, 84, 70], 1.5)), { metalness: 0.4, roughness: 0.75 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.25 });
  M.wood = std(T(wood()));
  M.woodDoor = std(T(wood(256, [110, 80, 52])));
  M.doorPaint = std(T(paintedWall([120, 128, 120], [110, 116, 108], 256)), { roughness: 0.7 });
  M.sheet = std(T(fabric(256, [176, 184, 188], 2)), { roughness: 0.95, side: THREE.DoubleSide });
  M.sheetBloody = std(T(fabric(256, [170, 172, 170], 9)), { roughness: 0.95, side: THREE.DoubleSide });
  M.mattress = std(T(fabric(256, [120, 140, 150], 1, true)), { roughness: 0.95 });
  M.curtain = std(T(fabric(256, [96, 140, 160], 2)), { roughness: 0.95, side: THREE.DoubleSide });
  M.plasticDark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.5 });
  M.plasticLight = std(T(fabric(128, [196, 192, 180])), { roughness: 0.6 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  M.leather = std(T(fabric(128, [40, 54, 60])), { roughness: 0.7 });
  M.paper = std(T(fabric(128, [210, 204, 186])), { roughness: 1, side: THREE.DoubleSide });
  M.cardboard = std(T(wood(128, [140, 110, 70])), { roughness: 1 });
  M.screenOff = new THREE.MeshStandardMaterial({ color: 0x0a0d0c, roughness: 0.2, metalness: 0.3 });
  M.screenGreen = new THREE.MeshStandardMaterial({ color: 0x041008, emissive: 0x1aff6a, emissiveIntensity: 0.6, roughness: 0.3 });
  M.screenRed = new THREE.MeshStandardMaterial({ color: 0x100404, emissive: 0xff2020, emissiveIntensity: 0.8 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x88aabb, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
  M.liquidGreen = new THREE.MeshStandardMaterial({ color: 0x0a3018, emissive: 0x28ff70, emissiveIntensity: 0.55, transparent: true, opacity: 0.75, roughness: 0.1 });
  M.ledRed = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  M.ledGreen = new THREE.MeshBasicMaterial({ color: 0x2aff6a });
  M.tubeOn = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff2ff, emissiveIntensity: 2.2 });
  M.tubeOff = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.3 });
  M.lampWarm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc68a, emissiveIntensity: 2.0 });
  M.redLight = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 2.4 });
  M.sky = new THREE.MeshBasicMaterial({ map: T(nightSky()), fog: false });
  M.brokenGlass = new THREE.MeshStandardMaterial({ color: 0x9fc0d0, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });

  // Decals
  const decal = (c) => new THREE.MeshStandardMaterial({ map: T(c, { repeat: [1, 1] }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.3 });
  M.bloodSplat = decal(decalBlood(256, 'splat'));
  M.bloodTrail = decal(decalBlood(256, 'trail'));
  M.bloodPool = decal(decalBlood(256, 'pool'));
  M.bulletHole = decal(bulletHole());
  M.paperDecal = decal(paperCanvas(['', '']));

  // Character detail map
  M.grimeDetail = T(grimeDetail(), { repeat: [2, 2] });

  // FX
  M.muzzleTex = T(muzzle());
  M.glowTex = T(radial(128));
  M.moonPool = new THREE.MeshBasicMaterial({ map: T(radial(128, 'rgba(120,150,210,0.07)', 'rgba(120,150,210,0)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  M.lightPool = new THREE.MeshBasicMaterial({ map: T(radial(128, 'rgba(255,240,210,0.14)', 'rgba(255,240,210,0)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  return M;
}
