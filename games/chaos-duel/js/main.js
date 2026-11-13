// CHAOS DUEL entry point: screens, game loop and glue between logic, rendering, audio and input.
import { W, H, GROUND, STEP, CONTROLS, MODES } from './config.js';
import { CHARACTERS, CHARACTER_IDS } from './characters.js';
import { EVENTS, EVENT_IDS } from './chaos.js';
import { Match } from './match.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { loadAssets, drawFrame } from './sprites.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ------------------------------------------------------------------ settings
const SETTINGS_KEY = 'chaosduel.settings';
const settings = { music: 60, sfx: 80, shake: true, touch: 'auto', roundTime: 99 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* storage blocked */ }
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

// --------------------------------------------------------------------- state
const stage = $('#stage');
const canvas = $('#game');
const renderer = new Renderer(canvas);
const fx = new Effects();
const audio = new AudioEngine();
const input = new Input();
const app = {
  screen: 'loading', history: [], mode: 'chaos', chars: ['bruno', 'zippy'], ready: [false, false],
  match: null, acc: 0, last: performance.now(), loaded: false, showT: 0,
};
window.__chaosDuel = app; // handy for debugging in the console

function applySettings() {
  audio.setVolumes(settings.music / 100, settings.sfx / 100);
  fx.shakeEnabled = settings.shake;
  $('#setMusic').value = settings.music; $('#outMusic').textContent = settings.music;
  $('#setSfx').value = settings.sfx; $('#outSfx').textContent = settings.sfx;
  $('#setShake b').textContent = settings.shake ? 'On' : 'Off';
  $('#setTouch b').textContent = { auto: 'Auto', on: 'On', off: 'Off' }[settings.touch];
  $('#setTime b').textContent = settings.roundTime + ' s';
  updateTouch();
}

// ------------------------------------------------------------------- screens
function show(id, { push = true } = {}) {
  const prev = app.screen;
  if (push && prev && prev !== id && !['loading', 'title'].includes(prev)) app.history.push(prev);
  app.screen = id;
  for (const s of $$('.screen')) s.classList.toggle('show', s.id === id);
  const fighting = id === 'fight';
  stage.classList.toggle('in-match', !!app.match);
  $('#pauseBtn').hidden = !fighting;
  $('#freeBar').hidden = !(fighting && app.match && !app.match.mode.rounds);
  updateTouch();
  if (id === 'select') enterSelect();
  if (!app.match && ['menu', 'modes', 'select', 'howto', 'title', 'settings'].includes(id)) audio.playMusic('menu');
  // focus the first control so keyboard players can navigate straight away
  const scr = $('#' + id);
  if (scr) {
    const first = scr.querySelector('.menu-list button, .menu-list a, .menu-list input, .ready-btn, .back');
    if (first && id !== 'select') setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
}

function back() {
  audio.play('back');
  if (app.screen === 'pause') return resume();
  const prev = app.history.pop();
  if (app.match && app.match.paused && (prev === 'pause' || !prev)) return show('pause', { push: false });
  show(prev || 'menu', { push: false });
}

function updateTouch() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const on = settings.touch === 'on' || (settings.touch === 'auto' && coarse);
  const t = $('#touch');
  t.hidden = !(on && app.screen === 'fight');
}

// ------------------------------------------------------------- menus wiring
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { audio.play('select'); if (go.dataset.go === 'select' && app.screen === 'results') app.match = null; show(go.dataset.go); return; }
  if (e.target.closest('[data-back]')) back();
  const mode = e.target.closest('[data-mode]');
  if (mode) {
    app.mode = mode.dataset.mode; audio.play('confirm');
    if (MODES[app.mode].fixedChars) startMatch(); // Free Fight starts immediately
    else show('select');
  }
});
$('#pressStart').addEventListener('click', start);
$('#resume').addEventListener('click', () => resume());
$('#restart').addEventListener('click', () => { audio.play('confirm'); startMatch(); });
$('#quit').addEventListener('click', () => quitToMenu());
$('#rematch').addEventListener('click', () => { audio.play('confirm'); startMatch(); });
$('#toMenu').addEventListener('click', () => quitToMenu());
$('#pauseBtn').addEventListener('click', () => pause());
$('#ffRestart').addEventListener('click', () => { audio.play('confirm'); startMatch(); });
$('#ffMenu').addEventListener('click', () => quitToMenu());

