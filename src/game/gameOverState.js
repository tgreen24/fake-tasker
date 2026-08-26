import { hasReachableHost, isHost } from './host';
import { assignColors } from './playerColor';
import { decideOutcomeFromCounts, taskProgress } from './outcome';
import { roleNameLower, roleNameLowerPlural } from './terminology';
import { awardBadges, roundDurationMs } from './badges';

const WIN_REASONS = {
  tasks: 'All tasks completed',
  'imposters-ejected': `Every ${roleNameLower('Imposter')} was exiled`,
  kills: `The ${roleNameLowerPlural('Crewmate')} were outnumbered`,
  ejection: `The ${roleNameLowerPlural('Crewmate')} exiled one of their own`,
  outnumbered: `The ${roleNameLowerPlural('Crewmate')} were outnumbered`
};

// Older rounds recorded only who won, so fall back rather than inventing one.
export function winReasonText(gameData) {
  return WIN_REASONS[gameData?.winReason] || '';
}

// Whoever settled the round recorded the winner. Falling back to the public
// counts covers a document read before that write landed.
export function decideWinner(gameData) {
  return gameData?.winner || decideOutcomeFromCounts(gameData) || '';
}

// Every player publishes their own role once the round is over, so this fills
// in as those writes land rather than being read from one shared map.
export function revealRoster(gameData) {
  const players = gameData?.players || [];
  const revealed = gameData?.revealed || {};
  const killList = gameData?.killList || [];
  const colors = assignColors(players);

  const dealt = players
    .filter((player) => revealed[player])
    .map((player) => ({
      name: player,
      role: revealed[player],
      color: colors[player],
      survived: !killList.includes(player)
    }));

  return {
    imposters: dealt.filter((entry) => entry.role === 'Imposter'),
    crewmates: dealt.filter((entry) => entry.role === 'Crewmate'),
    pending: players.length - dealt.length
  };
}

export function deriveGameOverState(gameData, playerName, uid, privateData) {
  const winner = decideWinner(gameData);
  const role = privateData?.role || (gameData?.revealed || {})[playerName];

  return {
    roster: revealRoster(gameData),
    badges: awardBadges(gameData),
    colors: assignColors(gameData?.players || []),
    roundMs: roundDurationMs(gameData),
    winReason: winReasonText(gameData),
    progress: taskProgress(gameData),
    winner,
    role,
    isCreator: isHost(gameData, uid),
    hostReachable: hasReachableHost(gameData),
    playerWon: (winner === 'Crewmates' && role === 'Crewmate') || (winner === 'Imposters' && role === 'Imposter')
  };
}
