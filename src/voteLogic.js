import { EXILED, TRAITOR } from './game/terminology';
export const VOTE_DURATION_MS = 180000;
export const SKIP = 'skip';

export function alivePlayersOf(gameData) {
  const players = gameData?.players || [];
  const killList = gameData?.killList || [];
  return players.filter((player) => !killList.includes(player));
}

// Marking somebody dead during a meeting is a correction, not a kill: it says
// they were already dead when the meeting opened and should never have been on
// anybody's ballot. So a vote only stands while both ends of it are still in
// the game. Their own vote goes, which it always did -- and so does every vote
// cast for them, which it did not. Those were spent on a player who was not
// eligible, and counting them exiled a corpse instead of whoever the room was
// actually trying to exile.
export function validVotesOf(gameData) {
  const votes = gameData?.votes || {};
  const out = gameData?.killList || [];
  const alive = alivePlayersOf(gameData);
  return Object.fromEntries(
    Object.entries(votes).filter(
      ([voter, vote]) => alive.includes(voter) && (vote === SKIP || !out.includes(vote))
    )
  );
}

// Who the meeting is still waiting on. A voter whose ballot was voided is back
// among them: they are asked again rather than told nothing and counted as
// done.
export function pendingVotersOf(gameData) {
  const valid = validVotesOf(gameData);
  return alivePlayersOf(gameData).filter((player) => valid[player] === undefined);
}

export function votesCastBy(gameData, alive) {
  const valid = validVotesOf(gameData);
  return alive.filter((player) => valid[player] !== undefined).length;
}

// The deadline is written in the calling phone's clock and read in everybody
// else's. A deadline further away than the vote is long says those two clocks
// disagree, not that the vote is over -- and closing on that would end the
// meeting the instant it opened, before anybody had voted. Waiting is the safe
// way to be wrong here: a vote that overstays can be ended by the host, and one
// that never happened cannot be got back.
export function voteDeadlinePassed(gameData, now = Date.now()) {
  const deadline = gameData?.voteDeadline;
  if (!deadline) return false;
  if (deadline - now > VOTE_DURATION_MS) return false;
  return now >= deadline;
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

  const counts = {};
  Object.values(validVotesOf(gameData)).forEach((vote) => {
    counts[vote] = (counts[vote] || 0) + 1;
  });

  const tallies = Object.values(counts);
  if (tallies.length === 0) return { message: 'Nobody voted, so nobody was exiled.', votedOut: null };

  const highest = Math.max(...tallies);
  const leaders = Object.keys(counts).filter((candidate) => counts[candidate] === highest);

  if (leaders.length > 1) return { message: 'A tie, so nobody was exiled.', votedOut: null };
  if (leaders[0] === SKIP) return { message: 'The vote was skipped.', votedOut: null };

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
