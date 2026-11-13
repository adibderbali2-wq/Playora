/* PLAYORA - "All games" page: category filter, playable-only toggle and sorting.
   Works on the cards already in the page, so the list is visible even without JavaScript. */
(() => {
  'use strict';
  const grid = document.querySelector('[data-filter-grid]');
  if (!grid) return;
  const chips = [...document.querySelectorAll('[data-filter]')];
  const playableToggle = document.querySelector('[data-filter-playable]');
  const sortSelect = document.querySelector('[data-sort]');
  const count = document.querySelector('[data-results-count]');
  const empty = document.querySelector('[data-filter-empty]');
  const cards = [...grid.querySelectorAll('[data-game-card]')];
  const validCats = new Set(chips.map((c) => c.dataset.filter));
  const validSorts = new Set(['popular', 'newest', 'az']);

  const params = new URLSearchParams(location.search);
  let state = {
    category: validCats.has(params.get('category')) ? params.get('category') : 'all',
    playable: params.get('playable') === '1',
    sort: validSorts.has(params.get('sort')) ? params.get('sort') : 'popular',
  };

  const sorters = {
    popular: (a, b) => b.dataset.playable - a.dataset.playable || b.dataset.popular - a.dataset.popular || b.dataset.added.localeCompare(a.dataset.added),
    newest: (a, b) => b.dataset.playable - a.dataset.playable || b.dataset.added.localeCompare(a.dataset.added),
    az: (a, b) => a.dataset.title.localeCompare(b.dataset.title),
  };

  const apply = (push) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === state.category)));
    playableToggle.checked = state.playable;
    sortSelect.value = state.sort;

    let shown = 0;
    let shownPlayable = 0;
    [...cards].sort(sorters[state.sort]).forEach((card) => {
      grid.appendChild(card);
      const ok = (state.category === 'all' || card.dataset.category === state.category) && (!state.playable || card.dataset.playable === '1');
      card.classList.toggle('is-hidden', !ok);
      if (ok) { shown++; if (card.dataset.playable === '1') shownPlayable++; }
    });
    empty.hidden = shown > 0;
    count.textContent = shown
      ? `Showing ${shown} game${shown === 1 ? '' : 's'}${shown - shownPlayable ? ` (${shownPlayable} playable, ${shown - shownPlayable} coming soon)` : ''}`
      : '';

    if (push) {
      const p = new URLSearchParams();
      if (state.category !== 'all') p.set('category', state.category);
      if (state.playable) p.set('playable', '1');
      if (state.sort !== 'popular') p.set('sort', state.sort);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    }
  };

  chips.forEach((chip) => chip.addEventListener('click', () => { state.category = chip.dataset.filter; apply(true); }));
  playableToggle.addEventListener('change', () => { state.playable = playableToggle.checked; apply(true); });
  sortSelect.addEventListener('change', () => { state.sort = validSorts.has(sortSelect.value) ? sortSelect.value : 'popular'; apply(true); });
  apply(false);
})();
