export const SABOTAGE_COOLDOWN_SECONDS = 120;

// A cooldown is meant to cost you playing time, so it only runs while the
// round is running. Two shapes: { until } is ticking, { remainingMs } is
// frozen for the duration of a meeting. A bare number is the older shape.
export function cooldownMsLeft(entry, now = Date.now()) {
  if (!entry) return 0;
  if (typeof entry === 'number') return entry - now;
  if (entry.remainingMs != null) return entry.remainingMs;
  if (entry.until != null) return entry.until - now;
  return 0;
}

// Expiry is stamped by whichever phone acted, so a reader's clock may disagree.
// Clamping to the configured length stops a slow clock turning a 30 second
// cooldown into a permanent one; a fast clock simply clears it early.
export function remainingCooldownSeconds(entry, maxSeconds, now = Date.now()) {
  if (!maxSeconds) return 0;
  const left = cooldownMsLeft(entry, now);
  if (left <= 0) return 0;
  return Math.ceil(Math.min(left, maxSeconds * 1000) / 1000);
}

export function cooldownExpiryFor(seconds, now = Date.now()) {
  return { until: now + seconds * 1000 };
}

export function isTicking(entry) {
  return !!entry && typeof entry !== 'number' && entry.remainingMs == null;
}

// Freeze every live cooldown at the moment a meeting is called.
export function pauseCooldowns(map = {}, now = Date.now()) {
  const paused = {};
  Object.keys(map).forEach((player) => {
    const left = cooldownMsLeft(map[player], now);
    if (left > 0) paused[player] = { remainingMs: left };
  });
  return paused;
}

// Restart them from where they stopped when the meeting ends.
export function resumeCooldowns(map = {}, now = Date.now()) {
  const resumed = {};
  Object.keys(map).forEach((player) => {
    const left = cooldownMsLeft(map[player], now);
    if (left > 0) resumed[player] = { until: now + left };
  });
  return resumed;
}
