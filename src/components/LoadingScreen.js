import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConnectionBanner from './ConnectionBanner';
import { clearSession } from '../session';

const GIVE_UP_MS = 15000;

// Never a dead end: a screen still loading after this long says so and offers
// the two things a player can actually do about it.
function LoadingScreen({ className, connected, gameCode }) {
  const navigate = useNavigate();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={className}>
      <ConnectionBanner connected={connected} />
      {slow ? (
        <div className="loading-stuck" role="alert">
          <h2>Can't reach game {gameCode}</h2>
          <p>Check your signal, then try again. The game carries on without you while you do.</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
          <button
            className="leave-game"
            onClick={() => {
              clearSession();
              navigate('/', { replace: true });
            }}
          >
            Leave game
          </button>
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
}

export default LoadingScreen;
