import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import GameLobby from './GameLobby';
import JoinGame from './JoinGame';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinGame />} />
        <Route path="/lobby/:gameCode" element={<GameLobby />} />
      </Routes>
    </Router>
  );
}

export default App;
