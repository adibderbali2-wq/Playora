// HEAD CUP — global constants. World units are pixels of a fixed 1280 x 720 stage.
export const W = 1280;
export const H = 720;
export const GROUND = 612; // y of the pitch surface where feet and the ball rest
export const STEP = 1 / 120; // fixed physics timestep (seconds)

// Goals. The left goal's mouth spans x = 0..GOAL_LINE; the right goal mirrors it.
export const GOAL_LINE = 96; // ball must fully cross this line (and be under the bar) to score
export const CROSSBAR_Y = 402; // underside of the crossbar
export const BAR_R = 7; // crossbar thickness (radius of its capsule)
// The crossbar/roof capsule slopes slightly toward the pitch so a ball never rests on top of the goal.
export const ROOF = { x0: 0, y0: 386, x1: 104, y1: CROSSBAR_Y - BAR_R };

export const PHYS = {
  gravity: 1550, // ball gravity
  playerGravity: 2300, // snappy jumps
  ballRadius: 21,
  maxBallSpeed: 2500,
  groundBounce: 0.66,
  wallBounce: 0.78,
  ceilingBounce: 0.6,
  rollFriction: 1.1, // per second, while rolling on the ground
  airDrag: 0.04,
  headBounce: 0.62,
  bodyBounce: 0.42,
  footBounce: 0.32,
};

// Player body proportions (multiplied by the character's size and temporary shrink effects)
export const BODY = {
  headR: 44, // big cartoon head
  neck: 52, // feet -> head centre distance is neck + headR*0.75
  bodyR: 22,
  footR: 14,
  legLen: 38,
  hipY: 30,
};

export const MATCH = {
  times: [30, 60, 90, 120],
  defaultTime: 60,
  goalLimits: [0, 3, 5, 7], // 0 = no limit
  readyTime: 1.6,
  celebrateTime: 2.6,
  kickoffDelay: 0.8,
};

// Keyboard bindings (KeyboardEvent.code = physical key, works on AZERTY/QWERTY alike)
export const KEYS = {
  p1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], kick: ['KeyS', 'KeyF'], skill: ['KeyQ'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], kick: ['Numpad0', 'Digit0', 'Enter', 'NumpadEnter', 'ArrowDown'], skill: ['ShiftRight'] },
};
