import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveGame } from '../game/mutations';
import { clearSession } from '../session';

const CONFIRM_WINDOW_MS = 4000;

// Exists so a player is never trapped in a game nobody can end -- which
// cannot be detected, only escaped from.
function LeaveGame({ gameCode, playerName, inRound = false, role, tasksOutstanding = 0 }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const onClick = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    // Go regardless of whether the write lands; being stuck here is the thing
    // this button exists to prevent.
    if (gameCode && playerName) {
      try {
        await leaveGame(gameCode, playerName, { inRound, role, tasksOutstanding });
      } catch (error) {
        console.warn('[leave] could not remove your seat', error);
      }
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
