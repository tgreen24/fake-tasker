export const SEAT_MOVE_NOTE_MS = 15000;

// Who took their seat on a new phone or browser recently enough to mention.
export function recentSeatMoves(seatMoves, now = Date.now()) {
  return Object.keys(seatMoves || {})
    .filter((name) => {
      const at = seatMoves[name];
      // Stamped by the other phone's clock, so a little skew either way is fine.
      return typeof at === 'number' && Math.abs(now - at) < SEAT_MOVE_NOTE_MS;
    })
    .sort();
}

// Somebody else's account holds this player's seat now.
export const seatTakenElsewhere = (gameData, playerName, uid) => {
  const holder = gameData?.playerUids?.[playerName];
  return !!holder && holder !== uid;
};
