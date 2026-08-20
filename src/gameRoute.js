export const RESULT_DISPLAY_MS = 5000;

export function routeForState(gameData, playerName, gameCode, now = Date.now()) {
  if (!gameData) return '/';

  const players = gameData.players || [];
  if (playerName && players.length > 0 && !players.includes(playerName)) return '/';

  if (showingVoteResult(gameData, now)) return `/voting/${gameCode}`;
  if (gameData.gameEnded) return `/gameover/${gameCode}`;
  if (gameData.meetingCalled) return `/voting/${gameCode}`;
  if (gameData.gameStarted) return `/countdown/${gameCode}`;
  return `/lobby/${gameCode}`;
}

export function showingVoteResult(gameData, now = Date.now()) {
  const until = gameData?.resultUntil;
  if (!until || now >= until) return false;
  return until - now <= RESULT_DISPLAY_MS;
}
