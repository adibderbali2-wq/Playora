/* PLAYORA - search results page (/search/?q=...) */
(() => {
  'use strict';
  const input = document.querySelector('[data-big-search-input]');
  const form = document.querySelector('[data-big-search]');
  const results = document.querySelector('[data-search-results]');
  const count = document.querySelector('[data-search-count]');
  const empty = document.querySelector('[data-search-empty]');
  const heading = document.querySelector('[data-search-heading]');
  if (!input || !results) return;

  const { cleanQuery, matchGame, loadCatalog } = window.PLAYORA;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const card = (g, cat) => `<article class="card${g.playable ? '' : ' card--soon'}" style="--cat:${esc(cat.color)}">
  <a class="card__link" href="${esc(g.pageUrl)}">
    <div class="card__media">
      <img src="${esc(g.thumbnail)}" alt="" width="640" height="360" loading="lazy" decoding="async">
      ${g.playable ? '' : '<span class="badge badge--soon">Coming soon</span>'}
      ${g.playable ? '<span class="card__play" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor"/></svg></span>' : ''}
    </div>
    <div class="card__body">
      <h3 class="card__title">${esc(g.title)}</h3>
      <span class="chip">${esc(cat.name)}</span>
    </div>
  </a>
</article>`;

  const run = async (q, push) => {
    q = cleanQuery(q);
    input.value = q;
    if (push) history.replaceState(null, '', '/search/' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.title = (q ? `“${q}” - Search` : 'Search games') + ' | PLAYORA';
    heading.textContent = q ? `Results for “${q}”` : 'Find a game';
    count.textContent = 'Searching…';

    let data;
    try {
      data = await loadCatalog();
    } catch {
      count.textContent = '';
      results.innerHTML = '<div class="notice"><p>Search is temporarily unavailable. Please check your connection and reload the page, or <a href="/games/" style="color:var(--lime)">browse all games</a>.</p></div>';
      return;
    }
    const cats = Object.fromEntries(data.categories.map((c) => [c.slug, c]));
    let list;
    if (!q) {
      list = data.games.filter((g) => g.playable);
    } else {
      list = data.games
        .map((g) => [g, matchGame(g, q, cats[g.category]?.name)])
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([g]) => g);
    }
    results.innerHTML = list.map((g) => card(g, cats[g.category] || { name: g.category, color: '#C8FF4D' })).join('');
    empty.hidden = list.length > 0 || !q;
    count.textContent = q
      ? (list.length ? `${list.length} game${list.length === 1 ? '' : 's'} found` : '')
      : 'Type a game name, a category or a word like “space”. Here are all playable games:';
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value, true); });
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(input.value, true), 200); });
  run(new URLSearchParams(location.search).get('q') || '', false);
  if (!input.value) input.focus({ preventScroll: true });
})();
