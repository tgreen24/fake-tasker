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
  useEffect(() => {
    const fetchGameData = async () => {
      const gameRef = doc(db, "games", gameCode);
      const gameData = (await getDoc(gameRef)).data();

      // Determine the winning team
      const crewmates = Object.keys(gameData.roles).filter((player) => gameData.roles[player] === 'Crewmate');
      const imposters = Object.keys(gameData.roles).filter((player) => gameData.roles[player] === 'Imposter');

      // Determine if the crewmates won by completing all tasks
      const allCrewmatesCompletedTasks = crewmates.every((crewmate) => {
        const assignedTasks = gameData.assignedTasks[crewmate] || [];
        const completedTasks = gameData.completedTasks?.[crewmate] || [];
        return assignedTasks.length === completedTasks.length;
      });

      // Check if all imposters have been voted out
      const allImpostersVotedOut = imposters.every((imposter) => gameData.killList.includes(imposter));

      if (allCrewmatesCompletedTasks || allImpostersVotedOut) {
        setWinningTeam('Crewmates Win');
      } else {
        setWinningTeam('Imposters Win');
      }

      // Set the isCreator flag based on Firestore data
      setIsCreator(gameData.creator === playerName);
    };

    fetchGameData();
  }, [gameCode, playerName]);

  // Listener for game end
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();

        // If gameStarted is false, navigate everyone back to the lobby
        if (!gameData.gameStarted) {
          console.log("Game round ended. Navigating back to lobby...");
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        }

     }
    });
    return () => unsubscribe();  // Clean up the listener when the component unmounts
  }, [gameCode, navigate, playerName, isCreator]);

  // Navigation sync: Check game state on mount and when page becomes visible
  useEffect(() => {
    const syncNavigationState = async () => {
      if (!gameCode || !playerName) return;

      const gameRef = doc(db, "games", gameCode);
      const docSnapshot = await getDoc(gameRef);

      if (!docSnapshot.exists()) {
        // Game deleted, go home
        navigate("/");
        return;
      }

      const gameData = docSnapshot.data();

      // Check if we should be on a different screen
      if (!gameData.gameStarted && !gameData.gameEnded) {
        // Should be back in lobby
        navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
      } else if (gameData.gameStarted && !gameData.gameEnded) {
        // Game is still running, should be in countdown
        navigate(`/countdown/${gameCode}`, { state: { playerName } });
      } else if (gameData.meetingCalled) {
        // Meeting called, should be on voting page
        navigate(`/voting/${gameCode}`, { state: { playerName } });
      }
    };

    // Sync on mount
    syncNavigationState();

    // Sync when page becomes visible (user returns from backgrounding)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[GameOver] Page foregrounded, syncing navigation state');
        syncNavigationState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameCode, playerName, navigate, isCreator]);

  // Set the player result based on the winning team
  useEffect(() => {
    if (winningTeam) {
      const fetchGameResult = async () => {
        const gameRef = doc(db, "games", gameCode);
        const gameData = (await getDoc(gameRef)).data();

        // Determine if the player won or lost
        if (gameData.roles[playerName] === 'Crewmate' && winningTeam === 'Crewmates Win') {
          setPlayerResult('You Win!');
        } else if (gameData.roles[playerName] === 'Imposter' && winningTeam === 'Imposters Win') {
          setPlayerResult('You Win!');
        } else {
          setPlayerResult('You Lose!');
        }
      };

      fetchGameResult();
    }
  }, [winningTeam, gameCode, playerName]);

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
