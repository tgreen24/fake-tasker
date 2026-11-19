import React, { useMemo, useRef, useState } from 'react';
import { PAN, makeDust, push } from '../../game/minigames/sweep';
import { useOnSolved } from './useOnSolved';
import { useDrag } from './useDrag';

// Push each pile of dust into the dustpan with your finger, like a broom.
function SweepTheFloor({ onSolved }) {
  const start = useMemo(() => makeDust(), []);
  const [piles, setPiles] = useState(start);
  const floor = useRef(null);
  const last = useRef(null);
  const done = piles.every((pile) => pile.swept);
  useOnSolved(done, onSolved);

  const at = (event) => {
    const box = floor.current.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };

  const dragHandlers = useDrag({
    onStart: (event) => {
      last.current = at(event);
    },
    onMove: (event) => {
      if (!last.current || done) return;
      const now = at(event);
      const from = last.current;
      last.current = now;
      setPiles((current) => push(current, from, now));
    },
    onEnd: () => {
      last.current = null;
    }
  });

  const left = piles.filter((pile) => !pile.swept).length;
  return (
    <div className="minigame sweep-floor">
      <p className="minigame-instructions">{done ? 'Spotless!' : 'Push the dust into the dustpan'}</p>
      <p className="minigame-step">{left} {left === 1 ? 'pile' : 'piles'} left</p>
      <div
        ref={floor}
        className="floor"
        role="img"
        aria-label={`Floor with ${left} piles of dust`}
        {...dragHandlers()}
      >
        <div
          className="dustpan"
          aria-hidden="true"
          style={{ left: `${PAN.left * 100}%`, width: `${(PAN.right - PAN.left) * 100}%`, top: `${PAN.top * 100}%` }}
        />
        {piles.filter((pile) => !pile.swept).map((pile) => (
          <span
            key={pile.id}
            className="dust"
            data-x={pile.x.toFixed(3)}
            data-y={pile.y.toFixed(3)}
            aria-hidden="true"
            style={{ left: `${pile.x * 100}%`, top: `${pile.y * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default SweepTheFloor;
