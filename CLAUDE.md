# PLAYORA — Claude notes

Static browser-games site. Plain HTML/CSS/JS, Node ≥18 build script, **no npm deps**. Hosted on Cloudflare Pages (build `npm run build`, output `dist/`).

## Token rules
- Don't read `dist/` (generated), `Claude outputs/`, fonts/images, or other games' `index.html` unless the task is about them.
- `scripts/build.mjs` is ~900 lines: grep for the function you need (`buildHome`, `buildGamePages`, `layout`, validation ~L92-141) instead of reading it whole.
- README.md / DEPLOY.md are user-facing guides; don't read them for routine work.

## Map
- `games/games.json` — catalog (single source of truth for every game page, card, category, search, sitemap).
- `games/<id>/` — one game: `index.html` + `thumb.svg|webp|png` (+ `assets/`). Folders starting `_` or `.` are not published.
- `games/_template/` — starter game (scales, keyboard/mouse/touch).
- `site.config.json` — site name/URL, categories, ads/analytics toggles.
- `src/assets/{css,js}` — site design. `src/content/*.html` — About/Contact/Privacy/Terms.
- `scripts/` — `build.mjs`, `check-links.mjs`, `serve.mjs`, `guard-games.mjs`.

## Commands
- `npm run build` → `dist/` (validates games.json, stops with clear errors)
- `npm run check` → protected-games guard + internal link check (run after build)
- `npm start` → build + serve on http://localhost:8080

## Adding a game (touch only these)
1. Copy `games/_template/` → `games/<new-id>/` (id: lowercase, digits, dashes).
2. Write the game in `games/<new-id>/index.html`; add `thumb.svg` (16:9, ~640×360, <60 KB).
3. Append one entry to `games/games.json` → `games` array. Required: `id, title, description, category, status ("playable"|"coming-soon"), added (YYYY-MM-DD)`. Optional: `controls, tags, featured, popular, aspectRatio, mobileFriendly, thumbnail, url, developer`. Categories: action, adventure, racing, puzzle, arcade, sports, strategy, multiplayer. Full field table: ADDING-GAMES.md.
4. `npm run build && npm run check`.
5. `npm run guard -- --lock` to add the new game to the protected snapshot, then commit.

No changes to `src/`, `scripts/` or `site.config.json` are needed to add a game.
Coming-soon → playable: add `index.html`, flip `status`, update `added`, re-lock.

## Protection (don't bypass)
- `games/.protected.json` snapshots every game. `npm run guard` fails if a protected game is removed from the catalog, loses its folder/thumbnail/index.html, or is demoted from playable; warns on content changes.
- Git pre-commit hook (`.githooks/pre-commit`) runs the guard. Enable per clone: `git config core.hooksPath .githooks`.
- `.claude/settings.json` asks before editing existing playable games and denies `rm -rf games*` / `git push`.
- Re-lock only after the user confirms an intended change to an existing game.

## Conventions
- Don't edit existing games or site design unless asked. Never edit `dist/`.
- No frameworks, no CDNs, no npm packages; libraries (e.g. Phaser) go inside the game's own `assets/`.
- Games run in an iframe; report failure with `parent.postMessage({ playora: 'error', message }, '*')`.
- No GitHub remote yet; don't add one or push without asking.
