import { isHost, hasReachableHost } from './host';
import { deriveGameOverState } from './gameOverState';
import { deriveLobbyState } from './lobbyState';
import { deriveRoundState } from './roundState';
import { deriveMeetingState } from './meetingState';

const UID = 'uid-host';
const game = (over = {}) => ({
  players: ['tyler', 'sam'],
  creator: 'tyler',
  creatorUid: UID,
  roles: { tyler: 'Imposter', sam: 'Crewmate' },
  killList: [],
  ...over
});

describe('isHost', () => {
  test('is true only for the account that created the game', () => {
    expect(isHost(game(), UID)).toBe(true);
    expect(isHost(game(), 'someone-else')).toBe(false);
  });

  test('is false when the game predates creatorUid', () => {
    expect(isHost(game({ creatorUid: undefined }), UID)).toBe(false);
  });

  test('is false with no signed-in account', () => {
    expect(isHost(game(), null)).toBe(false);
  });

  test('does not treat a matching display name as proof', () => {
    expect(isHost(game({ creator: 'tyler' }), 'a-different-uid')).toBe(false);
  });
});

describe('hasReachableHost', () => {
  test('detects a game nobody can control', () => {
    expect(hasReachableHost(game({ creatorUid: undefined }))).toBe(false);
    expect(hasReachableHost(game())).toBe(true);
  });
});

// The bug: the UI offered host buttons by display name while the rules
// enforced by uid, so the write was refused after being applied locally.
describe('every screen agrees with the rules about who the host is', () => {
  const cases = [
    ['lobby', (g, uid) => deriveLobbyState(g, 'tyler', uid).isCreator],
    ['round', (g, uid) => deriveRoundState(g, 'tyler', uid).isCreator],
    ['meeting', (g, uid) => deriveMeetingState(g, 'tyler', uid).isCreator],
    ['game over', (g, uid) => deriveGameOverState(g, 'tyler', uid).isCreator]
  ];

  cases.forEach(([name, isCreatorOn]) => {
    test(`${name}: grants host to the creating account`, () => {
      expect(isCreatorOn(game(), UID)).toBe(true);
    });

    test(`${name}: refuses host to the right name on a different account`, () => {
      expect(isCreatorOn(game(), 'stale-uid')).toBe(false);
    });

    test(`${name}: refuses host on a game with no creatorUid`, () => {
      expect(isCreatorOn(game({ creatorUid: undefined }), UID)).toBe(false);
    });
  });
});

describe('deriveGameOverState', () => {
  test('uses the recorded winner when there is one', () => {
    expect(deriveGameOverState(game({ winner: 'Imposters' }), 'sam', UID).winner).toBe('Imposters');
  });

  test('tells a crewmate they won when crewmates won', () => {
    const s = deriveGameOverState(game({ winner: 'Crewmates' }), 'sam', UID);
    expect(s.playerWon).toBe(true);
  });

  test('tells the imposter they lost when crewmates won', () => {
    const s = deriveGameOverState(game({ winner: 'Crewmates' }), 'tyler', UID);
    expect(s.playerWon).toBe(false);
  });
});
