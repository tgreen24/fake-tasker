import { scrambled } from '../random';

// A shape on each end as well as a color, for anyone who cannot tell two of
// the colors apart.
export const WIRES = [
  { id: 'red', color: '#e5484d', mark: '●' },
  { id: 'blue', color: '#2f6bff', mark: '▲' },
  { id: 'yellow', color: '#f5b301', mark: '■' },
  { id: 'pink', color: '#ff7ac6', mark: '◆' }
];

export const WIRING_PANELS = 3;

export function dealWires(random = Math.random) {
  const ids = WIRES.map((wire) => wire.id);
  return { left: ids, right: scrambled(ids, random) };
}

export const wireById = (id) => WIRES.find((wire) => wire.id === id);
