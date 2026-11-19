import {
  CODE_ALPHABET, CODE_LENGTH, LOCKDOWN_SECONDS,
  buildLockdown, formatCode, linksOf, lockdownPartFor, lockdownProgress, lockdownVerdict, normalizeCode
} from './lockdown';

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function roundOf(taskerCount, traitorCount, killList = []) {
  const roleMap = {};
  const players = [];
  for (let i = 0; i < taskerCount; i++) {
    players.push(`T${i}`);
    roleMap[`T${i}`] = 'Crewmate';
  }
  for (let i = 0; i < traitorCount; i++) {
    players.push(`X${i}`);
    roleMap[`X${i}`] = 'Imposter';
  }
  return { players, killList, roleMap };
}

const isTraitor = (name) => name.startsWith('X');

describe('buildLockdown', () => {
  const shapes = [];
  for (let taskers = 2; taskers <= 18; taskers++) {
    for (let traitors = 1; traitors <= 4 && traitors < taskers; traitors++) shapes.push([taskers, traitors]);
  }

  test.each(shapes)('%i taskers and %i traitors: everyone alive gives or receives exactly once', (taskers, traitors) => {
    for (let seed = 1; seed <= 25; seed++) {
      const round = roundOf(taskers, traitors);
      const lockdown = buildLockdown(round, 0, seeded(seed));
      const roles = lockdown.pairs.flatMap((pair) => [pair.giver, ...pair.receivers]);
      expect(roles.slice().sort()).toEqual(round.players.slice().sort());
    }
  });

  test.each(shapes)('%i taskers and %i traitors: taskers can always lift it on their own', (taskers, traitors) => {
    for (let seed = 1; seed <= 25; seed++) {
      const lockdown = buildLockdown(roundOf(taskers, traitors), 0, seeded(seed));
      const solvable = linksOf(lockdown).filter((link) => !isTraitor(link.giver) && !isTraitor(link.receiver));
      expect(solvable.length).toBeGreaterThanOrEqual(lockdown.needed);
      expect(lockdown.needed).toBe(Math.max(1, Math.ceil(solvable.length / 2)));
    }
  });

  test('traitors are paired with each other when there are two or more', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const lockdown = buildLockdown(roundOf(9, 2), 0, seeded(seed));
      const traitorPair = lockdown.pairs.find((pair) => isTraitor(pair.giver));
      expect(traitorPair.receivers.some(isTraitor)).toBe(true);
    }
  });

  test('leaves out anyone already dead', () => {
    const lockdown = buildLockdown(roundOf(6, 1, ['T0', 'T1']), 0, seeded(3));
    const everyone = lockdown.pairs.flatMap((pair) => [pair.giver, ...pair.receivers]);
    expect(everyone).not.toContain('T0');
    expect(everyone).not.toContain('T1');
  });

  test('cannot start without two taskers left', () => {
    expect(buildLockdown(roundOf(2, 1, ['T0']), 0, seeded(1))).toBeNull();
  });

  test('codes are distinct, the right length and only use readable characters', () => {
    const lockdown = buildLockdown(roundOf(18, 4), 0, seeded(9));
    const codes = lockdown.pairs.map((pair) => pair.code);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((code) => {
      expect(code).toHaveLength(CODE_LENGTH);
      [...code].forEach((character) => expect(CODE_ALPHABET).toContain(character));
    });
  });

  test('runs for the lockdown length from when it was set off', () => {
    const lockdown = buildLockdown(roundOf(4, 1), 1000, seeded(2));
    expect(lockdown.until).toBe(1000 + LOCKDOWN_SECONDS * 1000);
  });
});

describe('progress and verdict', () => {
  const lockdown = {
    startedAt: 0,
    until: 90000,
    needed: 2,
    entered: {},
    pairs: [
      { giver: 'A', receivers: ['B'], code: 'AAAAAA' },
      { giver: 'C', receivers: ['D', 'E'], code: 'BBBBBB' },
      { giver: 'X', receivers: ['Y'], code: 'CCCCCC' }
    ]
  };

  test('counts each correct entry', () => {
    const game = { lockdown: { ...lockdown, entered: { B: true } }, killList: [] };
    expect(lockdownProgress(game).done).toBe(1);
    expect(lockdownVerdict(game, 1000)).toBeNull();
  });

  test('a pair with somebody killed in it counts as done without anyone entering', () => {
    const game = { lockdown, killList: ['C'] };
    expect(lockdownProgress(game).done).toBe(2);
    expect(lockdownVerdict(game, 1000)).toBe('lifted');
  });

  test('fails once the time is up without enough codes', () => {
    const game = { lockdown: { ...lockdown, entered: { B: true } }, killList: [] };
    expect(lockdownVerdict(game, 90000)).toBe('failed');
  });

  test('enough codes in time lifts it even if it is settled late', () => {
    const game = { lockdown: { ...lockdown, entered: { B: true, Y: true } }, killList: [] };
    expect(lockdownVerdict(game, 120000)).toBe('lifted');
  });

  test('nothing to decide without a lockdown', () => {
    expect(lockdownVerdict({ killList: [] }, 0)).toBeNull();
  });

  test('tells each player their part, and nothing to the dead', () => {
    const game = { lockdown: { ...lockdown, entered: { D: true } }, killList: ['Y'] };
    expect(lockdownPartFor(game, 'C')).toEqual({ kind: 'give', code: 'BBBBBB', to: ['D', 'E'] });
    expect(lockdownPartFor(game, 'D')).toEqual({ kind: 'receive', from: 'C', code: 'BBBBBB', entered: true });
    expect(lockdownPartFor(game, 'E').entered).toBe(false);
    expect(lockdownPartFor(game, 'Y')).toBeNull();
    expect(lockdownPartFor(game, 'Z')).toBeNull();
  });
});

describe('codes as typed', () => {
  test('ignores case, spaces and the dash', () => {
    expect(normalizeCode(' k7m-4qx ')).toBe('K7M4QX');
    expect(formatCode('K7M4QX')).toBe('K7M-4QX');
  });
});
