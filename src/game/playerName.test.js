import { playerNameError } from './playerName';

describe('a player name', () => {
  test.each(['Sam', 'Mary Jo', "D'Andre", 'Zoë', 'Sam-2'])('%s is accepted', (name) => {
    expect(playerNameError(name)).toBeNull();
  });

  test.each(['Dr. Mike', 'Sarah B.', 'A/B', 'x~y', 'star*', '[me]', 'back`tick'])(
    '%s is refused, since it would break the field paths the game writes',
    (name) => {
      expect(playerNameError(name)).toMatch(/can't use/);
    }
  );

  test('a blank name asks for one', () => {
    expect(playerNameError('   ')).toBe('Please enter your name.');
  });
});
