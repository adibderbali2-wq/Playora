// Skill system. Each skill is one module in this folder exporting a plain object:
//   { id, name: {en, fr, ar}, desc: {en, fr, ar}, color, cooldown, duration, uses, sfx, target,
//     icon(ctx, r),                      // draws the icon centred at 0,0 with radius r
//     activate(game, player, state) -> bool (false = could not activate, use not consumed)
//     update?(game, player, state, dt),  // every step while active
//     modify?(game, player, mods),       // tweak speed/kick/jump multipliers while active
//     onKick?(game, player, ball, state),// owner kicked a ball while active
//     end?(game, player, state) }        // cleanup when the duration runs out (or on reset)
// To add a skill: create a file here and add it to SKILL_MODULES below.

export const SKILL_MODULES = [];
export const SKILLS = Object.fromEntries(SKILL_MODULES.map((s) => [s.id, s]));
export const SKILL_IDS = SKILL_MODULES.map((s) => s.id);

export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.state = new Map(); // player id -> { def, uses, charge, active, t, data }
    for (const p of game.players) {
      const def = SKILLS[p.skillId] || SKILL_MODULES[0] || null;
      if (def) p.skillId = def.id;
      this.state.set(p.id, { def, uses: def ? def.uses : 0, charge: def ? def.cooldown : 0, active: false, t: 0, data: {} });
    }
  }

  get(p) { return this.state.get(p.id); }

  /** Ready = charged, uses left, not already running. */
  ready(p) { const s = this.get(p); return !!(s && s.def) && !s.active && s.uses > 0 && s.charge <= 0; }

  tryActivate(p) {
    const s = this.get(p);
    if (!this.ready(p)) { this.game.emit('skillDenied', { player: p.id }); return false; }
    s.data = {};
    const ok = s.def.activate(this.game, p, s);
    if (ok === false) { this.game.emit('skillDenied', { player: p.id }); return false; }
    s.uses--; s.active = s.def.duration > 0; s.t = 0;
    this.game.emit('skill', { player: p.id, id: s.def.id, sfx: s.def.sfx, color: s.def.color, x: p.x, y: p.y });
    if (!s.active && s.def.end) s.def.end(this.game, p, s);
    return true;
  }

  update(dt) {
    const g = this.game;
    for (const p of g.players) {
      const s = this.get(p);
      if (s.charge > 0) s.charge = Math.max(0, s.charge - dt);
      if (!s.active) continue;
      s.t += dt;
      if (s.def.modify) s.def.modify(g, p, p.mods, s);
      if (s.def.update) s.def.update(g, p, s, dt);
      if (s.t >= s.def.duration) this.stop(p);
    }
  }

  stop(p) {
    const s = this.get(p);
    if (!s.active) return;
    s.active = false;
    if (s.def.end) s.def.end(this.game, p, s);
    this.game.emit('skillEnd', { player: p.id, id: s.def.id });
  }

  /** Called when positions reset after a goal: running skills end so nothing carries over unfairly. */
  onReset() { for (const p of this.game.players) this.stop(p); }

  /** Any player touched a ball: lets skills react (e.g. a burning ball knocks opponents back). */
  onTouch(ball, p, part) {
    for (const def of SKILL_MODULES) if (def.onBallTouch) def.onBallTouch(this.game, ball, p, part);
  }

  /** Owner-kick hook used by kick-modifying skills (Fireball, Ghost Ball, Mega Strength). */
  onKick(ball, p) {
    const s = this.get(p);
    if (s && s.active && s.def.onKick) s.def.onKick(this.game, p, ball, s);
  }
}
