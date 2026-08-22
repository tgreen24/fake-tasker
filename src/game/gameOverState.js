import { hasReachableHost, isHost } from './host';

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

export function deriveGameOverState(gameData, playerName, uid) {
  const winner = decideWinner(gameData);
  const role = gameData?.roles?.[playerName];

  return {
    winner,
    role,
    isCreator: isHost(gameData, uid),
    hostReachable: hasReachableHost(gameData),
    playerWon: (winner === 'Crewmates' && role === 'Crewmate') || (winner === 'Imposters' && role === 'Imposter')
  };
}
