import React from 'react';
import ConfirmButton from '../ConfirmButton';

// Deliberately as plain as the Leave link beside it, and two taps so a
// faint button cannot set a lockdown off by accident.
function LockdownTrigger({ onStart }) {
  return (
    <ConfirmButton
      className="leave-game lockdown-trigger"
      label="Lockdown"
      confirmLabel="Tap again to lock everyone down"
      onConfirm={onStart}
    />
  );
}

export default LockdownTrigger;
