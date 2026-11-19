export const MICROWAVE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
// One sequence, shown a little longer each round, the way Simon works.
export const MICROWAVE_ROUNDS = [3, 4, 5];

// No key twice in a row: a repeat flashes as one long light and looks like
// the pattern is shorter than it is.
export function microwaveSequence(random = Math.random, length = MICROWAVE_ROUNDS[MICROWAVE_ROUNDS.length - 1]) {
  const sequence = [];
  while (sequence.length < length) {
    const key = MICROWAVE_KEYS[Math.floor(random() * MICROWAVE_KEYS.length)];
    if (key !== sequence[sequence.length - 1]) sequence.push(key);
  }
  return sequence;
}
