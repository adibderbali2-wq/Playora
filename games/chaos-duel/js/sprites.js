// Sprite loading and drawing. Each animation is a horizontal strip of equal cells (see atlas.json),
// with every frame's feet aligned to the cell's anchor point.
import { CHARACTERS } from './characters.js';

const BASE = 'assets/characters/';
const cache = new Map(); // palette swaps
const sil = new WeakMap(); // source -> Map(color -> silhouette)

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + src));
    img.src = src;
  });
}

/** Loads every strip + banner. onProgress(0..1). */
export async function loadAssets(onProgress = () => {}) {
  const res = await fetch(BASE + 'atlas.json');
  if (!res.ok) throw new Error('Could not load the character atlas');
  const atlas = await res.json();
  const jobs = [];
  for (const id of Object.keys(CHARACTERS)) {
    const a = atlas[id];
    if (!a) throw new Error('Missing sprites for ' + id);
    const def = CHARACTERS[id];
    def.sheet = { fw: a.frameWidth, fh: a.frameHeight, ax: a.anchorX, ay: a.anchorY, imgs: {} };
    def.frameCounts = {};
    for (const [anim, info] of Object.entries(a.animations)) {
      def.frameCounts[anim] = info.frames;
      jobs.push(loadImage(BASE + info.file).then((img) => { def.sheet.imgs[anim] = img; }));
    }
    jobs.push(loadImage(BASE + id + '/banner.png').then((img) => { def.banner = img; }));
  }
  let done = 0;
  jobs.forEach((j) => j.then(() => onProgress(++done / jobs.length)));
  await Promise.all(jobs);
}

function canvasOf(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  return c;
}

/** Solid-colour silhouette of a strip (hit flash, afterimages). */
function silhouette(img, color) {
  let m = sil.get(img); if (!m) { m = new Map(); sil.set(img, m); }
  if (m.has(color)) return m.get(color);
  const c = canvasOf(img), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  m.set(color, c);
  return c;
}

/** Alternate costume for mirror matches (same character on both sides): swaps colour channels. */
function altPalette(img, id) {
  const key = img.src + '|alt';
  if (cache.has(key)) return cache.get(key);
  const c = canvasOf(img), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (id === 'bruno') { p[i + 1] = b; p[i + 2] = g; } // blue bear -> green bear
    else { p[i] = b; p[i + 2] = r; p[i + 1] = Math.min(255, g * 1.05); } // red rabbit -> blue rabbit
  }
  x.putImageData(d, 0, 0);
  cache.set(key, c);
  return c;
}

/**
 * Draw one frame with the feet at (x, y).
 * opts: { scale, facing, alpha, flash, tint, alt }
 */
export function drawFrame(ctx, def, anim, index, x, y, opts = {}) {
  const s = def.sheet; if (!s) return;
  let img = s.imgs[anim] || s.imgs.idle;
  if (opts.alt) img = altPalette(img, def.id);
  const scale = (opts.scale || 1) * def.scale;
  const facing = opts.facing || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  const sx = index * s.fw;
  const src = opts.tint ? silhouette(img, opts.tint) : img;
  ctx.drawImage(src, sx, 0, s.fw, s.fh, -s.ax, -s.ay, s.fw, s.fh);
  if (opts.flash) {
    ctx.globalAlpha = (opts.alpha ?? 1) * opts.flash;
    ctx.drawImage(silhouette(img, '#ffffff'), sx, 0, s.fw, s.fh, -s.ax, -s.ay, s.fw, s.fh);
  }
  ctx.restore();
}
