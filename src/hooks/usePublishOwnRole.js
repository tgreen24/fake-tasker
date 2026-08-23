import { useEffect } from 'react';
import { publishOwnRole } from '../game/mutations';

// Once the round is over every role is public, but each one now lives in a
// document only its owner can read -- so each player publishes their own.
// The game over roster fills in as those writes land.
export function usePublishOwnRole(gameCode, gameData, playerName, role) {
  const alreadyPublished = !!gameData?.revealed?.[playerName];
  const roundOver = !!gameData?.gameEnded;

  useEffect(() => {
    if (!roundOver || !role || !playerName || alreadyPublished) return;
    publishOwnRole(gameCode, playerName, role);
  }, [roundOver, role, playerName, alreadyPublished, gameCode]);
}
