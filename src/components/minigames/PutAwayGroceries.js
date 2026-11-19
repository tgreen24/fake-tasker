import React, { useMemo, useRef, useState } from 'react';
import { dealGroceries, swipePlace } from '../../game/minigames/pantry';
import { useOnSolved } from './useOnSolved';
import { useDrag } from './useDrag';

// Swipe each item left into the fridge or right into the pantry. The two
// buttons do the same, for anyone whose swipe keeps scrolling the page.
function PutAwayGroceries({ onSolved }) {
  const items = useMemo(() => dealGroceries(), []);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(null);
  const startX = useRef(0);
  const [missed, setMissed] = useState(0);
  const done = index >= items.length;
  useOnSolved(done, onSolved);

  const item = items[index];
  const putAway = (place) => {
    if (done || !place) return;
    if (place === item.place) {
      setIndex((n) => n + 1);
    } else {
      setMissed((n) => n + 1);
    }
  };

  const dragHandlers = useDrag({
    onStart: (event) => {
      startX.current = event.clientX;
      setDx(0);
    },
    onMove: (event) => setDx(event.clientX - startX.current),
    onEnd: (event, { cancelled }) => {
      setDx(null);
      if (!cancelled) putAway(swipePlace(event.clientX - startX.current));
    }
  });

  return (
    <div className="minigame put-away">
      <p className="minigame-instructions">
        {done ? 'All put away!' : 'Swipe left for the fridge, right for the pantry'}
      </p>
      <p className="minigame-step">{Math.min(index, items.length)} of {items.length} put away</p>
      <div className="put-away-counter">
        <span className="put-away-side fridge" aria-hidden="true">❄️<small>Fridge</small></span>
        {done ? (
          <span className="grocery-card empty" aria-hidden="true">✓</span>
        ) : (
          <div
            key={`${index}-${missed}`}
            className={`grocery-card ${missed ? 'missed' : ''} ${dx !== null ? 'dragging' : ''}`}
            style={dx !== null ? { transform: `translateX(${dx}px) rotate(${dx / 12}deg)` } : undefined}
            role="img"
            aria-label={item.name}
            data-place={item.place}
            {...dragHandlers()}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <small>{item.name}</small>
          </div>
        )}
        <span className="put-away-side pantry" aria-hidden="true">🥫<small>Pantry</small></span>
      </div>
      <div className="put-away-buttons">
        <button type="button" onClick={() => putAway('fridge')} disabled={done}>❄️ Fridge</button>
        <button type="button" onClick={() => putAway('pantry')} disabled={done}>Pantry 🥫</button>
      </div>
    </div>
  );
}

export default PutAwayGroceries;
