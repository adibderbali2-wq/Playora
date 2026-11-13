#!/usr/bin/env node
/**
 * PLAYORA static site builder
 * ---------------------------------------------------------------
 * Zero dependencies. Requires Node.js 18+.
 *
 *   npm run build      -> generates the finished website in ./dist
 *
 * Inputs:
 *   site.config.json   -> site name, URL, categories, ads/analytics switches
 *   games/games.json   -> THE GAME CATALOG (add new games here)
 *   games/<id>/        -> each game's files (index.html, thumb.svg, assets/)
 *   src/assets/        -> CSS, JS, fonts, images
 *   src/content/*.html -> About, Privacy, Terms... (plain HTML you can edit)
 *
 * Output:
 *   dist/              -> upload/deploy this folder (Cloudflare Pages does it for you)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const GAMES_DIR = path.join(ROOT, 'games');

const errors = [];
const warnings = [];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`\n✖ Could not read ${path.relative(ROOT, file)}:\n  ${e.message}\n`);
    console.error('  Tip: check for a missing comma, an extra comma, or a missing quote.\n');
    process.exit(1);
  }
};

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const write = (rel, content) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const copyDir = (from, to, filter = () => true) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (!filter(entry)) continue;
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d, filter);
    else fs.copyFileSync(s, d);
  }
};

const formatDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

/* ------------------------------------------------------------------ */
/* Load + validate data                                               */
/* ------------------------------------------------------------------ */
const site = readJSON(path.join(ROOT, 'site.config.json'));
const catalog = readJSON(path.join(GAMES_DIR, 'games.json'));
const SITE_URL = String(site.siteUrl || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(SITE_URL)) errors.push('site.config.json: "siteUrl" must start with https://');
if (!site.contactEmail) warnings.push('site.config.json: "contactEmail" is empty. The Contact page will show a notice instead of the form until you add your email.');
else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contactEmail)) errors.push('site.config.json: "contactEmail" is not a valid email address.');

const categories = site.categories;
const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

if (!Array.isArray(catalog.games)) {
  console.error('✖ games/games.json must contain a "games" list.');
  process.exit(1);
}

const seen = new Set();
const games = [];
catalog.games.forEach((g, i) => {
  const where = `games/games.json -> game #${i + 1}${g && g.id ? ` ("${g.id}")` : ''}`;
  const problems = [];
  if (!g.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id)) problems.push('"id" is required: lowercase letters, numbers and dashes only (e.g. "space-runner")');
  if (seen.has(g.id)) problems.push(`"id" "${g.id}" is used twice`);
  if (!g.title) problems.push('"title" is required');
  if (!g.description) problems.push('"description" is required');
  if (!catBySlug[g.category]) problems.push(`"category" must be one of: ${categories.map((c) => c.slug).join(', ')}`);
  if (g.status !== 'playable' && g.status !== 'coming-soon') problems.push('"status" must be "playable" or "coming-soon"');
  if (!g.added || !/^\d{4}-\d{2}-\d{2}$/.test(g.added)) problems.push('"added" must be a date like "2026-11-13"');

  const thumb = g.thumbnail || ['svg', 'webp', 'png', 'jpg', 'jpeg'].map((x) => `/games/${g.id}/thumb.${x}`).find((t) => fs.existsSync(path.join(ROOT, t))) || `/games/${g.id}/thumb.svg`;
  if (thumb.startsWith('/') && !fs.existsSync(path.join(ROOT, thumb))) problems.push(`thumbnail not found: ${thumb}`);

  let url = g.url || `/games/${g.id}/index.html`;
  const external = /^https:\/\//.test(url);
  if (!external && !url.startsWith('/')) problems.push('"url" must start with "/" (a game inside this site) or "https://" (an external embed)');
  if (g.status === 'playable' && !external && !fs.existsSync(path.join(ROOT, url.split('?')[0]))) {
    problems.push(`status is "playable" but the game file is missing: ${url}`);
  }

  if (problems.length) {
    problems.forEach((p) => errors.push(`${where}: ${p}`));
    return;
  }
  seen.add(g.id);
  games.push({
    tags: [],
    featured: false,
    popular: false,
    controls: '',
    aspectRatio: '16:9',
    developer: site.name,
    ...g,
    thumbnail: thumb,
    url,
    external,
    pageUrl: `/play/${g.id}/`,
    playable: g.status === 'playable',
  });
});

if (errors.length) {
  console.error('\n✖ Build stopped. Please fix the following:\n');
  errors.forEach((e) => console.error('  • ' + e));
  console.error('');
  process.exit(1);
}

/* Ordering helpers */
const byNewest = (a, b) => b.added.localeCompare(a.added) || a.title.localeCompare(b.title);
const playableFirst = (a, b) => Number(b.playable) - Number(a.playable);
const playable = games.filter((g) => g.playable);
const comingSoon = games.filter((g) => !g.playable).sort(byNewest);
const featuredGames = games.filter((g) => g.featured).sort(playableFirst);
const popularGames = games.filter((g) => g.popular).sort(playableFirst);
const recentGames = [...playable].sort(byNewest).slice(0, 8);
const newestIds = new Set([...playable].sort(byNewest).slice(0, 3).map((g) => g.id));

