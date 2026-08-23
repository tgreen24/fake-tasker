import { useEffect, useRef } from 'react';
import { endGame } from '../game/mutations';
import { decideOutcomeFromCounts, winReasonFor } from '../game/outcome';

// Settling the round used to be chained onto whichever write caused it, which
// meant a verdict could be lost when that write's effect was cleaned up before
// its await resolved. Instead every client re-checks the board on every
// snapshot: idempotent, and no single client has to survive long enough to
// finish the job.
export function useSettleOutcome(gameCode, gameData) {
  const settling = useRef(false);

  useEffect(() => {
    if (!gameData || !gameData.gameStarted || gameData.gameEnded) {
      settling.current = false;
      return;
    }

    const winner = decideOutcomeFromCounts(gameData);
    if (!winner || settling.current) return;

    settling.current = true;
    endGame(gameCode, winner, winReasonFor(gameData, winner));
  }, [gameCode, gameData]);
}
