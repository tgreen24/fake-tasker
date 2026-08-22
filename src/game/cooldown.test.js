import {
  remainingCooldownSeconds, cooldownExpiryFor, pauseCooldowns, resumeCooldowns,
  isTicking, SABOTAGE_COOLDOWN_SECONDS
} from './cooldown';

const NOW = 1_000_000;
const MAX = SABOTAGE_COOLDOWN_SECONDS;

describe('remainingCooldownSeconds', () => {
  test('is zero when nothing was recorded', () => {
    expect(remainingCooldownSeconds(undefined, 30, NOW)).toBe(0);
  });

  test('counts down a running cooldown', () => {
    expect(remainingCooldownSeconds({ until: NOW + 12_000 }, 30, NOW)).toBe(12);
  });

  test('is zero once elapsed', () => {
    expect(remainingCooldownSeconds({ until: NOW - 1 }, 30, NOW)).toBe(0);
  });

  test('a frozen cooldown does not move with the clock', () => {
    const frozen = { remainingMs: 45_000 };
    expect(remainingCooldownSeconds(frozen, MAX, NOW)).toBe(45);
    expect(remainingCooldownSeconds(frozen, MAX, NOW + 600_000)).toBe(45);
  });

  test('a slow clock cannot stretch it past its configured length', () => {
    expect(remainingCooldownSeconds({ until: NOW + 600_000 }, 30, NOW)).toBe(30);
  });

  test('a fast clock clears it early rather than wedging', () => {
    expect(remainingCooldownSeconds({ until: NOW + 5_000 }, 30, NOW + 60_000)).toBe(0);
  });

  test('still understands the older bare-timestamp shape', () => {
    expect(remainingCooldownSeconds(NOW + 10_000, 30, NOW)).toBe(10);
  });
});

// The reported problem: a two minute meeting served the whole sabotage
// cooldown while nobody was playing.
describe('a meeting does not serve the cooldown', () => {
  test('freezes what is left when the meeting is called', () => {
    const running = { rae: cooldownExpiryFor(MAX, NOW) };
    expect(pauseCooldowns(running, NOW + 30_000)).toEqual({ rae: { remainingMs: 90_000 } });
  });

  test('a meeting of any length costs the cooldown nothing', () => {
    const paused = pauseCooldowns({ rae: cooldownExpiryFor(MAX, NOW) }, NOW + 30_000);
    const meetingEnd = NOW + 30_000 + 120_000;
    const resumed = resumeCooldowns(paused, meetingEnd);
    expect(remainingCooldownSeconds(resumed.rae, MAX, meetingEnd)).toBe(90);
  });

  test('gameplay after the meeting resumes the countdown', () => {
    const paused = pauseCooldowns({ rae: cooldownExpiryFor(MAX, NOW) }, NOW + 30_000);
    const meetingEnd = NOW + 200_000;
    const resumed = resumeCooldowns(paused, meetingEnd);
    expect(remainingCooldownSeconds(resumed.rae, MAX, meetingEnd + 40_000)).toBe(50);
  });

  test('drops anyone whose cooldown had already run out', () => {
    expect(pauseCooldowns({ rae: { until: NOW - 1 } }, NOW)).toEqual({});
    expect(resumeCooldowns({ rae: { remainingMs: 0 } }, NOW)).toEqual({});
  });

  test('handles nobody being on cooldown', () => {
    expect(pauseCooldowns(undefined, NOW)).toEqual({});
    expect(resumeCooldowns(undefined, NOW)).toEqual({});
  });
});

describe('isTicking', () => {
  test('separates running from frozen, so the clock only ticks when it must', () => {
    expect(isTicking({ until: NOW + 1000 })).toBe(true);
    expect(isTicking({ remainingMs: 1000 })).toBe(false);
    expect(isTicking(undefined)).toBe(false);
  });
});
