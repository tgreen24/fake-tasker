import {
  shouldResolveMeeting,
  resolveVote,
  decideOutcome,
  pendingVotersOf,
  validVotesOf,
  votesCastBy,
  alivePlayersOf,
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

  // Marking somebody dead during the meeting says they were dead before it
  // opened, so nobody was ever eligible to vote for them. Counted, those votes
  // exile a corpse, and the same name lands in the dead list twice.
  test('discards votes cast for a player who was marked dead during the meeting', () => {
    const data = meeting({ killList: ['kai'], votes: { tyler: 'kai', sam: 'kai' } });
    expect(resolveVote(data).votedOut).toBeNull();
    expect(resolveVote(data).message).toMatch(/nobody/i);
  });

  test('a living plurality still wins once the votes for a corpse are dropped', () => {
    const data = meeting({
      players: ['tyler', 'sam', 'kai', 'rae'],
      killList: ['kai'],
      votes: { tyler: 'kai', sam: 'rae', rae: 'sam' }
    });
    expect(resolveVote(data).votedOut).toBeNull();
    expect(resolveVote(meeting({
      players: ['tyler', 'sam', 'kai', 'rae'],
      killList: ['kai'],
      votes: { tyler: 'kai', sam: 'rae', rae: 'rae' }
    })).votedOut).toBe('rae');
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

describe('a vote whose target is marked dead mid-meeting', () => {
  const board = meeting({
    players: ['tyler', 'sam', 'kai', 'rae'],
    killList: ['kai'],
    votes: { sam: 'kai', rae: 'skip' }
  });

  test('does not stand', () => {
    expect(validVotesOf(board)).toEqual({ rae: 'skip' });
  });

  test('leaves its voter still to vote', () => {
    expect(pendingVotersOf(board)).toEqual(['tyler', 'sam']);
    expect(votesCastBy(board, alivePlayersOf(board))).toBe(1);
  });

  test('does not close the meeting on a count that includes it', () => {
    expect(shouldResolveMeeting(board, NOW)).toBe(false);
  });

  test('stops being outstanding once that voter votes again', () => {
    const revoted = { ...board, votes: { ...board.votes, sam: 'tyler', tyler: 'skip' } };
    expect(pendingVotersOf(revoted)).toEqual([]);
    expect(shouldResolveMeeting(revoted, NOW)).toBe(true);
  });

  test('skip is never voided, having no target to lose', () => {
    const skipped = { ...board, votes: { tyler: 'skip', sam: 'skip', rae: 'skip' } };
    expect(pendingVotersOf(skipped)).toEqual([]);
  });
});
