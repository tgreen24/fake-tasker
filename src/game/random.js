export function shuffled(list, random = Math.random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A shuffle that never hands back the order it started in, for puzzles that
// would be solved before they began.
export function scrambled(list, random = Math.random) {
  if (new Set(list).size < 2) return list.slice();
  let order = shuffled(list, random);
  while (order.every((item, i) => item === list[i])) order = shuffled(list, random);
  return order;
}
