import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../session';

const CONFIRM_WINDOW_MS = 4000;

// Purely local: no write, nothing for anyone else to see. It exists so a
// player is never trapped in a game nobody can end -- which cannot be
// detected, only escaped from.
function LeaveGame() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearSession();
    navigate('/', { replace: true });
  };

  return (
    <button className={`leave-game ${confirming ? 'confirming' : ''}`} onClick={onClick}>
      {confirming ? 'Tap again to leave' : 'Leave game'}
    </button>
  );
}

export default LeaveGame;
