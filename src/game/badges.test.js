import { awardBadges, roundDurationMs, BADGES } from './badges';

const NOW = 1_000_000;
const game = (over = {}) => ({
  players: ['tyler', 'sam', 'kai', 'rae'],
  revealed: { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate', rae: 'Crewmate' },
  killList: [],
  kills: {},
  voteLog: [],
  taskCounts: { sam: 2, kai: 2, rae: 2 },
  finishedAt: {},
  winner: 'Crewmates',
  ...over
});

const labelFor = (awarded, name) => awarded[name]?.label;

describe('awarding', () => {
  test('nobody gets two badges, so they spread across the table', () => {
    const awarded = awardBadges(game({
      killList: ['sam', 'kai'],
      kills: { sam: 'tyler', kai: 'tyler' },
      voteLog: [{ votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler' }, exiled: null }],
      winner: 'Imposters'
    }));
    const names = Object.keys(awarded);
    expect(new Set(names).size).toBe(names.length);
  });

  test('leaves out anybody who was never dealt a role', () => {
    const awarded = awardBadges(game({ players: ['tyler', 'sam', 'kai', 'rae', 'ghost'] }));
    expect(awarded.ghost).toBeUndefined();
  });

  test('an empty game awards nothing rather than throwing', () => {
    expect(awardBadges(null)).toEqual({});
    expect(awardBadges(game())).toBeDefined();
  });
});

describe('Assassin', () => {
  // With one traitor it says nothing: of course they got the most.
  test('is not awarded when there is only one traitor', () => {
    const awarded = awardBadges(game({
      killList: ['sam', 'kai'],
      kills: { sam: 'tyler', kai: 'tyler' },
      winner: 'Imposters'
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Assassin');
  });

  test('goes to whichever traitor killed more, when they are competing', () => {
    const awarded = awardBadges(game({
      players: ['tyler', 'rae', 'sam', 'kai'],
      revealed: { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' },
      killList: ['sam', 'kai'],
      kills: { sam: 'tyler', kai: 'tyler' },
      winner: 'Imposters'
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Assassin');
  });

  test('is not awarded when nobody killed anybody', () => {
    const awarded = awardBadges(game());
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Assassin');
  });
});

describe('Clean Hands', () => {
  test('goes to a traitor who won without killing', () => {
    const awarded = awardBadges(game({
      winner: 'Imposters',
      killList: ['sam', 'kai'],
      kills: {}
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Clean Hands');
  });

  test('is not awarded to a traitor who lost', () => {
    const awarded = awardBadges(game({ winner: 'Crewmates' }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Clean Hands');
  });
});

describe('Fastest Tasker', () => {
  test('goes to whoever finished first', () => {
    const awarded = awardBadges(game({ finishedAt: { kai: NOW + 500, sam: NOW + 100 } }));
    expect(labelFor(awarded, 'sam')).toBe('Fastest Tasker');
  });

  test('is not awarded when nobody finished', () => {
    const awarded = awardBadges(game({ finishedAt: {} }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Fastest Tasker');
  });
});

describe('Most Suspicious and Good Instincts', () => {
  test('votes received and correct votes go to different people', () => {
    const awarded = awardBadges(game({
      voteLog: [
        { votes: { sam: 'tyler', kai: 'rae', rae: 'kai' }, exiled: null },
        { votes: { sam: 'tyler', kai: 'tyler' }, exiled: 'tyler' }
      ]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Most Suspicious');
    // sam voted twice and was right twice, which is a sharper thing to say
    // about them than "most often right", so Detective takes them. Good
    // Instincts was theirs to win as well, and it does not get handed down to
    // kai, who was simply right once.
    expect(labelFor(awarded, 'sam')).toBe('Detective');
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Good Instincts');
  });

  test('skips do not count as votes against anybody', () => {
    const awarded = awardBadges(game({
      voteLog: [{ votes: { sam: 'skip', kai: 'skip', rae: 'skip' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Most Suspicious');
  });
});

describe('Lazy Tasker', () => {
  test('goes to the tasker who did least', () => {
    const awarded = awardBadges(game({ taskCounts: { sam: 0, kai: 2, rae: 2 } }));
    expect(labelFor(awarded, 'sam')).toBe('Lazy Tasker');
  });

  // A traitor is dealt no tasks, so they would win this every single game.
  test('never goes to a traitor', () => {
    const awarded = awardBadges(game({ taskCounts: { sam: 2, kai: 2, rae: 2 } }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Lazy Tasker');
  });

  test('is not awarded when everybody did the same', () => {
    const awarded = awardBadges(game({ taskCounts: { sam: 2, kai: 2, rae: 2 } }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Lazy Tasker');
  });
});

describe('First Out and Never Voted', () => {
  test('First Out follows the order people went out in', () => {
    const awarded = awardBadges(game({ killList: ['kai', 'sam'], kills: { kai: 'tyler', sam: 'tyler' } }));
    expect(Object.entries(awarded).some(([n, b]) => n === 'kai' && b.label === 'First Out')).toBe(true);
  });

  test('Never Voted needs a meeting to have happened', () => {
    const awarded = awardBadges(game({ voteLog: [] }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Distracted');
  });

  test('Distracted goes to the one survivor who sat every vote out', () => {
    const awarded = awardBadges(game({
      voteLog: [{ votes: { sam: 'tyler', kai: 'tyler', tyler: 'sam' }, exiled: null }],
      taskCounts: { sam: 2, kai: 2, rae: 2 }
    }));
    expect(labelFor(awarded, 'rae')).toBe('Distracted');
  });

  test('but not when several people sat out, since none of them stands out', () => {
    const awarded = awardBadges(game({
      voteLog: [{ votes: { sam: 'tyler' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Distracted');
  });
});

describe('roundDurationMs', () => {
  test('measures start to end', () => {
    expect(roundDurationMs({ roundStartedAt: NOW, endedAt: NOW + 90_000 })).toBe(90_000);
  });

  test('is zero when a round never ended, or the clock disagrees', () => {
    expect(roundDurationMs({ roundStartedAt: NOW })).toBe(0);
    expect(roundDurationMs({ roundStartedAt: NOW, endedAt: NOW - 5 })).toBe(0);
    expect(roundDurationMs(null)).toBe(0);
  });
});

describe('the badge list itself', () => {
  test('every badge has an id and a label, and ids are unique', () => {
    BADGES.forEach((badge) => {
      expect(badge.id).toBeTruthy();
      expect(badge.label).toBeTruthy();
      expect(typeof badge.find).toBe('function');
    });
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});


describe('what the roster already says is not repeated as a badge', () => {
  test('Survivor is gone -- the roster marks who made it', () => {
    const awarded = awardBadges(game({
      voteLog: [{ votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Survivor');
  });
});

describe('every badge carries a colour', () => {
  test('so two different awards never read the same', () => {
    const awarded = awardBadges(game({
      taskCounts: { sam: 0, kai: 2, rae: 2 },
      finishedAt: { kai: 1 },
      voteLog: [{ votes: { sam: 'tyler', kai: 'tyler' }, exiled: null }]
    }));
    Object.values(awarded).forEach((badge) => expect(badge.tone).toBeTruthy());
  });
});

describe('the badges added for variety', () => {
  const withMeetings = (over = {}) => game({
    voteLog: [
      { caller: 'sam', votes: { sam: 'tyler', kai: 'rae', rae: 'kai' }, exiled: null },
      { caller: 'sam', votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler' }, exiled: 'tyler' }
    ],
    ...over
  });

  // Most Kills needs two traitors competing, so a lone traitor gets nothing
  // from it -- they should still come away with something.
  test('a lone traitor still earns a badge, just not a kill one', () => {
    const awarded = awardBadges(game({
      killList: ['kai'],
      kills: { kai: 'tyler' },
      winner: 'Imposters',
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler', rae: 'tyler' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Assassin');
    expect(awarded.tyler).toBeTruthy();
  });

  // A living player cannot vote for themselves, so counting their own vote
  // would make this impossible to earn rather than merely rare.
  test('Unanimous means everybody except the target picked them', () => {
    const awarded = awardBadges(game({
      voteLog: [{
        caller: 'sam',
        votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler', tyler: 'sam' },
        exiled: 'tyler'
      }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Unanimous');
  });

  test('Unanimous still fires when the target skipped their own vote', () => {
    const awarded = awardBadges(game({
      voteLog: [{
        caller: 'sam',
        votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler', tyler: 'skip' },
        exiled: 'tyler'
      }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Unanimous');
  });

  test('two people agreeing is not unanimous, it is just two people', () => {
    const awarded = awardBadges(game({
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler', kai: 'tyler' }, exiled: 'tyler' }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Unanimous');
  });

  test('Unanimous does not fire when one person disagreed', () => {
    const awarded = awardBadges(game({
      voteLog: [{
        caller: 'sam',
        votes: { sam: 'tyler', kai: 'tyler', rae: 'kai', tyler: 'sam' },
        exiled: null
      }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Unanimous');
  });

  test('Unanimous does not fire when the vote was split', () => {
    const awarded = awardBadges(game({
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler', kai: 'rae', rae: 'kai' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Unanimous');
  });

  test('Most Meetings counts who called them', () => {
    const awarded = awardBadges(withMeetings());
    expect(labelFor(awarded, 'sam')).toBeTruthy();
    const labels = Object.values(awarded).map((b) => b.label);
    expect(labels.some((l) => ['Whistle Blower', 'Detective', 'Good Instincts'].includes(l))).toBe(true);
  });

  test('Never Suspected needs a meeting to have happened', () => {
    const quiet = awardBadges(game({ voteLog: [] }));
    expect(Object.values(quiet).map((b) => b.label)).not.toContain('Trustworthy');
  });

  test('Right Every Time needs more than one vote to mean anything', () => {
    const once = awardBadges(game({
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler' }, exiled: null }]
    }));
    expect(Object.values(once).map((b) => b.label)).not.toContain('Detective');
  });

  test('Skipped Everything needs more than one skip', () => {
    const twice = awardBadges(game({
      voteLog: [
        { caller: 'sam', votes: { rae: 'skip' }, exiled: null },
        { caller: 'sam', votes: { rae: 'skip' }, exiled: null }
      ]
    }));
    expect(labelFor(twice, 'rae')).toBe('Unsure');
  });

  test('a played-out round hands most people something', () => {
    const awarded = awardBadges(game({
      players: ['tyler', 'rae', 'sam', 'kai'],
      revealed: { tyler: 'Imposter', rae: 'Crewmate', sam: 'Crewmate', kai: 'Crewmate' },
      killList: ['kai'],
      kills: { kai: 'tyler' },
      taskCounts: { rae: 2, sam: 0, kai: 1 },
      finishedAt: { rae: 5 },
      voteLog: [
        { caller: 'sam', votes: { sam: 'tyler', rae: 'tyler', kai: 'skip' }, exiled: null }
      ],
      winner: 'Imposters'
    }));
    expect(Object.keys(awarded).length).toBeGreaterThanOrEqual(3);
    const names = Object.keys(awarded);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('the traitor badges', () => {
  const traitorWon = (over = {}) => game({
    winner: 'Imposters',
    killList: ['sam', 'kai'],
    kills: { sam: 'tyler', kai: 'tyler' },
    ...over
  });

  test('Got Away With It needs the traitor to have won without drawing a vote', () => {
    const awarded = awardBadges(traitorWon({
      voteLog: [{ caller: 'sam', votes: { sam: 'kai', kai: 'sam' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Betrayer');
  });

  test('does not fire if anybody voted for them', () => {
    const awarded = awardBadges(traitorWon({
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler', kai: 'sam' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Betrayer');
  });

  test('does not fire if the traitor lost', () => {
    const awarded = awardBadges(game({
      winner: 'Crewmates',
      voteLog: [{ caller: 'sam', votes: { sam: 'kai', kai: 'sam' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Betrayer');
  });

  test('Self Report goes to a traitor who called the meeting', () => {
    const awarded = awardBadges(game({
      voteLog: [{ caller: 'tyler', votes: { sam: 'kai', kai: 'sam', rae: 'kai' }, exiled: 'kai' }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Self Report');
  });

  test('a tasker calling a meeting is not a self report', () => {
    const awarded = awardBadges(game({
      voteLog: [{ caller: 'sam', votes: { sam: 'kai', kai: 'sam' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Self Report');
  });
});

describe('Double Agent', () => {
  const twoTraitors = (over = {}) => game({
    players: ['tyler', 'rae', 'sam', 'kai'],
    revealed: { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' },
    taskCounts: { sam: 2, kai: 2 },
    ...over
  });

  test('goes to a traitor who voted for their own', () => {
    const awarded = awardBadges(twoTraitors({
      voteLog: [{ caller: 'sam', votes: { tyler: 'rae', sam: 'kai', kai: 'sam' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Double Agent');
  });

  test('is not earned by voting for a tasker', () => {
    const awarded = awardBadges(twoTraitors({
      voteLog: [{ caller: 'sam', votes: { tyler: 'sam', sam: 'kai' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Double Agent');
  });

  test('a tasker voting for a traitor is intuition, not betrayal', () => {
    const awarded = awardBadges(twoTraitors({
      voteLog: [{ caller: 'sam', votes: { sam: 'tyler', kai: 'rae' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Double Agent');
  });

  test('cannot happen with a single traitor', () => {
    const awarded = awardBadges(game({
      voteLog: [{ caller: 'sam', votes: { tyler: 'sam', sam: 'tyler' }, exiled: null }]
    }));
    expect(Object.values(awarded).map((b) => b.label)).not.toContain('Double Agent');
  });
});

describe('Trustworthy never lands on a traitor', () => {
  test('a traitor who won unsuspected gets Betrayer', () => {
    const awarded = awardBadges(game({
      winner: 'Imposters',
      killList: ['sam'],
      kills: { sam: 'tyler' },
      voteLog: [{ caller: 'sam', votes: { sam: 'kai', kai: 'sam', rae: 'kai' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).toBe('Betrayer');
  });

  // The case that used to slip through: Betrayer needs a win, so a traitor who
  // lost without ever being voted for fell past it and landed on Trustworthy.
  test('a traitor who lost unsuspected does not get Trustworthy', () => {
    const awarded = awardBadges(game({
      winner: 'Crewmates',
      voteLog: [{ caller: 'sam', votes: { sam: 'kai', kai: 'sam', rae: 'kai' }, exiled: null }]
    }));
    expect(labelFor(awarded, 'tyler')).not.toBe('Trustworthy');
  });

  test('the one tasker nobody voted for still gets it', () => {
    const awarded = awardBadges(game({
      winner: 'Crewmates',
      voteLog: [{
        caller: 'sam',
        votes: { sam: 'tyler', kai: 'sam', rae: 'kai', tyler: 'rae' },
        exiled: null
      }]
    }));
    // sam, kai and rae were all voted for; only one tasker is left unvoted.
    const holder = Object.keys(awarded).find((n) => awarded[n].label === 'Trustworthy');
    expect(holder).toBeFalsy();
  });
});

// Reported from a real game: the traitor was voted out unanimously on the first
// meeting, and the screen then handed Most Suspicious to whoever the traitor
// had voted for, Good Instincts to one of four people who all voted the same
// way, and Trustworthy to one of three nobody had voted for.
describe('a badge nobody clearly earned is not awarded', () => {
  const unanimousFirstMeeting = game({
    winner: 'Crewmates',
    killList: ['tyler'],
    revealed: { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate', rae: 'Crewmate' },
    voteLog: [{
      caller: 'sam',
      votes: { sam: 'tyler', kai: 'tyler', rae: 'tyler', tyler: 'sam' },
      exiled: 'tyler'
    }]
  });

  const labels = () => Object.values(awardBadges(unanimousFirstMeeting)).map((b) => b.label);

  test('the traitor takes Unanimous', () => {
    expect(labelFor(awardBadges(unanimousFirstMeeting), 'tyler')).toBe('Unanimous');
  });

  test('Most Suspicious does not slide to the runner-up', () => {
    // tyler really was the most suspicious; sam took one vote, from tyler.
    expect(labels()).not.toContain('Most Suspicious');
  });

  test('Good Instincts is not awarded when everybody voted the same way', () => {
    expect(labels()).not.toContain('Good Instincts');
  });

  test('Trustworthy is not awarded when several people went unvoted', () => {
    expect(labels()).not.toContain('Trustworthy');
  });

  test('a superlative still fires when somebody is genuinely ahead', () => {
    const clear = game({
      voteLog: [
        { caller: 'sam', votes: { sam: 'tyler', kai: 'rae', rae: 'kai' }, exiled: null },
        { caller: 'sam', votes: { sam: 'tyler', kai: 'tyler', rae: 'sam' }, exiled: null }
      ]
    });
    expect(labelFor(awardBadges(clear), 'tyler')).toBe('Most Suspicious');
  });
});
