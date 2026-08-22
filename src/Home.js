import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { saveSession } from './session';

const CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;
const GAME_LIFETIME_MS = 24 * 60 * 60 * 1000;

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
      let gameCode = null;
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
        const candidate = generateGameCode();
        const existing = await getDoc(doc(db, 'games', candidate));
        if (!existing.exists()) {
          gameCode = candidate;
          break;
        }
      }

      if (!gameCode) {
        setErrorMessage('Could not create a game right now. Please try again.');
        return;
      }

      await setDoc(doc(db, 'games', gameCode), {
        players: [name],
        creator: name,
        creatorUid: auth.currentUser?.uid || null,
        tasks: [],
        gameStarted: false,
        gameEnded: false,
        meetingCalled: false,
        imposterHistory: {},
        imposterCount: 1,
        tasksPerCrewmate: 3,
        killCooldown: 30,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + GAME_LIFETIME_MS)
      });

      saveSession(gameCode, name);
      navigate(`/lobby/${gameCode}`, { state: { playerName: name } });
    } catch (error) {
      console.error('Error creating game:', error);
      setErrorMessage('Could not create a game right now. Please try again.');
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
