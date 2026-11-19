import { TASK_PACKS, LONG, lengthFor, roomFor, taskTexts } from './taskPacks';
import {
  buildRound, calculateWeights, selectImposters, assignTasksEvenly
} from './roleAssignment';
import { MIN_PLAYERS, deriveLobbyState, validateNewTask, validateStart } from './lobbyState';
import { isMinigameTask, parseMinigameTask } from './minigameTasks';

const PLAYERS = ['tyler', 'sam', 'kai', 'rae'];
const TASKS = ['Dishes', 'Sweep', 'Fold', 'Water', 'Sort'];

describe('calculateWeights', () => {
  test('gives everyone an equal chance when nobody has played imposter', () => {
    expect(calculateWeights(PLAYERS, {})).toEqual({ tyler: 1, sam: 1, kai: 1, rae: 1 });
  });

  test('favours whoever has been imposter least', () => {
    const weights = calculateWeights(PLAYERS, { tyler: 3, sam: 1 });
    expect(weights.tyler).toBe(1);
    expect(weights.sam).toBe(3);
    expect(weights.kai).toBe(4);
    expect(weights.rae).toBe(4);
  });

  test('never drops a player to a zero chance', () => {
    const weights = calculateWeights(PLAYERS, { tyler: 99 });
    expect(Math.min(...Object.values(weights))).toBeGreaterThan(0);
  });
});

describe('selectImposters', () => {
  const flat = { tyler: 1, sam: 1, kai: 1, rae: 1 };

  test('picks the requested number, without repeats', () => {
    const picked = selectImposters(PLAYERS, flat, 2);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
  });

  test('never picks somebody who is not playing', () => {
    selectImposters(PLAYERS, flat, 2).forEach((p) => expect(PLAYERS).toContain(p));
  });

  test('cannot pick more imposters than there are players', () => {
    expect(selectImposters(['tyler'], { tyler: 1 }, 3)).toEqual(['tyler']);
  });

  test('the weighting actually shifts the draw over many rounds', () => {
    const weights = calculateWeights(PLAYERS, { tyler: 5 });
    let tylerPicked = 0;
    for (let i = 0; i < 400; i++) {
      if (selectImposters(PLAYERS, weights, 1).includes('tyler')) tylerPicked += 1;
    }
    expect(tylerPicked).toBeLessThan(100);
  });
});

describe('assignTasksEvenly', () => {
  const crew = ['sam', 'kai', 'rae'];

  test('gives each crewmate the requested number', () => {
    const assigned = assignTasksEvenly(crew, TASKS, 3);
    crew.forEach((mate) => expect(assigned[mate]).toHaveLength(3));
  });

  test('never gives the same person a task twice', () => {
    const assigned = assignTasksEvenly(crew, TASKS, 3);
    crew.forEach((mate) => expect(new Set(assigned[mate]).size).toBe(assigned[mate].length));
  });

  test('caps at the number of tasks that exist', () => {
    const assigned = assignTasksEvenly(crew, ['Dishes'], 5);
    crew.forEach((mate) => expect(assigned[mate]).toEqual(['Dishes']));
  });

  test('spreads tasks across the group rather than reusing a few', () => {
    const assigned = assignTasksEvenly(crew, TASKS, 3);
    const used = new Set(Object.values(assigned).flat());
    expect(used.size).toBe(TASKS.length);
  });

  test('handles an empty task list without hanging', () => {
    expect(assignTasksEvenly(crew, [], 3)).toEqual({ sam: [], kai: [], rae: [] });
  });

  test('handles having no crewmates', () => {
    expect(assignTasksEvenly([], TASKS, 3)).toEqual({});
  });

  test.each(TASK_PACKS.map((pack) => [pack.name, pack]))(
    'with the %s pack, sends each hand to different rooms with a long task in it',
    (name, pack) => {
      const taskers = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      for (let deal = 0; deal < 40; deal++) {
        const assigned = assignTasksEvenly(taskers, taskTexts(pack), 3);
        taskers.forEach((tasker) => {
          const hand = assigned[tasker];
          expect(hand).toHaveLength(3);
          expect(new Set(hand.map(roomFor)).size).toBe(3);
          expect(hand.some((task) => lengthFor(task) === LONG)).toBe(true);
        });
      }
    }
  );
});

describe('buildRound', () => {
  const settings = { players: PLAYERS, tasks: TASKS, imposterCount: 1, tasksPerCrewmate: 2 };

  test('gives every player exactly one role', () => {
    const { roles } = buildRound({ ...settings, imposterHistory: {} });
    expect(Object.keys(roles).sort()).toEqual([...PLAYERS].sort());
  });

  test('assigns tasks to crewmates and none to imposters', () => {
    const { roles, assignedTasks } = buildRound({ ...settings, imposterHistory: {} });
    Object.keys(roles).forEach((player) => {
      if (roles[player] === 'Imposter') expect(assignedTasks[player]).toBeUndefined();
      else expect(assignedTasks[player]).toHaveLength(2);
    });
  });

  test('records the round against the imposter history', () => {
    const { roles, imposterHistory } = buildRound({ ...settings, imposterHistory: { tyler: 2 } });
    const imposter = Object.keys(roles).find((p) => roles[p] === 'Imposter');
    expect(imposterHistory[imposter]).toBe(imposter === 'tyler' ? 3 : 1);
  });

  test('does not mutate the history it was given', () => {
    const history = { tyler: 2 };
    buildRound({ ...settings, imposterHistory: history });
    expect(history).toEqual({ tyler: 2 });
  });

  test('clears completed tasks for everyone', () => {
    const { completedTasks } = buildRound({ ...settings, imposterHistory: {} });
    PLAYERS.forEach((p) => expect(completedTasks[p]).toEqual([]));
  });
});

