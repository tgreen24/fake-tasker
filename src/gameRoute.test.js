import { routeForState, showingVoteResult, RESULT_DISPLAY_MS } from './gameRoute';

const NOW = 1_000_000;
const CODE = 'AB12CD';
const base = { players: ['tyler', 'sam'], creator: 'tyler' };
const route = (data, name = 'tyler', now = NOW) => routeForState(data, name, CODE, now);

describe('routeForState', () => {
  test('sends a player with no game document home', () => {
    expect(route(null)).toBe('/');
  });

  test('sends a kicked player home', () => {
    expect(route({ ...base, players: ['sam'], gameStarted: true })).toBe('/');
  });

  test('keeps players in the lobby before the round starts', () => {
    expect(route(base)).toBe(`/lobby/${CODE}`);
  });

  test('moves players into the round once it starts', () => {
    expect(route({ ...base, gameStarted: true })).toBe(`/countdown/${CODE}`);
  });

  test('moves players into voting when a meeting is called', () => {
    expect(route({ ...base, gameStarted: true, meetingCalled: true })).toBe(`/voting/${CODE}`);
  });

  test('holds players on the result screen for the result window', () => {
    const data = { ...base, gameStarted: true, resultUntil: NOW + 2000 };
    expect(route(data)).toBe(`/voting/${CODE}`);
  });

  test('returns players to the round after the result window lapses', () => {
    const data = { ...base, gameStarted: true, resultUntil: NOW - 1 };
    expect(route(data)).toBe(`/countdown/${CODE}`);
  });

  test('returns a player who slept through the whole result window to the round', () => {
    const data = { ...base, gameStarted: true, resultUntil: NOW + 2000 };
    expect(route(data, 'tyler', NOW + 300_000)).toBe(`/countdown/${CODE}`);
  });

  test('ignores a result window from a badly skewed clock', () => {
    const data = { ...base, gameStarted: true, resultUntil: NOW + 600_000 };
    expect(route(data)).toBe(`/countdown/${CODE}`);
  });

  test('shows the result before the game over screen', () => {
    const data = { ...base, gameStarted: true, gameEnded: true, resultUntil: NOW + 2000 };
    expect(route(data)).toBe(`/voting/${CODE}`);
  });

  test('sends players to game over once the result window lapses', () => {
    const data = { ...base, gameStarted: true, gameEnded: true, resultUntil: NOW - 1 };
    expect(route(data)).toBe(`/gameover/${CODE}`);
  });

  test('does not strand players on game over when a new round starts', () => {
    const data = { ...base, gameStarted: true, gameEnded: false };
    expect(route(data)).toBe(`/countdown/${CODE}`);
  });

  test('every player in a game resolves to the same screen', () => {
    const data = { ...base, gameStarted: true, meetingCalled: true };
    expect(route(data, 'tyler')).toBe(route(data, 'sam'));
  });
});

describe('showingVoteResult', () => {
  test('is false with no result window', () => {
    expect(showingVoteResult(base, NOW)).toBe(false);
  });

  test('is true inside the window', () => {
    expect(showingVoteResult({ resultUntil: NOW + RESULT_DISPLAY_MS - 1 }, NOW)).toBe(true);
  });

  test('is false once the window has passed', () => {
    expect(showingVoteResult({ resultUntil: NOW }, NOW)).toBe(false);
  });
});
