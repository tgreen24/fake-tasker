import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { loadSession, saveSession } from '../session';

export function usePlayerName(gameCode) {
  const location = useLocation();
  const fromRouter = location.state?.playerName;

  const [playerName] = useState(() => {
    if (fromRouter) return fromRouter;
    const stored = loadSession();
    return stored && stored.gameCode === gameCode ? stored.playerName : '';
  });

  useEffect(() => {
    if (playerName && gameCode) saveSession(gameCode, playerName);
  }, [playerName, gameCode]);

  return playerName;
}
