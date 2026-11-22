import React, { useState } from 'react';
import { takeSeat } from '../game/mutations';

// The name belongs to a seat this browser does not hold. That is either this
// player on a new phone or browser -- a chat app's built-in one, a borrowed
// phone -- or somebody who typed a name that is taken. One tap takes the seat;
// asking first means a typo never bumps the real player.
function ClaimSeat({ gameCode, playerName, onGranted = () => {}, onCancel, message }) {
  const [status, setStatus] = useState('idle');

  const take = async () => {
    setStatus('taking');
    const taken = await takeSeat(gameCode, playerName);
    if (!taken) {
      setStatus('failed');
      return;
    }
    setStatus('taken');
    onGranted();
  };

  return (
    <div className="claim-seat">
      <p>{message || <>Somebody in this game is already called <strong>{playerName}</strong>. If that's you on a new phone or browser, take your seat back.</>}</p>
      {status === 'failed' && <p className="error-message">Could not reach the game. Try again.</p>}
      {status === 'taken' ? (
        <p className="vote-progress" role="status">Getting you back in…</p>
      ) : (
        <button className="join-button" onClick={take} disabled={status === 'taking'}>
          {status === 'taking' ? 'Taking your seat…' : `That's me — take ${playerName}'s seat`}
        </button>
      )}
      {onCancel && <button className="leave-game" onClick={onCancel}>Use a different name</button>}
    </div>
  );
}

export default ClaimSeat;
