export const GLASSES = 3;
// Full in two and a half seconds of pouring.
export const POUR_MS = 2500;
const BAND = 0.14;

// Where the lines are drawn on each glass: a band somewhere between half full
// and nearly full, so the stopping point moves every time.
export function makeBands(random = Math.random, count = GLASSES) {
  return Array.from({ length: count }, () => {
    const low = 0.5 + random() * (0.84 - BAND - 0.5);
    return { low, high: low + BAND };
  });
}

export const pourAfter = (level, elapsedMs) => level + elapsedMs / POUR_MS;

// 'filled' once it sits between the lines with the pouring stopped, 'spilled'
// once it goes over the top line, otherwise it can still be topped up.
export function glassVerdict(level, { low, high }) {
  if (level > high) return 'spilled';
  if (level >= low) return 'filled';
  return null;
}