/* ------------------------------------------------------------------ */
/* Icons (hand-drawn, inline SVG)                                     */
/* ------------------------------------------------------------------ */
const ICONS = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  puzzle: '<path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4V4Z"/>',
  joystick: '<rect x="4" y="15" width="16" height="6" rx="2"/><path d="M12 15V9"/><circle cx="12" cy="6" r="3"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M3.5 9h17M3.5 15h17"/>',
  castle: '<path d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12Z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  fire: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
};
const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

/* ------------------------------------------------------------------ */
/* Ads + analytics (OFF until you switch them on in site.config.json) */
/* ------------------------------------------------------------------ */
const adsOn = Boolean(site.ads?.enabled && /^ca-pub-\d{10,20}$/.test(site.ads?.adsenseClientId || ''));
if (site.ads?.enabled && !adsOn) warnings.push('Ads are enabled but "adsenseClientId" is missing or invalid (expected ca-pub-XXXXXXXXXXXXXXXX). Ads stay off.');
/**
 * Reserved advertising position. Renders NOTHING while ads are off,
 * so visitors never see empty boxes or fake ads.
 */
const adSlot = (name, variant = 'banner') => {
  if (!adsOn) return `<!-- ad slot "${name}" (reserved, ads disabled) -->`;
  const slotId = site.ads.slots?.[name];
  if (!slotId) return `<!-- ad slot "${name}" has no slot id -->`;
  return `<aside class="ad-slot ad-slot--${variant}" aria-label="Advertisement">
  <span class="ad-slot__label">Advertisement</span>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(site.ads.adsenseClientId)}" data-ad-slot="${esc(slotId)}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</aside>`;
};
const gaOn = Boolean(site.analytics?.enabled && /^G-[A-Z0-9]{4,20}$/.test(site.analytics?.googleAnalyticsId || ''));
if (site.analytics?.enabled && !gaOn) warnings.push('Analytics is enabled but "googleAnalyticsId" is missing or invalid (expected G-XXXXXXX). Analytics stays off.');

