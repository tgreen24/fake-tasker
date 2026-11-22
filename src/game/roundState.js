import { isHost } from './host';
import { taskProgress } from './outcome';

const CREWMATE = 'Crewmate';
const IMPOSTER = 'Imposter';

const playersWithRole = (roles, role) =>
  Object.keys(roles).filter((player) => roles[player] === role).sort();

// Out of the game with a role nobody has published. Only their own phone holds
// it, and until it does the round cannot be decided by anything but the tasks.
export function awaitingRevealOf(gameData) {
  const revealed = gameData?.revealed || {};
  return Array.from(new Set(gameData?.killList || [])).filter((name) => !revealed[name]);
}

// How each target on a traitor's list went out, since the list is shared by
// every traitor: a teammate's kill otherwise looks like a tick anybody may
// clear. A vote is not a traitor's to undo; a kill is, after a second tap.
export function targetsFor(crewmates, gameData, playerName) {
  const killList = gameData?.killList || [];
  const kills = gameData?.kills || {};
  const votedOut = new Set((gameData?.voteLog || []).map((entry) => entry?.exiled).filter(Boolean));
  return crewmates.map((name) => {
    if (!killList.includes(name)) return { name, out: null };
    if (kills[name]) return { name, out: kills[name] === playerName ? 'killed-by-you' : 'killed-by-teammate', killer: kills[name] };
    if (votedOut.has(name)) return { name, out: 'voted-out' };
    return { name, out: 'dead' };
  });
}

// What a tap on a target does. Bringing somebody back takes two taps, the
// first only arming it.
export function targetTap(target, armed) {
  if (!target.out) return 'kill';
  if (target.out === 'voted-out') return 'none';
  return armed === target.name ? 'bring-back' : 'arm';
}

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
    awaitingReveal: awaitingRevealOf(gameData),
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
    targets: targetsFor(crewmates, gameData, playerName),
    killerOf: (player) => gameData?.kills?.[player],
    fellowImposters: playersWithRole(roleMap, IMPOSTER).filter((player) => player !== playerName),
    tasks: privateData?.tasks || [],
    completedTasks: privateData?.completedTasks || [],
    fakeTasks: privateData?.fakeTasks || [],
    fakeCompleted: privateData?.fakeCompleted || [],
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
