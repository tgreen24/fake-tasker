import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import GameLobby from './GameLobby';
import JoinGame from './JoinGame';
import Countdown from './Countdown';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:gameCode" element={<GameLobby />} />
        <Route path="/countdown/:gameCode" element={<Countdown />} />
      </Routes>
    </Router>
  );
}

export default App;
