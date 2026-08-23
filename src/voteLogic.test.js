import {
  shouldResolveMeeting,
  resolveVote,
  decideOutcome,
  VOTE_DURATION_MS
} from './voteLogic';

const NOW = 1_000_000;
const meeting = (over) => ({
  players: ['tyler', 'sam', 'kai'],
  killList: [],
  meetingCalled: true,
  voteDeadline: NOW + VOTE_DURATION_MS,
  roles: { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' },
  ...over
});

describe('shouldResolveMeeting', () => {
  test('waits while votes are outstanding', () => {
    expect(shouldResolveMeeting(meeting({ votes: { tyler: 'skip' } }), NOW)).toBe(false);
  });

  test('resolves as soon as every living player has voted', () => {
    const data = meeting({ votes: { tyler: 'skip', sam: 'skip', kai: 'skip' } });
    expect(shouldResolveMeeting(data, NOW)).toBe(true);
  });

  test('resolves past the deadline even with a player missing', () => {
    const data = meeting({ votes: { tyler: 'skip', sam: 'skip' } });
    expect(shouldResolveMeeting(data, NOW + VOTE_DURATION_MS + 1)).toBe(true);
  });

  test('does not need votes from dead players', () => {
    const data = meeting({ killList: ['kai'], votes: { tyler: 'skip', sam: 'skip' } });
    expect(shouldResolveMeeting(data, NOW)).toBe(true);
  });

  test('ignores a deadline written by a badly skewed clock', () => {
    const data = meeting({ voteDeadline: NOW + VOTE_DURATION_MS * 10, votes: {} });
    expect(shouldResolveMeeting(data, NOW)).toBe(true);
  });

  test('never resolves a meeting that is not running', () => {
    expect(shouldResolveMeeting(meeting({ meetingCalled: false }), NOW)).toBe(false);
  });
});

describe('resolveVote', () => {
  test('ejects a plurality winner', () => {
    const data = meeting({ votes: { tyler: 'sam', sam: 'skip', kai: 'sam' } });
    expect(resolveVote(data).votedOut).toBe('sam');
  });

  test('ejects nobody on a tie', () => {
    const data = meeting({ votes: { tyler: 'sam', sam: 'kai' } });
    expect(resolveVote(data).votedOut).toBeNull();
  });

  test('ejects nobody when skip leads', () => {
    const data = meeting({ votes: { tyler: 'skip', sam: 'skip', kai: 'sam' } });
    expect(resolveVote(data).votedOut).toBeNull();
  });

  test('discards votes cast by players who since died', () => {
    const data = meeting({ killList: ['kai'], votes: { kai: 'sam', tyler: 'skip', sam: 'skip' } });
    expect(resolveVote(data).votedOut).toBeNull();
  });

  test('handles a deadline expiring with no votes at all', () => {
    const result = resolveVote(meeting({ votes: {} }));
    expect(result.votedOut).toBeNull();
    expect(result.message).toMatch(/nobody/i);
  });

  test('names the imposter when one is ejected', () => {
    const data = meeting({ votes: { tyler: 'tyler', sam: 'tyler', kai: 'skip' } });
    expect(resolveVote(data).message).toMatch(/was a Traitor/);
  });
});

describe('decideOutcome', () => {
  const roles = { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' };

  test('crewmates win when every imposter is out', () => {
    expect(decideOutcome(roles, ['tyler'])).toBe('Crewmates');
  });

  test('imposters win once they equal the crewmates', () => {
    expect(decideOutcome(roles, ['sam'])).toBe('Imposters');
  });

  test('the round continues while crewmates outnumber imposters', () => {
    expect(decideOutcome(roles, [])).toBeNull();
  });
});
