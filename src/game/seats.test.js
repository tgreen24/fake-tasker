import { SEAT_MOVE_NOTE_MS, recentSeatMoves, seatTakenElsewhere } from './seats';

test('the host hears about a seat move for a little while, then it goes', () => {
  const now = 1_000_000;
  const moves = { sam: now - 2000, kai: now - SEAT_MOVE_NOTE_MS - 1, ava: now + 1500, eli: 'bad' };
  expect(recentSeatMoves(moves, now)).toEqual(['ava', 'sam']);
  expect(recentSeatMoves(undefined, now)).toEqual([]);
});

test('a seat is only lost when another account is recorded for it', () => {
  const game = { playerUids: { sam: 'uid-new' } };
  expect(seatTakenElsewhere(game, 'sam', 'uid-old')).toBe(true);
  expect(seatTakenElsewhere(game, 'sam', 'uid-new')).toBe(false);
  expect(seatTakenElsewhere(game, 'kai', 'uid-old')).toBe(false);
  expect(seatTakenElsewhere(null, 'sam', 'uid-old')).toBe(false);
});
