// The floor is a unit square, y downward; the dustpan sits along the bottom
// in the middle. A pile is pushed along with the finger when the finger
// passes over it, the way a broom moves dust.
export const DUST_PILES = 6;
export const PUSH_RADIUS = 0.11;
export const PAN = { left: 0.3, right: 0.7, top: 0.84 };

export function makeDust(random = Math.random, count = DUST_PILES) {
  const piles = [];
  let tries = 0;
  while (piles.length < count && tries < 5000) {
    tries++;
    const pile = { id: `dust-${piles.length}`, x: 0.12 + random() * 0.76, y: 0.1 + random() * 0.5 };
    if (piles.every((other) => Math.hypot(other.x - pile.x, other.y - pile.y) > 0.16)) piles.push(pile);
  }
  return piles;
}

const clamp = (value) => Math.min(0.97, Math.max(0.03, value));

export const inPan = ({ x, y }) => x >= PAN.left && x <= PAN.right && y >= PAN.top;

// Moves every pile the finger is touching by however far the finger moved.
export function push(piles, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return piles.map((pile) => {
    if (pile.swept || Math.hypot(pile.x - from.x, pile.y - from.y) > PUSH_RADIUS) return pile;
    const moved = { ...pile, x: clamp(pile.x + dx), y: clamp(pile.y + dy) };
    return inPan(moved) ? { ...moved, swept: true } : moved;
  });
}
