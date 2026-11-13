// Characters: loads characters.json, converts 1-5 stats into physics numbers, and loads custom head images.

/** Stats 1..5 -> physics. Keeps every character inside a fair range. */
export function statsToPhysics(s = {}) {
  const v = (k) => Math.max(1, Math.min(5, Number(s[k]) || 3));
  return {
    speed: 300 + v('speed') * 45, // 345 .. 525 px/s
    jump: 720 + v('jump') * 48, // 768 .. 960 px/s
    kick: 930 + v('kick') * 105, // 1035 .. 1455 px/s
    size: 0.9 + v('size') * 0.05, // 0.95 .. 1.15 head scale
  };
}

/** Fill in missing look fields so hand-written JSON entries never crash the renderer. */
export function normalize(c, i) {
  const look = c.look || {};
  return {
    id: c.id || 'player-' + i,
    name: c.name || 'Player ' + (i + 1),
    skill: c.skill || 'fireball',
    stats: { speed: 3, jump: 3, kick: 3, size: 3, ...(c.stats || {}) },
    image: c.image || null,
    look: {
      skin: '#d9a066', face: 'round', brows: 'normal', eyes: '#3a2412', nose: 'normal', mouth: 'smile',
      ...look,
      hair: { style: 'short', color: '#2a1a10', ...(look.hair || {}) },
      beard: { style: 'none', color: '#2a1a10', ...(look.beard || {}) },
      accessory: { type: 'none', ...(look.accessory || {}) },
    },
  };
}

export function parseRoster(json) {
  const list = Array.isArray(json) ? json : json.characters;
  if (!Array.isArray(list) || !list.length) throw new Error('characters.json has no characters');
  return list.map(normalize);
}

/** Browser: fetch the roster and any custom head images (a missing image falls back to the drawn head). */
export async function loadRoster(url = 'characters.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load ' + url);
  const roster = parseRoster(await res.json());
  await Promise.all(roster.filter((c) => c.image).map((c) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { c.img = img; resolve(); };
    img.onerror = () => { console.warn(`Head image not found for ${c.name}: ${c.image}. Using the drawn head.`); resolve(); };
    img.src = c.image;
  })));
  return roster;
}
