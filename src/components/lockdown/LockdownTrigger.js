import React from 'react';
import TimerBar from '../TimerBar';

function LockdownTrigger({ cooldownLeft, cooldownTotal, onStart }) {
  return (
    <div className="lockdown-trigger">
      <button className="end-game-btn" onClick={onStart} disabled={cooldownLeft > 0}>
        🔒 Start Lockdown
      </button>
      {cooldownLeft > 0 && (
        <TimerBar label="Lockdown ready in" secondsLeft={cooldownLeft} totalSeconds={cooldownTotal} tone="warn" />
      )}
    </div>
  );
}

export default LockdownTrigger;
