export const DICE = 3;

const roll = (random) => 1 + Math.floor(random() * 6);

export const allMatch = (faces) => faces.every((face) => face === faces[0]);

// Never already solved before the first tap.
export function firstRoll(random = Math.random) {
  let faces;
  do faces = Array.from({ length: DICE }, () => roll(random));
  while (allMatch(faces));
  return faces;
}

// Held dice keep their face; the rest roll again.
export const rollAgain = (faces, held, random = Math.random) =>
  faces.map((face, i) => (held.includes(i) ? face : roll(random)));
