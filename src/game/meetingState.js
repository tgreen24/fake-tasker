import { assignColors } from './playerColor';
import { isHost } from './host';
import { showingVoteResult } from '../gameRoute';
import { alivePlayersOf, pendingVotersOf, validVotesOf, votesCastBy } from '../voteLogic';

export const HOST_HEAD_START_MS = 2500;
export const PEER_STAGGER_MS = 750;

export function deriveMeetingState(gameData, playerName, uid, privateData) {
  const players = gameData?.players || [];
  const roleMap = privateData?.roleMap || {};
  const deadPlayers = gameData?.killList || [];
  const votes = gameData?.votes || {};
  const votingResult = gameData?.votingResult || '';
  const alivePlayers = alivePlayersOf(gameData);
  const validVotes = validVotesOf(gameData);
  const ownVote = votes[playerName];

  return {
    players,
    roles: roleMap,
    colors: assignColors(players),
    deadPlayers,
    alivePlayers,
    role: privateData?.role,
    isCreator: isHost(gameData, uid),
    isAlive: !deadPlayers.includes(playerName),
    meetingCaller: gameData?.meetingCaller || '',
    meetingCalled: !!gameData?.meetingCalled,
    voteDeadline: gameData?.voteDeadline,
    votingResult,
    ejected: gameData?.ejected || '',
    ejectedWasImposter: (gameData?.revealed || {})[gameData?.ejected] === 'Imposter',
    ejectedRoleKnown: !!(gameData?.revealed || {})[gameData?.ejected],
    votingEnded: showingVoteResult(gameData) || (!gameData?.meetingCalled && !!votingResult),
    myVote: validVotes[playerName],
    // The ballot they cast that no longer stands, so the screen can say why it
    // is asking again instead of silently reopening.
    voidedVote: ownVote !== undefined && validVotes[playerName] === undefined ? ownVote : null,
    ballot: alivePlayers.filter((player) => player !== playerName),
    votesCast: votesCastBy(gameData, alivePlayers),
    pendingVoters: pendingVotersOf(gameData),
    killableBy: (killer) => players.filter((player) =>
      !deadPlayers.includes(player) && player !== killer && roleMap[player] !== 'Imposter')
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
