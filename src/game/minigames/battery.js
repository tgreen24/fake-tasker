export const CHARGE_MS = 5000;
// Letting go drains it, slower than it filled, so it has to be held rather
// than tapped at.
export const DRAIN_MS = 10000;

export function chargeAfter(level, holding, elapsedMs) {
  if (level >= 1) return 1;
  if (holding) return Math.min(1, level + elapsedMs / CHARGE_MS);
  return Math.max(0, level - elapsedMs / DRAIN_MS);
}
