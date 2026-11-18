import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { currentUid, db } from '../firebase';
import { requestSeat } from '../game/mutations';

// The name is taken by a seat this browser does not hold. That is either
// somebody else, or this player on a new browser -- a chat app's built-in one,
// a borrowed phone -- and only the host, stood in the same room, can say which.
function ClaimSeat({ gameCode, playerName, onGranted = () => {}, onCancel, message }) {
  const [status, setStatus] = useState('idle');
  const asked = useRef(false);
  const granted = useRef(onGranted);
  granted.current = onGranted;

  useEffect(() => {
    if (status !== 'asking') return undefined;
    const uid = currentUid();
    return onSnapshot(doc(db, 'games', gameCode), (snapshot) => {
      const game = snapshot.data();
      if (!game) return;
      if ((game.playerUids || {})[playerName] === uid) {
        setStatus('granted');
        granted.current();
        return;
      }
      const pending = (game.seatRequests || {})[playerName] === uid;
      if (pending) asked.current = true;
      else if (asked.current) setStatus('refused');
    }, () => {});
  }, [status, gameCode, playerName]);

  const ask = async () => {
    asked.current = false;
    setStatus('asking');
    const sent = await requestSeat(gameCode, playerName);
    if (!sent) setStatus('failed');
  };

  return (
    <div className="claim-seat">
      <p>{message || <>Somebody in this game is already called <strong>{playerName}</strong>.</>}</p>
      {status === 'asking' || status === 'granted' ? (
        <p className="vote-progress" role="status">
          Asking the host to let you back in. They will see a button on their screen.
        </p>
      ) : (
        <>
          {status === 'refused' && <p className="error-message">The host did not let you in.</p>}
          {status === 'failed' && <p className="error-message">Could not reach the game. Try again.</p>}
          <button className="join-button" onClick={ask}>
            That's me — take {playerName}'s seat
          </button>
        </>
      )}
      {onCancel && <button className="leave-game" onClick={onCancel}>Use a different name</button>}
    </div>
  );
}

export default ClaimSeat;
