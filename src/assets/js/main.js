/* PLAYORA - shared site behaviour: mobile menu + instant search suggestions */
(() => {
  'use strict';

  /* ---------- Shared catalog loader (used by search pages too) ---------- */
  let catalogPromise = null;
  window.PLAYORA = window.PLAYORA || {};
  window.PLAYORA.loadCatalog = () => {
    if (!catalogPromise) {
      catalogPromise = fetch('/data/catalog.json', { credentials: 'same-origin' })
        .then((r) => { if (!r.ok) throw new Error('catalog ' + r.status); return r.json(); })
        .catch((e) => { catalogPromise = null; throw e; });
    }
    return catalogPromise;
  };

  /** Clean user text: trim, collapse spaces, strip control chars, cap length. */
  window.PLAYORA.cleanQuery = (s) =>
    String(s || '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

  /** Score a game against a query. 0 = no match. */
  window.PLAYORA.matchGame = (g, q, catName) => {
    if (!q) return 1;
    const words = q.toLowerCase().split(' ').filter(Boolean);
    const title = g.title.toLowerCase();
    const hay = [title, g.description.toLowerCase(), (g.tags || []).join(' ').toLowerCase(), (catName || '').toLowerCase(), g.category].join(' ');
    let score = 0;
    for (const w of words) {
      if (!hay.includes(w)) return 0;
      if (title.startsWith(w)) score += 6;
      else if (title.includes(w)) score += 4;
      else if ((g.tags || []).some((t) => t.toLowerCase().includes(w)) || g.category.includes(w)) score += 2;
      else score += 1;
    }
    return score + (g.playable ? 1 : 0);
  };

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (toggle && menu) {
    const label = toggle.querySelector('.visually-hidden');
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      label.textContent = open ? 'Close menu' : 'Open menu';
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (open) menu.querySelector('input')?.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 1040px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
  }

  /* ---------- Header search suggestions ---------- */
  const form = document.querySelector('[data-search-form]');
  const input = document.querySelector('[data-search-input]');
  const box = document.querySelector('[data-search-suggest]');
  if (!form || !input || !box) return;

  let items = [];
  let active = -1;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const close = () => { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const highlight = (i) => {
    items.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
    active = i;
    if (items[i]) input.setAttribute('aria-activedescendant', items[i].id);
    else input.removeAttribute('aria-activedescendant');
  };

  const render = async () => {
    const q = window.PLAYORA.cleanQuery(input.value);
    if (q.length < 1) { close(); return; }
    let data;
    try { data = await window.PLAYORA.loadCatalog(); } catch { close(); return; }
    if (window.PLAYORA.cleanQuery(input.value) !== q) return; // typed on
    const cats = Object.fromEntries(data.categories.map((c) => [c.slug, c]));
    const hits = data.games
      .map((g) => [g, window.PLAYORA.matchGame(g, q, cats[g.category]?.name)])
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);

    box.innerHTML =
      (hits.length
        ? hits.map((g, i) => `<a class="suggest-item" role="option" id="sg-${i}" href="${esc(g.pageUrl)}">
            <img src="${esc(g.thumbnail)}" alt="" width="64" height="36" loading="lazy">
            <span><span class="suggest-item__title">${esc(g.title)}</span><br><span class="suggest-item__meta">${esc(cats[g.category]?.name || '')}${g.playable ? '' : ' · Coming soon'}</span></span>
          </a>`).join('')
        : `<p class="suggest-empty">No games match “${esc(q)}”</p>`) +
      `<a class="suggest-all" role="option" id="sg-all" href="/search/?q=${encodeURIComponent(q)}">See all results for “${esc(q)}”</a>`;
    items = [...box.querySelectorAll('[role="option"]')];
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  };

  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 90); });
  input.addEventListener('focus', () => { window.PLAYORA.loadCatalog().catch(() => {}); if (input.value) render(); });
  input.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, -1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); items[active].click(); }
    else if (e.key === 'Escape') { close(); }
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  form.addEventListener('submit', (e) => {
    const q = window.PLAYORA.cleanQuery(input.value);
    if (!q) { e.preventDefault(); input.focus(); return; }
    input.value = q;
  });
})();
