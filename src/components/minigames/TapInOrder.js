import React, { useMemo, useState } from 'react';

const shuffle = (list) => {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Numbers scattered over a grid, tapped from lowest to highest. A wrong tap
// starts it over, so mashing is slower than looking.
function TapInOrder({ count = 9, onSolved }) {
  const tiles = useMemo(() => shuffle(Array.from({ length: count }, (_, i) => i + 1)), [count]);
  const [next, setNext] = useState(1);
  const [missed, setMissed] = useState(0);

  const tap = (number) => {
    if (next > count) return;
    if (number !== next) {
      setNext(1);
      setMissed((times) => times + 1);
      return;
    }
    setNext(number + 1);
    if (number === count && onSolved) onSolved();
  };

  return (
    <div className="minigame tap-in-order">
      <p className="minigame-instructions">
        {next > count ? 'Done!' : `Tap 1 to ${count} in order`}
      </p>
      <div className={`tap-grid ${missed ? 'missed' : ''}`} key={missed}>
        {tiles.map((number) => (
          <button
            key={number}
            type="button"
            className={`tap-tile ${number < next ? 'tapped' : ''}`}
            aria-label={`Tap ${number}`}
            onClick={() => tap(number)}
          >
            {number}
          </button>
        ))}
      </div>
      {missed > 0 && next === 1 && <p className="minigame-hint">Wrong one, start again from 1</p>}
    </div>
  );
}

export default TapInOrder;
