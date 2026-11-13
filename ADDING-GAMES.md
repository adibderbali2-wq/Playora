# Adding a game to PLAYORA

Adding a game never requires touching the website's design or code. You only:

1. put the game's files in its own folder inside `games/`, and
2. add one entry to the catalog file `games/games.json`.

The game's page, its card on the homepage, the category pages, search, related games and
the sitemap are all created automatically.

---

## Step 1. Create the game folder

Pick an **id** for the game: lowercase letters, numbers and dashes only, e.g. `space-runner`.
The id becomes the web address: `https://your-site/play/space-runner/`.

```
games/
  space-runner/
    index.html      <- the game itself (required for playable games)
    thumb.svg       <- thumbnail, 16:9 (thumb.webp / thumb.png / thumb.jpg also work)
    assets/         <- images, sounds, scripts used by the game
```

Tip: copy `games/_template/` to get a working starting point that already scales to
every screen and handles keyboard, mouse and touch.

**Thumbnail tips:** 640 × 360 pixels (16:9). Prefer `.webp` or `.svg` to keep pages fast; aim
for under 60 KB. Don't use images you don't have the rights to.

## Step 2. Add the game to the catalog

Open `games/games.json` and add a new block inside the `"games": [ ... ]` list.
Put a comma between blocks.

```json
{
  "id": "space-runner",
  "title": "Space Runner",
  "description": "Run across floating platforms, grab energy cores and outrun the black hole.",
  "controls": "Arrow keys or WASD to move, Space to jump. On phones, tap the left/right side.",
  "category": "action",
  "tags": ["space", "platformer", "runner"],
  "status": "playable",
  "featured": false,
  "popular": false,
  "added": "2026-12-01",
  "aspectRatio": "16:9",
  "mobileFriendly": true
}
```

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Folder name and web address. Lowercase, numbers, dashes. Must be unique. |
| `title` | yes | Game name shown everywhere. |
| `description` | yes | Shown on the game page and used by Google. 1 to 3 sentences. |
| `category` | yes | One of: `action`, `adventure`, `racing`, `puzzle`, `arcade`, `sports`, `strategy`, `multiplayer`. |
| `status` | yes | `"playable"` or `"coming-soon"`. Coming-soon games show a badge and no Play button. |
| `added` | yes | Date added, `YYYY-MM-DD`. Used for "Recently added". |
| `controls` | no | "How to play" text on the game page. |
| `tags` | no | Extra search words, shown as tags on the game page. |
| `featured` | no | `true` shows it in "Featured games" on the homepage. |
| `popular` | no | `true` shows it in "Popular right now". |
| `aspectRatio` | no | Shape of the player: `"16:9"` (default), `"4:3"`, `"1:1"`, `"9:16"`… |
| `mobileFriendly` | no | Set `false` if the game needs a keyboard. |
| `thumbnail` | no | Only if the thumbnail isn't `games/<id>/thumb.*`. |
| `url` | no | Only if the game isn't at `games/<id>/index.html`. Can be an `https://` address of a game hosted elsewhere that allows embedding. |
| `developer` | no | Shown on the game page. Defaults to PLAYORA. |

## Step 3. Check it, then publish

On your computer (needs Node.js, see README):

```
npm start
```

Open http://localhost:8080 and try the game. If you made a typo in `games.json`,
the build stops and tells you exactly which game and which field to fix.

Then publish it (see DEPLOY.md, part 11): in GitHub Desktop, write a summary like
"Add Space Runner", press **Commit to main**, then **Push origin**. About a minute later
the game is live for everyone.

## Turning a "coming soon" game into a playable one

1. Add `index.html` (and `assets/`) to its existing folder.
2. In `games.json` change `"status": "coming-soon"` to `"status": "playable"`, and update `"added"`.
3. Commit and push.

## Removing a game

Delete its block from `games.json` and delete its folder. Commit and push.

## Rules for games on PLAYORA

- Only publish games you made or have written permission to distribute, with assets you have the right to use.
- No pop-ups, redirects or third-party trackers inside games.
- Keep the total size of a game reasonable (ideally under 10 MB) so it loads fast on phones.
- Games run inside the PLAYORA player frame. If a game breaks, it can tell the page to show a friendly error:
  `parent.postMessage({ playora: 'error', message: 'Could not load level' }, '*')`.
