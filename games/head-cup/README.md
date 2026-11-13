# HEAD CUP

A 2D "big head" football game for PLAYORA: 1 player vs CPU, 2 players on one keyboard, or 2 vs 2.
Plain HTML5 Canvas + JavaScript modules, no libraries, no build step, no image or sound files
(everything is drawn and synthesised in code).

## Run it

The game uses JavaScript modules and loads `characters.json`, so browsers need it served over
HTTP (opening `index.html` by double-click won't work). From the PLAYORA project root:

```
npm start                                   # whole site: http://localhost:8080/play/head-cup/
node games/head-cup/_tests/devserver.mjs    # game alone, no caching: http://localhost:8090/
node games/head-cup/_tests/run.mjs          # headless tests (physics, goals, 14 skills, AI)
```

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W | ↑ |
| Kick | S or F | 0 / Enter (also ↓) |
| Skill | Q | Right Shift |
| Pause / mute | Esc or P / M | |

Keys are physical positions, so on AZERTY keyboards Player 1 uses Z/Q/S/D.
**Gamepads** (standard mapping): stick or d-pad to move, A jump, X/B/RT kick, Y/RB/LT skill, Start pause.
Gamepad 1 also controls Player 1, gamepad 2 Player 2; in 2 vs 2 the team-mates can be set to gamepads 3 and 4
in *Match settings* (otherwise the CPU plays them). **Touch**: on-screen buttons appear on phones and tablets
(Settings → Touch controls: Auto / On / Off).

## Modes and rules

- **1 Player**: you against the CPU (Easy / Medium / Hard in Match settings).
- **2 Players**: two people on one keyboard.
- **2 vs 2**: Player 1 + team-mate vs Player 2 + team-mate.
- Match time 30 / 60 / 90 / 120 s, optional goal limit (3 / 5 / 7), sudden death if tied (golden goal).
- Every player picks one skill. Its ring fills up during the match; each skill can be used once (X1).

## Add or change a character

Characters live in `characters.json`. Each entry:

```json
{
  "id": "my-star", "name": "My Star", "skill": "fireball",
  "stats": { "speed": 4, "jump": 3, "kick": 4, "size": 3 },
  "image": "assets/heads/my-star.png",
  "look": { "skin": "#c68642", "face": "round", "hair": { "style": "short", "color": "#222" } }
}
```

- `stats` go from 1 to 5. Keep the four numbers adding up to about 14 so characters stay balanced.
- `skill` is the default skill (players can still pick another one).
- **Your own picture**: save a square PNG (512 × 512 recommended, transparent background, face centred and
  filling the circle, looking to the right) in `assets/heads/` and set `"image"`. If the file is missing,
  the drawn head is used instead, so nothing breaks.
- Without an image the head is drawn from `look`:
  `face` round/oval/long/square · `hair.style` short, buzz, slick, sidepart, spiky, mohawk, afro, mane, long,
  ponytail, dreads, bun, bald, none · `beard.style` none, stubble, full, braided, goatee, mustache ·
  `brows` normal/thick/thin/angry · `nose` small/normal/big/round · `mouth` smile/grin/smirk/teeth/open ·
  `accessory.type` none, headband, sweatband, sunglasses, glasses, viking, ninja, nemes, earring ·
  extras `freckles`, `lashes`, `liner`.
- Please use invented characters, not real people's faces or names.

## Add a skill

1. Create `src/skills/mySkill.js` exporting an object:

```js
export default {
  id: 'mySkill', color: '#ff00aa', cooldown: 8, duration: 5, uses: 1, sfx: 'magnet',
  name: { en: 'My Skill', fr: 'Mon pouvoir', ar: 'مهارتي' },
  desc: { en: 'What it does.', fr: 'Ce qu’il fait.', ar: 'ماذا تفعل.' },
  activate(game, player, state) { /* return false to refuse (the use is not spent) */ },
  update(game, player, state, dt) {},   // optional, every step while active
  modify(game, player, mods) {},        // optional: mods.speedMul / kickMul / jumpMul
  onKick(game, player, ball, state) {}, // optional: the owner kicked a ball
  end(game, player, state) {},          // optional: undo everything here
  icon(ctx, r) { /* draw the icon centred at 0,0 */ },
};
```

2. Add one line to `src/skills/index.js` (`import` + the `SKILL_MODULES` list). That's it: it appears in the
   select screen, the HUD, How to play and the CPU can use it (add a rule in `useSkill` in `src/ai.js` to
   tell the CPU *when*).

`cooldown` is how long the ring takes to fill at the start of a match; `duration` 0 means instant.
Sound names (`sfx`) are defined in `src/audio.js`.

## Code map

| File | Role |
|---|---|
| `src/config.js` | Sizes, physics constants, key bindings |
| `src/physics.js` | Ball (sub-stepped, no tunnelling), crossbars, players, kicks, goal check |
| `src/game.js` | Match rules (phases, timer, sudden death, goal limit) + the fixed-step loop |
| `src/skills/*.js` | One file per skill + `index.js` (skill system) |
| `src/ai.js` | CPU players (Easy / Medium / Hard, 2v2 roles) |
| `src/characters.js` / `characters.json` | Roster loading, stats → physics, custom head images |
| `src/heads.js`, `src/renderer.js`, `src/effects.js` | Drawing: heads, stadium, players, HUD, particles |
| `src/teams.js` | Flags (drawn in code) and kit colours |
| `src/ui.js`, `src/i18n.js`, `src/modes.js` | Menus, select screen, settings, EN/FR/AR text, mode slots |
| `src/audio.js`, `src/input.js`, `src/main.js` | Sound, keyboard/gamepad/touch, start-up |
| `_tests/` | Headless tests, benchmarks, dev server (not published: folders starting with `_` are skipped) |