const headExtras = () => {
  let out = '';
  if (gaOn) {
    const id = esc(site.analytics.googleAnalyticsId);
    out += `\n<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`;
  }
  if (adsOn) {
    out += `\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(site.ads.adsenseClientId)}" crossorigin="anonymous"></script>`;
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Layout                                                             */
/* ------------------------------------------------------------------ */
const ASSET_V = Date.now().toString(36); // cache-busting for CSS/JS

const logoMark = `<svg class="logo__mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <defs><linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C8FF4D"/><stop offset="1" stop-color="#3DDCFF"/></linearGradient></defs>
  <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#lg-mark)"/>
  <path d="M19 14.5v19l15-9.5-15-9.5Z" fill="#0E0C1D"/>
  <circle cx="36.5" cy="11.5" r="3.5" fill="#FF5C8A" stroke="#0E0C1D" stroke-width="2"/>
</svg>`;
const logo = (tag = 'a') =>
  `<${tag}${tag === 'a' ? ' href="/"' : ''} class="logo" aria-label="${esc(site.name)} home">${logoMark}<span class="logo__word">PLAY<span>ORA</span></span></${tag}>`;

const navItems = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/games/', label: 'All games', key: 'games' },
  { href: '/categories/', label: 'Categories', key: 'categories' },
  { href: '/about/', label: 'About', key: 'about' },
];

function layout({ title, description, canonical, body, active = '', ogImage, ogType = 'website', scripts = [], jsonLd, noindex = false, bodyClass = '' }) {
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name} - ${site.tagline} Free Online Games`;
  const desc = description || site.description;
  const canon = SITE_URL + (canonical || '/');
  const image = SITE_URL + (ogImage || '/assets/img/og-image.jpg');
  const nav = navItems
    .map((n) => `<li><a href="${n.href}"${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a></li>`)
    .join('');
  const catLinks = categories
    .map((c) => `<li><a href="/category/${c.slug}/" style="--cat:${c.color}">${icon(c.icon)}<span>${c.name}</span></a></li>`)
    .join('');

  return `<!doctype html>
<html lang="${esc(site.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canon)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="${esc(site.themeColor)}">
<meta name="color-scheme" content="dark">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/unbounded-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/main.css?v=${ASSET_V}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}${headExtras()}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header" data-header>
  <div class="container site-header__inner">
    ${logo()}
    <nav class="main-nav" aria-label="Main">
      <ul>${nav}</ul>
    </nav>
    <form class="header-search" action="/search/" method="get" role="search" data-search-form>
      <label class="visually-hidden" for="header-q">Search games</label>
      ${icon('search')}
      <input id="header-q" name="q" type="search" placeholder="Search games" autocomplete="off" maxlength="60" data-search-input aria-controls="search-suggest" aria-autocomplete="list" aria-expanded="false">
      <div class="search-suggest" id="search-suggest" role="listbox" hidden data-search-suggest></div>
    </form>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-nav-toggle>
      <span class="visually-hidden">Open menu</span>${icon('menu', 'icon icon--open')}${icon('close', 'icon icon--close')}
    </button>
  </div>
  <div class="mobile-menu" id="mobile-menu" hidden data-mobile-menu>
    <div class="container">
      <form class="mobile-search" action="/search/" method="get" role="search">
        <label class="visually-hidden" for="mobile-q">Search games</label>
        ${icon('search')}
        <input id="mobile-q" name="q" type="search" placeholder="Search games" autocomplete="off" maxlength="60">
        <button type="submit" class="btn btn--primary btn--sm">Search</button>
      </form>
      <ul class="mobile-menu__nav">${nav}</ul>
      <p class="mobile-menu__label">Categories</p>
      <ul class="mobile-menu__cats">${catLinks}</ul>
    </div>
  </div>
</header>

<main id="main" tabindex="-1">
${body}
</main>

<footer class="site-footer">
  <div class="container site-footer__grid">
    <div class="site-footer__brand">
      ${logo()}
      <p>${esc(site.tagline)} Free browser games for every screen. No downloads, no sign-up, just play.</p>
    </div>
    <nav aria-label="Categories">
      <h2 class="site-footer__title">Categories</h2>
      <ul>${categories.map((c) => `<li><a href="/category/${c.slug}/">${c.name}</a></li>`).join('')}</ul>
    </nav>
    <nav aria-label="Explore">
      <h2 class="site-footer__title">Explore</h2>
      <ul>
        <li><a href="/games/">All games</a></li>
        <li><a href="/games/?sort=newest">New games</a></li>
        <li><a href="/categories/">Categories</a></li>
        <li><a href="/search/">Search</a></li>
      </ul>
    </nav>
    <nav aria-label="Company">
      <h2 class="site-footer__title">${esc(site.name)}</h2>
      <ul>
        <li><a href="/about/">About us</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/privacy/">Privacy policy</a></li>
        <li><a href="/terms/">Terms of use</a></li>
      </ul>
    </nav>
  </div>
  <div class="container site-footer__bottom">
    <p>© ${site.launchYear}${new Date().getFullYear() > site.launchYear ? '–' + new Date().getFullYear() : ''} ${esc(site.name)}. All rights reserved.</p>
    <p>Made for players, on every screen.</p>
  </div>
</footer>
<script src="/assets/js/main.js?v=${ASSET_V}" defer></script>
${scripts.map((s) => `<script src="${s}?v=${ASSET_V}" defer></script>`).join('\n')}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Components                                                         */
/* ------------------------------------------------------------------ */
const card = (g, { size = '', eager = false } = {}) => {
  const c = catBySlug[g.category];
  let badge = '';
  if (!g.playable) badge = `<span class="badge badge--soon">${icon('hourglass')}Coming soon</span>`;
  else if (newestIds.has(g.id)) badge = `<span class="badge badge--new">New</span>`;
  else if (g.popular) badge = `<span class="badge badge--hot">${icon('fire')}Hot</span>`;
  return `<article class="card${size ? ' card--' + size : ''}${g.playable ? '' : ' card--soon'}" style="--cat:${c.color}" data-game-card data-category="${g.category}" data-title="${esc(g.title.toLowerCase())}" data-added="${g.added}" data-popular="${g.popular ? 1 : 0}" data-playable="${g.playable ? 1 : 0}">
  <a class="card__link" href="${g.pageUrl}">
    <div class="card__media">
      <img src="${esc(g.thumbnail)}" alt="" width="640" height="360" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      ${badge}
      ${g.playable ? `<span class="card__play" aria-hidden="true">${icon('play')}</span>` : ''}
    </div>
    <div class="card__body">
      <h3 class="card__title">${esc(g.title)}</h3>
      <span class="chip" >${icon(c.icon)}${c.name}</span>
    </div>
    <span class="visually-hidden">${g.playable ? 'Play now' : 'Coming soon'}</span>
  </a>
</article>`;
};

const grid = (list, opts) => `<div class="game-grid">${list.map((g) => card(g, opts)).join('')}</div>`;

const sectionHead = (title, iconName, link, sub = '') => `<div class="section-head">
  <div>
    <h2 class="section-title">${iconName ? `<span class="section-title__icon">${icon(iconName)}</span>` : ''}${title}</h2>
    ${sub ? `<p class="section-sub">${sub}</p>` : ''}
  </div>
  ${link ? `<a class="link-arrow" href="${link.href}">${link.label}${icon('arrow')}</a>` : ''}
</div>`;

const categoryTiles = (counts) => `<div class="cat-grid">${categories
  .map((c) => {
    const n = counts[c.slug] || { playable: 0, soon: 0 };
    const label = n.playable ? `${n.playable} game${n.playable > 1 ? 's' : ''}` : n.soon ? 'Coming soon' : 'Coming soon';
    return `<a class="cat-tile" href="/category/${c.slug}/" style="--cat:${c.color}">
    <span class="cat-tile__icon">${icon(c.icon)}</span>
    <span class="cat-tile__name">${c.name}</span>
    <span class="cat-tile__count">${label}</span>
  </a>`;
  })
  .join('')}</div>`;

const counts = {};
for (const g of games) {
  counts[g.category] ??= { playable: 0, soon: 0 };
  counts[g.category][g.playable ? 'playable' : 'soon']++;
}

const categoryPills = (activeSlug = '') => `<nav class="cat-pills" aria-label="Game categories"><ul>
  <li><a href="/games/" ${activeSlug === 'all' ? 'aria-current="page"' : ''} style="--cat:#F4F2FF">${icon('grid')}All</a></li>
  ${categories.map((c) => `<li><a href="/category/${c.slug}/" style="--cat:${c.color}"${activeSlug === c.slug ? ' aria-current="page"' : ''}>${icon(c.icon)}${c.name}</a></li>`).join('')}
</ul></nav>`;

const emptyState = (title, text, cta) => `<div class="empty-state">
  <div class="empty-state__art" aria-hidden="true">${logoMark}</div>
  <h3>${title}</h3>
  <p>${text}</p>
  ${cta ? `<a class="btn btn--primary" href="${cta.href}">${cta.label}</a>` : ''}
</div>`;

/* ------------------------------------------------------------------ */
/* Pages                                                              */
/* ------------------------------------------------------------------ */
function buildHome() {
  const spotlight = featuredGames.find((g) => g.playable) || playable[0];
  const heroCards = (featuredGames.length ? featuredGames : games).filter((g) => g.id !== spotlight?.id).slice(0, 2);

  const hero = `<section class="hero">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="eyebrow">${icon('spark')} Free browser games</p>
      <h1 class="hero__title">Play more.<br><span class="hero__accent">Have fun.</span></h1>
      <p class="hero__lead">${esc(site.name)} brings you hand-picked games that run right in your browser. No downloads, no sign-up. Just pick a game and play on your computer, tablet or phone.</p>
      <div class="hero__actions">
        ${spotlight ? `<a class="btn btn--primary btn--lg" href="${spotlight.pageUrl}">${icon('play')}Play ${esc(spotlight.title)}</a>` : ''}
        <a class="btn btn--ghost btn--lg" href="/categories/">Browse categories</a>
      </div>
      <dl class="hero__stats">
        <div><dt>Games to play</dt><dd>${playable.length}</dd></div>
        <div><dt>Categories</dt><dd>${categories.length}</dd></div>
        <div><dt>Downloads needed</dt><dd>0</dd></div>
      </dl>
    </div>
    ${spotlight ? `<div class="hero__showcase" aria-label="Featured games">
      <a class="showcase-main" href="${spotlight.pageUrl}" style="--cat:${catBySlug[spotlight.category].color}">
        <img src="${esc(spotlight.thumbnail)}" alt="" width="640" height="360" fetchpriority="high">
        <span class="showcase-main__meta"><span class="chip">${icon(catBySlug[spotlight.category].icon)}${catBySlug[spotlight.category].name}</span><strong>${esc(spotlight.title)}</strong></span>
        <span class="showcase-main__play" aria-hidden="true">${icon('play')}</span>
      </a>
      ${heroCards
        .map(
          (g, i) => `<a class="showcase-mini showcase-mini--${i + 1}" href="${g.pageUrl}" style="--cat:${catBySlug[g.category].color}">
        <img src="${esc(g.thumbnail)}" alt="" width="640" height="360" loading="lazy">
        <span>${esc(g.title)}${g.playable ? '' : ' · soon'}</span>
      </a>`
        )
        .join('')}
    </div>` : ''}
  </div>
</section>`;

  const body = `${hero}
<div class="container home-sections">
  ${categoryPills()}
  ${adSlot('home-top')}
  <section class="section" aria-labelledby="featured-h">
    ${sectionHead('<span id="featured-h">Featured games</span>', 'spark', { href: '/games/', label: 'All games' }, 'Our picks to start with.')}
    ${featuredGames.length ? grid(featuredGames.slice(0, 4), { size: 'lg' }) : emptyState('Featured games are on the way', 'Check back soon for our first hand-picked games.')}
  </section>

  <section class="section" aria-labelledby="popular-h">
    ${sectionHead('<span id="popular-h">Popular right now</span>', 'fire', { href: '/games/?sort=popular', label: 'See more' })}
    ${popularGames.length ? grid(popularGames.slice(0, 8)) : emptyState('No popular games yet', 'Popular games will show up here.')}
  </section>

  ${adSlot('home-middle')}

  <section class="section" aria-labelledby="recent-h">
    ${sectionHead('<span id="recent-h">Recently added</span>', 'clock', { href: '/games/?sort=newest', label: 'Newest first' })}
    ${recentGames.length ? grid(recentGames) : emptyState('New games are coming', 'The first games are being added right now.')}
  </section>

  <section class="section" aria-labelledby="cats-h">
    ${sectionHead('<span id="cats-h">Explore categories</span>', 'grid', { href: '/categories/', label: 'All categories' })}
    ${categoryTiles(counts)}
  </section>

  ${comingSoon.length ? `<section class="section" aria-labelledby="soon-h">
    ${sectionHead('<span id="soon-h">Coming soon</span>', 'hourglass', null, 'In development. These games are not playable yet.')}
    ${grid(comingSoon.slice(0, 8))}
  </section>` : ''}

  <section class="cta-band">
    <div>
      <h2>Make games? Let's talk.</h2>
      <p>We're always looking for great HTML5 games to bring to ${esc(site.name)} players.</p>
    </div>
    <a class="btn btn--primary" href="/contact/">${icon('mail')}Get in touch</a>
  </section>
</div>`;

  write(
    'index.html',
    layout({
      body,
      active: 'home',
      canonical: '/',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: SITE_URL + '/',
        potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/search/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
      },
    })
  );
}

