import {
  totalsFor, livingCounts, taskProgress, taskGoal, decideOutcomeFromCounts, winReasonFor
} from './outcome';
import { decideOutcome } from '../voteLogic';

// Public state only: no roles map anywhere in these fixtures.
const game = (over = {}) => ({
  players: ['tyler', 'sam', 'kai', 'rae'],
  imposterCount: 1,
  tasksPerCrewmate: 2,
  killList: [],
  revealed: {},
  tasksCompleted: 0,
  ...over
});

describe('totalsFor', () => {
  test('splits the roster using the public imposter setting', () => {
    expect(totalsFor(game())).toEqual({ players: 4, traitors: 1, taskers: 3 });
  });

  test('never claims more traitors than players', () => {
    expect(totalsFor(game({ players: ['tyler'], imposterCount: 3 })).traitors).toBe(1);
  });

  test('survives a game that has not started', () => {
    expect(totalsFor(null)).toEqual({ players: 0, traitors: 0, taskers: 0 });
  });
});

describe('livingCounts', () => {
  test('counts everyone as alive before anyone is out', () => {
    expect(livingCounts(game())).toEqual({ traitors: 1, taskers: 3, unaccounted: 0 });
  });

  test('subtracts a tasker once their role is published', () => {
    const g = game({ killList: ['sam'], revealed: { sam: 'Crewmate' } });
    expect(livingCounts(g)).toMatchObject({ traitors: 1, taskers: 2 });
  });

  test('subtracts a traitor once theirs is', () => {
    const g = game({ killList: ['tyler'], revealed: { tyler: 'Imposter' } });
    expect(livingCounts(g)).toMatchObject({ traitors: 0, taskers: 3 });
  });

  test('flags anyone out whose role has not landed yet', () => {
    expect(livingCounts(game({ killList: ['sam'] })).unaccounted).toBe(1);
  });
});

describe('decideOutcomeFromCounts', () => {
  test('the round continues while taskers outnumber traitors', () => {
    expect(decideOutcomeFromCounts(game())).toBeNull();
  });

  test('taskers win when the last traitor is out', () => {
    const g = game({ killList: ['tyler'], revealed: { tyler: 'Imposter' } });
    expect(decideOutcomeFromCounts(g)).toBe('Crewmates');
  });

  test('traitors win on reaching parity', () => {
    const g = game({
      killList: ['sam', 'kai'],
      revealed: { sam: 'Crewmate', kai: 'Crewmate' }
    });
    expect(decideOutcomeFromCounts(g)).toBe('Imposters');
  });

  test('taskers win by finishing every task', () => {
    expect(decideOutcomeFromCounts(game({ tasksCompleted: 6 }))).toBe('Crewmates');
  });

  test('does not end the round on a partial task count', () => {
    expect(decideOutcomeFromCounts(game({ tasksCompleted: 5 }))).toBeNull();
  });

  // Ending a round early because a role has not been published yet would be
  // the worst kind of bug: the game calls a winner that is not one.
  test('waits rather than adjudicating on an unpublished role', () => {
    expect(decideOutcomeFromCounts(game({ killList: ['sam', 'kai'] }))).toBeNull();
  });
});

describe('taskProgress', () => {
  test('measures against taskers times tasks each, both public', () => {
    expect(taskGoal(game())).toBe(6);
    expect(taskProgress(game({ tasksCompleted: 3 }))).toEqual({ done: 3, goal: 6, percent: 50 });
  });

  test('cannot exceed the goal or report NaN before a round starts', () => {
    expect(taskProgress(game({ tasksCompleted: 99 })).percent).toBe(100);
    expect(taskProgress(game({ tasksPerCrewmate: 0 })).percent).toBe(0);
  });
});

