import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

function GameOver() {
  const location = useLocation();
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const playerName = location.state?.playerName || '';
  const [isCreator, setIsCreator] = useState(false); 
  const [winningTeam, setWinningTeam] = useState('');  
  const [playerResult, setPlayerResult] = useState('');

  // Fetch game data and check if the player is the creator
  // CONSOLIDATED LISTENER - Replaces 3 separate listeners with ONE
  // Dramatically reduces Firestore reads
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        navigate("/");
        return;
      }

      const gameData = docSnapshot.data();
      const roles = gameData.roles || {};

      // Update all state from one listener
      setIsCreator(gameData.creator === playerName);

      // Determine the winning team
      const crewmates = Object.keys(roles).filter((player) => roles[player] === 'Crewmate');
      const imposters = Object.keys(roles).filter((player) => roles[player] === 'Imposter');

      // Check if crewmates won by completing all tasks
      const allCrewmatesCompletedTasks = crewmates.every((crewmate) => {
        const assignedTasks = gameData.assignedTasks?.[crewmate] || [];
        const completedTasks = gameData.completedTasks?.[crewmate] || [];
        return assignedTasks.length === completedTasks.length;
      });

      // Check if all imposters have been voted out
      const allImpostersVotedOut = imposters.every((imposter) => 
        (gameData.killList || []).includes(imposter)
      );

      if (allCrewmatesCompletedTasks || allImpostersVotedOut) {
        setWinningTeam('Crewmates Win');
      } else {
        setWinningTeam('Imposters Win');
      }

      // Set player result
      if (roles[playerName] === 'Crewmate' && (allCrewmatesCompletedTasks || allImpostersVotedOut)) {
        setPlayerResult('You Win!');
      } else if (roles[playerName] === 'Imposter' && !allCrewmatesCompletedTasks && !allImpostersVotedOut) {
        setPlayerResult('You Win!');
      } else {
        setPlayerResult('You Lose!');
      }

      // Handle navigation back to lobby when game round ends
      if (!gameData.gameStarted) {
        console.log("Game round ended. Navigating back to lobby...");
        navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator: gameData.creator === playerName, gameStarted: false } });
      }
    });

    return () => unsubscribe();
  }, [gameCode, playerName, navigate]);

  // Navigation sync when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && gameCode && playerName) {
        console.log('[GameOver] Page foregrounded, syncing navigation state');
        const gameRef = doc(db, "games", gameCode);
        const docSnapshot = await getDoc(gameRef);

        if (!docSnapshot.exists()) {
          navigate("/");
          return;
        }

        const gameData = docSnapshot.data();
        const isCreator = gameData.creator === playerName;

        if (!gameData.gameStarted && !gameData.gameEnded) {
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        } else if (gameData.gameStarted && !gameData.gameEnded) {
          navigate(`/countdown/${gameCode}`, { state: { playerName } });
        } else if (gameData.meetingCalled) {
          navigate(`/voting/${gameCode}`, { state: { playerName } });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameCode, playerName, navigate]);

  const endGameAndReturnToLobby = async () => {
    const gameRef = doc(db, "games", gameCode);

    // Set gameStarted to false to send all players back to the lobby
    await updateDoc(gameRef, { gameStarted: false, gameEnded: false });
  };

  return (
    <div className="gameover-screen">
      <div className="background-overlay">
        <div className="gameover-content">
          <div className="player-name">
            <h2>{playerName}</h2>
          </div>

          <h1 className={`winning-team ${winningTeam === 'Imposters Win' ? 'imposters-win' : 'crewmates-win'}`}>
            {winningTeam}
          </h1>

          <h2 className="player-result">{playerResult}</h2>

          {isCreator && (
            <button className="end-game-btn" onClick={endGameAndReturnToLobby}>
              End Game and Return to Lobby
            </button>
          )}
        </div>
      </div>
    </div>

  );
}

export default GameOver;
