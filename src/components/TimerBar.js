import React from 'react';
import { formatClock } from '../game/playerColor';

const SEGMENTS = 12;

function TimerBar({ label, secondsLeft, totalSeconds, tone = 'danger' }) {
  const remaining = Math.max(0, secondsLeft || 0);
  const total = Math.max(1, totalSeconds || 1);
  const lit = Math.ceil((remaining / total) * SEGMENTS);

  return (
    <div className={`timer-bar timer-${tone}`}>
      <div className="timer-label">{label}</div>
      <div className="timer-clock">{formatClock(remaining)}</div>
      <div className="timer-segments" aria-hidden="true">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span key={i} className={i < lit ? 'lit' : ''} />
        ))}
      </div>
    </div>
  );
}

export default TimerBar;
