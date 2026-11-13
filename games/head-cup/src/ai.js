// CPU opponents. (Filled in by the AI milestone.)
export class AIController {
  constructor(game, player, difficulty) { this.game = game; this.p = player; this.difficulty = difficulty; }
  idle() { for (const k in this.p.input) this.p.input[k] = false; }
  update() { this.idle(); }
}
