import { isHost } from './host';
import { taskProgress } from './outcome';

const CREWMATE = 'Crewmate';
const IMPOSTER = 'Imposter';

const playersWithRole = (roles, role) =>
  Object.keys(roles).filter((player) => roles[player] === role).sort();

export function deriveRoundState(gameData, playerName, uid) {
  const roles = gameData?.roles || {};
  const killList = gameData?.killList || [];
  const sabotages = gameData?.sabotages || {};
  const assigned = gameData?.assignedTasks || {};
  const completed = gameData?.completedTasks || {};

  const crewmates = playersWithRole(roles, CREWMATE);
  const mySabotage = sabotages[playerName];
  const sabotagingImposter = Object.keys(sabotages).find(
    (imposter) => sabotages[imposter]?.sabotagedPlayer === playerName
  );

  const progress = taskProgress(gameData);

  return {
    role: roles[playerName],
    // A meeting has already happened this round, so roles are long since dealt.
    returningFromMeeting: !!gameData?.votingResult,
    roundStartedAt: gameData?.roundStartedAt,
    // Traitors already know everyone's role; taskers never call this.
    roleOf: (player) => roles[player],
    meetingEndedAt: gameData?.resultUntil,
    isCreator: isHost(gameData, uid),
    isDead: killList.includes(playerName),
    killCooldown: gameData?.killCooldown || 30,
    killCooldownUntil: gameData?.killCooldowns?.[playerName],
    sabotageCooldownUntil: gameData?.sabotageCooldowns?.[playerName],
    killList,
    crewmates,
    fellowImposters: playersWithRole(roles, IMPOSTER).filter((player) => player !== playerName),
    tasks: assigned[playerName] || [],
    completedTasks: completed[playerName] || [],
    tasksBlocked: !!sabotagingImposter,
    sabotagingImposter: sabotagingImposter || '',
    sabotageActive: !!mySabotage,
    sabotagedPlayer: mySabotage?.sabotagedPlayer || '',
    eligibleCrewmates: crewmates.filter((mate) => {
      const outstanding = (assigned[mate]?.length || 0) > (completed[mate]?.length || 0);
      const alreadySabotaged = Object.values(sabotages).some((s) => s.sabotagedPlayer === mate);
      return outstanding && !alreadySabotaged && !killList.includes(mate);
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

// A win by tasks counts the whole crew, so the caller's own pending write has
// to be folded in -- the snapshot will not have landed yet.
export function everyoneFinishedTasks(gameData, playerName, nextCompleted) {
  const roles = gameData?.roles || {};
  const crewmates = playersWithRole(roles, CREWMATE);
  if (crewmates.length === 0) return false;

  return crewmates.every((mate) => {
    const assigned = gameData?.assignedTasks?.[mate] || [];
    const done = mate === playerName ? nextCompleted : (gameData?.completedTasks?.[mate] || []);
    return done.length >= assigned.length;
  });
}

