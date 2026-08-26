import { useEffect } from 'react';
import { publishOwnSummary } from '../game/mutations';

// Once the round is over every role is public, but each one now lives in a
// document only its owner can read -- so each player publishes their own.
// The game over roster fills in as those writes land.
export function usePublishOwnRole(gameCode, gameData, playerName, role, tasksDone) {
  const alreadyPublished = !!gameData?.revealed?.[playerName];
  const countPublished = gameData?.taskCounts?.[playerName] !== undefined;
  const roundOver = !!gameData?.gameEnded;

  useEffect(() => {
    if (!roundOver || !role || !playerName) return;
    if (alreadyPublished && countPublished) return;
    // Nobody else can read your task document, so the count the badges need has
    // to come from you -- published alongside your role in a single write.
    publishOwnSummary(gameCode, playerName, role, tasksDone);
  }, [roundOver, role, playerName, alreadyPublished, countPublished, tasksDone, gameCode]);
}
