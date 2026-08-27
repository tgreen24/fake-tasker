import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { attemptJoin } from './game/joinGameFlow';
import { saveSession } from './session';
import { withTimeout, isTimeout } from './withTimeout';

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

    setJoining(true);
    setErrorMessage('');

    try {
      const result = await withTimeout(attemptJoin(gameCode, playerName));
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }

      saveSession(result.code, result.name);
      navigate(`/lobby/${result.code}`, { state: { playerName: result.name } });
    } catch (error) {
      console.error('Error joining game: ', error);
      setErrorMessage(
        isTimeout(error)
          ? 'That is taking longer than it should. Check your connection and tap Join Game again.'
          : 'Something went wrong. Please try again.'
      );
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
