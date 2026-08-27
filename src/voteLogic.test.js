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

  // This used to resolve, on the reasoning that a nonsense deadline should not
  // be allowed to hang a vote. It hangs nothing: the host can force a vote to
  // end. What it did instead was let one phone set to the wrong time close
  // every meeting the instant it opened, before anybody had voted -- and a vote
  // that never happened cannot be got back. So it waits now.
  test('waits rather than trust a deadline written by a badly skewed clock', () => {
    const data = meeting({ voteDeadline: NOW + VOTE_DURATION_MS * 10, votes: {} });
    expect(shouldResolveMeeting(data, NOW)).toBe(false);
  });

  test('a skewed deadline still cannot hold up a vote everybody has cast', () => {
    const data = meeting({
      voteDeadline: NOW + VOTE_DURATION_MS * 10,
      votes: { tyler: 'skip', sam: 'skip', kai: 'skip' }
    });
    expect(shouldResolveMeeting(data, NOW)).toBe(true);
  });

  test('a deadline that has genuinely passed still resolves', () => {
    const data = meeting({ voteDeadline: NOW - 1, votes: {} });
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
