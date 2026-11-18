import React, { useState } from 'react';
import { dismissSeatRequest, grantSeat } from '../game/mutations';

// The other half of ClaimSeat: the host is the one person who can look across
// the room and see whether that really is Sam on a new phone.
function SeatRequests({ gameCode, isHost, requests, dealtSeats }) {
  const [busy, setBusy] = useState(null);
  const names = Object.keys(requests || {}).filter((name) => requests[name]);
  if (!isHost || names.length === 0) return null;

  const act = async (name, work) => {
    setBusy(name);
    await work();
    setBusy(null);
  };

  return (
    <div className="seat-requests" role="alert">
      {names.map((name) => (
        <div key={name} className="seat-request">
          <p><strong>{name}</strong> is trying to get back in on a different phone or browser.</p>
          <div className="seat-request-actions">
            <button
              className="start-game-btn"
              disabled={busy === name}
              onClick={() => act(name, () => grantSeat(gameCode, name, requests[name], {
                dealt: (dealtSeats || []).includes(name)
              }))}
            >
              Let {name} back in
            </button>
            <button
              className="end-game-btn"
              disabled={busy === name}
              onClick={() => act(name, () => dismissSeatRequest(gameCode, name))}
            >
              Not them
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SeatRequests;
