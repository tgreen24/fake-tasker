import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import GameLobby from './GameLobby';
import JoinGame from './JoinGame';
import Countdown from './Countdown';
import GameOver from './GameOver';
import VotingPage from './VotingPage';
import { useAuthReady } from './hooks/useAuthReady';
import './App.css';

function App() {
  const { ready, error, retry } = useAuthReady();

  if (error) {
    return (
      <div className="app-gate">
        <div className="app-gate-card">
          <h2>Can't reach the game right now</h2>
          <p>Check your connection and try again.</p>
          <button onClick={retry}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app-gate">
        <div className="app-gate-card">
          <h2>Fake Tasker</h2>
          <p>Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:gameCode" element={<GameLobby />} />
        <Route path="/countdown/:gameCode" element={<Countdown />} />
        <Route path="/gameover/:gameCode" element={<GameOver />} />
        <Route path="/voting/:gameCode" element={<VotingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
