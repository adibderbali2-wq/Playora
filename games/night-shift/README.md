# NIGHT SHIFT: The Abandoned Hospital

First-person 3D horror survival game for PLAYORA. Plain ES modules + Three.js (r170, MIT, vendored in
`assets/lib/`). No build step, no CDN, no external assets: every texture, model, animation and sound is
generated at load time, so the folder is ~1 MB and works offline once loaded.

## Play
- From the site: `npm start` in the repo root, then open http://localhost:8080/play/night-shift/
- Standalone dev server (no caching): `node games/night-shift/_tests/devserver.mjs 8092` → http://localhost:8092

Controls: WASD move, mouse look (click to lock), Shift sprint, Space jump, E interact, F flashlight,
left click shoot, R reload, H medkit, Tab inventory/notes, Esc pause.

## Files
| File | What it does |
|---|---|
| `src/main.js` | Boot/loading, game loop, menus, save/checkpoints, interaction, shooting, light pool, post-processing |
| `src/level.js` | Thin-wall building generator, doors, light fixtures, collision, raycasts, nav grid + A* |
| `src/layout.js` | Hospital floor plan (wards, reception, ORs, ER, B2 lab) and set dressing |
| `src/props.js` | Prop models (beds, wheelchairs, OR gear, lab tubes…) merged into few draw calls |
| `src/textures.js` | Procedural canvas textures and the material library |
| `src/zombie.js` | Skinned humanoid models (20-bone skeleton), animation clips, AI state machine |
| `src/player.js` | Movement/collision, flashlight (shadowed spot + beam), hands + pistol viewmodel |
| `src/story.js` | Four chapters, objectives, pickups, documents, scripted scares, spawns |
| `src/audio.js` | Synthesised positional (HRTF) audio: gunshots, groans, screams, ambience, heartbeat |
| `src/fx.js`, `src/hud.js` | Particles/decals and the DOM HUD |
| `_tests/` | Dev server + playtest harness (not published: folders starting with `_` are skipped) |

## Playtest harness
With the dev server running, open the game and in the console: `await import('/_tests/harness.js')`.
`T.start()`, `T.goto(x,z)`, `T.use(...)`, `T.fight()`, `T.step(sec)`, `T.shot(name)` drive the game
deterministically and save rendered frames to `_tests/shots/` (git-ignored).
