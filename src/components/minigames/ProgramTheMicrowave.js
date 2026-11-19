import React, { useEffect, useMemo, useState } from 'react';
import { MICROWAVE_KEYS, MICROWAVE_ROUNDS, microwaveSequence } from '../../game/minigames/microwave';
import { useOnSolved } from './useOnSolved';

const LEAD_IN_MS = 700;
const LIT_MS = 450;
const GAP_MS = 220;
const WRONG_SHOWN_MS = 900;
const NEXT_ROUND_MS = 600;

// Watch the keys light up, then press them in the same order. Each round
// replays the pattern one key longer; a wrong key replays the same round.
function ProgramTheMicrowave({ onSolved }) {
  const sequence = useMemo(() => microwaveSequence(), []);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('watch');
  const [lit, setLit] = useState(null);
  const [pressed, setPressed] = useState(0);
  const length = MICROWAVE_ROUNDS[round];
  useOnSolved(phase === 'done', onSolved);

  useEffect(() => {
    if (phase !== 'watch') return undefined;
    const timers = [];
    sequence.slice(0, length).forEach((key, i) => {
      const at = LEAD_IN_MS + i * (LIT_MS + GAP_MS);
      timers.push(setTimeout(() => setLit(key), at));
      timers.push(setTimeout(() => setLit(null), at + LIT_MS));
    });
    timers.push(setTimeout(() => {
      setPressed(0);
      setPhase('input');
    }, LEAD_IN_MS + length * (LIT_MS + GAP_MS)));
    return () => timers.forEach(clearTimeout);
  }, [phase, sequence, length]);

  useEffect(() => {
    if (phase === 'wrong') {
      const timer = setTimeout(() => setPhase('watch'), WRONG_SHOWN_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'next') {
      const timer = setTimeout(() => {
        setRound((now) => now + 1);
        setPhase('watch');
      }, NEXT_ROUND_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  const press = (key) => {
    if (phase !== 'input') return;
    if (key !== sequence[pressed]) {
      setPhase('wrong');
      return;
    }
    const next = pressed + 1;
    setPressed(next);
    if (next < length) return;
    setPhase(round === MICROWAVE_ROUNDS.length - 1 ? 'done' : 'next');
  };

  const display = {
    watch: 'WATCH',
    input: `${pressed}/${length}`,
    wrong: 'ERROR',
    next: 'BEEP!',
    done: 'DONE'
  }[phase];

  return (
    <div className="minigame microwave">
      <p className="minigame-instructions">
        {phase === 'done' ? 'Dinner is ready!' : phase === 'input' ? 'Your turn: same order' : 'Watch the buttons'}
      </p>
      <p className="minigame-step">Round {round + 1} of {MICROWAVE_ROUNDS.length}</p>
      <div className={`microwave-display ${phase === 'wrong' ? 'missed error' : ''}`} aria-live="polite">{display}</div>
      <div className="microwave-keys">
        {MICROWAVE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`microwave-key ${lit === key ? 'lit' : ''}`}
            aria-label={`Key ${key}`}
            data-lit={lit === key ? 'true' : undefined}
            disabled={phase !== 'input'}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProgramTheMicrowave;
