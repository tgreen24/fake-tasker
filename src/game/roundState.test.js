import {
  deriveRoundState, everyoneFinishedTasks, toggledTaskList, winnerAfterKill
} from './roundState';

const game = (over = {}) => ({
  creator: 'tyler',
  roles: { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' },
  assignedTasks: { sam: ['Dishes', 'Sweep'], kai: ['Dishes'] },
  completedTasks: { sam: ['Dishes'], kai: [] },
  killList: [],
  sabotages: {},
  killCooldown: 20,
  ...over
});

describe('deriveRoundState', () => {
  test('reads the player their own role and tasks', () => {
    const s = deriveRoundState(game(), 'sam');
    expect(s.role).toBe('Crewmate');
    expect(s.tasks).toEqual(['Dishes', 'Sweep']);
    expect(s.completedTasks).toEqual(['Dishes']);
  });

  test('marks a killed player as dead', () => {
    expect(deriveRoundState(game({ killList: ['sam'] }), 'sam').isDead).toBe(true);
  });

  test('identifies the host', () => {
    expect(deriveRoundState(game(), 'tyler').isCreator).toBe(true);
    expect(deriveRoundState(game(), 'sam').isCreator).toBe(false);
  });

  test('hides the acting imposter from their own fellow list', () => {
    const s = deriveRoundState(game({ roles: { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate' } }), 'tyler');
    expect(s.fellowImposters).toEqual(['rae']);
    expect(s.crewmates).toEqual(['sam']);
  });

  test('blocks tasks for a sabotaged crewmate and names the imposter', () => {
    const s = deriveRoundState(game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } }), 'sam');
    expect(s.tasksBlocked).toBe(true);
    expect(s.sabotagingImposter).toBe('tyler');
  });

  test('does not block a crewmate who is not the target', () => {
    const s = deriveRoundState(game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } }), 'kai');
    expect(s.tasksBlocked).toBe(false);
  });

  test('tells the sabotaging imposter who they are hiding from', () => {
    const s = deriveRoundState(game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } }), 'tyler');
    expect(s.sabotageActive).toBe(true);
    expect(s.sabotagedPlayer).toBe('sam');
    expect(s.tasksBlocked).toBe(false);
  });

  test('offers only crewmates who are alive, unsabotaged and still have tasks', () => {
    const s = deriveRoundState(game({
      completedTasks: { sam: ['Dishes'], kai: ['Dishes'] },
      sabotages: {}
    }), 'tyler');
    expect(s.eligibleCrewmates).toEqual(['sam']);
  });

  test('excludes the dead from sabotage targets', () => {
    const s = deriveRoundState(game({ killList: ['sam'] }), 'tyler');
    expect(s.eligibleCrewmates).toEqual(['kai']);
  });

  test('excludes someone already being sabotaged', () => {
    const s = deriveRoundState(game({ sabotages: { rae: { sabotagedPlayer: 'sam' } } }), 'tyler');
    expect(s.eligibleCrewmates).toEqual(['kai']);
  });

  test('counts crew-wide task progress', () => {
    const s = deriveRoundState(game(), 'sam');
    expect(s.totalTasks).toBe(3);
    expect(s.totalCompletedTasks).toBe(1);
    expect(s.progress).toBe(33);
  });

  test('reports zero progress rather than NaN before tasks exist', () => {
    const s = deriveRoundState(game({ assignedTasks: {}, completedTasks: {} }), 'sam');
    expect(s.progress).toBe(0);
  });

  test('survives a missing game document', () => {
    const s = deriveRoundState(null, 'sam');
    expect(s.role).toBeUndefined();
    expect(s.tasks).toEqual([]);
    expect(s.progress).toBe(0);
  });
});

describe('toggledTaskList', () => {
  test('adds a task that is not done', () => {
    expect(toggledTaskList(['a'], 'b')).toEqual(['a', 'b']);
  });
  test('removes one that is', () => {
    expect(toggledTaskList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('everyoneFinishedTasks', () => {
  test('is false while anyone has work left', () => {
    expect(everyoneFinishedTasks(game(), 'sam', ['Dishes'])).toBe(false);
  });

  test('counts the caller pending write, which the snapshot has not seen yet', () => {
    const nearlyDone = game({ completedTasks: { sam: ['Dishes'], kai: ['Dishes'] } });
    expect(everyoneFinishedTasks(nearlyDone, 'sam', ['Dishes', 'Sweep'])).toBe(true);
  });

  test('is false with no crewmates at all', () => {
    expect(everyoneFinishedTasks(game({ roles: { tyler: 'Imposter' } }), 'tyler', [])).toBe(false);
  });
});

describe('winnerAfterKill', () => {
  test('imposters win once they equal the living crew', () => {
    expect(winnerAfterKill(game(), ['sam'])).toBe('Imposters');
  });
  test('the round continues while crew outnumber them', () => {
    expect(winnerAfterKill(game(), [])).toBeNull();
  });
});
