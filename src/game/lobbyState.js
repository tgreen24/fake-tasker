import { assignColors } from './playerColor';
import { isHost } from './host';
import { MAX_PLAYERS, MIN_PLAYERS } from './constants';
import { isMinigameTask, normalizeStyle } from './minigameTasks';

const MOST_TASKS_EACH = 10;

// The most physical tasks a hand can need: all of it, half rounded up when
// mixed (the odd one may go either way), none when it is all minigames.
export function physicalNeeded(style, tasksEach) {
  const kind = normalizeStyle(style);
  if (kind === 'minigames') return 0;
  if (kind === 'mixed') return Math.ceil(tasksEach / 2);
  return tasksEach;
}

export function taskCountLimit(style, taskCount) {
  const kind = normalizeStyle(style);
  if (kind === 'minigames') return MOST_TASKS_EACH;
  if (kind === 'mixed') return Math.min(MOST_TASKS_EACH, taskCount * 2);
  return Math.min(MOST_TASKS_EACH, taskCount);
}

export { MIN_PLAYERS };

// The "tasks each" a setting change leaves room for: the current number,
// lowered if the new limit no longer reaches it -- otherwise the picker shows a
// value it has no option for and Start refuses for a reason nobody can see.
export function tasksEachWithin(current, style, taskCount) {
  const limit = Math.max(1, taskCountLimit(style, taskCount));
  return current > limit ? limit : null;
}

export function deriveLobbyState(gameData, playerName, uid) {
  const players = gameData?.players || [];
  const tasks = gameData?.tasks || [];

  return {
    players,
    tasks,
    colors: assignColors(players),
    maxPlayers: MAX_PLAYERS,
    isCreator: isHost(gameData, uid),
    imposterCount: gameData?.imposterCount || 1,
    tasksPerCrewmate: gameData?.tasksPerCrewmate || 3,
    killCooldown: gameData?.killCooldown || 30,
    lockdownEnabled: !!gameData?.lockdownEnabled,
    taskStyle: normalizeStyle(gameData?.taskStyle),
    minigameRooms: gameData?.minigameRooms || [],
    imposterHistory: gameData?.imposterHistory || {},
    imposterOptions: Array.from(
      { length: Math.max(1, Math.floor(players.length / 3)) },
      (_, i) => i + 1
    ),
    taskCountOptions: Array.from(
      { length: Math.max(1, taskCountLimit(gameData?.taskStyle, tasks.length)) },
      (_, i) => i + 1
    )
  };
}

export function validateStart({ players, tasks, imposterCount, tasksPerCrewmate, taskStyle, minigameRooms = [] }) {
  if (players.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
  const physical = physicalNeeded(taskStyle, tasksPerCrewmate);
  if (tasks.length < physical) return `Not enough tasks. You need at least ${physical}.`;
  if (normalizeStyle(taskStyle) !== 'physical' && !minigameRooms.length) return 'Add at least one room for the minigames.';
  if (imposterCount > players.length - 1) return 'Invalid imposter count. Must have at least 1 crewmate.';
  return null;
}

export function validateNewTask(task, tasks) {
  const trimmed = task.trim();
  if (!trimmed) return { error: null, task: null };
  if (tasks.includes(trimmed)) return { error: 'That task is already on the list.', task: null };
  if (isMinigameTask(trimmed) || trimmed.startsWith('minigame:')) {
    return { error: 'Tasks cannot start with "minigame:".', task: null };
  }
  return { error: null, task: trimmed };
}
