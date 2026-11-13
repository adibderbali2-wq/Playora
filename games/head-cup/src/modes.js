// Game modes and how their player slots are filled.
// A slot = one player on the pitch. `owner` = which keyboard player edits it on the select screen.
import { TEAM_BY_ID } from './teams.js';

export const MODES = {
  '1p': { id: '1p', title: 'onePlayer', sub: 'vsCpu', teamSize: 1, humans: 1 },
  '2p': { id: '2p', title: 'twoPlayers', sub: 'vsFriend', teamSize: 1, humans: 2 },
  '2v2': { id: '2v2', title: 'twoVsTwo', sub: 'teamMode', teamSize: 2, humans: 2 },
};

/** Default slots for a mode. Player 1 also accepts gamepad 1, Player 2 gamepad 2. */
export function defaultSlots(mode) {
  const m = MODES[mode];
  const slots = [
    { team: 0, idx: 0, owner: 'kb1', controller: 'kb1+pad0', tag: 'P1' },
    m.humans === 1
      ? { team: 1, idx: 0, owner: 'kb1', controller: 'ai', tag: 'CPU' }
      : { team: 1, idx: 0, owner: 'kb2', controller: 'kb2+pad1', tag: 'P2' },
  ];
  if (m.teamSize === 2) {
    slots.push({ team: 0, idx: 1, owner: 'kb1', controller: 'ai', tag: 'CPU', mate: true });
    slots.push({ team: 1, idx: 1, owner: 'kb2', controller: 'ai', tag: 'CPU', mate: true });
  }
  return slots;
}

/** Turn the select-screen choices into the `teams` array the Game expects. */
export function buildTeams(slots, picks, flags, roster, difficulty) {
  const teams = [0, 1].map((ti) => ({ flag: flags[ti], kit: TEAM_BY_ID[flags[ti]].kit, players: [] }));
  // if both teams wear similar shirts, the right team switches to its shorts colour for readability
  if (sameish(teams[0].kit.shirt, teams[1].kit.shirt)) teams[1].kit = { ...teams[1].kit, shirt: teams[1].kit.shorts, shorts: teams[1].kit.shirt };
  slots.forEach((s, i) => {
    const pick = picks[i];
    teams[s.team].players.push({
      char: roster.find((c) => c.id === pick.char) || roster[0], skill: pick.skill,
      controller: s.controller, difficulty, tag: s.controller === 'ai' ? 'CPU' : s.tag,
    });
  });
  for (const t of teams) t.players.sort((a, b) => (a.controller === 'ai') - (b.controller === 'ai'));
  return teams;
}

function sameish(a, b) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
}
