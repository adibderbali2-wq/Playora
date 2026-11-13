# Game template

This folder is ignored by the website build (folders starting with `_` are skipped).
Copy it to start a new game:

1. Copy `games/_template` to `games/my-game-id` (lowercase, dashes, no spaces).
2. Build your game in `index.html`. Put images, sounds and scripts in `assets/`.
3. Add a thumbnail as `thumb.svg`, `thumb.webp` or `thumb.png` (16:9, about 640 x 360).
4. Add an entry to `games/games.json` (see ADDING-GAMES.md in the project root).

## Using Phaser

Phaser is a good choice for bigger 2D games. Download the single file
`phaser.min.js` from https://phaser.io/download and save it in this game's
`assets/` folder, then load it with:

```html
<script src="assets/phaser.min.js"></script>
```

Keeping Phaser inside the game folder means it only loads when someone plays
that game, the rest of PLAYORA stays fast, and the game keeps working even if
an outside website goes down. Use `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }`
in your Phaser config so the game fits the PLAYORA player.
