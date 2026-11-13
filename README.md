# PLAYORA

**Play more. Have fun.** A fast, responsive browser-gaming website, ready to host your own HTML5 games.

- Plain HTML, CSS and JavaScript: no framework and no npm packages to install.
- A tiny build script (`scripts/build.mjs`, Node.js) turns the game catalog into finished pages.
- Made to be hosted for free on **Cloudflare Pages**. See **DEPLOY.md**.
- Adding a game = a folder + one catalog entry. See **ADDING-GAMES.md**.

---

## Run it on your computer

You need **Node.js 18 or newer** (download the "LTS" version from https://nodejs.org and install it with the default options).

Open a terminal in this folder (in VS Code: **Terminal → New Terminal**) and run:

```
npm start
```

Then open **http://localhost:8080** in your browser. Press `Ctrl + C` in the terminal to stop.

| Command | What it does |
|---|---|
| `npm start` | Builds the site and serves it at http://localhost:8080 |
| `npm run build` | Builds the finished site into the `dist/` folder |
| `npm run check` | Checks every internal link and image in `dist/` |

> Opening `index.html` by double-clicking won't work. The site must be built and served, which `npm start` does for you.

## Project structure

```
playora/
├── site.config.json       Site name, URL, contact email, categories, ads/analytics switches
├── games/
│   ├── games.json         THE GAME CATALOG: every game's info lives here
│   ├── _template/         Starter for a new game (copy it)
│   ├── comet-catcher/     A game: index.html + thumb.svg (+ assets/)
│   ├── brick-blitz/
│   ├── glyph-match/
│   ├── paddle-duel/
│   └── turbo-lanes/ …     "Coming soon" games: thumbnail only, for now
├── src/
│   ├── assets/
│   │   ├── css/main.css   All the styling (colours and fonts at the top)
│   │   ├── js/            main.js (menu, search box), player.js, filters.js, search.js, contact.js
│   │   ├── fonts/         Unbounded + Manrope (self-hosted, open licence)
│   │   └── img/           Favicon, app icons, logo.png, social share image
│   ├── content/           About, Contact, Privacy, Terms: plain HTML you can edit
│   └── favicon.ico
├── scripts/
│   ├── build.mjs          Builds the site into dist/
│   ├── serve.mjs          Local preview server
│   └── check-links.mjs    Link checker
├── dist/                  Generated website (don't edit, not uploaded to GitHub)
├── .node-version          Tells Cloudflare which Node.js to use (22)
├── README.md · ADDING-GAMES.md · DEPLOY.md
└── package.json
```

## Pages the build creates

| Address | Page |
|---|---|
| `/` | Homepage: hero, featured, popular, recently added, categories, coming soon |
| `/games/` | All games with category filters, "playable only" and sorting |
| `/categories/` and `/category/<name>/` | Category overview and one page per category (8) |
| `/play/<game-id>/` | One page per game: player, fullscreen, restart, description, how to play, related games |
| `/search/?q=…` | Search results |
| `/about/`, `/contact/`, `/privacy/`, `/terms/` | Information pages |
| `/404.html` | Friendly "page not found" |
| `/sitemap.xml`, `/robots.txt`, `/site.webmanifest`, `/_headers` | SEO, app icon and security settings |

## Settings you should change

All in `site.config.json`:

- **`contactEmail`**: your contact address. Until it's set, the Contact page shows "inbox being set up" instead of the form, and the build prints a reminder.
- **`siteUrl`**: your real address, once you know it (e.g. `https://playora.pages.dev`, later `https://playora.com`). Used by Google, the sitemap and social share previews.

## Advertising (later)

Ad positions are already reserved in the layouts: under the hero and between homepage
sections, at the top of category pages, below the game description and in the game page
sidebar. All are away from the player and its buttons. **While ads are off, nothing is
shown**: no empty boxes, no scripts.

When your AdSense account is approved:

1. In `site.config.json` set `"ads": { "enabled": true, "adsenseClientId": "ca-pub-…" }` and fill in the slot IDs
   AdSense gives you for `home-top`, `home-middle`, `category-top`, `game-sidebar`, `game-below`.
2. Create a file `src/ads.txt` containing the line Google gives you. Any file placed directly in `src/` is published at the site root
   (this is also how you add a Google Search Console verification file).
3. Set up a consent banner (Google's own "Privacy & messaging" CMP is free) before showing ads to visitors in the EU/UK,
   and update `src/content/privacy.html`.

## Analytics (later)

Set `"analytics": { "enabled": true, "googleAnalyticsId": "G-…" }` in `site.config.json`.
The tracking script is added to every page automatically; with it off, no tracking code is present.
Alternative: Cloudflare Web Analytics (Cloudflare dashboard → your Pages project → **Metrics**)
needs no code and no cookies.

## Working features

- Responsive layout for phones, tablets, laptops and desktops; mobile menu with search and categories.
- Instant search suggestions in the header, and a full search page.
- Category pages and an "All games" page with working filters and sorting (shareable URLs like `/games/?category=puzzle`).
- Featured, popular, recently added and coming-soon sections, all driven by `games.json`.
- Game player: click-to-play (fast pages), loading spinner, friendly error with **Try again** if a game is missing, slow or crashes,
  restart button, fullscreen (with an iPhone fallback and a "turn your phone sideways" hint).
- 4 original, playable games with keyboard, mouse and touch controls and local high scores.
- Coming-soon games are clearly labelled and can't be "played".
- SEO: unique titles and descriptions, canonical URLs, Open Graph and Twitter previews, structured data, sitemap, robots.txt, clean URLs.
- Performance: no frameworks, self-hosted fonts, SVG thumbnails, lazy-loaded images, long-term caching of CSS/JS.
- Security headers (Content-Security-Policy, X-Frame-Options, etc.), no secrets in the code, user input cleaned and length-limited.
- Accessibility: semantic HTML, skip link, keyboard navigation, visible focus, labelled controls, reduced-motion support.

## Known limitations

- **Contact form**: there's no server, so the form opens the visitor's own email app with the message filled in. A visitor without an email app set up
  must copy your address instead. For a true "send" button, a form service (e.g. Formspree) or a Cloudflare Pages Function can be added later.
- **No accounts, comments, ratings or cloud saves**: high scores are stored only on the player's own device.
- **"Popular" is chosen by you** (the `popular` field), not measured automatically. Once analytics runs you can update it from real numbers.
- **Search runs in the browser** on the catalog. Perfect for hundreds of games; at many thousands it would be worth a server-side search.
- **Legal pages** are solid starting templates, not legal advice. Review them (especially before enabling ads) for the countries you target.
- Cloudflare Pages (free) limits single files to 25 MB and a site to 20,000 files; keep large game assets compressed.
