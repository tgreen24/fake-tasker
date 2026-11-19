import React, { useEffect, useState } from 'react';
import { COOKIE_ROUNDS, makeCookieRound } from '../../game/minigames/cookies';
import { useOnSolved } from './useOnSolved';

const SHOW_MS = 1500;
const ANSWER_SHOWN_MS = 900;

// Cookies sit on the plate for a moment, then a napkin covers them. How many
// were there? A wrong answer shows them again and deals a new plate.
function CountTheCookies({ onSolved }) {
  const [round, setRound] = useState(0);
  const [plate, setPlate] = useState(() => makeCookieRound(0));
  const [phase, setPhase] = useState('show');
  useOnSolved(phase === 'done', onSolved);

  useEffect(() => {
    if (phase !== 'show') return undefined;
    const timer = setTimeout(() => setPhase('ask'), SHOW_MS);
    return () => clearTimeout(timer);
  }, [phase, plate]);

  useEffect(() => {
    if (phase !== 'right' && phase !== 'wrong') return undefined;
    const timer = setTimeout(() => {
      const next = phase === 'right' ? round + 1 : round;
      if (next === COOKIE_ROUNDS.length) {
        setPhase('done');
        return;
      }
      setRound(next);
      setPlate(makeCookieRound(next));
      setPhase('show');
    }, ANSWER_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [phase, round]);

  const answer = (count) => {
    if (phase !== 'ask') return;
    setPhase(count === plate.count ? 'right' : 'wrong');
  };

  const covered = phase === 'ask';
  const instructions = {
    show: 'Count the cookies!',
    ask: 'How many were there?',
    right: 'Right!',
    wrong: `Not quite, there were ${plate.count}`,
    done: 'Cookie count complete!'
  }[phase];

  return (
    <div className="minigame count-cookies">
      <p className="minigame-instructions">{instructions}</p>
      <p className="minigame-step">Plate {round + 1} of {COOKIE_ROUNDS.length}</p>
      <div className={`cookie-plate ${covered ? 'covered' : ''}`}>
        {!covered && phase !== 'done' && plate.spots.map((spot, i) => (
          <span
            key={i}
            className="cookie"
            aria-hidden="true"
            style={{ left: `${50 + spot.x * 50}%`, top: `${50 + spot.y * 50}%` }}
          >
            🍪
          </span>
        ))}
        {covered && <span className="cookie-napkin" aria-hidden="true" />}
      </div>
      <div className="cookie-answers">
        {plate.options.map((count) => (
          <button
            key={count}
            type="button"
            aria-label={`${count} cookies`}
            disabled={phase !== 'ask'}
            onClick={() => answer(count)}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CountTheCookies;