describe('dealing by task style', () => {
  const rooms = ['Kitchen', 'Garage', 'Bedroom 1'];
  const deal = (taskStyle, tasksPerCrewmate = 4) => buildRound({
    players: PLAYERS, tasks: TASKS, imposterCount: 1, tasksPerCrewmate, taskStyle, minigameRooms: rooms
  });
  const minigamesIn = (hand) => hand.filter(isMinigameTask).length;

  test('a physical game deals no minigames, as before', () => {
    const { assignedTasks } = deal('physical', 3);
    Object.values(assignedTasks).forEach((hand) => expect(minigamesIn(hand)).toBe(0));
  });

  test('a minigames game deals only minigames, in the rooms given', () => {
    const { assignedTasks } = deal('minigames');
    Object.values(assignedTasks).forEach((hand) => {
      expect(hand).toHaveLength(4);
      hand.forEach((task) => expect(rooms).toContain(parseMinigameTask(task).room));
    });
  });

  test('a mixed game gives everyone the same even split', () => {
    const { assignedTasks } = deal('mixed');
    Object.values(assignedTasks).forEach((hand) => {
      expect(hand).toHaveLength(4);
      expect(minigamesIn(hand)).toBe(2);
    });
  });

  test('traitors are dealt a fake hand just like a tasker\'s, and no real one', () => {
    ['physical', 'minigames', 'mixed'].forEach((style) => {
      const { roles, assignedTasks, fakeTasks } = deal(style);
      const traitor = Object.keys(roles).find((p) => roles[p] === 'Imposter');
      const tasker = Object.keys(roles).find((p) => roles[p] !== 'Imposter');
      expect(assignedTasks[traitor]).toBeUndefined();
      expect(fakeTasks[traitor]).toHaveLength(4);
      expect(minigamesIn(fakeTasks[traitor])).toBe(minigamesIn(assignedTasks[tasker]));
      expect(fakeTasks[tasker]).toBeUndefined();
    });
  });
});

describe('validateStart', () => {
  const ok = { players: PLAYERS, tasks: TASKS, imposterCount: 1, tasksPerCrewmate: 2 };

  test('a minigames game needs rooms but no physical tasks', () => {
    expect(validateStart({ ...ok, tasks: [], tasksPerCrewmate: 6, taskStyle: 'minigames', minigameRooms: ['Kitchen'] })).toBeNull();
    expect(validateStart({ ...ok, taskStyle: 'minigames', minigameRooms: [] })).toMatch(/room/);
  });

  test('a mixed game needs physical tasks for its half', () => {
    const mixed = { ...ok, taskStyle: 'mixed', minigameRooms: ['Kitchen'], tasksPerCrewmate: 6 };
    expect(validateStart({ ...mixed, tasks: TASKS.slice(0, 3) })).toBeNull();
    expect(validateStart({ ...mixed, tasks: TASKS.slice(0, 2) })).toMatch(/at least 3/);
  });

  test('accepts a valid setup', () => expect(validateStart(ok)).toBeNull());

  test('rejects a lone player', () => {
    expect(validateStart({ ...ok, players: ['tyler'] })).toMatch(
      new RegExp(`at least ${MIN_PLAYERS} players`)
    );
  });

  // Two players is one traitor against one tasker, which the outcome rules
  // settle as a traitor win on the round's first snapshot -- the host taps
  // Start and everybody lands on the game over screen.
  test('rejects two players, which would end the moment it began', () => {
    expect(validateStart({ ...ok, players: ['tyler', 'sam'] })).toBeTruthy();
  });

  test('allows three', () => {
    expect(validateStart({ ...ok, players: ['tyler', 'sam', 'kai'] })).toBeNull();
  });

  test('rejects too few tasks for the per-crewmate setting', () => {
    expect(validateStart({ ...ok, tasks: ['Dishes'] })).toMatch(/Not enough tasks/);
  });

  test('rejects leaving nobody on the crew', () => {
    expect(validateStart({ ...ok, imposterCount: 4 })).toMatch(/at least 1 crewmate/);
  });
});

describe('validateNewTask', () => {
  test('trims and accepts a new task', () => {
    expect(validateNewTask('  Dishes  ', [])).toEqual({ error: null, task: 'Dishes' });
  });
  test('ignores an empty entry', () => {
    expect(validateNewTask('   ', [])).toEqual({ error: null, task: null });
  });
  test('rejects a duplicate', () => {
    expect(validateNewTask('Dishes', ['Dishes']).error).toMatch(/already on the list/);
  });
});

describe('deriveLobbyState', () => {
  test('falls back to defaults with no document', () => {
    const s = deriveLobbyState(null, 'tyler');
    expect(s.players).toEqual([]);
    expect(s.imposterCount).toBe(1);
    expect(s.tasksPerCrewmate).toBe(3);
    expect(s.isCreator).toBe(false);
  });

  test('scales the imposter options to one per three players', () => {
    expect(deriveLobbyState({ players: PLAYERS }, 'tyler').imposterOptions).toEqual([1]);
    expect(deriveLobbyState({ players: [...PLAYERS, 'a', 'b'] }, 'tyler').imposterOptions).toEqual([1, 2]);
  });

  test('caps task-count options at the tasks that exist', () => {
    expect(deriveLobbyState({ tasks: ['a', 'b'] }, 'tyler').taskCountOptions).toEqual([1, 2]);
  });
});
