import React, { useEffect, useState } from 'react';
import { allMatch, firstRoll, rollAgain } from '../../game/minigames/dice';
import { useOnSolved } from './useOnSolved';

const ROLL_MS = 450;
const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function Die({ face }) {
  return (
    <span className="die-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[face].includes(i + 1) ? 'pip' : ''} />
      ))}
    </span>
  );
}

// Roll three dice; tap any to hold them. Keep rolling until all three match.
function GameNightDice({ onSolved }) {
  const [faces, setFaces] = useState(() => firstRoll());
  const [held, setHeld] = useState([]);
  const [rolling, setRolling] = useState(false);
  const [rolls, setRolls] = useState(1);
  const matched = allMatch(faces) && !rolling;
  useOnSolved(matched, onSolved);

  useEffect(() => {
    if (!rolling) return undefined;
    const timer = setTimeout(() => {
      setFaces((now) => rollAgain(now, held));
      setRolling(false);
      setRolls((n) => n + 1);
    }, ROLL_MS);
    return () => clearTimeout(timer);
  }, [rolling, held]);

  const toggleHold = (i) => {
    if (matched || rolling) return;
    setHeld((now) => (now.includes(i) ? now.filter((d) => d !== i) : [...now, i]));
  };

  return (
    <div className="minigame game-dice">
      <p className="minigame-instructions">{matched ? 'Three of a kind!' : 'Get all three dice to match'}</p>
      <p className="minigame-step">Roll {rolls} · tap a die to hold it</p>
      <div className="dice-row">
        {faces.map((face, i) => (
          <button
            key={i}
            type="button"
            className={`die ${held.includes(i) ? 'held' : ''} ${rolling && !held.includes(i) ? 'rolling' : ''}`}
            aria-label={`Die ${i + 1} showing ${face}${held.includes(i) ? ', held' : ''}`}
            aria-pressed={held.includes(i)}
            onClick={() => toggleHold(i)}
          >
            <Die face={face} />
            <small>{held.includes(i) ? 'HELD' : ' '}</small>
          </button>
        ))}
      </div>
      <button type="button" className="dice-roll" onClick={() => setRolling(true)} disabled={matched || rolling}>
        🎲 Roll
      </button>
    </div>
  );
}

export default GameNightDice;