function buildAllGames() {
  const sorted = [...games].sort((a, b) => playableFirst(a, b) || Number(b.popular) - Number(a.popular) || byNewest(a, b));
  const body = `<div class="page-hero page-hero--compact">
  <div class="container">
    <p class="eyebrow">${icon('grid')} Library</p>
    <h1>All games</h1>
    <p class="page-hero__lead">${playable.length} game${playable.length === 1 ? '' : 's'} ready to play${comingSoon.length ? `, ${comingSoon.length} coming soon` : ''}. Filter by category or sort to find your next favourite.</p>
  </div>
</div>
<div class="container">
  <div class="filters" data-filters>
    <div class="filter-chips" role="group" aria-label="Filter by category">
      <button type="button" class="filter-chip" aria-pressed="true" data-filter="all">All</button>
      ${categories.map((c) => `<button type="button" class="filter-chip" aria-pressed="false" data-filter="${c.slug}" style="--cat:${c.color}">${icon(c.icon)}${c.name}</button>`).join('')}
    </div>
    <div class="filter-row">
      <label class="toggle"><input type="checkbox" data-filter-playable> <span>Playable only</span></label>
      <label class="select">
        <span>Sort</span>
        <select data-sort>
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="az">A to Z</option>
        </select>
      </label>
    </div>
  </div>
  <p class="results-count" aria-live="polite" data-results-count></p>
  <div class="game-grid" data-filter-grid>${sorted.map((g) => card(g)).join('')}</div>
  <div data-filter-empty hidden>${emptyState('No games match these filters', 'Try another category or turn off “Playable only”.')}</div>
  ${adSlot('category-top')}
</div>`;
  write('games/index.html', layout({ title: 'All games', description: `Browse every free browser game on ${site.name}. Filter by category, sort by newest or most popular, and play instantly.`, canonical: '/games/', body, active: 'games', scripts: ['/assets/js/filters.js'] }));
}

