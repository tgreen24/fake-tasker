import { scrambled, shuffled } from '../random';
import { SOCK_STYLES, dealSocks } from './socks';
import { WIRES, dealWires } from './wiring';
import { GROCERIES, WORDS_PER_GAME, nextHintTile, pickGroceryList, scrambleWord } from './groceries';
import { LAUNDRY_PIECES, dealLaundry } from './laundry';
import { CHARGE_MS, chargeAfter } from './battery';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('a shuffle keeps every item, and a scramble never comes back in order', () => {
  seeds.forEach((seed) => {
    const list = ['a', 'b', 'c', 'd'];
    expect(shuffled(list, seeded(seed)).slice().sort()).toEqual(list);
    expect(scrambled(list, seeded(seed))).not.toEqual(list);
  });
});

test('socks are dealt as six pairs', () => {
  const deck = dealSocks(seeded(3));
  expect(deck).toHaveLength(12);
  SOCK_STYLES.forEach((style) => {
    expect(deck.filter((card) => card.style === style.id)).toHaveLength(2);
  });
  expect(new Set(deck.map((card) => card.id)).size).toBe(12);
});

test('the wires never start already connected', () => {
  seeds.forEach((seed) => {
    const { left, right } = dealWires(seeded(seed));
    expect(right.slice().sort()).toEqual(left.slice().sort());
    expect(right).not.toEqual(left);
    expect(left).toHaveLength(WIRES.length);
  });
});

test('there are over a hundred groceries, four to seven letters, and no two share their letters', () => {
  expect(GROCERIES.length).toBeGreaterThan(100);
  GROCERIES.forEach((word) => expect(word).toMatch(/^[A-Z]{4,7}$/));
  const sortedLetters = GROCERIES.map((word) => word.split('').sort().join(''));
  expect(new Set(sortedLetters).size).toBe(GROCERIES.length);
});

test('a list is three different words, none shown unscrambled', () => {
  seeds.forEach((seed) => {
    const list = pickGroceryList(seeded(seed));
    expect(list).toHaveLength(WORDS_PER_GAME);
    expect(new Set(list.map((entry) => entry.word)).size).toBe(WORDS_PER_GAME);
    list.forEach(({ word, tiles }) => {
      expect(tiles.map((tile) => tile.letter).sort()).toEqual(word.split('').sort());
      expect(tiles.map((tile) => tile.id)).not.toEqual(word.split('').map((l, i) => `${l}${i}`));
    });
  });
});

test('a hint points at the next correct letter, and at nothing once a placed letter is wrong', () => {
  const { tiles } = scrambleWord('CHEESE', seeded(4));
  const idOf = (letter, skip = []) => tiles.find((tile) => tile.letter === letter && !skip.includes(tile.id)).id;
  expect(tiles.find((tile) => tile.id === nextHintTile('CHEESE', tiles, [])).letter).toBe('C');
  const ch = [idOf('C'), idOf('H')];
  expect(tiles.find((tile) => tile.id === nextHintTile('CHEESE', tiles, ch)).letter).toBe('E');
  expect(nextHintTile('CHEESE', tiles, [idOf('H')])).toBeNull();
});

test('laundry always needs both baskets', () => {
  seeds.forEach((seed) => {
    const pile = dealLaundry(seeded(seed));
    expect(pile).toHaveLength(LAUNDRY_PIECES);
    expect(pile.filter((piece) => piece.basket === 'whites').length).toBeGreaterThanOrEqual(3);
    expect(pile.filter((piece) => piece.basket === 'colors').length).toBeGreaterThanOrEqual(3);
  });
});

test('a battery fills in five seconds of holding, drains when let go, and stays full', () => {
  expect(chargeAfter(0, true, CHARGE_MS)).toBe(1);
  expect(chargeAfter(0.5, false, 1000)).toBeCloseTo(0.4);
  expect(chargeAfter(0.05, false, 5000)).toBe(0);
  expect(chargeAfter(1, false, 5000)).toBe(1);
});
