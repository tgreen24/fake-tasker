export const CUSHIONS = 3;
// Each round shuffles more, and faster.
export const REMOTE_ROUNDS = [
  { swaps: 4, swapMs: 500 },
  { swaps: 6, swapMs: 380 },
  { swaps: 8, swapMs: 300 }
];

// Pairs of spots to trade, never a spot with itself.
export function makeSwaps(random = Math.random, count = REMOTE_ROUNDS[0].swaps) {
  return Array.from({ length: count }, () => {
    const a = Math.floor(random() * CUSHIONS);
    const b = (a + 1 + Math.floor(random() * (CUSHIONS - 1))) % CUSHIONS;
    return [a, b];
  });
}

// spot[cushion] is where that cushion sits. Trades whatever is in two spots.
export function swapSpots(spot, [a, b]) {
  return spot.map((at) => (at === a ? b : at === b ? a : at));
}

// Which spot each cushion is in after the swaps, cushion i starting in spot i.
export function spotsAfter(swaps, count = CUSHIONS) {
  return swaps.reduce(swapSpots, Array.from({ length: count }, (_, i) => i));
}
