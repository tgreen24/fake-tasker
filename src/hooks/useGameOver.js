import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentUid } from '../firebase';
import { returnToLobby } from '../game/mutations';
import { deriveGameOverState } from '../game/gameOverState';
import { clearSession } from '../session';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';

export function useGameOver(gameCode) {
  const navigate = useNavigate();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);
  const [errorMessage, setErrorMessage] = useState('');

  const summary = useMemo(
    () => deriveGameOverState(gameData, playerName, currentUid()),
    [gameData, playerName]
  );

  const endGameAndReturnToLobby = useCallback(async () => {
    setErrorMessage('');
    const ok = await returnToLobby(gameCode);
    if (!ok) setErrorMessage('Could not return everyone to the lobby. Check your connection and try again.');
  }, [gameCode]);

  const leaveGame = useCallback(() => {
    clearSession();
    navigate('/', { replace: true });
  }, [navigate]);

  return {
    state: { ...summary, playerName, errorMessage },
    actions: { endGameAndReturnToLobby, leaveGame },
    loading,
    connected
  };
}
