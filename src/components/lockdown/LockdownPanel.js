import React from 'react';
import TimerBar from '../TimerBar';
import TapInOrder from '../minigames/TapInOrder';
import CodeEntry from './CodeEntry';
import { formatCode } from '../../game/lockdown';
import { useSolvedOnce } from '../../hooks/useSolvedOnce';

const listNames = (names) => (names.length > 1
  ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  : names[0]);

function YourPart({ part, onEnterCode }) {
  if (part.kind === 'give') {
    return (
      <div className="lockdown-step">
        <p>Give this code to <strong>{listNames(part.to)}</strong>:</p>
        <p className="lockdown-code">{formatCode(part.code)}</p>
      </div>
    );
  }
  if (part.entered) return <p className="lockdown-accepted">✓ Your code is in.</p>;
  return <CodeEntry from={part.from} onEnter={onEnterCode} />;
}

// Keyed by the lockdown it belongs to, so a second lockdown starts unsolved.
function LockdownPanel({ gameCode, playerName, lockdown, onEnterCode }) {
  const { secondsLeft, secondsTotal, done, needed, part, startedAt } = lockdown;
  const [solved, markSolved] = useSolvedOnce(`fake-tasker:lockdown:${gameCode}:${startedAt}:${playerName}`);

  return (
    <section className="lockdown" aria-live="polite">
      <h2 className="lockdown-title">🔒 Lockdown</h2>
      <TimerBar label="Lift it before time runs out" secondsLeft={secondsLeft} totalSeconds={secondsTotal} />
      <p className="lockdown-count">Codes in: <strong>{done} of {needed}</strong></p>

      {part && !solved && (
        <div className="lockdown-step">
          <p>Solve this to {part.kind === 'give' ? 'see your code' : 'unlock your keypad'}.</p>
          <TapInOrder onSolved={markSolved} />
        </div>
      )}
      {part && solved && <YourPart part={part} onEnterCode={onEnterCode} />}
    </section>
  );
}

export default LockdownPanel;
