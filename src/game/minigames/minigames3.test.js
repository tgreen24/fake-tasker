import { GLASSES, glassVerdict, makeBands, pourAfter, POUR_MS } from './glass';
import { ITEMS_TO_PUT_AWAY, SWIPE_PX, dealGroceries, swipePlace } from './pantry';
import { COOKIE_ROUNDS, makeCookieRound } from './cookies';
import { DICE, allMatch, firstRoll, rollAgain } from './dice';
import { DUST_PILES, PAN, inPan, makeDust, push } from './sweep';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('every glass has its lines between half full and the brim', () => {
  seeds.forEach((seed) => {
    const bands = makeBands(seeded(seed));
    expect(bands).toHaveLength(GLASSES);
    bands.forEach(({ low, high }) => {
      expect(low).toBeGreaterThanOrEqual(0.5);
      expect(high).toBeLessThanOrEqual(0.85);
      expect(high).toBeGreaterThan(low);
    });
  });
  const band = { low: 0.6, high: 0.74 };
  expect(pourAfter(0, POUR_MS)).toBe(1);
  expect(glassVerdict(0.5, band)).toBeNull();
  expect(glassVerdict(0.65, band)).toBe('filled');
  expect(glassVerdict(0.8, band)).toBe('spilled');
});

test('groceries come out at least three to a side, and a short swipe means nothing', () => {
  seeds.forEach((seed) => {
    const items = dealGroceries(seeded(seed));
    expect(items).toHaveLength(ITEMS_TO_PUT_AWAY);
    expect(new Set(items.map((item) => item.name)).size).toBe(ITEMS_TO_PUT_AWAY);
    expect(items.filter((item) => item.place === 'fridge').length).toBeGreaterThanOrEqual(3);
    expect(items.filter((item) => item.place === 'pantry').length).toBeGreaterThanOrEqual(3);
  });
  expect(swipePlace(-SWIPE_PX)).toBe('fridge');
  expect(swipePlace(SWIPE_PX + 10)).toBe('pantry');
  expect(swipePlace(20)).toBeNull();
});

test('cookies never overlap, and the right count is always one of the answers', () => {
  seeds.forEach((seed) => {
    COOKIE_ROUNDS.forEach((range, round) => {
      const { count, spots, options } = makeCookieRound(round, seeded(seed));
      expect(count).toBeGreaterThanOrEqual(range.min);
      expect(count).toBeLessThanOrEqual(range.max);
      expect(spots).toHaveLength(count);
      spots.forEach((a, i) => spots.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.3);
      }));
      expect(options).toContain(count);
      expect(new Set(options).size).toBe(options.length);
    });
  });
});

test('held dice keep their faces, and three of a kind is a match', () => {
  seeds.forEach((seed) => {
    const faces = firstRoll(seeded(seed));
    expect(faces).toHaveLength(DICE);
    expect(allMatch(faces)).toBe(false);
    faces.forEach((face) => expect(face).toBeGreaterThanOrEqual(1));
    const again = rollAgain(faces, [0, 2], seeded(seed + 100));
    expect(again[0]).toBe(faces[0]);
    expect(again[2]).toBe(faces[2]);
  });
  expect(allMatch([4, 4, 4])).toBe(true);
  expect(allMatch([4, 4, 5])).toBe(false);
});

test('dust starts out of the pan, spread apart, and is pushed only when touched', () => {
  seeds.forEach((seed) => {
    const piles = makeDust(seeded(seed));
    expect(piles).toHaveLength(DUST_PILES);
    piles.forEach((pile) => expect(inPan(pile)).toBe(false));
  });
  const piles = [{ id: 'a', x: 0.5, y: 0.5 }, { id: 'b', x: 0.1, y: 0.1 }];
  const after = push(piles, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 });
  expect(after[0].y).toBeCloseTo(0.6);
  expect(after[1]).toBe(piles[1]);
  const swept = push([{ id: 'c', x: 0.5, y: 0.8 }], { x: 0.5, y: 0.8 }, { x: 0.5, y: PAN.top + 0.05 });
  expect(swept[0].swept).toBe(true);
});
