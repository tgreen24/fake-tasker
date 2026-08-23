import { hasReachableHost, isHost } from './host';
import { assignColors } from './playerColor';
import { roleNameLower, roleNameLowerPlural } from './terminology';

export function decideWinner(gameData) {
  if (gameData?.winner) return gameData.winner;

  const roles = gameData?.roles || {};
  const killList = gameData?.killList || [];
  const crewmates = Object.keys(roles).filter((player) => roles[player] === 'Crewmate');
  const imposters = Object.keys(roles).filter((player) => roles[player] === 'Imposter');

  const allTasksDone = crewmates.length > 0 && crewmates.every((crewmate) => {
    const assigned = gameData?.assignedTasks?.[crewmate] || [];
    const done = gameData?.completedTasks?.[crewmate] || [];
    return done.length >= assigned.length;
  });
  const allImpostersOut = imposters.length > 0 && imposters.every((imposter) => killList.includes(imposter));

  return allTasksDone || allImpostersOut ? 'Crewmates' : 'Imposters';
}

// Everyone who was actually dealt a role this round, in roster order so the
// colours match what people saw all game.
export function revealRoster(gameData) {
  const players = gameData?.players || [];
  const roles = gameData?.roles || {};
  const killList = gameData?.killList || [];
  const colors = assignColors(players);

  const dealt = players
    .filter((player) => roles[player])
    .map((player) => ({
      name: player,
      role: roles[player],
      color: colors[player],
      survived: !killList.includes(player)
    }));

  return {
    imposters: dealt.filter((entry) => entry.role === 'Imposter'),
    crewmates: dealt.filter((entry) => entry.role === 'Crewmate')
  };
}

const WIN_REASONS = {
  tasks: 'All tasks completed',
  'imposters-ejected': `Every ${roleNameLower('Imposter')} was voted out`,
  kills: `The ${roleNameLowerPlural('Crewmate')} were outnumbered`,
  ejection: `The ${roleNameLowerPlural('Crewmate')} voted out one of their own`,
  outnumbered: `The ${roleNameLowerPlural('Crewmate')} were outnumbered`
};

// Older rounds recorded only who won, so fall back rather than inventing one.
export function winReasonText(gameData) {
  return WIN_REASONS[gameData?.winReason] || '';
}

export function deriveGameOverState(gameData, playerName, uid) {
  const winner = decideWinner(gameData);
  const role = gameData?.roles?.[playerName];

  return {
    roster: revealRoster(gameData),
    winReason: winReasonText(gameData),
    winner,
    role,
    isCreator: isHost(gameData, uid),
    hostReachable: hasReachableHost(gameData),
    playerWon: (winner === 'Crewmates' && role === 'Crewmate') || (winner === 'Imposters' && role === 'Imposter')
  };
}
