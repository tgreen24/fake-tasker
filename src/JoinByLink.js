import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { attemptJoin } from './game/joinGameFlow';
import { loadSession, saveSession } from './session';

// Arrived from a link in a group chat: the code is in the URL, the name is not.
function JoinByLink() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const code = (gameCode || '').toUpperCase();

  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [joining, setJoining] = useState(false);

  // Already in this game on this device -- a link that gets you back in.
  useEffect(() => {
    const stored = loadSession();
    if (stored && stored.gameCode === code && stored.playerName) {
      navigate(`/lobby/${code}`, { replace: true, state: { playerName: stored.playerName } });
    }
  }, [code, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setJoining(true);
    setErrorMessage('');

    try {
      const result = await attemptJoin(code, playerName);
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }
      saveSession(result.code, result.name);
      navigate(`/lobby/${result.code}`, { state: { playerName: result.name } });
    } catch (error) {
      console.error('Error joining game:', error);
      setErrorMessage('Could not join that game. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="join-game-container">
      <div className="join-game-card">
        <p className="joining-line">Joining game <strong>{code}</strong></p>

        <form onSubmit={submit} className="join-form">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
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

export default JoinByLink;
