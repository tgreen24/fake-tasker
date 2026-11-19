import { scrambled, shuffled } from '../random';

// Things on a grocery list, four to seven letters. None spells another word
// with the same letters (no LEMON/MELON, PEAR/REAP), so a sensible answer is
// never turned away -- and none rearranges into anything unkind.
export const GROCERIES = [
  'ALMOND', 'APPLE', 'APRICOT', 'AVOCADO', 'BACON', 'BANANA', 'BEEF', 'BERRY', 'BISCUIT', 'BROTH',
  'BROWNIE', 'BURGER', 'BURRITO', 'BUTTER', 'CABBAGE', 'CAKE', 'CANDY', 'CARAMEL', 'CARROT',
  'CASHEW', 'CELERY', 'CEREAL', 'CHARD', 'CHEESE', 'CHERRY', 'CHICKEN', 'CHILI', 'CHIP', 'CHIVE',
  'COCOA', 'COCONUT', 'COFFEE', 'COOKIE', 'CORN', 'CRABS', 'CRACKER', 'CREAM', 'CROUTON',
  'CUPCAKE', 'CURRY', 'DILL', 'DONUT', 'EGGS', 'FIGS', 'FLOUR', 'FUDGE', 'GARLIC', 'GELATO',
  'GRANOLA', 'GRAVY', 'GRITS', 'GUAVA', 'HONEY', 'JELLY', 'JUICE', 'KETCHUP', 'KIWI', 'LASAGNA',
  'LATTE', 'LETTUCE', 'LOBSTER', 'MILK', 'MINT', 'MUFFIN', 'MUSTARD', 'NACHO', 'NOODLE', 'NUTMEG',
  'OATMEAL', 'OLIVE', 'OLIVES', 'ONION', 'OREGANO', 'PANCAKE', 'PAPAYA', 'PASTA', 'PEACHES',
  'PEANUT', 'PECAN', 'PEPPER', 'PICKLE', 'PIZZA', 'POPCORN', 'PORK', 'POTATO', 'PRETZEL', 'PRUNE',
  'PUMPKIN', 'QUINOA', 'RADISH', 'RAISIN', 'RAVIOLI', 'RICE', 'SALAD', 'SALAMI', 'SALSA',
  'SAUSAGE', 'SHERBET', 'SHRIMP', 'SODA', 'SOUP', 'SPINACH', 'SQUASH', 'SQUID', 'SUGAR', 'SYRUP',
  'THYME', 'TOFFEE', 'TOFU', 'TOMATO', 'TURKEY', 'TURNIP', 'VANILLA', 'WAFER', 'WAFFLE', 'WALNUT',
  'WATER', 'WHEAT', 'YAMS', 'YEAST', 'YOGURT'
];

export const WORDS_PER_GAME = 3;

export function scrambleWord(word, random = Math.random) {
  const letters = word.split('').map((letter, i) => ({ id: `${letter}${i}`, letter }));
  return { word, tiles: scrambled(letters, random) };
}

export function pickGroceryList(random = Math.random, count = WORDS_PER_GAME) {
  return shuffled(GROCERIES, random).slice(0, count).map((word) => scrambleWord(word, random));
}

// The id of the tile that comes next in the word, given what is placed so far,
// or null if a letter already placed is wrong.
export function nextHintTile(word, tiles, placedIds) {
  const placed = placedIds.map((id) => tiles.find((tile) => tile.id === id).letter).join('');
  if (!word.startsWith(placed) || placed.length >= word.length) return null;
  const wanted = word[placed.length];
  const free = tiles.find((tile) => tile.letter === wanted && !placedIds.includes(tile.id));
  return free ? free.id : null;
}
