import { isHost } from './host';
import { taskProgress } from './outcome';

const CREWMATE = 'Crewmate';
const IMPOSTER = 'Imposter';

const playersWithRole = (roles, role) =>
  Object.keys(roles).filter((player) => roles[player] === role).sort();

export function deriveRoundState(gameData, playerName, uid, privateData) {
  const killList = gameData?.killList || [];
  const sabotages = gameData?.sabotages || {};

  // Only a traitor is given the map, so only a traitor can read the room.
  const roleMap = privateData?.roleMap || {};
  const role = privateData?.role;

  const crewmates = playersWithRole(roleMap, CREWMATE);
  const mySabotage = sabotages[playerName];
  const sabotagingImposter = Object.keys(sabotages).find(
    (imposter) => sabotages[imposter]?.sabotagedPlayer === playerName
  );

  const progress = taskProgress(gameData);

  return {
    role,
    returningFromMeeting: !!gameData?.votingResult,
    roundStartedAt: gameData?.roundStartedAt,
    meetingEndedAt: gameData?.resultUntil,
    roleOf: (player) => roleMap[player],
    isCreator: isHost(gameData, uid),
    isDead: killList.includes(playerName),
    killCooldown: gameData?.killCooldown || 30,
    killCooldownUntil: gameData?.killCooldowns?.[playerName],
    sabotageCooldownUntil: gameData?.sabotageCooldowns?.[playerName],
    killList,
    crewmates,
    fellowImposters: playersWithRole(roleMap, IMPOSTER).filter((player) => player !== playerName),
    tasks: privateData?.tasks || [],
    completedTasks: privateData?.completedTasks || [],
    tasksBlocked: !!sabotagingImposter,
    sabotagingImposter: sabotagingImposter || '',
    sabotageActive: !!mySabotage,
    sabotagedPlayer: mySabotage?.sabotagedPlayer || '',
    // Who still has tasks outstanding is no longer knowable -- progress is one
    // shared number now -- so any living tasker not already sabotaged is fair game.
    eligibleCrewmates: crewmates.filter((mate) => {
      const alreadySabotaged = Object.values(sabotages).some((s) => s.sabotagedPlayer === mate);
      return !alreadySabotaged && !killList.includes(mate);
    }),
    totalTasks: progress.goal,
    totalCompletedTasks: progress.done,
    progress: progress.percent
  };
}

export function toggledTaskList(completedTasks, task) {
  return completedTasks.includes(task)
    ? completedTasks.filter((entry) => entry !== task)
    : [...completedTasks, task];
}
