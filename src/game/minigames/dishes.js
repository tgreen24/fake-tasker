export const PLATES = 3;
// Close enough to clean: chasing the last few specks is not fun.
export const CLEAN_ENOUGH = 0.05;

// Grime as blobs inside the plate, in units of the plate's radius from its
// center, so the drawing can be any size.
export function makeGrime(random = Math.random, count = 9) {
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 0.55;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      r: 0.14 + random() * 0.12
    };
  });
}

export const isClean = (remaining, initial) => initial > 0 && remaining / initial <= CLEAN_ENOUGH;
