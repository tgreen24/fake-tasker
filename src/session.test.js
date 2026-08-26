import { saveSession, loadSession, clearSession, recordExit, lastExit } from './session';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('remembering which player this tab is', () => {
  test('saves a copy the tab owns and a copy that outlives it', () => {
    saveSession('ABC123', 'tyler');
    expect(JSON.parse(sessionStorage.getItem('fake-tasker:session'))).toEqual({
      gameCode: 'ABC123', playerName: 'tyler'
    });
    expect(JSON.parse(localStorage.getItem('fake-tasker:session'))).toEqual({
      gameCode: 'ABC123', playerName: 'tyler'
    });
  });

  test('the tab copy wins, so two tabs stay two different players', () => {
    saveSession('ABC123', 'sam');
    sessionStorage.setItem(
      'fake-tasker:session', JSON.stringify({ gameCode: 'ABC123', playerName: 'tyler' })
    );
    expect(loadSession()).toEqual({ gameCode: 'ABC123', playerName: 'tyler' });
  });

  // The reason this exists: iOS rebuilds a discarded tab without its
  // sessionStorage, and a player with no name gets sent to the home screen.
  test('falls back to the shared copy when the tab comes back without one', () => {
    saveSession('ABC123', 'tyler');
    sessionStorage.clear();
    expect(loadSession()).toEqual({ gameCode: 'ABC123', playerName: 'tyler' });
  });

  test('reads nothing when there is nothing to read', () => {
    expect(loadSession()).toBeNull();
  });

  test('survives a corrupt copy rather than throwing', () => {
    sessionStorage.setItem('fake-tasker:session', '{not json');
    localStorage.setItem('fake-tasker:session', '{not json either');
    expect(loadSession()).toBeNull();
  });

  test('a corrupt tab copy still falls through to a good shared one', () => {
    saveSession('ABC123', 'tyler');
    sessionStorage.setItem('fake-tasker:session', '{not json');
    expect(loadSession()).toEqual({ gameCode: 'ABC123', playerName: 'tyler' });
  });

  test('ignores an incomplete save rather than storing half a player', () => {
    saveSession('ABC123', '');
    saveSession('', 'tyler');
    expect(loadSession()).toBeNull();
  });

  test('leaving clears both copies, so the next visit starts fresh', () => {
    saveSession('ABC123', 'tyler');
    clearSession();
    expect(sessionStorage.getItem('fake-tasker:session')).toBeNull();
    expect(localStorage.getItem('fake-tasker:session')).toBeNull();
    expect(loadSession()).toBeNull();
  });
});

describe('recording why somebody left', () => {
  test('keeps the reason and the game it happened in', () => {
    recordExit('game document is gone', { gameCode: 'ABC123', playerName: 'tyler' });
    const exit = lastExit();
    expect(exit.reason).toBe('game document is gone');
    expect(exit.gameCode).toBe('ABC123');
    expect(exit.playerName).toBe('tyler');
    expect(typeof exit.at).toBe('string');
  });

  test('outlives the tab, since that is the whole point', () => {
    recordExit('waited for the game and it never arrived', { gameCode: 'ABC123' });
    sessionStorage.clear();
    expect(lastExit().reason).toBe('waited for the game and it never arrived');
  });

  test('reads nothing when nothing has gone wrong yet', () => {
    expect(lastExit()).toBeNull();
  });

  test('leaving a game does not erase the record of why', () => {
    recordExit('no longer on the roster', { gameCode: 'ABC123' });
    clearSession();
    expect(lastExit().reason).toBe('no longer on the roster');
  });
});
