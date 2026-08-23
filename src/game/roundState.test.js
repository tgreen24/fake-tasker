import { deriveRoundState, toggledTaskList } from './roundState';

const HOST_UID = 'uid-tyler';
const ROLES = { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' };

// A traitor's private document carries the whole map; a tasker's carries only
// their own role and list. Nobody can read anybody else's.
const traitorDoc = (over = {}) => ({ role: 'Imposter', roleMap: ROLES, tasks: [], completedTasks: [], ...over });
const taskerDoc = (over = {}) => ({
  role: 'Crewmate', tasks: ['Dishes', 'Sweep'], completedTasks: ['Dishes'], ...over
});

// The shared document, which no longer carries a single role.
const game = (over = {}) => ({
  creator: 'tyler',
  creatorUid: HOST_UID,
  players: ['tyler', 'sam', 'kai'],
  imposterCount: 1,
  tasksPerCrewmate: 2,
  tasksCompleted: 0,
  killList: [],
  sabotages: {},
  killCooldown: 20,
  ...over
});

describe('deriveRoundState', () => {
  test('reads a player their own role and tasks from their own document', () => {
    const s = deriveRoundState(game(), 'sam', 'uid-sam', taskerDoc());
    expect(s.role).toBe('Crewmate');
    expect(s.tasks).toEqual(['Dishes', 'Sweep']);
    expect(s.completedTasks).toEqual(['Dishes']);
  });

  test('a tasker learns nothing about anyone else', () => {
    const s = deriveRoundState(game(), 'sam', 'uid-sam', taskerDoc());
    expect(s.crewmates).toEqual([]);
    expect(s.fellowImposters).toEqual([]);
    expect(s.roleOf('tyler')).toBeUndefined();
  });

  test('a traitor sees the room, because that is what the target list is', () => {
    const s = deriveRoundState(game(), 'tyler', HOST_UID, traitorDoc());
    expect(s.crewmates).toEqual(['kai', 'sam']);
    expect(s.roleOf('sam')).toBe('Crewmate');
  });

  test('hides the acting traitor from their own fellow list', () => {
    const roleMap = { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate' };
    const s = deriveRoundState(game(), 'tyler', HOST_UID, traitorDoc({ roleMap }));
    expect(s.fellowImposters).toEqual(['rae']);
  });

  test('marks a killed player as dead', () => {
    expect(deriveRoundState(game({ killList: ['sam'] }), 'sam', 'uid-sam', taskerDoc()).isDead).toBe(true);
  });

  test('identifies the host by account, not display name', () => {
    expect(deriveRoundState(game(), 'tyler', HOST_UID, traitorDoc()).isCreator).toBe(true);
    expect(deriveRoundState(game(), 'tyler', 'uid-sam', traitorDoc()).isCreator).toBe(false);
  });

  test('blocks a sabotaged tasker and names who to find', () => {
    const g = game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } });
    const s = deriveRoundState(g, 'sam', 'uid-sam', taskerDoc());
    expect(s.tasksBlocked).toBe(true);
    expect(s.sabotagingImposter).toBe('tyler');
  });

  test('does not block a tasker who is not the target', () => {
    const g = game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } });
    expect(deriveRoundState(g, 'kai', 'uid-kai', taskerDoc()).tasksBlocked).toBe(false);
  });

  test('tells the sabotaging traitor who they are hiding from', () => {
    const g = game({ sabotages: { tyler: { sabotagedPlayer: 'sam' } } });
    const s = deriveRoundState(g, 'tyler', HOST_UID, traitorDoc());
    expect(s.sabotageActive).toBe(true);
    expect(s.sabotagedPlayer).toBe('sam');
    expect(s.tasksBlocked).toBe(false);
  });

  test('offers any living tasker who is not already sabotaged', () => {
    const s = deriveRoundState(game(), 'tyler', HOST_UID, traitorDoc());
    expect(s.eligibleCrewmates).toEqual(['kai', 'sam']);
  });

  test('excludes the dead and the already sabotaged', () => {
    const g = game({ killList: ['sam'], sabotages: { rae: { sabotagedPlayer: 'kai' } } });
    expect(deriveRoundState(g, 'tyler', HOST_UID, traitorDoc()).eligibleCrewmates).toEqual([]);
  });

  test('reads crew-wide progress from the shared counter', () => {
    const s = deriveRoundState(game({ tasksCompleted: 3 }), 'sam', 'uid-sam', taskerDoc());
    expect(s.totalTasks).toBe(4);
    expect(s.totalCompletedTasks).toBe(3);
    expect(s.progress).toBe(75);
  });

  test('reports zero rather than NaN before a round has tasks', () => {
    const s = deriveRoundState(game({ tasksPerCrewmate: 0 }), 'sam', 'uid-sam', taskerDoc());
    expect(s.progress).toBe(0);
  });

  test('survives having no private document yet', () => {
    const s = deriveRoundState(game(), 'sam', 'uid-sam', null);
    expect(s.role).toBeUndefined();
    expect(s.tasks).toEqual([]);
    expect(s.crewmates).toEqual([]);
  });

  test('survives no game document at all', () => {
    const s = deriveRoundState(null, 'sam', 'uid-sam', null);
    expect(s.tasks).toEqual([]);
    expect(s.progress).toBe(0);
  });
});

describe('toggledTaskList', () => {
  test('adds a task that is not done', () => expect(toggledTaskList(['a'], 'b')).toEqual(['a', 'b']));
  test('removes one that is', () => expect(toggledTaskList(['a', 'b'], 'a')).toEqual(['b']));
});
