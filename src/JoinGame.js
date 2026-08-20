import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { saveSession } from './session';

const MAX_PLAYERS = 25;

function JoinGame() {
  const [gameCode, setGameCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const playerName = (location.state?.playerName || '').trim();

  const handleJoinGame = async (e) => {
    e.preventDefault();

    if (!playerName) {
      navigate('/');
      return;
    }

    const code = gameCode.trim().toUpperCase();
    const gameRef = doc(db, 'games', code);

    setJoining(true);
    setErrorMessage('');

    try {
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        setErrorMessage('Invalid game code. Please try again.');
        return;
      }

      const gameData = gameDoc.data();
      const currentPlayers = gameData.players || [];
      const alreadySeated = currentPlayers.includes(playerName);

      // Reclaiming your own seat after losing the tab is a reconnect, not a join.
      if (gameData.gameStarted) {
        if (!alreadySeated) {
          setErrorMessage('That game is already in progress.');
          return;
        }
        saveSession(code, playerName);
        navigate(`/lobby/${code}`, { state: { playerName } });
        return;
      }

      if (alreadySeated) {
        setErrorMessage(`Someone in this game is already called "${playerName}". Go back and pick another name.`);
        return;
      }

      if (currentPlayers.length >= MAX_PLAYERS) {
        setErrorMessage('The game is full. Please try another game.');
        return;
      }

      await updateDoc(gameRef, { players: arrayUnion(playerName) });

      saveSession(code, playerName);
      navigate(`/lobby/${code}`, { state: { playerName } });
    } catch (error) {
      console.error('Error joining game: ', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="join-game-container">
      <div className="join-game-card">
        <h2>Join a Game</h2>
        <form onSubmit={handleJoinGame} className="join-form">
          <input
            type="text"
            placeholder="Enter game code"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            required
            className="join-input"
          />
          <button type="submit" className="join-button" disabled={joining}>
            {joining ? 'Joining…' : 'Join Game'}
          </button>
        </form>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default JoinGame;
