import React, { useEffect, useMemo, useState } from 'react';
import { CHANGE_PROBLEMS, MONEY, formatMoney, makeChangeProblems } from '../../game/minigames/change';
import { useOnSolved } from './useOnSolved';

const TOO_MUCH_SHOWN_MS = 700;
const NEXT_PROBLEM_MS = 500;

function Problem({ problem, number, onDone }) {
  const [given, setGiven] = useState([]);
  const total = given.reduce((sum, cents) => sum + cents, 0);
  const right = total === problem.change;
  const tooMuch = total > problem.change;
  useOnSolved(right, onDone);

  useEffect(() => {
    if (!tooMuch) return undefined;
    const timer = setTimeout(() => setGiven([]), TOO_MUCH_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [tooMuch]);

  const give = (cents) => {
    if (right || tooMuch) return;
    setGiven((now) => [...now, cents]);
  };

  return (
    <>
      <p className="minigame-step">Customer {number} of {CHANGE_PROBLEMS}</p>
      <div className="change-receipt">
        <span>Costs <strong>{formatMoney(problem.price)}</strong></span>
        <span>Paid <strong>{formatMoney(problem.paid)}</strong></span>
      </div>
      <p className={`change-total ${tooMuch ? 'missed too-much' : ''} ${right ? 'right' : ''}`} aria-live="polite">
        {tooMuch ? 'Too much! Start again' : `Change given: ${formatMoney(total)}`}
      </p>
      <div className="change-money">
        {MONEY.map((money) => {
          const left = money.inDrawer - given.filter((cents) => cents === money.cents).length;
          return (
            <button
              key={money.cents}
              type="button"
              className={`money ${money.kind}`}
              aria-label={`Give ${money.label}, ${left} left`}
              disabled={left <= 0}
              onClick={() => give(money.cents)}
            >
              {money.label}
              <small>{left} left</small>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="leave-game change-clear"
        onClick={() => setGiven([])}
        disabled={!given.length || right}
      >
        Take it back
      </button>
    </>
  );
}

// Count back the change for three customers, from bills and quarters.
function MakeChange({ onSolved }) {
  const problems = useMemo(() => makeChangeProblems(), []);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  useOnSolved(finished, onSolved);

  const problemDone = () => {
    if (index === problems.length - 1) {
      setFinished(true);
      return;
    }
    setTimeout(() => setIndex((now) => now + 1), NEXT_PROBLEM_MS);
  };

  return (
    <div className="minigame make-change">
      <p className="minigame-instructions">{finished ? 'Register balanced!' : 'Give the right change'}</p>
      <Problem key={index} problem={problems[index]} number={index + 1} onDone={problemDone} />
    </div>
  );
}

export default MakeChange;
