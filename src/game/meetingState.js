import { showingVoteResult } from '../gameRoute';
import { alivePlayersOf, votesCastBy } from '../voteLogic';

export const HOST_HEAD_START_MS = 2500;
export const PEER_STAGGER_MS = 750;

export function deriveMeetingState(gameData, playerName) {
  const players = gameData?.players || [];
  const roles = gameData?.roles || {};
  const deadPlayers = gameData?.killList || [];
  const votes = gameData?.votes || {};
  const votingResult = gameData?.votingResult || '';
  const alivePlayers = alivePlayersOf(gameData);

  return {
    players,
    roles,
    deadPlayers,
    alivePlayers,
    role: roles[playerName],
    isCreator: gameData?.creator === playerName,
    isAlive: !deadPlayers.includes(playerName),
    meetingCaller: gameData?.meetingCaller || '',
    meetingCalled: !!gameData?.meetingCalled,
    voteDeadline: gameData?.voteDeadline,
    votingResult,
    votingEnded: showingVoteResult(gameData) || (!gameData?.meetingCalled && !!votingResult),
    myVote: votes[playerName],
    votesCast: votesCastBy(gameData, alivePlayers),
    killableBy: (killer) => players.filter((player) =>
      !deadPlayers.includes(player) && player !== killer && roles[player] !== 'Imposter')
  };
}

// The host tries to close the meeting first; peers back it up on a stagger, so
// a sleeping host cannot hang the vote but the common case is still one write.
export function resolverDelayMs(players, playerName, isCreator) {
  if (isCreator) return 0;
  return HOST_HEAD_START_MS + Math.max(0, players.indexOf(playerName)) * PEER_STAGGER_MS;
}

export function secondsUntil(deadline, now = Date.now()) {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
