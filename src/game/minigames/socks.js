import { shuffled } from '../random';

// Pattern and color both differ between pairs, so no pair is told apart by
// color alone.
export const SOCK_STYLES = [
  { id: 'red-solid', color: '#e5484d', pattern: 'solid' },
  { id: 'blue-stripes', color: '#2f6bff', pattern: 'stripes' },
  { id: 'green-dots', color: '#2ecc71', pattern: 'dots' },
  { id: 'yellow-checks', color: '#f5b301', pattern: 'checks' },
  { id: 'purple-band', color: '#a26bff', pattern: 'band' },
  { id: 'white-heel', color: '#e7eef6', pattern: 'heel' }
];

export function dealSocks(random = Math.random) {
  const cards = SOCK_STYLES.flatMap((style) => [
    { id: `${style.id}-a`, style: style.id },
    { id: `${style.id}-b`, style: style.id }
  ]);
  return shuffled(cards, random);
}

export const sockStyle = (id) => SOCK_STYLES.find((style) => style.id === id);