$('#setMusic').addEventListener('input', (e) => { settings.music = +e.target.value; applySettings(); save(); });
$('#setSfx').addEventListener('input', (e) => { settings.sfx = +e.target.value; applySettings(); save(); audio.play('ui'); });
$('#setShake').addEventListener('click', () => { settings.shake = !settings.shake; applySettings(); save(); audio.play('ui'); });
$('#setTouch').addEventListener('click', () => { settings.touch = { auto: 'on', on: 'off', off: 'auto' }[settings.touch]; applySettings(); save(); audio.play('ui'); });
$('#setTime').addEventListener('click', () => { settings.roundTime = { 60: 99, 99: 120, 120: 60 }[settings.roundTime] || 99; applySettings(); save(); audio.play('ui'); });

function quitToMenu() {
  audio.play('back');
  app.match = null; fx.reset(); app.history = [];
  audio.setIntensity(false);
  show('menu', { push: false });
}

function start() {
  if (app.screen !== 'title') return;
  audio.unlock();
  applySettings();
  audio.play('confirm');
  show('menu', { push: false });
}

// keyboard navigation for menus (both players' keys work)
const NAV_UP = new Set(['ArrowUp', 'KeyW']), NAV_DOWN = new Set(['ArrowDown', 'KeyS']);
const NAV_LEFT = new Set(['ArrowLeft', 'KeyA']), NAV_RIGHT = new Set(['ArrowRight', 'KeyD']);
const NAV_OK = new Set(['Enter', 'Space', 'KeyF', 'KeyK', 'NumpadEnter']);
input.onKey((e) => {
  audio.unlock();
  const s = app.screen;
  if (s === 'loading') return;
  if (s === 'title') { start(); return; }
  if (s === 'fight') { if (e.code === 'Escape' || e.code === 'KeyP') pause(); return; }
  if (s === 'select') return selectKey(e);
  if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); if (s !== 'menu' && s !== 'results') back(); return; }
  if ((e.code === 'KeyP') && s === 'pause') return resume();
  const scr = $('#' + s);
  const items = $$('.menu-list > button, .menu-list > a, .menu-list .row, .modes .mode, .back', scr).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const active = document.activeElement;
  let i = items.findIndex((el) => el === active || el.contains(active));
  const horizontal = scr.querySelector('.menu-list.row');
  const isRange = active && active.type === 'range';
  if (NAV_DOWN.has(e.code) || (horizontal && NAV_RIGHT.has(e.code) && !isRange)) { e.preventDefault(); i = (i + 1) % items.length; focusItem(items[i]); audio.play('ui'); }
  else if (NAV_UP.has(e.code) || (horizontal && NAV_LEFT.has(e.code) && !isRange)) { e.preventDefault(); i = (i - 1 + items.length) % items.length; focusItem(items[i]); audio.play('ui'); }
  else if (isRange && (NAV_LEFT.has(e.code) || NAV_RIGHT.has(e.code))) {
    e.preventDefault();
    active.value = +active.value + (NAV_RIGHT.has(e.code) ? 5 : -5); active.dispatchEvent(new Event('input'));
  } else if (NAV_OK.has(e.code) && i >= 0 && !isRange) {
    e.preventDefault();
    const el = items[i];
    (el.matches('label') ? el.querySelector('input') : el).click();
  }
});
function focusItem(el) { (el.matches('label') ? el.querySelector('input') : el).focus({ preventScroll: false }); }

