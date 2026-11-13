// HEAD CUP entry point: load the roster, build the systems, run the loop.
import { startLoop } from './game.js';
import { loadRoster } from './characters.js';
import { Renderer } from './renderer.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { t } from './i18n.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const fx = new Effects();
const audio = new AudioEngine();
const input = new Input();

function fit() {
  const r = stage.getBoundingClientRect();
  renderer.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
}
addEventListener('resize', fit);
document.addEventListener('fullscreenchange', fit);
fit();

async function boot() {
  const bar = document.getElementById('loadBar');
  bar.style.width = '30%';
  let roster;
  try {
    const fonts = document.fonts ? Promise.race([document.fonts.load('900 40px Unbounded').catch(() => {}), new Promise((r) => setTimeout(r, 2000))]) : null;
    [roster] = await Promise.all([loadRoster('characters.json'), fonts]);
  } catch (err) {
    console.error(err);
    document.querySelector('#loading p').textContent = 'Could not load the game. Please try again.';
    try { parent.postMessage({ playora: 'error', message: 'HEAD CUP could not load characters.json' }, '*'); } catch { /* standalone */ }
    return;
  }
  bar.style.width = '100%';
  renderer.bg = null; // rebuild the stadium now that fonts are ready
  const ui = new UI({ renderer, fx, audio, input, roster });
  ui.init();
  window.__headCup = ui; // handy for debugging

  // the menu shows a live CPU vs CPU match in the background
  const demoTeams = () => [
    { flag: 'tunisia', kit: { shirt: '#e70013', shorts: '#ffffff', socks: '#e70013', trim: '#ffffff' }, players: [{ char: roster.find((c) => c.id === 'captain-carthage') || roster[0], controller: 'ai', difficulty: 'hard', skill: 'speedBoost' }] },
    { flag: 'brazil', kit: { shirt: '#ffdc02', shorts: '#002776', socks: '#ffffff', trim: '#009b3a' }, players: [{ char: roster.find((c) => c.id === 'samba-king') || roster[1], controller: 'ai', difficulty: 'hard', skill: 'teleport' }] },
  ];
  const { Game } = await import('./game.js');
  let demo = new Game({ teams: demoTeams(), time: 9999, suddenDeath: false, emit: () => {} });

  startLoop({
    update(step) {
      const g = ui.game;
      if (g && ui.screen === 'play') {
        for (const p of g.players) if (p.controller !== 'ai') input.read(p.controller, p.input);
        g.update(step);
        fx.update(step);
      } else if (!g) {
        demo.update(step);
        if (demo.phase === 'end') demo = new Game({ teams: demoTeams(), time: 9999, suddenDeath: false, emit: () => {} });
      }
    },
    render(alpha, dt) {
      ui.frame(dt);
      const g = ui.game || demo;
      renderer.draw(g, ui.game ? fx : idleFx, alpha, { dt, t, goalGlow: ui.goalGlow, hud: !!ui.game, touch: !document.getElementById('touch').hidden });
    },
  });
  ui.show('title', false);
}
const idleFx = new Effects();
boot();
