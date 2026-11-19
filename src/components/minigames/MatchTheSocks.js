import React, { useEffect, useMemo, useState } from 'react';
import Sock from './Sock';
import { dealSocks } from '../../game/minigames/socks';
import { useOnSolved } from './useOnSolved';

const SHOW_MISS_MS = 800;

function MatchTheSocks({ onSolved }) {
  const deck = useMemo(() => dealSocks(), []);
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState([]);

  useEffect(() => {
    if (open.length !== 2) return undefined;
    const [first, second] = open.map((index) => deck[index]);
    if (first.style === second.style) {
      setMatched((done) => [...done, first.style]);
      setOpen([]);
      return undefined;
    }
    const timer = setTimeout(() => setOpen([]), SHOW_MISS_MS);
    return () => clearTimeout(timer);
  }, [open, deck]);

  const pairs = deck.length / 2;
  useOnSolved(matched.length === pairs, onSolved);

  const flip = (index) => {
    if (open.length === 2 || open.includes(index) || matched.includes(deck[index].style)) return;
    setOpen((now) => [...now, index]);
  };

  return (
    <div className="minigame match-socks">
      <p className="minigame-instructions">
        {matched.length === pairs ? 'All paired up!' : 'Find the matching socks'}
      </p>
      <div className="sock-grid">
        {deck.map((card, index) => {
          const faceUp = open.includes(index) || matched.includes(card.style);
          return (
            <button
              key={card.id}
              type="button"
              className={`sock-card ${faceUp ? 'face-up' : ''} ${matched.includes(card.style) ? 'matched' : ''}`}
              aria-label={faceUp ? `Sock ${card.style}` : `Card ${index + 1}`}
              data-style={card.style}
              onClick={() => flip(index)}
            >
              {faceUp ? <Sock style={card.style} /> : <span aria-hidden="true">🧺</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MatchTheSocks;
