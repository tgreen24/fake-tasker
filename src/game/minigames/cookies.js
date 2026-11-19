import { shuffled } from '../random';

// More cookies each round.
export const COOKIE_ROUNDS = [
  { min: 3, max: 5 },
  { min: 5, max: 7 },
  { min: 7, max: 9 }
];
const SPREAD = 0.72;
const APART = 0.3;

// Spots on the plate, in units of its radius from the center, never close
// enough for two cookies to overlap and be counted as one.
function spots(count, random) {
  const placed = [];
  let tries = 0;
  while (placed.length < count && tries < 5000) {
    tries++;
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * SPREAD;
    const spot = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    if (placed.every((other) => Math.hypot(other.x - spot.x, other.y - spot.y) >= APART)) placed.push(spot);
  }
  return placed;
}

// Four answers, the right one among neighbours, so a glance is not enough.
function options(count, random) {
  const near = [count - 2, count - 1, count + 1, count + 2].filter((n) => n > 0);
  return shuffled([count, ...shuffled(near, random).slice(0, 3)], random);
}

export function makeCookieRound(round, random = Math.random) {
  const { min, max } = COOKIE_ROUNDS[round];
  const count = min + Math.floor(random() * (max - min + 1));
  return { count, spots: spots(count, random), options: options(count, random) };
}