function buildCategories() {
  const body = `<div class="page-hero page-hero--compact">
  <div class="container">
    <p class="eyebrow">${icon('grid')} Categories</p>
    <h1>Game categories</h1>
    <p class="page-hero__lead">Pick a mood. Every category is packed with games that play right in your browser.</p>
  </div>
</div>
<div class="container section">${categoryTiles(counts)}</div>`;
  write('categories/index.html', layout({ title: 'Game categories', description: `Explore ${site.name} game categories: ${categories.map((c) => c.name).join(', ')}.`, canonical: '/categories/', body, active: 'categories' }));

  for (const c of categories) {
    const list = games.filter((g) => g.category === c.slug).sort((a, b) => playableFirst(a, b) || Number(b.popular) - Number(a.popular) || byNewest(a, b));
    const nPlay = list.filter((g) => g.playable).length;
    const others = categories.filter((o) => o.slug !== c.slug);
    const body = `<div class="page-hero page-hero--cat" style="--cat:${c.color}">
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/categories/">Categories</a></li><li aria-current="page">${c.name}</li></ol></nav>
    <div class="page-hero__row">
      <span class="page-hero__icon">${icon(c.icon)}</span>
      <div>
        <h1>${c.name} games</h1>
        <p class="page-hero__lead">${esc(c.blurb)}</p>
      </div>
    </div>
  </div>
</div>
<div class="container">
  ${categoryPills(c.slug)}
  ${adSlot('category-top')}
  <section class="section" aria-label="${c.name} games">
    ${list.length
      ? `<p class="results-count">${nPlay ? `${nPlay} game${nPlay > 1 ? 's' : ''} to play` : 'No playable games yet'}${list.length - nPlay ? ` · ${list.length - nPlay} coming soon` : ''}</p>${grid(list)}`
      : emptyState(`${c.name} games are coming soon`, `We're preparing the first ${c.name.toLowerCase()} games. In the meantime, try something from another category.`, { href: '/games/', label: 'Browse all games' })}
  </section>
  <section class="section">
    ${sectionHead('More categories', 'grid')}
    <div class="cat-grid cat-grid--small">${others.map((o) => `<a class="cat-tile" href="/category/${o.slug}/" style="--cat:${o.color}"><span class="cat-tile__icon">${icon(o.icon)}</span><span class="cat-tile__name">${o.name}</span></a>`).join('')}</div>
  </section>
</div>`;
    write(`category/${c.slug}/index.html`, layout({ title: `${c.name} games - play free online`, description: `Play free ${c.name.toLowerCase()} games online on ${site.name}. ${c.blurb}`, canonical: `/category/${c.slug}/`, body, active: 'categories' }));
  }
}

function buildGamePages() {
  for (const g of games) {
    const c = catBySlug[g.category];
    const [rw, rh] = (g.aspectRatio || '16:9').split(':').map(Number);
    const related = [
      ...games.filter((o) => o.id !== g.id && o.category === g.category).sort(playableFirst),
      ...games.filter((o) => o.id !== g.id && o.category !== g.category).sort((a, b) => playableFirst(a, b) || Number(b.popular) - Number(a.popular)),
    ].slice(0, 6);

    const player = g.playable
      ? `<div class="player" data-player data-src="${esc(g.url)}" data-external="${g.external ? 1 : 0}" style="--ratio:${rw}/${rh}">
  <div class="player__stage" data-player-stage>
    <div class="player__poster" data-player-poster>
      <img class="player__bg" src="${esc(g.thumbnail)}" alt="" width="640" height="360">
      <div class="player__poster-inner">
        <img class="player__thumb" src="${esc(g.thumbnail)}" alt="${esc(g.title)} thumbnail" width="320" height="180">
        <button type="button" class="btn btn--primary btn--xl" data-player-start>${icon('play')}Play now</button>
        <p class="player__hint">${g.mobileFriendly === false ? 'Best played on a computer with a keyboard.' : 'Works on computer, tablet and phone.'}</p>
      </div>
    </div>
    <div class="player__state" data-player-loading hidden>
      <div class="spinner" aria-hidden="true"></div>
      <p role="status">Loading ${esc(g.title)}…</p>
    </div>
    <div class="player__state player__state--error" data-player-error hidden>
      ${icon('alert', 'icon icon--xl')}
      <h2>Oops, this game couldn't load</h2>
      <p data-player-error-text>Check your internet connection and try again. If it keeps happening, the game might be under maintenance.</p>
      <div class="player__state-actions">
        <button type="button" class="btn btn--primary" data-player-retry>${icon('refresh')}Try again</button>
        <a class="btn btn--ghost" href="/category/${c.slug}/">More ${c.name.toLowerCase()} games</a>
      </div>
    </div>
    ${rw > rh ? `<p class="player__rotate" aria-hidden="true">${icon('refresh')}Turn your phone sideways for a bigger view</p>` : ''}
    <button type="button" class="player__exit" data-player-exit hidden>${icon('shrink')}<span>Exit fullscreen</span></button>
  </div>
  <div class="player__bar">
    <div class="player__bar-title"><strong>${esc(g.title)}</strong><span class="chip" style="--cat:${c.color}">${icon(c.icon)}${c.name}</span></div>
    <div class="player__bar-actions">
      <button type="button" class="icon-btn" data-player-restart disabled aria-label="Restart game" title="Restart game">${icon('refresh')}</button>
      <button type="button" class="icon-btn" data-player-fullscreen aria-label="Fullscreen" title="Fullscreen">${icon('expand')}</button>
    </div>
  </div>
</div>`
      : `<div class="player player--soon" style="--ratio:${rw}/${rh}">
  <div class="player__stage">
    <div class="player__poster">
      <img class="player__bg" src="${esc(g.thumbnail)}" alt="" width="640" height="360">
      <div class="player__poster-inner">
        <img class="player__thumb" src="${esc(g.thumbnail)}" alt="${esc(g.title)} thumbnail" width="320" height="180">
        <span class="badge badge--soon badge--lg">${icon('hourglass')}Coming soon</span>
        <p class="player__hint">${esc(g.title)} is still in development and can't be played yet.</p>
        <a class="btn btn--primary" href="/games/?playable=1">Play available games</a>
      </div>
    </div>
  </div>
</div>`;

    const body = `<div class="container game-page" style="--cat:${c.color}">
  <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/category/${c.slug}/">${c.name}</a></li><li aria-current="page">${esc(g.title)}</li></ol></nav>
  <div class="game-layout">
    <div class="game-main">
      ${player}
      <section class="game-info">
        <h1>${esc(g.title)}${g.playable ? '' : ' <span class="badge badge--soon">Coming soon</span>'}</h1>
        <p class="game-info__desc">${esc(g.description)}</p>
        ${g.controls ? `<h2 class="game-info__h">${icon('keyboard')}How to play</h2><p>${esc(g.controls)}</p>` : ''}
      </section>
      ${adSlot('game-below')}
    </div>
    <aside class="game-side" aria-label="Game details">
      <dl class="facts">
        <div><dt>Category</dt><dd><a href="/category/${c.slug}/" class="chip" style="--cat:${c.color}">${icon(c.icon)}${c.name}</a></dd></div>
        <div><dt>Status</dt><dd>${g.playable ? 'Playable now' : 'In development'}</dd></div>
        <div><dt>Added</dt><dd><time datetime="${g.added}">${formatDate(g.added)}</time></dd></div>
        <div><dt>Devices</dt><dd>${g.mobileFriendly === false ? 'Computer' : 'Computer, tablet, phone'}</dd></div>
        <div><dt>Developer</dt><dd>${esc(g.developer)}</dd></div>
      </dl>
      ${g.tags.length ? `<ul class="tags" aria-label="Tags">${g.tags.map((t) => `<li><a href="/search/?q=${encodeURIComponent(t)}">#${esc(t)}</a></li>`).join('')}</ul>` : ''}
      ${adSlot('game-sidebar', 'box')}
    </aside>
  </div>
  <section class="section" aria-labelledby="related-h">
    ${sectionHead('<span id="related-h">You might also like</span>', 'spark', { href: `/category/${c.slug}/`, label: `More ${c.name}` })}
    ${grid(related)}
  </section>
</div>`;

    write(
      `play/${g.id}/index.html`,
      layout({
        title: g.playable ? `${g.title} - Play free online` : `${g.title} (coming soon)`,
        description: g.description.slice(0, 155),
        canonical: g.pageUrl,
        ogImage: fs.existsSync(path.join(ROOT, `games/${g.id}/og.png`)) ? `/games/${g.id}/og.png` : undefined,
        body,
        active: 'games',
        scripts: g.playable ? ['/assets/js/player.js'] : [],
        bodyClass: 'is-game-page',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'VideoGame',
          name: g.title,
          description: g.description,
          url: SITE_URL + g.pageUrl,
          image: SITE_URL + g.thumbnail,
          genre: c.name,
          gamePlatform: 'Web browser',
          applicationCategory: 'Game',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
          publisher: { '@type': 'Organization', name: site.name },
        },
      })
    );
  }
}

function buildSearch() {
  const body = `<div class="page-hero page-hero--compact">
  <div class="container">
    <p class="eyebrow">${icon('search')} Search</p>
    <h1 data-search-heading>Find a game</h1>
    <form class="big-search" action="/search/" method="get" role="search" data-big-search>
      <label class="visually-hidden" for="search-page-q">Search games</label>
      ${icon('search')}
      <input id="search-page-q" name="q" type="search" placeholder="Try “puzzle” or “space”" maxlength="60" autocomplete="off" data-big-search-input>
      <button type="submit" class="btn btn--primary">Search</button>
    </form>
  </div>
</div>
<div class="container section">
  <p class="results-count" aria-live="polite" data-search-count></p>
  <div class="game-grid" data-search-results></div>
  <div data-search-empty hidden>${emptyState('No games found', 'Check the spelling or try a broader word like “arcade”, “puzzle” or “action”.', { href: '/games/', label: 'Browse all games' })}</div>
  <noscript><p class="notice">Search needs JavaScript. You can still <a href="/games/">browse all games</a> or <a href="/categories/">pick a category</a>.</p></noscript>
</div>`;
  write('search/index.html', layout({ title: 'Search games', description: `Search all games on ${site.name}.`, canonical: '/search/', body, scripts: ['/assets/js/search.js'] }));
}

function buildContentPages() {
  const dir = path.join(SRC, 'content');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
    if (!m) { errors.push(`src/content/${file}: missing the {"title": ..., "description": ...} comment on the first line`); continue; }
    const meta = JSON.parse(m[1]);
    const slug = file.replace(/\.html$/, '');
    let html = raw.slice(m[0].length)
      .replaceAll('{{SITE_NAME}}', esc(site.name))
      .replaceAll('{{SITE_URL}}', esc(SITE_URL))
      .replaceAll('{{UPDATED}}', formatDate(meta.updated || new Date().toISOString().slice(0, 10)))
      .replaceAll('{{CONTACT_EMAIL}}', site.contactEmail ? `<a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>` : 'the form on our <a href="/contact/">Contact page</a>');

    if (slug === 'contact') {
      html = html.replace('{{CONTACT_FORM}}', site.contactEmail
        ? `<form class="contact-form" data-contact-form data-email="${esc(site.contactEmail)}" novalidate>
  <div class="field"><label for="cf-name">Your name</label><input id="cf-name" name="name" type="text" maxlength="80" autocomplete="name" required><p class="field__error" id="cf-name-err" hidden></p></div>
  <div class="field"><label for="cf-email">Your email</label><input id="cf-email" name="email" type="email" maxlength="120" autocomplete="email" required><p class="field__error" id="cf-email-err" hidden></p></div>
  <div class="field"><label for="cf-topic">Topic</label>
    <select id="cf-topic" name="topic">
      <option>General question</option><option>Report a broken game</option><option>Submit a game</option><option>Business and partnerships</option><option>Privacy request</option>
    </select></div>
  <div class="field"><label for="cf-msg">Message</label><textarea id="cf-msg" name="message" rows="6" maxlength="2000" required></textarea><p class="field__hint"><span data-count>0</span>/2000</p><p class="field__error" id="cf-msg-err" hidden></p></div>
  <button type="submit" class="btn btn--primary">${icon('mail')}Write the email</button>
  <p class="field__hint">This opens your email app with your message ready to send to <strong>${esc(site.contactEmail)}</strong>. Nothing is sent until you press send there.</p>
  <p class="form-status" role="status" data-form-status></p>
</form>`
        : `<div class="notice">${icon('mail')}<p>Our contact inbox is being set up. Please check back very soon.</p></div>`);
    }

    const body = `<div class="page-hero page-hero--compact">
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">${esc(meta.heading || meta.title)}</li></ol></nav>
    <h1>${esc(meta.heading || meta.title)}</h1>
    ${meta.lead ? `<p class="page-hero__lead">${esc(meta.lead)}</p>` : ''}
  </div>
</div>
<div class="container"><div class="prose">${html}</div></div>`;
    write(`${slug}/index.html`, layout({
      title: meta.title, description: meta.description, canonical: `/${slug}/`, body,
      active: slug === 'about' ? 'about' : '',
      scripts: slug === 'contact' && site.contactEmail ? ['/assets/js/contact.js'] : [],
    }));
  }
}

function build404() {
  const picks = playable.slice(0, 4);
  const body = `<div class="container not-found">
  <div class="not-found__code" aria-hidden="true">4<span>${logoMark}</span>4</div>
  <h1>Game over… this page doesn't exist</h1>
  <p>The link may be broken, or the page may have moved. Let's get you back in the game.</p>
  <div class="hero__actions">
    <a class="btn btn--primary" href="/">${icon('back')}Back to home</a>
    <a class="btn btn--ghost" href="/games/">Browse all games</a>
  </div>
  ${picks.length ? `<section class="section"><h2 class="section-title">Try one of these</h2>${grid(picks)}</section>` : ''}
</div>`;
  write('404.html', layout({ title: 'Page not found', description: 'This page does not exist.', canonical: '/404.html', body, noindex: true }));
}

function buildMeta() {
  // Catalog for search + suggestions (only public fields)
  write('data/catalog.json', JSON.stringify({
    categories: categories.map(({ slug, name, color }) => ({ slug, name, color })),
    games: games.map((g) => ({
      id: g.id, title: g.title, description: g.description, category: g.category, tags: g.tags,
      thumbnail: g.thumbnail, pageUrl: g.pageUrl, playable: g.playable, popular: g.popular, featured: g.featured, added: g.added,
    })),
  }));

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ['/', today, '1.0'], ['/games/', today, '0.9'], ['/categories/', today, '0.8'],
    ...categories.map((c) => [`/category/${c.slug}/`, today, '0.8']),
    ...games.map((g) => [g.pageUrl, g.added, g.playable ? '0.9' : '0.4']),
    ['/about/', today, '0.4'], ['/contact/', today, '0.3'], ['/privacy/', today, '0.2'], ['/terms/', today, '0.2'],
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d, p]) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${d}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *
Allow: /
Disallow: /search/

Sitemap: ${SITE_URL}/sitemap.xml
`);
  write('site.webmanifest', JSON.stringify({
    name: site.name, short_name: site.name, description: site.description, start_url: '/', display: 'standalone',
    background_color: site.themeColor, theme_color: site.themeColor,
    icons: [
      { src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2));

  // Cloudflare Pages headers: security + caching
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${gaOn ? ' https://www.googletagmanager.com' : ''}${adsOn ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://fundingchoicesmessages.google.com https://*.adtrafficquality.google' : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: https:`,
    "font-src 'self'",
    `connect-src 'self'${gaOn || adsOn ? ' https:' : ''}`,
    `frame-src 'self' https:`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: ${csp}

/assets/css/*
  Cache-Control: public, max-age=31536000, immutable

/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=604800

/games/*
  ! Content-Security-Policy

/assets/fonts/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=31536000, immutable

/data/*
  Cache-Control: public, max-age=300
`);
}

/* ------------------------------------------------------------------ */
/* Run                                                                */
/* ------------------------------------------------------------------ */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'));
copyDir(GAMES_DIR, path.join(DIST, 'games'), (e) => !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'games.json');
// Root files in src/ (favicon.ico, ads.txt, Google verification files...) are copied as-is.
for (const e of fs.readdirSync(SRC, { withFileTypes: true })) if (e.isFile()) fs.copyFileSync(path.join(SRC, e.name), path.join(DIST, e.name));

buildHome();
buildAllGames();
buildCategories();
buildGamePages();
buildSearch();
buildContentPages();
build404();
buildMeta();

if (errors.length) {
  console.error('\n✖ Build stopped. Please fix the following:\n');
  errors.forEach((e) => console.error('  • ' + e));
  process.exit(1);
}

warnings.forEach((w) => console.warn('⚠ ' + w));
console.log(`\n✔ ${site.name} built into ./dist`);
console.log(`  ${playable.length} playable game(s), ${comingSoon.length} coming soon, ${categories.length} categories`);
console.log(`  Ads: ${adsOn ? 'ON' : 'off'} · Analytics: ${gaOn ? 'ON' : 'off'}\n`);
