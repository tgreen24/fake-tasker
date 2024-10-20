import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import GameLobby from './GameLobby';
import JoinGame from './JoinGame';
import Countdown from './Countdown';
import GameOver from './GameOver';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:gameCode" element={<GameLobby />} />
        <Route path="/countdown/:gameCode" element={<Countdown />} />
        <Route path="/gameover/:gameCode" element={<GameOver />} />
      </Routes>
    </Router>
  );
}

export default App;
