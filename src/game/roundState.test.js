import { deriveRoundState, everyoneFinishedTasks, toggledTaskList } from './roundState';

const HOST_UID = 'uid-tyler';
const game = (over = {}) => ({
  creator: 'tyler',
  players: ['tyler', 'sam', 'kai'],
  creatorUid: HOST_UID,
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

  test('identifies the host by account, not by display name', () => {
    expect(deriveRoundState(game(), 'tyler', HOST_UID).isCreator).toBe(true);
    expect(deriveRoundState(game(), 'sam', 'uid-sam').isCreator).toBe(false);
    expect(deriveRoundState(game(), 'tyler', 'uid-sam').isCreator).toBe(false);
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

  test('reads crew-wide progress from the shared counter, not from role data', () => {
    const s = deriveRoundState(game({ imposterCount: 1, tasksPerCrewmate: 2, tasksCompleted: 3 }), 'sam');
    expect(s.totalTasks).toBe(4);
    expect(s.totalCompletedTasks).toBe(3);
    expect(s.progress).toBe(75);
  });

  test('reports zero progress rather than NaN before tasks exist', () => {
    const s = deriveRoundState(game({ tasksPerCrewmate: 0 }), 'sam');
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