// The whole point: the same answer as today's logic, without seeing any roles.
describe('agrees with the role-based logic it replaces', () => {
  const roles = { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate', rae: 'Crewmate' };
  const revealFor = (out) => Object.fromEntries(out.map((p) => [p, roles[p]]));

  [[], ['sam'], ['sam', 'kai'], ['tyler'], ['sam', 'kai', 'rae']].forEach((out) => {
    test(`same verdict with [${out.join(', ') || 'nobody'}] out`, () => {
      const publicOnly = game({ killList: out, revealed: revealFor(out) });
      expect(decideOutcomeFromCounts(publicOnly)).toBe(decideOutcome(roles, out));
    });
  });
});

// The reported bug: voting out the last traitor left the round running until
// somebody happened to complete a task. The verdict was chained onto the write
// that published the role, and got dropped when that effect was cleaned up.
// Settling is now re-derived from the board, so any snapshot can finish it.
describe('winReasonFor', () => {
  const base = {
    players: ['tyler', 'sam', 'kai', 'rae'],
    imposterCount: 1,
    tasksPerCrewmate: 2
  };

  test('tasks finished', () => {
    expect(winReasonFor({ ...base, tasksCompleted: 6 }, 'Crewmates')).toBe('tasks');
  });

  test('last traitor voted out', () => {
    const g = { ...base, killList: ['tyler'], revealed: { tyler: 'Imposter' }, ejected: 'tyler' };
    expect(winReasonFor(g, 'Crewmates')).toBe('imposters-ejected');
  });

  test('taskers ejected one of their own down to parity', () => {
    const g = {
      ...base,
      killList: ['sam', 'kai'],
      revealed: { sam: 'Crewmate', kai: 'Crewmate' },
      ejected: 'kai'
    };
    expect(winReasonFor(g, 'Imposters')).toBe('ejection');
  });

  test('killed down to parity', () => {
    const g = {
      ...base,
      killList: ['sam', 'kai'],
      revealed: { sam: 'Crewmate', kai: 'Crewmate' }
    };
    expect(winReasonFor(g, 'Imposters')).toBe('kills');
  });
});

describe('settling is a function of the board, not of who acted', () => {
  const board = {
    players: ['tyler', 'sam', 'kai', 'rae'],
    imposterCount: 1,
    tasksPerCrewmate: 2,
    killList: ['tyler'],
    revealed: { tyler: 'Imposter' },
    ejected: 'tyler',
    tasksCompleted: 1
  };

  test('any client looking at the same board reaches the same verdict', () => {
    expect(decideOutcomeFromCounts(board)).toBe('Crewmates');
    expect(winReasonFor(board, 'Crewmates')).toBe('imposters-ejected');
  });

  test('and keeps reaching it, so a missed moment is not a lost round', () => {
    expect(decideOutcomeFromCounts({ ...board, tasksCompleted: 2 })).toBe('Crewmates');
    expect(decideOutcomeFromCounts({ ...board, tasksCompleted: 3 })).toBe('Crewmates');
  });
});

// Leaving used to be purely local, so a departed player stayed in the roster:
// dealt a role next round, counted in the totals, and their unfinished tasks
// kept the goal permanently out of reach.
describe('a player leaving', () => {
  const inLobby = {
    players: ['tyler', 'sam', 'kai', 'rae'],
    imposterCount: 1,
    tasksPerCrewmate: 2,
    killList: [],
    revealed: {},
    tasksCompleted: 0
  };

  test('before a round, the roster shrinks and so does the goal', () => {
    expect(taskGoal(inLobby)).toBe(6);
    const afterLeaving = { ...inLobby, players: ['tyler', 'sam', 'kai'] };
    expect(totalsFor(afterLeaving)).toEqual({ players: 3, traitors: 1, taskers: 2 });
    expect(taskGoal(afterLeaving)).toBe(4);
  });

  test('during a round, a departed traitor counts as out rather than alive forever', () => {
    const left = { ...inLobby, killList: ['tyler'], revealed: { tyler: 'Imposter' } };
    expect(livingCounts(left)).toMatchObject({ traitors: 0 });
    expect(decideOutcomeFromCounts(left)).toBe('Crewmates');
  });

  test('during a round, a departed tasker does not strand the task goal', () => {
    // Two of three taskers finished; the third leaves with both outstanding,
    // and those are credited on the way out.
    const left = {
      ...inLobby,
      killList: ['rae'],
      revealed: { rae: 'Crewmate' },
      tasksCompleted: 4 + 2
    };
    expect(taskGoal(left)).toBe(6);
    expect(decideOutcomeFromCounts(left)).toBe('Crewmates');
  });

  test('without that credit the round could never be won by tasks', () => {
    const stranded = { ...inLobby, killList: ['rae'], revealed: { rae: 'Crewmate' }, tasksCompleted: 4 };
    expect(decideOutcomeFromCounts(stranded)).toBeNull();
  });
});
