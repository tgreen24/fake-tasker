// Money in cents throughout, so no sum is ever off by a fraction of a cent.
//
// The drawer only holds so much of each, like a real till: three quarters,
// four ones, one five, one ten. With those limits any amount of change can be
// made exactly one way -- the fewest pieces -- so tapping quarters until the
// total comes right is not an answer.
export const MONEY = [
  { cents: 1000, label: '$10', kind: 'bill', inDrawer: 1 },
  { cents: 500, label: '$5', kind: 'bill', inDrawer: 1 },
  { cents: 100, label: '$1', kind: 'bill', inDrawer: 4 },
  { cents: 25, label: '25¢', kind: 'coin', inDrawer: 3 }
];

// The pieces that make an amount, largest first, or null if the drawer cannot.
export function piecesFor(cents) {
  let left = cents;
  const pieces = [];
  MONEY.forEach((money) => {
    const count = Math.min(money.inDrawer, Math.floor(left / money.cents));
    for (let i = 0; i < count; i++) pieces.push(money.cents);
    left -= count * money.cents;
  });
  return left === 0 ? pieces : null;
}
export const CHANGE_PROBLEMS = 3;
const PAID = [500, 1000, 2000];

export const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;

// A price in quarters between $1 and $9.75, paid with the smallest bill that
// covers it -- or now and then the next one up, for bigger change.
export function makeChangeProblem(random = Math.random) {
  const price = 100 + Math.floor(random() * 36) * 25;
  const enough = PAID.filter((bill) => bill > price);
  const paid = random() < 0.3 && enough.length > 1 ? enough[1] : enough[0];
  return { price, paid, change: paid - price };
}

export function makeChangeProblems(random = Math.random, count = CHANGE_PROBLEMS) {
  return Array.from({ length: count }, () => makeChangeProblem(random));
}