// ---------------------------------------------------------- character select
function buildSelect() {
  for (const pick of $$('.pick')) {
    const p = +pick.dataset.player;
    const ch = $('.choices', pick);
    ch.innerHTML = CHARACTER_IDS.map((id) => `<button data-c="${id}">${CHARACTERS[id].name}</button>`).join('');
    ch.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b && !app.ready[p]) { app.chars[p] = b.dataset.c; audio.play('ui'); renderPick(p); } });
    $('.ready-btn', pick).addEventListener('click', () => toggleReady(p));
  }
}

function enterSelect() {
  app.ready = [false, false];
  $('#selMode').textContent = MODES[app.mode].name;
  renderPick(0); renderPick(1);
}

function renderPick(p) {
  const pick = $(`.pick[data-player="${p}"]`);
  const def = CHARACTERS[app.chars[p]];
  pick.classList.toggle('ready', app.ready[p]);
  $('.ptag', pick).textContent = `PLAYER ${p + 1}`;
  $('.banner', pick).src = def.banner ? def.banner.src : '';
  $('.banner', pick).alt = `${def.name}, ${def.title}`;
  $$('.choices button', pick).forEach((b) => { b.classList.toggle('on', b.dataset.c === app.chars[p]); });
  const meter = (n) => `<span class="meter">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const st = def.stats;
  $('.stats', pick).innerHTML = `<span>Power</span>${meter(st.power)}<span>Speed</span>${meter(st.speed)}<span>Defence</span>${meter(st.defense)}<span>Mobility</span>${meter(st.mobility)}`;
  $('.stats', pick).style.setProperty('--c', def.color);
  $('.special', pick).innerHTML = `<b>Special · ${def.special.name}</b>${def.special.desc}`;
  const c = CONTROLS[p === 0 ? 'p1' : 'p2'];
  const k = (code) => `<kbd>${input.label(code)}</kbd>`;
  $('.keys', pick).innerHTML = `${k(c.left)} ${k(c.right)} choose · ${k(c.attack)} confirm · ${k(c.heavy)} cancel`;
  const btn = $('.ready-btn', pick);
  btn.textContent = app.ready[p] ? 'Ready!' : 'Confirm';
}

function toggleReady(p) {
  app.ready[p] = !app.ready[p];
  audio.play(app.ready[p] ? 'confirm' : 'back');
  renderPick(p);
  if (app.ready[0] && app.ready[1]) setTimeout(() => { if (app.screen === 'select' && app.ready[0] && app.ready[1]) startMatch(); }, 650);
}

function selectKey(e) {
  if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); return back(); }
  for (const p of [0, 1]) {
    const c = CONTROLS[p === 0 ? 'p1' : 'p2'];
    if (e.code === c.left || e.code === c.right) {
      if (app.ready[p]) continue;
      const i = CHARACTER_IDS.indexOf(app.chars[p]);
      const n = CHARACTER_IDS.length;
      app.chars[p] = CHARACTER_IDS[(i + (e.code === c.right ? 1 : -1) + n) % n];
      audio.play('ui'); renderPick(p);
    } else if (e.code === c.attack || (p === 0 && (e.code === 'Enter' || e.code === 'Space') && !app.ready[0])) {
      if (!app.ready[p]) toggleReady(p);
    } else if (e.code === c.heavy) {
      if (app.ready[p]) toggleReady(p); else if (!app.ready[1 - p]) back();
    }
  }
}

// --------------------------------------------------------------- how to play
function buildHowTo() {
  const rows = (c) => [
    ['Move', `<kbd>${input.label(c.left)}</kbd> <kbd>${input.label(c.right)}</kbd> (hold to run)`],
    ['Jump', `<kbd>${input.label(c.up)}</kbd>`],
    ['Block', `<kbd>${input.label(c.down)}</kbd> (hold)`],
    ['Punch', `<kbd>${input.label(c.attack)}</kbd> (chain up to 3)`],
    ['Heavy attack', `<kbd>${input.label(c.heavy)}</kbd>`],
    ['Special', `<kbd>${input.label(c.special)}</kbd> alone`],
    ['Dash', `<kbd>${input.label(c.special)}</kbd> + <kbd>${input.label(c.left)}</kbd>/<kbd>${input.label(c.right)}</kbd>`],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  $('#keysP1').innerHTML = rows(CONTROLS.p1) + '<tr><td>Pause</td><td><kbd>Esc</kbd> or <kbd>P</kbd></td></tr>';
  $('#keysP2').innerHTML = rows(CONTROLS.p2);
  $('#howFighters').innerHTML = CHARACTER_IDS.map((id) => {
    const d = CHARACTERS[id];
    return `<div><img src="${d.banner ? d.banner.src : ''}" alt="${d.name}"><b>${d.name} · ${d.title}</b><p>${d.blurb}</p><p><b>${d.special.name}:</b> ${d.special.desc}</p></div>`;
  }).join('');
  $('#howEvents').innerHTML = EVENT_IDS.map((id) => `<div style="--c:${EVENTS[id].color}"><b>${EVENTS[id].name}</b>${EVENTS[id].desc}.</div>`).join('');
}

// --------------------------------------------------------------------- match
function emit(type, d) {
  if (type === 'sfx') return audio.play(d);
  if (type === 'chaosStart') { audio.setIntensity(true); }
  if (type === 'chaosEnd') { audio.setIntensity(false); return; }
  if (type === 'roundStart') { fx.reset(); renderer.shown = [1, 1]; return; }
  if (type === 'matchEnd') return setTimeout(() => showResults(d), 900);
  fx.handle(type, d);
}

function startMatch() {
  const fixed = MODES[app.mode].fixedChars;
  const chars = (fixed || app.chars).slice();
  fx.reset();
  app.match = new Match({ mode: app.mode, chars, emit, roundTime: settings.roundTime });
  app.acc = 0; app.history = [];
  input.clear();
  audio.playMusic('fight'); audio.setIntensity(false);
  show('fight', { push: false });
  canvas.focus?.();
}

function pause() {
  const m = app.match;
  if (!m || app.screen !== 'fight' || m.phase === 'matchEnd') return;
  m.paused = true; input.clear();
  audio.play('back');
  show('pause', { push: false });
}

function resume() {
  const m = app.match; if (!m) return;
  audio.play('confirm');
  m.paused = false; app.acc = 0; app.history = [];
  audio.playMusic('fight');
  show('fight', { push: false });
}

function showResults(r) {
  if (!app.match) return;
  const free = r.free;
  const wDef = CHARACTERS[r.chars[r.winner]];
  $('#resKicker').textContent = free ? 'Free Fight · K.O.' : `${MODES[r.mode].name} · Match over`;
  title.textContent = `Player ${r.winner + 1} wins!`;
  if (r.winner === 1) title.classList.add('p2');
  $('#resBanner').src = wDef.banner.src;
  $('#resScore').textContent = free ? `${wDef.name} wins the fight` : `${r.wins[0]} – ${r.wins[1]}`;
  $('#rematch').textContent = free ? 'Restart' : 'Rematch';
  $('#results [data-go="select"]').hidden = !!free;
  audio.play('victory');
  const s = r.stats;
  const n = (v) => Math.round(v);
  $('#resStats').innerHTML = `<tr><th>P1 · ${CHARACTERS[r.chars[0]].name}</th><th></th><th>P2 · ${CHARACTERS[r.chars[1]].name}</th></tr>
    <tr><td>${n(s[0].damage)}</td><td>Damage dealt</td><td>${n(s[1].damage)}</td></tr>
    <tr><td>${s[0].hits}</td><td>Hits landed</td><td>${s[1].hits}</td></tr>
    <tr><td>${s[0].maxCombo}</td><td>Best combo</td><td>${s[1].maxCombo}</td></tr>`;
  audio.playMusic(null);
  show('results', { push: false });
}

// pause automatically when the tab/iframe loses focus mid-fight
addEventListener('blur', () => { if (app.screen === 'fight') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'fight') pause(); });

// ------------------------------------------------------------------ the loop
function resize() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(r.width, r.height, dpr);
  for (const c of $$('.preview')) { c.width = Math.round(c.clientWidth * dpr) || 220; c.height = Math.round(c.clientHeight * dpr) || 200; }
}
addEventListener('resize', resize);

const showcase = { t: 0 };
function drawShowcase(dt) {
  showcase.t += dt;
  const ctx = renderer.ctx, k = renderer.scale;
  if (!renderer.bg) renderer.buildBackground();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(renderer.bg, 0, 0);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  renderer.t += dt; renderer.drawCrowdLights(ctx, null);
  if (!app.loaded) return;
  const b = CHARACTERS.bruno, z = CHARACTERS.zippy;
  const fi = (def, fps) => Math.floor(showcase.t * fps) % def.frameCounts.idle;
  for (const [def, x, f] of [[b, W * 0.66, -1], [z, W * 0.86, -1]]) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, GROUND + 3, 50, 10, 0, 0, Math.PI * 2); ctx.fill();
    drawFrame(ctx, def, 'idle', fi(def, 9), x, GROUND, { facing: f, scale: 1.15 });
  }
}

function drawPreviews(dt) {
  for (const pick of $$('.pick')) {
    const p = +pick.dataset.player, c = $('.preview', pick), ctx = c.getContext('2d');
    const def = CHARACTERS[app.chars[p]];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    const s = c.height / 200;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const ready = app.ready[p];
    const anim = ready ? 'victory' : 'idle';
    const n = def.frameCounts[anim];
    const idx = ready ? Math.min(n - 1, Math.floor(app.showT * 9)) : Math.floor(app.showT * 9) % n;
    drawFrame(ctx, def, anim, idx, (c.width / s) / 2, 188, { facing: p === 0 ? 1 : -1, scale: 0.78, alt: p === 1 && app.chars[0] === app.chars[1] });
  }
}

let readyAt = [0, 0];
function frame(now) {
  const dt = Math.min(0.1, (now - app.last) / 1000); app.last = now;
  app.showT += dt;
  const m = app.match;
  if (m && ['fight', 'pause', 'results'].includes(app.screen) || (m && app.screen === 'settings' && m.paused) || (m && app.screen === 'howto' && m.paused)) {
    if (app.screen === 'fight' && !m.paused) {
      for (const f of m.fighters) input.read(f.index, f.input);
      app.acc += dt;
      while (app.acc >= STEP) { m.update(STEP); app.acc -= STEP; }
      fx.update(dt);
    }
    renderer.draw(m, fx, app.screen === 'fight' ? dt : 0, { debug: app.debug });
  } else {
    drawShowcase(dt);
  }
  if (app.screen === 'select') {
    for (const p of [0, 1]) if (app.ready[p] && !readyAt[p]) readyAt[p] = app.showT; else if (!app.ready[p]) readyAt[p] = 0;
    drawPreviews(dt);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------- boot
async function boot() {
  resize();
  applySettings();
  input.bindTouch($('#touch'));
  buildSelect();
  requestAnimationFrame(frame);
  try {
    const fonts = document.fonts ? Promise.race([Promise.all([document.fonts.load('900 52px Unbounded'), document.fonts.load('700 14px Manrope')]), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    await Promise.all([loadAssets((k) => { $('#loadBar').style.width = Math.round(k * 100) + '%'; }), fonts]);
  } catch (err) {
    $('#loadText').textContent = 'Could not load the game files. Please try again.';
    try { parent.postMessage({ playora: 'error', message: 'CHAOS DUEL could not load its sprites' }, '*'); } catch { /* standalone */ }
    console.error(err);
    return;
  }
  app.loaded = true;
  renderer.bg = null; // rebuild with the loaded fonts
  buildHowTo();
  // keyboard layout labels may arrive a moment later
  setTimeout(() => { buildHowTo(); renderPick(0); renderPick(1); }, 600);
  show('title', { push: false });
}
boot();
