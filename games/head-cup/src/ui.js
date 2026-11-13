// User interface: screens, menus, select cards, settings, pause, results, and the glue between
// game events and the effects/audio systems.
import { W, H, GROUND, MATCH, KEYS } from './config.js';
import { Game } from './game.js';
import { MODES, defaultSlots, buildTeams } from './modes.js';
import { TEAMS, TEAM_BY_ID, drawFlag, drawFlagBadge } from './teams.js';
import { SKILLS, SKILL_IDS } from './skills/index.js';
import { t, tr, setLang, getLang, applyDom, LANGS, detectLang } from './i18n.js';
import { drawHead } from './heads.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STORE = 'headcup.settings';

export class UI {
  constructor({ renderer, fx, audio, input, roster }) {
    Object.assign(this, { renderer, fx, audio, input, roster });
    this.settings = { lang: detectLang(), music: 50, sfx: 80, muted: false, shake: true, touch: 'auto', hints: true, time: 60, goalLimit: 0, sudden: true, difficulty: 'medium' };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch { /* storage blocked */ }
    setLang(this.settings.lang);
    this.screen = 'loading'; this.history = []; this.game = null; this.sel = null; this.lastSetup = null;
    this.goalGlow = null; this.hintsT = 0; this.prevPhase = null; this.chanceT = 0;
  }

  save() { try { localStorage.setItem(STORE, JSON.stringify(this.settings)); } catch { /* ignore */ } }

  init() {
    applyDom(); this.applyAudio(); this.fx.shakeOn = this.settings.shake;
    this.buildLangs(); this.buildHowTo(); this.bindStatic();
    this.input.bindTouch($('#touch'));
    this.input.onKey((e) => this.onKey(e));
  }

  // ---------------------------------------------------------------- screens
  show(id, push = true) {
    if (push && this.screen && this.screen !== id && !['loading', 'title'].includes(this.screen)) this.history.push(this.screen);
    this.screen = id;
    $$('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
    const playing = id === 'play';
    if (!playing) $('#hints').hidden = true;
    $('#btnPause').hidden = !playing;
    this.updateTouch();
    if (!this.game && ['menu', 'select', 'setup', 'howto', 'settings', 'title'].includes(id)) this.audio.playMusic('menu');
    if (id === 'settings') this.buildSettings();
    if (id === 'setup') this.buildSetup();
    setTimeout(() => { const f = this.navItems()[0]; if (f && id !== 'select') this.focus(f); }, 40);
  }
  back() {
    this.audio.play('back');
    if (this.screen === 'pause') return this.resume();
    const prev = this.history.pop();
    if (this.game && this.game.paused && (!prev || prev === 'pause')) return this.show('pause', false);
    this.show(prev || 'menu', false);
  }
  updateTouch() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const on = this.settings.touch === 'on' || (this.settings.touch === 'auto' && coarse);
    $('#touch').hidden = !(on && this.screen === 'play');
    $('#touch').classList.toggle('solo', !!(this.game && this.game.players.filter((p) => p.controller !== 'ai').length < 2));
  }

