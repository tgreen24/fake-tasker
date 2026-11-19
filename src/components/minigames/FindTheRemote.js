import React, { useEffect, useState } from 'react';
import { CUSHIONS, REMOTE_ROUNDS, makeSwaps, swapSpots } from '../../game/minigames/remote';
import { useOnSolved } from './useOnSolved';

const REVEAL_MS = 1300;
const SETTLE_MS = 450;
const ANSWER_SHOWN_MS = 1100;

const home = () => Array.from({ length: CUSHIONS }, (_, i) => i);

// Watch which cushion the remote goes under, follow it through the shuffle,
// then tap it. A wrong guess shows where it was and shuffles that round again.
function FindTheRemote({ onSolved }) {
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('reveal');
  const [spots, setSpots] = useState(home);
  const [remote, setRemote] = useState(() => Math.floor(Math.random() * CUSHIONS));
  const [guess, setGuess] = useState(null);
  const { swaps, swapMs } = REMOTE_ROUNDS[round];
  useOnSolved(phase === 'done', onSolved);

  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    const timer = setTimeout(() => setPhase('shuffle'), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [phase, attempt]);

  useEffect(() => {
    if (phase !== 'shuffle') return undefined;
    const plan = makeSwaps(Math.random, swaps);
    const timers = plan.map((swap, i) => setTimeout(() => setSpots((now) => swapSpots(now, swap)), SETTLE_MS + i * swapMs));
    timers.push(setTimeout(() => setPhase('pick'), SETTLE_MS + plan.length * swapMs + 100));
    return () => timers.forEach(clearTimeout);
  }, [phase, swaps, swapMs]);

  useEffect(() => {
    if (phase !== 'right' && phase !== 'wrong') return undefined;
    const timer = setTimeout(() => {
      setGuess(null);
      setRemote(Math.floor(Math.random() * CUSHIONS));
      setAttempt((n) => n + 1);
      if (phase === 'right') {
        if (round === REMOTE_ROUNDS.length - 1) {
          setPhase('done');
          return;
        }
        setRound((n) => n + 1);
      }
      setPhase('reveal');
    }, ANSWER_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [phase, round]);

  const pick = (cushion) => {
    if (phase !== 'pick') return;
    setGuess(cushion);
    setPhase(cushion === remote ? 'right' : 'wrong');
  };

  const showRemote = phase === 'reveal' || phase === 'right' || phase === 'wrong' || phase === 'done';
  const instructions = {
    reveal: 'Watch where the remote goes',
    shuffle: 'Keep your eye on it…',
    pick: 'Which cushion is it under?',
    right: 'Found it!',
    wrong: 'Not there! Watch again',
    done: 'Remote found!'
  }[phase];

  return (
    <div className="minigame find-remote">
      <p className="minigame-instructions">{instructions}</p>
      <p className="minigame-step">Round {round + 1} of {REMOTE_ROUNDS.length}</p>
      <div className="couch" style={{ '--swap-ms': `${swapMs}ms` }}>
        {spots.map((spot, cushion) => (
          <div key={cushion} className="cushion-slot" style={{ left: `${(spot * 100) / CUSHIONS}%` }}>
            {cushion === remote && (
              <svg viewBox="0 0 20 44" className={`remote ${showRemote ? 'shown' : ''}`} aria-hidden="true">
                <rect x="1" y="1" width="18" height="42" rx="6" fill="#2b3442" stroke="#0b0f15" strokeWidth="1.5" />
                <circle cx="10" cy="8" r="3" fill="#e5484d" />
                {[17, 23, 29, 35].map((y) => [6, 14].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#93a6bb" />))}
              </svg>
            )}
            <button
              type="button"
              className={[
                'cushion',
                showRemote && cushion === remote ? 'lifted' : '',
                guess === cushion && phase === 'wrong' ? 'missed' : ''
              ].join(' ')}
              aria-label={`Cushion ${cushion + 1}`}
              data-remote={showRemote && cushion === remote ? 'true' : undefined}
              disabled={phase !== 'pick'}
              onClick={() => pick(cushion)}
            />
          </div>
        ))}
        <div className="couch-base" aria-hidden="true" />
      </div>
    </div>
  );
}

export default FindTheRemote;
