import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GLASSES, glassVerdict, makeBands, pourAfter } from '../../game/minigames/glass';
import { useOnSolved } from './useOnSolved';

const TICK_MS = 30;
const SPILL_SHOWN_MS = 800;
const NEXT_GLASS_MS = 500;

// Hold to pour, let go between the lines. Letting go too early is fine -- keep
// topping it up -- but going over the top line spills it and starts again.
function Glass({ band, number, onDone }) {
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState(null);
  const pouring = useRef(false);
  const levelRef = useRef(0);
  useOnSolved(result === 'filled', onDone);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pouring.current) return;
      const next = pourAfter(levelRef.current, TICK_MS);
      levelRef.current = next;
      setLevel(next);
      if (glassVerdict(next, band) === 'spilled') {
        pouring.current = false;
        setResult('spilled');
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [band]);

  useEffect(() => {
    if (result !== 'spilled') return undefined;
    const timer = setTimeout(() => {
      levelRef.current = 0;
      setLevel(0);
      setResult(null);
    }, SPILL_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const start = (event) => {
    event.preventDefault();
    if (result) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pouring.current = true;
  };
  const stop = () => {
    if (!pouring.current) return;
    pouring.current = false;
    if (glassVerdict(levelRef.current, band) === 'filled') setResult('filled');
  };

  const percent = Math.round(Math.min(level, 1) * 100);
  return (
    <>
      <p className="minigame-step">Glass {number} of {GLASSES}</p>
      <div className={`glass ${result || ''} ${result === 'spilled' ? 'missed' : ''}`}>
        <div className="glass-band" style={{ bottom: `${band.low * 100}%`, height: `${(band.high - band.low) * 100}%` }} />
        <div className="glass-milk" style={{ height: `${Math.min(level, 1) * 100}%` }} />
      </div>
      <p className="minigame-hint glass-status" aria-live="polite">
        {result === 'spilled' ? 'Too full! It spilled' : result === 'filled' ? 'Perfect!' : ' '}
      </p>
      <button
        type="button"
        className="pour-button"
        aria-label={`Hold to pour, ${percent} percent full`}
        data-low={Math.round(band.low * 100)}
        data-high={Math.round(band.high * 100)}
        disabled={!!result}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(event) => event.preventDefault()}
      >
        🥛 Hold to pour
      </button>
    </>
  );
}

function FillTheGlass({ onSolved }) {
  const bands = useMemo(() => makeBands(), []);
  const [glass, setGlass] = useState(0);
  const [finished, setFinished] = useState(false);
  useOnSolved(finished, onSolved);

  const glassDone = () => {
    if (glass === bands.length - 1) {
      setFinished(true);
      return;
    }
    setTimeout(() => setGlass((n) => n + 1), NEXT_GLASS_MS);
  };

  return (
    <div className="minigame fill-glass">
      <p className="minigame-instructions">{finished ? 'Everyone has a drink!' : 'Stop pouring between the lines'}</p>
      <Glass key={glass} band={bands[glass]} number={glass + 1} onDone={glassDone} />
    </div>
  );
}

export default FillTheGlass;