  bindStatic() {
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]'); if (go) { this.audio.play('select'); this.show(go.dataset.go); return; }
      if (e.target.closest('[data-back]')) return this.back();
      const m = e.target.closest('[data-mode]'); if (m) { this.audio.play('confirm'); this.startSelect(m.dataset.mode); }
    });
    $('#pressStart').addEventListener('click', () => this.start());
    $('#title').addEventListener('click', () => this.start());
    $('#btnPlay').addEventListener('click', () => this.startMatch());
    $('#btnResume').addEventListener('click', () => this.resume());
    $('#btnRestart').addEventListener('click', () => { this.audio.play('confirm'); this.startMatch(this.lastSetup); });
    $('#btnQuit').addEventListener('click', () => this.quit());
    $('#btnRematch').addEventListener('click', () => { this.audio.play('confirm'); this.startMatch(this.lastSetup); });
    $('#btnChange').addEventListener('click', () => { this.quit(true); this.startSelect(this.sel ? this.sel.mode : '2p', true); });
    $('#btnMenu').addEventListener('click', () => this.quit());
    $('#btnPause').addEventListener('click', () => this.pause());
    $('#btnMute').addEventListener('click', () => this.toggleMute());
    $('#btnFull').addEventListener('click', () => this.fullscreen());
    addEventListener('blur', () => { if (this.screen === 'play') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.screen === 'play') this.pause(); });
  }

  start() {
    if (this.screen !== 'title') return;
    this.audio.unlock(); this.applyAudio(); this.audio.play('confirm');
    this.show('menu', false);
  }
  toggleMute() { this.settings.muted = !this.settings.muted; this.applyAudio(); this.save(); if (this.screen === 'settings') this.buildSettings(); }
  applyAudio() { this.audio.set(this.settings.music / 100, this.settings.sfx / 100, this.settings.muted); $('#btnMute').textContent = this.settings.muted ? '🔇' : '🔊'; }
  fullscreen() {
    const el = $('#stage');
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }

  // ------------------------------------------------------------ keyboard nav
  navItems() {
    const scr = $('#' + this.screen); if (!scr) return [];
    return $$('.nav > button, .nav > a, .nav > .opt, .langs button, .row > .pill', scr).filter((el) => el.offsetParent !== null);
  }
  focus(el) { if (el.classList.contains('opt')) el.focus({ preventScroll: true }); else el.focus({ preventScroll: true }); }

  onKey(e) {
    this.audio.unlock();
    const s = this.screen, c = e.code;
    if (c === 'KeyM' && s !== 'select') { this.toggleMute(); return; }
    if (s === 'loading') return;
    if (s === 'title') return this.start();
    if (s === 'play') { if (c === 'Escape' || c === 'KeyP') this.pause(); return; }
    if (s === 'select') return this.selectKey(c);
    if (c === 'Escape' || c === 'Backspace') { if (s !== 'menu') this.back(); return; }
    this.navKey(c);
  }

  navKey(c) {
    const items = this.navItems(); if (!items.length) return;
    const a = document.activeElement;
    let i = items.findIndex((el) => el === a || el.contains(a));
    const UP = ['ArrowUp', 'KeyW'], DOWN = ['ArrowDown', 'KeyS'], LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], OK = ['Enter', 'Space', 'KeyF', 'NumpadEnter', 'Numpad0'];
    const cur = items[i];
    const isOpt = cur && cur.classList.contains('opt');
    const horizontalRow = cur && cur.parentElement && (cur.parentElement.classList.contains('row') || cur.parentElement.classList.contains('modes') || cur.parentElement.classList.contains('langs'));
    if (isOpt && (LEFT.includes(c) || RIGHT.includes(c))) return this.optStep(cur, RIGHT.includes(c) ? 1 : -1);
    if (DOWN.includes(c) || (horizontalRow && RIGHT.includes(c))) { this.focus(items[(i + 1) % items.length]); this.audio.play('ui'); }
    else if (UP.includes(c) || (horizontalRow && LEFT.includes(c))) { this.focus(items[(i - 1 + items.length) % items.length]); this.audio.play('ui'); }
    else if (OK.includes(c) && cur && !isOpt) cur.click();
  }
  /** Gamepad menu navigation (called every frame). */
  padNav() {
    for (const { pad, button } of this.input.padPresses()) {
      const map = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 1: 'Escape', 9: 'Escape' };
      if (this.screen === 'select') {
        const k = pad === 0 ? KEYS.p1 : KEYS.p2;
        const m = { 12: k.jump[0], 13: pad === 0 ? 'KeyS' : 'ArrowDown', 14: k.left[0], 15: k.right[0], 0: pad === 0 ? 'KeyF' : 'Enter', 1: pad === 0 ? 'KeyQ' : 'ShiftRight' }[button];
        if (m) this.selectKey(m);
      } else if (this.screen === 'play') { if (button === 9) this.pause(); }
      else if (map[button]) { this.audio.unlock(); if (this.screen === 'title') this.start(); else if (map[button] === 'Escape') { if (this.screen !== 'menu') this.back(); } else this.navKey(map[button]); }
    }
  }

  // ----------------------------------------------------------- language etc
  buildLangs() {
    const box = $('#langs');
    box.innerHTML = Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" class="${k === getLang() ? 'on' : ''}">${v}</button>`).join('');
    box.onclick = (e) => { const b = e.target.closest('[data-lang]'); if (b) this.setLanguage(b.dataset.lang); };
  }
  setLanguage(l) {
    this.settings.lang = setLang(l); this.save(); applyDom(); this.buildLangs(); this.buildHowTo();
    if (this.screen === 'settings') this.buildSettings();
    this.audio.play('ui');
  }

  // ------------------------------------------------------------------ options
  /** Build an option row. kind 'seg' (choices) or 'range'. */
  opt(label, kind, value, choices, onChange) {
    const row = document.createElement('div'); row.className = 'opt'; row.tabIndex = 0;
    const lab = document.createElement('span'); lab.textContent = label; row.appendChild(lab);
    if (kind === 'range') {
      const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 100; r.step = 5; r.value = value; r.tabIndex = -1;
      r.oninput = () => onChange(+r.value); row.appendChild(r); row._step = (d) => { r.value = +r.value + d * 5; onChange(+r.value); };
    } else {
      const seg = document.createElement('div'); seg.className = 'seg';
      choices.forEach(([v, text]) => { const b = document.createElement('button'); b.textContent = text; b.tabIndex = -1; if (v === value) b.className = 'on'; b.onclick = () => { $$('button', seg).forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(v); this.audio.play('ui'); }; seg.appendChild(b); });
      row.appendChild(seg);
      row._step = (d) => { const bs = $$('button', seg); const i = bs.findIndex((b) => b.classList.contains('on')); bs[Math.max(0, Math.min(bs.length - 1, i + d))].click(); };
    }
    return row;
  }
  optStep(row, d) { if (row._step) row._step(d); }

  buildSettings() {
    const s = this.settings, box = $('#settingsOpts'); box.innerHTML = '';
    const onOff = [[true, t('on')], [false, t('off')]];
    box.append(
      this.opt(t('language'), 'seg', s.lang, Object.entries(LANGS), (v) => this.setLanguage(v)),
      this.opt(t('music'), 'range', s.music, null, (v) => { s.music = v; this.applyAudio(); this.save(); }),
      this.opt(t('sfx'), 'range', s.sfx, null, (v) => { s.sfx = v; this.applyAudio(); this.save(); this.audio.play('kick'); }),
      this.opt(t('mute'), 'seg', s.muted, onOff, (v) => { s.muted = v; this.applyAudio(); this.save(); }),
      this.opt(t('shake'), 'seg', s.shake, onOff, (v) => { s.shake = v; this.fx.shakeOn = v; this.save(); }),
      this.opt(t('touch'), 'seg', s.touch, [['auto', t('auto')], ['on', t('on')], ['off', t('off')]], (v) => { s.touch = v; this.save(); }),
      this.opt(t('hints'), 'seg', s.hints, onOff, (v) => { s.hints = v; this.save(); }),
    );
  }

  buildSetup() {
    const s = this.settings, box = $('#setupOpts'); box.innerHTML = '';
    box.append(
      this.opt(t('time'), 'seg', s.time, MATCH.times.map((v) => [v, `${v}s`]), (v) => { s.time = v; this.save(); }),
      this.opt(t('goalLimit'), 'seg', s.goalLimit, MATCH.goalLimits.map((v) => [v, v ? String(v) : t('noLimit')]), (v) => { s.goalLimit = v; this.save(); }),
      this.opt(t('suddenDeath'), 'seg', s.sudden, [[true, t('on')], [false, t('off')]], (v) => { s.sudden = v; this.save(); }),
    );
    const sel = this.sel;
    if (sel && sel.slots.some((x) => x.controller === 'ai' || x.mate)) {
      box.append(this.opt(t('difficulty'), 'seg', s.difficulty, [['easy', t('easy')], ['medium', t('medium')], ['hard', t('hard')]], (v) => { s.difficulty = v; this.save(); }));
    }
    if (sel) sel.slots.forEach((slot, i) => {
      if (!slot.mate) return;
      const pads = [['ai', t('cpu')], ['pad2', t('gamepad', { n: 3 })], ['pad3', t('gamepad', { n: 4 })]];
      box.append(this.opt(`${t('teammate')} (${tr(TEAM_BY_ID[sel.flags[slot.team]].name)})`, 'seg', slot.controller, pads, (v) => { slot.controller = v; slot.tag = v === 'ai' ? 'CPU' : `P${v === 'pad2' ? 3 : 4}`; }));
    });
  }

  buildHowTo() {
    const k = (codes) => codes.map((c) => `<kbd>${this.input.label(c)}</kbd>`).join(' ');
    const row = (label, a, b) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td></tr>`;
    $('#howKeys').innerHTML = `<table class="keytable"><tr><th></th><th>${t('player', { n: 1 })}</th><th>${t('player', { n: 2 })}</th></tr>
      ${row(t('move'), k([...KEYS.p1.left, ...KEYS.p1.right]), k([...KEYS.p2.left, ...KEYS.p2.right]))}
      ${row(t('jumpK'), k(KEYS.p1.jump), k(KEYS.p2.jump))}
      ${row(t('kickK'), k(KEYS.p1.kick), k(['Numpad0', 'Enter']))}
      ${row(t('skillK'), k(KEYS.p1.skill), k(KEYS.p2.skill))}
      ${row(t('pauseK'), k(['Escape']) + ' / <kbd>P</kbd>', '')}
      ${row(t('muteK'), '<kbd>M</kbd>', '')}</table>`;
    const box = $('#howSkills'); box.innerHTML = '';
    for (const id of SKILL_IDS) {
      const d = SKILLS[id], div = document.createElement('div');
      const c = document.createElement('canvas'); c.width = c.height = 80; iconTo(c, d);
      const txt = document.createElement('span'); txt.innerHTML = `<b>${tr(d.name)}</b>${tr(d.desc)}`;
      div.append(c, txt); box.appendChild(div);
    }
  }

  // ------------------------------------------------------------------ select
  startSelect(mode, keepPicks) {
    const roster = this.roster;
    const old = keepPicks && this.sel && this.sel.mode === mode ? this.sel : null;
    const slots = old ? old.slots : defaultSlots(mode);
    const pickFor = (id) => ({ char: id, skill: (roster.find((c) => c.id === id) || roster[0]).skill });
    const ids = roster.map((c) => c.id);
    const randomChar = (taken) => { const free = ids.filter((x) => !taken.includes(x)); return free[Math.floor(Math.random() * free.length)] || ids[0]; };
    let picks;
    if (old) picks = old.picks;
    else {
      const first = ids.includes('captain-carthage') ? 'captain-carthage' : ids[0];
      const second = MODES[mode].humans === 2 ? (ids.includes('samba-king') ? 'samba-king' : ids[1]) : randomChar([first]);
      picks = [pickFor(first), pickFor(second)];
      while (picks.length < slots.length) picks.push(pickFor(randomChar(picks.map((p) => p.char))));
    }
    this.sel = { mode, slots, picks, flags: old ? old.flags : ['tunisia', 'brazil'], ready: slots.map(() => false), cursor: { kb1: { slot: 0, row: 0 }, kb2: { slot: 1, row: 0 } } };
    if (MODES[mode].humans === 1) this.sel.cursor.kb2 = null;
    this.buildCards();
    this.show('select');
  }

  queue(owner) { return this.sel.slots.map((s, i) => i).filter((i) => this.sel.slots[i].owner === owner); }
  rows(i) { return this.sel.slots[i].idx === 0 ? ['char', 'team', 'skill'] : ['char', 'skill']; }

  buildCards() {
    const sel = this.sel, box = $('#cards');
    box.classList.toggle('four', sel.slots.length === 4);
    box.innerHTML = '';
    // order cards left team first
    const order = sel.slots.map((s, i) => i).sort((a, b) => sel.slots[a].team - sel.slots[b].team || sel.slots[a].idx - sel.slots[b].idx);
    for (const i of order) {
      const s = sel.slots[i];
      const card = document.createElement('div'); card.className = `card t${s.team}`; card.dataset.slot = i;
      card.innerHTML = `<div class="who"></div><canvas width="480" height="300"></canvas>
        ${this.rows(i).map((r) => `<div class="chooser" data-row="${r}"><button data-d="-1" aria-label="previous">‹</button><div class="val"></div><button data-d="1" aria-label="next">›</button></div>`).join('')}
        <div class="stats"></div><div class="skilldesc"></div><button class="ok"></button><div class="keys"></div>`;
      card.addEventListener('click', (e) => {
        const btn = e.target.closest('.chooser button'); if (btn) { this.change(i, btn.parentElement.dataset.row, +btn.dataset.d); return; }
        if (e.target.closest('.ok')) this.toggleReady(i);
      });
      box.appendChild(card);
    }
    this.renderCards();
  }

  change(i, row, d) {
    const sel = this.sel; if (sel.ready[i]) return;
    const pick = sel.picks[i], s = sel.slots[i];
    if (row === 'char') {
      const ids = this.roster.map((c) => c.id); const k = (ids.indexOf(pick.char) + d + ids.length) % ids.length;
      pick.char = ids[k]; pick.skill = this.roster[k].skill;
    } else if (row === 'team') {
      const ids = TEAMS.map((x) => x.id); let k = ids.indexOf(sel.flags[s.team]);
      do { k = (k + d + ids.length) % ids.length; } while (ids[k] === sel.flags[1 - s.team]);
      sel.flags[s.team] = ids[k];
    } else if (row === 'skill') {
      const k = (SKILL_IDS.indexOf(pick.skill) + d + SKILL_IDS.length) % SKILL_IDS.length; pick.skill = SKILL_IDS[k];
    }
    this.audio.play('ui'); this.renderCards();
  }

  toggleReady(i) {
    const sel = this.sel; sel.ready[i] = !sel.ready[i];
    this.audio.play(sel.ready[i] ? 'confirm' : 'back');
    // advance the owner's cursor to their next unready card
    for (const owner of ['kb1', 'kb2']) {
      const cur = sel.cursor[owner]; if (!cur) continue;
      const q = this.queue(owner).filter((j) => !sel.ready[j]);
      if (sel.ready[i] && cur.slot === i && q.length) { cur.slot = q[0]; cur.row = 0; }
      if (!sel.ready[i] && this.queue(owner).includes(i)) { cur.slot = i; cur.row = 0; }
    }
    // in 1 Player mode, Player 1 also sets up the CPU side: after their own card, move to the CPU card
    this.renderCards();
    if (sel.ready.every(Boolean)) setTimeout(() => { if (this.screen === 'select' && this.sel.ready.every(Boolean)) { this.audio.play('select'); this.show('setup'); } }, 450);
  }

  selectKey(code) {
    const sel = this.sel; if (!sel) return;
    if (code === 'Escape' || code === 'Backspace') return this.back();
    const maps = { kb1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', ok: ['KeyF', 'Space'], cancel: 'KeyQ' }, kb2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', ok: ['Enter', 'NumpadEnter', 'Numpad0', 'Digit0'], cancel: 'ShiftRight' } };
    for (const owner of ['kb1', 'kb2']) {
      const cur = sel.cursor[owner], m = maps[owner]; if (!cur) continue;
      const rows = this.rows(cur.slot);
      if (code === m.up) { cur.row = (cur.row - 1 + rows.length) % rows.length; this.audio.play('ui'); }
      else if (code === m.down) { cur.row = (cur.row + 1) % rows.length; this.audio.play('ui'); }
      else if (code === m.left || code === m.right) this.change(cur.slot, rows[cur.row], code === m.right ? 1 : -1);
      else if (m.ok.includes(code)) { if (!sel.ready[cur.slot]) this.toggleReady(cur.slot); }
      else if (code === m.cancel) { const done = this.queue(owner).filter((j) => sel.ready[j]); if (done.length) this.toggleReady(done[done.length - 1]); else if (owner === 'kb1') this.back(); }
      else continue;
      this.renderCards();
    }
  }

  renderCards() {
    const sel = this.sel;
    for (const card of $$('#cards .card')) {
      const i = +card.dataset.slot, s = sel.slots[i], pick = sel.picks[i];
      const ch = this.roster.find((c) => c.id === pick.char) || this.roster[0];
      const skill = SKILLS[pick.skill];
      const owner = ['kb1', 'kb2'].find((o) => sel.cursor[o] && sel.cursor[o].slot === i);
      card.classList.toggle('active', !!owner && !sel.ready[i]);
      card.classList.toggle('ready', sel.ready[i]);
      $('.who', card).textContent = s.controller === 'ai' ? (s.mate ? `${t('teammate')} · ${t('cpu')}` : t('cpu')) : s.mate ? t('teammate') : t('player', { n: s.tag.slice(1) });
      for (const ch2 of $$('.chooser', card)) {
        const row = ch2.dataset.row, val = $('.val', ch2);
        ch2.classList.toggle('focus', !!owner && sel.cursor[owner].row === this.rows(i).indexOf(row) && !sel.ready[i]);
        $$('button', ch2).forEach((b) => { b.disabled = sel.ready[i]; });
        if (row === 'char') val.innerHTML = `<span><span class="lab">${t('character')}</span>${esc(ch.name)}</span>`;
        if (row === 'team') { const tm = TEAM_BY_ID[sel.flags[s.team]]; val.innerHTML = `<canvas width="60" height="60"></canvas><span><span class="lab">${t('team')}</span>${tr(tm.name)}</span>`; const c = $('canvas', val), x = c.getContext('2d'); drawFlagBadge(x, tm.id, 30, 30, 24); }
        if (row === 'skill') { val.innerHTML = `<canvas width="60" height="60"></canvas><span><span class="lab">${t('skill')}</span>${tr(skill.name)}</span>`; iconTo($('canvas', val), skill); }
      }
      const meter = (n) => `<span class="meter">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`;
      $('.stats', card).innerHTML = ['speed', 'jump', 'kick', 'size'].map((k) => `<span>${t(k)}</span>${meter(ch.stats[k])}`).join('');
      $('.skilldesc', card).textContent = tr(skill.desc);
      $('.ok', card).textContent = sel.ready[i] ? t('ready') : t('confirm');
      const m = s.owner === 'kb1' ? KEYS.p1 : KEYS.p2;
      const kk = (c) => `<kbd>${this.input.label(c)}</kbd>`;
      $('.keys', card).innerHTML = s.owner === 'kb1' ? `${kk('KeyW')}${kk('KeyS')} ${kk('KeyA')}${kk('KeyD')} · ${kk('KeyF')} ${t('confirm')}` : `${kk('ArrowUp')}${kk('ArrowDown')} ${kk('ArrowLeft')}${kk('ArrowRight')} · ${kk('Enter')} ${t('confirm')}`;
      void m;
      this.drawCardPreview($('canvas', card), ch, TEAM_BY_ID[sel.flags[s.team]].kit, s.team === 0 ? 1 : -1, sel.ready[i]);
    }
  }

  drawCardPreview(c, ch, kit, facing, happy) {
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const fake = { id: 'preview' + ch.id, x: 240, y: 290, px: 240, py: 290, vx: 0, vy: 0, size: 1.5, scale: 1, kit, facing, char: ch, onGround: true, legAngle: 0.15,
      kick: { t: 0 }, emotion: happy ? 'happy' : 'normal', frozen: 0, stun: 0, reversed: 0, aura: null, controller: 'kb1', tag: '', team: 0 };
    const game = { time: performance.now() / 1000, balls: [{ x: 240 + facing * 200, y: 120 }], phase: 'ready' };
    x.save(); x.translate(0, -GROUND * 0 ); x.translate(240 - 240, 290 - 290);
    x.save(); x.translate(240, 290); x.scale(1.0, 1.0); x.translate(-240, -290);
    this.renderer.drawPlayer(x, game, fake, 1);
    x.restore(); x.restore();
  }

  // ------------------------------------------------------------------ match
  startMatch(setup) {
    const sel = this.sel; if (!sel && !setup) return;
    const s = this.settings;
    setup = setup || { mode: sel.mode, teams: buildTeams(sel.slots, sel.picks, sel.flags, this.roster, s.difficulty), time: s.time, goalLimit: s.goalLimit, sudden: s.sudden, difficulty: s.difficulty };
    // fresh copies so a rematch never reuses state
    const teams = setup.teams.map((tm) => ({ ...tm, players: tm.players.map((p) => ({ ...p })) }));
    this.lastSetup = setup;
    this.fx.reset(); this.goalGlow = null; this.prevPhase = null;
    this.game = new Game({ teams, time: setup.time, goalLimit: setup.goalLimit, suddenDeath: setup.sudden, difficulty: setup.difficulty, emit: (type, d) => this.onEvent(type, d) });
    this.input.clear(); this.hintsT = s.hints ? 5 : 0;
    this.buildHints();
    this.audio.playMusic('match'); this.audio.crowd(true);
    this.history = [];
    this.show('play', false);
  }
  pause() { const g = this.game; if (!g || this.screen !== 'play' || g.phase === 'end') return; g.paused = true; this.input.clear(); this.audio.play('back'); this.show('pause', false); }
  resume() { const g = this.game; if (!g) return; g.paused = false; this.history = []; this.audio.play('confirm'); this.show('play', false); }
  quit(silent) {
    if (!silent) this.audio.play('back');
    this.game = null; this.fx.reset(); this.audio.crowd(false); this.history = []; $('#hints').hidden = true;
    if (!silent) this.show('menu', false);
  }

  buildHints() {
    const g = this.game;
    const card = (owner) => {
      const m = owner === 'kb1' ? KEYS.p1 : KEYS.p2;
      const k = (codes) => `<span class="ks">${codes.map((c) => `<kbd>${this.input.label(c)}</kbd>`).join('')}</span>`;
      return `${k([...m.left, ...m.right])}<span>${t('move')}</span>${k(m.jump)}<span>${t('jumpK')}</span>${k(owner === 'kb1' ? m.kick : ['Numpad0', 'Enter'])}<span>${t('kickK')}</span>${k(m.skill)}<span>${t('skillK')}</span>`;
    };
    const humans = g.players.filter((p) => p.controller.startsWith('kb'));
    $('#hintP1').innerHTML = humans.some((p) => p.controller.startsWith('kb1')) ? card('kb1') : '';
    $('#hintP2').innerHTML = humans.some((p) => p.controller.startsWith('kb2')) ? card('kb2') : '';
    $('#hints').hidden = !this.hintsT;
  }

  /** Game events -> sounds and visual effects. */
  onEvent(type, d) {
    const fx = this.fx, a = this.audio, g = this.game;
    switch (type) {
      case 'kick': a.play('kick', 0.6 + d.power / 2500); fx.sparks(d.x, d.y, '#ffffff', 8, 260); fx.addShake(2); break;
      case 'touch': if (d.part === 'head') { a.play('head'); fx.sparks(d.x, d.y, '#fff7c2', 5, 200); } else a.play('body'); break;
      case 'bounce': a.play('bounce', d.v); break;
      case 'post': a.play('post'); fx.sparks(d.x, d.y, '#ffffff', 12, 300); fx.addShake(5); a.cheer(0.5, 1.2); break;
      case 'net': a.play('net'); break;
      case 'jump': a.play('jump'); fx.dust(d.x, GROUND, 5); break;
      case 'land': a.play('land'); fx.dust(d.x, GROUND, 4); break;
      case 'swing': a.play('swing'); break;
      case 'goal': {
        const team = g.teams[d.team], kit = team.kit;
        fx.show(d.own ? t('ownGoal') : t('goal'), { size: 130, life: 2.2, color: '#ffd23d' });
        fx.confetti(d.x, d.y, [kit.shirt, kit.shorts, kit.trim || '#fff', '#ffd23d'], 160);
        fx.confetti(W / 2, H * 0.2, [kit.shirt, kit.shorts, '#ffffff'], 60);
        fx.addShake(18); fx.flash = 0.5; fx.flashColor = '#ffffff';
        this.goalGlow = d.team === 0 ? 1 : 0; setTimeout(() => { this.goalGlow = null; }, 2200);
        a.play('goal'); a.cheer(1, 3);
        break;
      }
      case 'golden': fx.show(t('golden'), { size: 90, life: 2, color: '#ffd23d' }); break;
      case 'whistle': if (d.kind === 'kickoff') { fx.show(t('go'), { size: 140, life: 0.8, color: '#c8ff4d' }); a.whistle(0.35); } else if (d.kind === 'golden') a.whistle(0.6); break;
      case 'end': a.play('end'); a.cheer(0.8, 3); fx.show(t('timeUp'), { size: 110, life: 1.5 }); setTimeout(() => this.showResults(d), 1700); break;
      case 'skill': {
        const p = g.players.find((q) => q.id === d.player); const def = SKILLS[d.id];
        a.play(d.sfx); fx.ring(p.x, p.y - 110, d.color, 140, 9, 0.5); fx.sparks(p.x, p.y - 110, d.color, 18, 380);
        fx.text(p.x, p.y - 190, tr(def.name).toUpperCase(), d.color, 22);
        break;
      }
      case 'skillDenied': { const p = g.players.find((q) => q.id === d.player); if (p && p.controller !== 'ai') a.play('denied'); break; }
      case 'fx': this.skillFx(d); break;
    }
  }

  skillFx(d) {
    const fx = this.fx, a = this.audio;
    switch (d.kind) {
      case 'portal': fx.ring(d.x, d.y, '#3ddcff', 70, 8, 0.5); fx.ring(d.x, d.y, '#ffffff', 45, 4, 0.4); fx.sparks(d.x, d.y, '#3ddcff', 14, 260); break;
      case 'ice': for (let i = 0; i < 18; i++) fx.trail(d.x + (Math.random() - 0.5) * 80, d.y + (Math.random() - 0.5) * 100, '#dff7ff', 'ice', 6); break;
      case 'shrink': fx.ring(d.x, d.y, '#b98bff', 20, 6, 0.4); break;
      case 'tornado': fx.ring(d.x, d.y, '#ffffff', 80, 5, 0.4); a.play('mega'); break;
      case 'fireKick': fx.sparks(d.x, d.y, '#ff7a1a', 26, 520); fx.addShake(8); a.play('fireKick'); break;
      case 'burn': fx.sparks(d.x, d.y, '#ff5a1f', 20, 380); fx.addShake(6); a.play('burn'); break;
      case 'ghost': fx.ring(d.x, d.y, '#d9d4ff', 90, 5, 0.5); break;
      case 'multi': fx.sparks(d.x, d.y, '#c8ff4d', 24, 420); break;
      case 'quake': for (let x = 0; x < W; x += 60) fx.dust(x, GROUND, 3); fx.addShake(24); break;
      case 'reverse': fx.ring(d.x, d.y, '#ff9a3d', 50, 5, 0.4); break;
    }
  }

  /** Called every frame from the main loop. */
  frame(dt) {
    const g = this.game;
    if (g && this.screen === 'play') {
      if (g.phase === 'ready' && this.prevPhase !== 'ready' && g.time > 0.1) this.fx.show(t('getReady'), { size: 100, life: 0.9, color: '#ffffff' });
      if (!this.prevPhase && g.phase === 'ready') this.fx.show(t('getReady'), { size: 100, life: 1.2, color: '#ffffff' });
      this.prevPhase = g.phase;
      if (this.hintsT > 0) { this.hintsT -= dt; $('#hints').style.opacity = Math.min(1, this.hintsT); if (this.hintsT <= 0) $('#hints').hidden = true; }
      // crowd reacts to chances near either goal
      this.chanceT -= dt;
      const b = g.ball;
      if (g.phase === 'play' && this.chanceT <= 0 && (b.x < 260 || b.x > W - 260) && Math.abs(b.vx) > 500) { this.audio.cheer(0.4, 1); this.chanceT = 2.5; }
    }
    if (this.screen === 'select') this.renderCardsAnim = (this.renderCardsAnim || 0) + dt;
    this.padNav();
  }

  showResults(r) {
    const g = this.game; if (!g) return;
    const title = $('#resTitle');
    const name = (ti) => tr(TEAM_BY_ID[g.teams[ti].flag].name);
    title.textContent = r.winner == null ? t('draw') : t('win', { team: name(r.winner) });
    title.style.color = r.winner == null ? '#ffffff' : '#ffd23d';
    if (r.winner != null) this.audio.play('victory');
    // canvas: both teams, players' heads with their mood, big score
    const c = $('#resCanvas'), x = c.getContext('2d');
    x.direction = 'ltr';
    x.clearRect(0, 0, c.width, c.height);
    [0, 1].forEach((ti) => {
      const cx = ti === 0 ? 170 : 730;
      drawFlag(x, g.teams[ti].flag, cx - 75, 20, 150, 100);
      x.strokeStyle = '#1d1230'; x.lineWidth = 6; x.strokeRect(cx - 75, 20, 150, 100);
      const ps = g.players.filter((p) => p.team === ti);
      ps.forEach((p, k) => drawHead(x, p.char, cx + (k - (ps.length - 1) / 2) * 110, 210, 62, { facing: ti === 0 ? 1 : -1, emotion: r.winner == null ? 'normal' : r.winner === ti ? 'happy' : 'sad' }));
    });
    x.font = '900 120px Unbounded, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 14; x.strokeStyle = '#1d1230'; x.strokeText(`${r.score[0]} : ${r.score[1]}`, 450, 150);
    x.fillStyle = '#ffffff'; x.fillText(`${r.score[0]} : ${r.score[1]}`, 450, 150);
    const scorers = g.players.filter((p) => p.goals > 0 || p.ownGoals > 0).map((p) => `⚽ ${esc(p.char.name)} × ${p.goals}${p.ownGoals ? ` (${t('ownGoal')} × ${p.ownGoals})` : ''}`).join(' · ');
    $('#resScorers').innerHTML = scorers ? `${t('goals')}: ${scorers}` : '';
    this.audio.crowd(false); this.audio.playMusic(null);
    this.show('results', false);
  }
}

function iconTo(c, def) {
  const x = c.getContext('2d'), r = c.width / 2;
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#1d1230'; x.beginPath(); x.arc(r, r, r * 0.96, 0, Math.PI * 2); x.fill();
  x.fillStyle = def.color; x.globalAlpha = 0.35; x.beginPath(); x.arc(r, r, r * 0.86, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  x.save(); x.translate(r, r); def.icon(x, r * 0.6); x.restore();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
