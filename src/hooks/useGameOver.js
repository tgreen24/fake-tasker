import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentUid } from '../firebase';
import { publishRoles, returnToLobby } from '../game/mutations';
import { deriveGameOverState } from '../game/gameOverState';
import { clearSession } from '../session';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';
import { usePrivateRole } from './usePrivateRole';
import { usePublishOwnRole } from './usePublishOwnRole';

export function useGameOver(gameCode) {
  const navigate = useNavigate();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);
  const { privateData } = usePrivateRole(gameCode, playerName);
  usePublishOwnRole(
    gameCode, gameData, playerName, privateData?.role, privateData?.completedTasks?.length
  );
  const [errorMessage, setErrorMessage] = useState('');

  // Every role is public once the round is over, but each lives on its owner's
  // phone -- so a traitor in a pocket was simply missing from the reveal. A
  // traitor was dealt everybody's, and publishes whatever has not arrived.
  const roleMap = privateData?.roleMap;
  const gameEnded = !!gameData?.gameEnded;
  const missingKey = (gameData?.players || [])
    .filter((name) => !(gameData?.revealed || {})[name]).join('\n');
  const published = useRef('');
  useEffect(() => {
    if (!gameEnded || !roleMap || !missingKey || published.current === missingKey) return;
    const roles = Object.fromEntries(
      missingKey.split('\n').filter((name) => roleMap[name]).map((name) => [name, roleMap[name]])
    );
    if (!Object.keys(roles).length) return;
    published.current = missingKey;
    publishRoles(gameCode, roles).then((saved) => {
      if (!saved) published.current = '';
    });
  }, [gameEnded, roleMap, missingKey, gameCode]);

  const summary = useMemo(
    () => deriveGameOverState(gameData, playerName, currentUid(), privateData),
    [gameData, playerName, privateData]
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
    state: {
      ...summary, playerName, errorMessage,
      seatRequests: gameData?.seatRequests || {}, dealtSeats: gameData?.dealtSeats || [],
    },
    actions: { endGameAndReturnToLobby, leaveGame },
    loading,
    connected
  };
}
