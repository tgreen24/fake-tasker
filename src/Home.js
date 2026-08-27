import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createGame } from './game/mutations';
import { saveSession } from './session';
import { withTimeout, isTimeout } from './withTimeout';

const CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

function generateGameCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARACTERS.charAt(Math.floor(Math.random() * CODE_CHARACTERS.length));
  }
  return code;
}

function Home() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateGame = async () => {
    const name = playerName.trim();
    if (!name) {
      setErrorMessage('Please enter a player name.');
      return;
    }

    setCreating(true);
    setErrorMessage('');

    try {
      const gameCode = await withTimeout((async () => {
        for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
          const candidate = generateGameCode();
          const existing = await getDoc(doc(db, 'games', candidate));
          if (!existing.exists()) {
            await createGame(candidate, name);
            return candidate;
          }
        }
        return null;
      })());

      if (!gameCode) {
        setErrorMessage('Every code we tried was taken. Please try again.');
        return;
      }

      saveSession(gameCode, name);
      navigate(`/lobby/${gameCode}`, { state: { playerName: name } });
    } catch (error) {
      console.error('Error creating game:', error);
      setErrorMessage(
        isTimeout(error)
          ? "That is taking longer than it should. Check your connection and tap Create Game again."
          : error?.code === 'permission-denied'
          ? 'Your app is out of date. Please reload the page.'
          : 'Could not create a game right now. Please try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGame = () => {
    const name = playerName.trim();
    if (!name) {
      setErrorMessage('Please enter a player name.');
      return;
    }
    navigate('/join', { state: { playerName: name } });
  };

  return (
    <div className="home">
      <div className="home-card">
        <h1>Fake Tasker</h1>
        <input
          type="text"
          placeholder="Enter your player name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          className="name-input"
        />
        <button onClick={handleCreateGame} disabled={creating}>
          {creating ? 'Creating…' : 'Create Game'}
        </button>
        <button className="join-button" onClick={handleJoinGame} disabled={creating}>Join Game</button>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>
    </div>
  );
}

export default Home;
