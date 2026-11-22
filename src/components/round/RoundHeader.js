import React, { useEffect, useState } from 'react';
import ConfirmButton from '../ConfirmButton';
import LeaveGame from '../LeaveGame';
import { HoldForRole } from './RoleCard';
import { MoreIcon } from './Icons';

// Name, the role you can hold to see, and a menu for the rarely needed: the
// guide, leaving, and for the host ending the round. The host's screen is
// otherwise exactly everyone else's.
function RoundHeader({ playerName, role, isDead, fellowImposters, isHost, onGuide, onEndRound, leave }) {
  return (
    <header className="round-header">
      <div className="round-avatar" aria-hidden="true">{(playerName || '?').slice(0, 1).toUpperCase()}</div>
      <h1 className="round-name">{playerName}</h1>
      <HoldForRole role={role} isDead={isDead} fellowImposters={fellowImposters} />
      <RoundMenu isHost={isHost} onGuide={onGuide} onEndRound={onEndRound} leave={leave} />
    </header>
  );
}

function RoundMenu({ isHost, onGuide, onEndRound, leave }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="round-menu">
      <button
        type="button"
        className="round-icon-button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
      >
        <MoreIcon />
      </button>
      {open && (
        <>
          <button type="button" className="round-menu-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="round-menu-panel">
            <button
              type="button"
              className="round-menu-item"
              onClick={() => {
                setOpen(false);
                onGuide();
              }}
            >
              How to play
            </button>
            {isHost && (
              <ConfirmButton
                className="round-menu-item danger"
                label="End Game Round"
                confirmLabel="Tap again to end the round"
                onConfirm={() => {
                  setOpen(false);
                  onEndRound();
                }}
              />
            )}
            <LeaveGame {...leave} />
          </div>
        </>
      )}
    </div>
  );
}

export default RoundHeader;
