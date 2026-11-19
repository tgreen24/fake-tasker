import { shuffled } from '../random';

export const PLACES = ['fridge', 'pantry'];
export const ITEMS_TO_PUT_AWAY = 8;

// Only things nobody argues about. No bread, eggs or chocolate.
export const PANTRY_ITEMS = [
  { name: 'Milk', emoji: '🥛', place: 'fridge' },
  { name: 'Cheese', emoji: '🧀', place: 'fridge' },
  { name: 'Butter', emoji: '🧈', place: 'fridge' },
  { name: 'Lettuce', emoji: '🥬', place: 'fridge' },
  { name: 'Steak', emoji: '🥩', place: 'fridge' },
  { name: 'Strawberries', emoji: '🍓', place: 'fridge' },
  { name: 'Carrots', emoji: '🥕', place: 'fridge' },
  { name: 'Soup can', emoji: '🥫', place: 'pantry' },
  { name: 'Pasta', emoji: '🍝', place: 'pantry' },
  { name: 'Rice', emoji: '🍚', place: 'pantry' },
  { name: 'Salt', emoji: '🧂', place: 'pantry' },
  { name: 'Honey', emoji: '🍯', place: 'pantry' },
  { name: 'Cookies', emoji: '🍪', place: 'pantry' },
  { name: 'Peanuts', emoji: '🥜', place: 'pantry' }
];

// Eight, with at least three for each side.
export function dealGroceries(random = Math.random, count = ITEMS_TO_PUT_AWAY) {
  const fridge = shuffled(PANTRY_ITEMS.filter((item) => item.place === 'fridge'), random);
  const pantry = shuffled(PANTRY_ITEMS.filter((item) => item.place === 'pantry'), random);
  const fromFridge = 3 + Math.floor(random() * (count - 5));
  return shuffled([...fridge.slice(0, fromFridge), ...pantry.slice(0, count - fromFridge)], random);
}

// Which way a swipe went, once it has gone far enough to mean it.
export const SWIPE_PX = 60;
export const swipePlace = (dx) => (dx <= -SWIPE_PX ? 'fridge' : dx >= SWIPE_PX ? 'pantry' : null);
