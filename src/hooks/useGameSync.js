import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Custom hook to sync game state from Firestore and handle navigation
 * This consolidates multiple onSnapshot listeners into one
 */
export function useGameSync(gameCode, playerName, navigate) {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameCode) return;

    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.log("Game deleted. Navigating to home...");
        navigate("/");
        return;
      }

      const data = docSnapshot.data();
      setGameData(data);
      setLoading(false);
    });

    // Handle navigation sync when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && gameData && playerName) {
        handleNavigationSync(gameData, playerName, gameCode, navigate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameCode, navigate]);

  // Sync navigation on mount
  useEffect(() => {
    if (gameData && playerName && !document.hidden) {
      handleNavigationSync(gameData, playerName, gameCode, navigate);
    }
  }, [gameData, playerName, gameCode, navigate]);

  return { gameData, loading };
}

/**
 * Helper function to handle navigation based on game state
 */
function handleNavigationSync(gameData, playerName, gameCode, navigate) {
  const currentPath = window.location.pathname;

  // Check if we should be on a different screen
  if (gameData.gameEnded && !currentPath.includes('/gameover')) {
    const roles = gameData.roles || {};
    const result = roles[playerName] === 'Crewmate' && gameData.completedTasks ? 'win' : 'lose';
    navigate(`/gameover/${gameCode}`, { state: { playerName, result } });
  } else if (gameData.meetingCalled && !currentPath.includes('/voting')) {
    navigate(`/voting/${gameCode}`, { state: { playerName } });
  } else if (gameData.gameStarted && !gameData.gameEnded && !currentPath.includes('/countdown')) {
    navigate(`/countdown/${gameCode}`, { state: { playerName } });
  } else if (!gameData.gameStarted && !gameData.gameEnded && !currentPath.includes('/lobby')) {
    navigate(`/lobby/${gameCode}`, { state: { playerName } });
  }
}
