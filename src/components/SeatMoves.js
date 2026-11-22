import React from 'react';
import { useNow } from '../hooks/useNow';
import { recentSeatMoves } from '../game/seats';

// A passing note for the host when somebody takes their seat on a new phone.
// Nothing to answer: it is there so a seat never changes hands unseen.
function SeatMoves({ isHost, seatMoves }) {
  const showing = isHost && recentSeatMoves(seatMoves).length > 0;
  const now = useNow(showing);
  const names = isHost ? recentSeatMoves(seatMoves, now) : [];
  if (names.length === 0) return null;

  return (
    <p className="reveal-notice seat-moved" role="status">
      {names.join(' and ')} rejoined on a new phone or browser
    </p>
  );
}

export default SeatMoves;
