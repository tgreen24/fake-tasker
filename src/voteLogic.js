import { EXILED, TRAITOR } from './game/terminology';
export const VOTE_DURATION_MS = 180000;

export function alivePlayersOf(gameData) {
  const players = gameData?.players || [];
  const killList = gameData?.killList || [];
  return players.filter((player) => !killList.includes(player));
}

export function votesCastBy(gameData, alive) {
  const votes = gameData?.votes || {};
  return alive.filter((player) => votes[player] !== undefined).length;
}

export function voteDeadlinePassed(gameData, now = Date.now()) {
  const deadline = gameData?.voteDeadline;
  if (!deadline) return false;
  if (now >= deadline) return true;
  return deadline - now > VOTE_DURATION_MS;
}

export function shouldResolveMeeting(gameData, now = Date.now()) {
  if (!gameData?.meetingCalled) return false;
  const alive = alivePlayersOf(gameData);
  if (alive.length === 0) return true;
  if (votesCastBy(gameData, alive) >= alive.length) return true;
  return voteDeadlinePassed(gameData, now);
}

export function resolveVote(gameData) {
  const roles = gameData.roles || {};
  const alive = alivePlayersOf(gameData);

  const counts = {};
  Object.entries(gameData.votes || {})
    .filter(([voter]) => alive.includes(voter))
    .forEach(([, vote]) => {
      counts[vote] = (counts[vote] || 0) + 1;
    });

  const tallies = Object.values(counts);
  if (tallies.length === 0) return { message: 'Nobody voted, so nobody was exiled.', votedOut: null };

  const highest = Math.max(...tallies);
  const leaders = Object.keys(counts).filter((candidate) => counts[candidate] === highest);

  if (leaders.length > 1) return { message: 'A tie, so nobody was exiled.', votedOut: null };
  if (leaders[0] === 'skip') return { message: 'The vote was skipped.', votedOut: null };

  const votedOut = leaders[0];
  return {
    message: roles[votedOut] === 'Imposter'
      ? `${votedOut} was a ${TRAITOR} and was ${EXILED}!`
      : `${votedOut} was not a ${TRAITOR} and was ${EXILED}.`,
    votedOut
  };
}

export function decideOutcome(roles, killList) {
  const remainingImposters = Object.keys(roles).filter(
    (player) => roles[player] === 'Imposter' && !killList.includes(player)
  ).length;
  const remainingCrewmates = Object.keys(roles).filter(
    (player) => roles[player] === 'Crewmate' && !killList.includes(player)
  ).length;

  if (remainingImposters === 0) return 'Crewmates';
  if (remainingImposters >= remainingCrewmates) return 'Imposters';
  return null;
}
