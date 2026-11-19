import React, { useEffect, useRef, useState } from 'react';
import { chargeAfter } from '../../game/minigames/battery';
import { useOnSolved } from './useOnSolved';

const BATTERIES = 3;

function ChargeTheBatteries({ onSolved }) {
  const [levels, setLevels] = useState(() => Array(BATTERIES).fill(0));
  const held = useRef(new Set());
  const levelsRef = useRef(levels);

  // One animation loop for every battery, running only while one is held or
  // still draining.
  useEffect(() => {
    let frame;
    let last = performance.now();
    const step = (now) => {
      const elapsed = now - last;
      last = now;
      const current = levelsRef.current;
      const next = current.map((level, i) => chargeAfter(level, held.current.has(i), elapsed));
      if (next.some((level, i) => level !== current[i])) {
        levelsRef.current = next;
        setLevels(next);
      }
      if (!next.every((level) => level >= 1)) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const full = levels.every((level) => level >= 1);
  useOnSolved(full, onSolved);

  const press = (i) => (event) => {
    event.preventDefault();
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    held.current.add(i);
  };
  const release = (i) => () => held.current.delete(i);

  return (
    <div className="minigame charge-batteries">
      <p className="minigame-instructions">{full ? 'All charged!' : 'Hold each battery until it is full'}</p>
      <div className="battery-row">
        {levels.map((level, i) => (
          <button
            key={i}
            type="button"
            className={`battery ${level >= 1 ? 'full' : ''}`}
            aria-label={`Battery ${i + 1}, ${Math.floor(level * 100)} percent`}
            onPointerDown={press(i)}
            onPointerUp={release(i)}
            onPointerCancel={release(i)}
            onLostPointerCapture={release(i)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="battery-cap" aria-hidden="true" />
            <span className="battery-body" aria-hidden="true">
              <span className="battery-fill" style={{ height: `${level * 100}%` }} />
              <span className="battery-bolt">{level >= 1 ? '✓' : '⚡'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ChargeTheBatteries;
