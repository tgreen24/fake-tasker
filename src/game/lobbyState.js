import { MAX_PLAYERS, MIN_PLAYERS } from './constants';

export { MIN_PLAYERS };

export function deriveLobbyState(gameData, playerName) {
  const players = gameData?.players || [];
  const tasks = gameData?.tasks || [];

  return {
    players,
    tasks,
    maxPlayers: MAX_PLAYERS,
    isCreator: !!gameData && gameData.creator === playerName,
    imposterCount: gameData?.imposterCount || 1,
    tasksPerCrewmate: gameData?.tasksPerCrewmate || 3,
    killCooldown: gameData?.killCooldown || 30,
    imposterHistory: gameData?.imposterHistory || {},
    imposterOptions: Array.from(
      { length: Math.max(1, Math.floor(players.length / 3)) },
      (_, i) => i + 1
    ),
    taskCountOptions: Array.from(
      { length: Math.max(1, Math.min(tasks.length, 10)) },
      (_, i) => i + 1
    )
  };
}

export function validateStart({ players, tasks, imposterCount, tasksPerCrewmate }) {
  if (players.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
  if (tasks.length < tasksPerCrewmate) return `Not enough tasks. You need at least ${tasksPerCrewmate}.`;
  if (imposterCount > players.length - 1) return 'Invalid imposter count. Must have at least 1 crewmate.';
  return null;
}

export function validateNewTask(task, tasks) {
  const trimmed = task.trim();
  if (!trimmed) return { error: null, task: null };
  if (tasks.includes(trimmed)) return { error: 'That task is already on the list.', task: null };
  return { error: null, task: trimmed };
}
