import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');

  const generateGameCode = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleCreateGame = () => {
    if (playerName.trim() !== '') {
      const gameCode = generateGameCode();
      navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator: true } }); // Pass playerName and isCreator flag
    } else {
      alert('Please enter a player name.');
    }
  };

  const handleJoinGame = () => {
    if (playerName.trim() !== '') {
      navigate('/join', { state: { playerName } }); // Pass playerName to the Join screen
    } else {
      alert('Please enter a player name.');
    }
  };

  return (
    <div className="home">
      <h1>Fake Tasker</h1>
      <input
        type="text"
        placeholder="Enter your player name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="name-input"  // Add class for styling
      />
      <button onClick={handleCreateGame}>
        Create Game
      </button>
      <button onClick={handleJoinGame}>
        Join Game
      </button>
    </div>
  );
}

export default Home;
