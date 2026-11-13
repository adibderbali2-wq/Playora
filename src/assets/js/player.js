/* PLAYORA - game player: click-to-play, loading + error states, restart, fullscreen.
   Games are loaded in an <iframe> so any HTML5 game (plain canvas, Phaser, etc.) works. */
(() => {
  'use strict';
  const player = document.querySelector('[data-player]');
  if (!player) return;

  const stage = player.querySelector('[data-player-stage]');
  const poster = player.querySelector('[data-player-poster]');
  const startBtn = player.querySelector('[data-player-start]');
  const loading = player.querySelector('[data-player-loading]');
  const errorBox = player.querySelector('[data-player-error]');
  const errorText = player.querySelector('[data-player-error-text]');
  const retryBtn = player.querySelector('[data-player-retry]');
  const restartBtn = player.querySelector('[data-player-restart]');
  const fsBtn = player.querySelector('[data-player-fullscreen]');
  const exitBtn = player.querySelector('[data-player-exit]');
  const src = player.dataset.src;
  const external = player.dataset.external === '1';
  const LOAD_TIMEOUT = 20000;

  let frame = null;
  let timer = null;

  const show = (el, on) => { el.hidden = !on; };

  const fail = (msg) => {
    clearTimeout(timer);
    if (frame) { frame.remove(); frame = null; }
    show(loading, false);
    show(poster, false);
    if (msg) errorText.textContent = msg;
    show(errorBox, true);
    restartBtn.disabled = true;
    retryBtn.focus({ preventScroll: true });
  };

  const start = async () => {
    show(poster, false);
    show(errorBox, false);
    show(loading, true);
    restartBtn.disabled = true;

    // For games hosted on PLAYORA, check the files exist before loading them.
    if (!external) {
      try {
        const res = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) {
          fail(res.status === 404
            ? "We couldn't find this game's files. It may be getting an update. Please try again later."
            : 'The game server answered with an error. Please try again in a moment.');
          return;
        }
      } catch {
        fail("We couldn't reach the game. Check your internet connection and try again.");
        return;
      }
    }

    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.title = document.querySelector('.game-info h1')?.textContent.trim() || 'Game';
    frame.allow = 'fullscreen; autoplay; gamepad; accelerometer; gyroscope';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    if (external) frame.sandbox = 'allow-scripts allow-same-origin allow-pointer-lock allow-popups';

    timer = setTimeout(() => fail('This game is taking too long to load. Your connection may be slow. Please try again.'), LOAD_TIMEOUT);
    frame.addEventListener('load', () => {
      clearTimeout(timer);
      show(loading, false);
      restartBtn.disabled = false;
      try { frame.focus(); } catch { /* cross-origin */ }
    }, { once: true });
    frame.addEventListener('error', () => fail());
    frame.src = src;
    stage.appendChild(frame);
  };

  // Games can tell the page they crashed: parent.postMessage({ playora: 'error', message: '...' }, '*')
  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow) return;
    if (e.data && e.data.playora === 'error') fail(typeof e.data.message === 'string' ? e.data.message.slice(0, 200) : undefined);
  });

  startBtn.addEventListener('click', start);
  retryBtn.addEventListener('click', start);
  restartBtn.addEventListener('click', () => {
    if (!frame) return;
    show(loading, true);
    restartBtn.disabled = true;
    timer = setTimeout(() => fail('The game did not restart. Please try again.'), LOAD_TIMEOUT);
    frame.addEventListener('load', () => { clearTimeout(timer); show(loading, false); restartBtn.disabled = false; try { frame.focus(); } catch {} }, { once: true });
    frame.src = src;
  });

  /* ---------- Fullscreen ---------- */
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canNativeFs = Boolean(stage.requestFullscreen || stage.webkitRequestFullscreen);
  const isPseudo = () => player.classList.contains('is-pseudo-fs');

  const updateFsUi = () => {
    const on = Boolean(fsElement()) || isPseudo();
    fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
    fsBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
    show(exitBtn, on);
  };

  const enterFs = async () => {
    if (!frame && !poster.hidden) start(); // fullscreen also starts the game
    if (canNativeFs) {
      try {
        await (stage.requestFullscreen ? stage.requestFullscreen({ navigationUI: 'hide' }) : stage.webkitRequestFullscreen());
        const ratio = getComputedStyle(player).getPropertyValue('--ratio').trim().split('/').map(Number);
        if (ratio[0] > ratio[1] && screen.orientation?.lock && matchMedia('(pointer: coarse)').matches) {
          screen.orientation.lock('landscape').catch(() => {});
        }
        return;
      } catch { /* fall through to the CSS fallback */ }
    }
    player.classList.add('is-pseudo-fs');
    document.body.classList.add('pseudo-fs');
    updateFsUi();
  };

  const exitFs = () => {
    if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    player.classList.remove('is-pseudo-fs');
    document.body.classList.remove('pseudo-fs');
    try { screen.orientation?.unlock?.(); } catch {}
    updateFsUi();
  };

  fsBtn.addEventListener('click', () => (fsElement() || isPseudo() ? exitFs() : enterFs()));
  exitBtn.addEventListener('click', exitFs);
  document.addEventListener('fullscreenchange', updateFsUi);
  document.addEventListener('webkitfullscreenchange', updateFsUi);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isPseudo()) exitFs(); });
})();
