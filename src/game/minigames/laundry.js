import { shuffled } from '../random';

export const BASKETS = ['whites', 'colors'];
export const CLOTHES = ['shirt', 'pants', 'sock', 'towel'];
const WHITES = ['#f4f4f0', '#e3e6ea'];
const COLORS = ['#e5484d', '#2f6bff', '#2ecc71', '#a26bff', '#f5913b'];

const pick = (list, random) => list[Math.floor(random() * list.length)];

export const LAUNDRY_PIECES = 9;

// At least three for each basket, so both always get used.
export function dealLaundry(random = Math.random, count = LAUNDRY_PIECES) {
  const whites = 3 + Math.floor(random() * (count - 5));
  return shuffled(Array.from({ length: count }, (_, i) => {
    const basket = i < whites ? 'whites' : 'colors';
    return {
      id: `piece-${i}`,
      kind: pick(CLOTHES, random),
      basket,
      color: pick(basket === 'whites' ? WHITES : COLORS, random)
    };
  }), random);
}
