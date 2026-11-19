import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from './components/ScreenHeader';
import { MINIGAMES } from './components/minigames';

function PracticeRun({ game }) {
  const [attempt, setAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [time, setTime] = useState(null);
  const { Component } = game;

  const again = () => {
    setAttempt((n) => n + 1);
    setStartedAt(Date.now());
    setTime(null);
  };

  return (
    <div className="practice-run">
      <Component key={attempt} onSolved={() => setTime((Date.now() - startedAt) / 1000)} />
      {time !== null && (
        <div className="practice-result">
          <p>Solved in {time.toFixed(1)}s</p>
          <button onClick={again}>Play Again</button>
        </div>
      )}
    </div>
  );
}

function Practice() {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(null);
  const game = MINIGAMES.find((entry) => entry.id === chosen);

  return (
    <div className="home practice">
      <div className="home-card">
        <ScreenHeader title="Practice" />
        {game ? (
          <>
            <h2>{game.name}</h2>
            <PracticeRun game={game} />
            <button className="leave-game" onClick={() => setChosen(null)}>All minigames</button>
          </>
        ) : (
          <>
            <p>Try the minigames before a game.</p>
            <ul className="practice-list">
              {MINIGAMES.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => setChosen(entry.id)}>
                    <span aria-hidden="true">{entry.icon}</span> {entry.name}
                  </button>
                </li>
              ))}
            </ul>
            <button className="leave-game" onClick={() => navigate('/')}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}

export default Practice;
