import {
  DEFAULT_ROOMS, MAX_ROOMS, cleanRoom, dealMinigameTasks, isMinigameTask, minigameTask, parseMinigameTask,
  roomsWithAdded, roomsWithout, splitFor, startingRooms, taskLabel
} from './minigameTasks';
import { MINIGAME_CATALOG } from './minigames/catalog';
import { MINIGAMES } from '../components/minigames';
import { tasksEachWithin, validateNewTask } from './lobbyState';

const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('every minigame in the catalog can be played', () => {
  MINIGAMES.forEach((game) => expect(typeof game.Component).toBe('function'));
  expect(MINIGAMES).toHaveLength(MINIGAME_CATALOG.length);
});

test('a minigame task survives being stored as text, and a physical task is left alone', () => {
  const task = minigameTask('match-socks', 'Bedroom 2');
  expect(parseMinigameTask(task)).toMatchObject({ gameId: 'match-socks', room: 'Bedroom 2', name: 'Match the Socks' });
  expect(taskLabel(task)).toBe('🧦 Bedroom 2: Match the Socks');
  expect(isMinigameTask('Count the forks in the silverware drawer')).toBe(false);
  expect(taskLabel('Count the forks')).toBe('Count the forks');
  expect(parseMinigameTask('minigame:no-such-game@Kitchen')).toBeNull();
});

test('each style splits a hand the way it says', () => {
  expect(splitFor('physical', 3)).toEqual({ physical: 3, minigames: 0 });
  expect(splitFor('minigames', 3)).toEqual({ physical: 0, minigames: 3 });
  expect(splitFor('mixed', 4)).toEqual({ physical: 2, minigames: 2 });
  seeds.forEach((seed) => {
    const { physical, minigames } = splitFor('mixed', 3, seeded(seed));
    expect(physical + minigames).toBe(3);
    expect(Math.abs(physical - minigames)).toBe(1);
  });
  expect(splitFor('something old', 2)).toEqual({ physical: 2, minigames: 0 });
});

test('room names are tidied, and the separator cannot be typed', () => {
  expect(cleanRoom('  Bedroom   1 ')).toBe('Bedroom 1');
  expect(cleanRoom('Gar@age')).toBe('Garage');
  expect(cleanRoom('   ')).toBeNull();
});

test('a player never gets the same minigame or room twice when there are enough', () => {
  const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  seeds.forEach((seed) => {
    const dealt = dealMinigameTasks(players, 3, ['Kitchen', 'Bedroom 1', 'Bedroom 2', 'Garage'], seeded(seed));
    players.forEach((player) => {
      const hand = dealt[player].map(parseMinigameTask);
      expect(hand).toHaveLength(3);
      expect(new Set(hand.map((task) => task.gameId)).size).toBe(3);
      expect(new Set(hand.map((task) => task.room)).size).toBe(3);
    });
  });
});

test('with one room, everyone is still dealt their full hand', () => {
  const dealt = dealMinigameTasks(['A', 'B'], 3, ['Kitchen'], seeded(5));
  expect(dealt.A).toHaveLength(3);
  expect(dealt.A.every((task) => parseMinigameTask(task).room === 'Kitchen')).toBe(true);
});

test('minigames spread around the group rather than everyone getting the same few', () => {
  const players = Array.from({ length: 16 }, (_, i) => `P${i}`);
  const dealt = dealMinigameTasks(players, 2, ['Kitchen', 'Garage'], seeded(9));
  const used = new Set(Object.values(dealt).flat().map((task) => parseMinigameTask(task).gameId));
  expect(used.size).toBe(MINIGAME_CATALOG.length);
});

test('the room list starts from the pack, and ignores repeats and blanks', () => {
  expect(startingRooms(['Kitchen', 'Garage'])).toEqual(['Kitchen', 'Garage']);
  expect(startingRooms([])).toEqual(DEFAULT_ROOMS);
  expect(roomsWithAdded(['Kitchen'], ' kitchen ')).toEqual(['Kitchen']);
  expect(roomsWithAdded(['Kitchen'], '  ')).toEqual(['Kitchen']);
  expect(roomsWithAdded(['Kitchen'], 'Bedroom 2')).toEqual(['Kitchen', 'Bedroom 2']);
  const full = Array.from({ length: MAX_ROOMS }, (_, i) => `Room ${i}`);
  expect(roomsWithAdded(full, 'One more')).toBe(full);
  expect(roomsWithout(['Kitchen', 'Garage'], 'Kitchen')).toEqual(['Garage']);
});

test('a typed task can never pass for a minigame', () => {
  expect(validateNewTask('minigame:fix-wiring@Kitchen', []).error).toBeTruthy();
  expect(validateNewTask('Mop the floor', []).task).toBe('Mop the floor');
});

test('changing a setting lowers "tasks each" only when it no longer fits', () => {
  expect(tasksEachWithin(10, 'physical', 5)).toBe(5);
  expect(tasksEachWithin(3, 'physical', 5)).toBeNull();
  expect(tasksEachWithin(10, 'minigames', 0)).toBeNull();
  expect(tasksEachWithin(8, 'mixed', 3)).toBe(6);
  expect(tasksEachWithin(4, 'physical', 0)).toBe(1);
});
