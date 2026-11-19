import { CHANGE_PROBLEMS, MONEY, formatMoney, makeChangeProblems, piecesFor } from './change';
import { MICROWAVE_ROUNDS, microwaveSequence } from './microwave';
import { CUSHIONS, makeSwaps, spotsAfter } from './remote';
import { CLEAN_ENOUGH, isClean, makeGrime } from './dishes';
import { WINDOWS, nextLight } from './lights';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('change is always owed, and the drawer always holds enough to make it', () => {
  seeds.forEach((seed) => {
    const problems = makeChangeProblems(seeded(seed));
    expect(problems).toHaveLength(CHANGE_PROBLEMS);
    problems.forEach(({ price, paid, change }) => {
      expect(paid).toBeGreaterThan(price);
      expect(change).toBe(paid - price);
      expect(piecesFor(change)).not.toBeNull();
    });
  });
  expect(formatMoney(325)).toBe('$3.25');
});

test('the drawer allows only one way to make any amount, so quarters cannot be spammed', () => {
  // Every combination the drawer allows, by the amount it adds up to.
  const ways = {};
  const count = (index, total) => {
    if (index === MONEY.length) {
      ways[total] = (ways[total] || 0) + 1;
      return;
    }
    for (let n = 0; n <= MONEY[index].inDrawer; n++) count(index + 1, total + n * MONEY[index].cents);
  };
  count(0, 0);
  expect(Object.values(ways).every((n) => n === 1)).toBe(true);
  expect(piecesFor(375)).toEqual([100, 100, 100, 25, 25, 25]);
  expect(piecesFor(100)).toEqual([100]);
});

test('a microwave pattern is long enough for the last round and never repeats a key back to back', () => {
  seeds.forEach((seed) => {
    const sequence = microwaveSequence(seeded(seed));
    expect(sequence).toHaveLength(MICROWAVE_ROUNDS[MICROWAVE_ROUNDS.length - 1]);
    const repeats = sequence.filter((key, i) => i > 0 && key === sequence[i - 1]);
    expect(repeats).toEqual([]);
  });
});

test('every swap trades two different spots, and cushions keep track of where they went', () => {
  seeds.forEach((seed) => {
    makeSwaps(seeded(seed), 8).forEach(([a, b]) => {
      expect(a).not.toBe(b);
      expect(Math.max(a, b)).toBeLessThan(CUSHIONS);
    });
  });
  expect(spotsAfter([[0, 1]])).toEqual([1, 0, 2]);
  expect(spotsAfter([[0, 1], [1, 2]])).toEqual([2, 0, 1]);
  expect(spotsAfter([[0, 2], [0, 2]])).toEqual([0, 1, 2]);
});

test('grime stays on the plate, and a plate is clean once almost none is left', () => {
  seeds.forEach((seed) => {
    makeGrime(seeded(seed)).forEach(({ x, y, r }) => expect(Math.hypot(x, y) + r).toBeLessThanOrEqual(0.82));
  });
  expect(isClean(CLEAN_ENOUGH * 100, 100)).toBe(true);
  expect(isClean(50, 100)).toBe(false);
  expect(isClean(0, 0)).toBe(false);
});

test('a new light only comes on in a dark window', () => {
  seeds.forEach((seed) => {
    const lit = [0, 2, 4, 6];
    expect(lit).not.toContain(nextLight(lit, seeded(seed)));
  });
  expect(nextLight(Array.from({ length: WINDOWS }, (_, i) => i))).toBeNull();
});
