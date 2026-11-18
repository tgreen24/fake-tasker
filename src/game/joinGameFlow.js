import { doc, getDoc } from 'firebase/firestore';
import { currentUid, db } from '../firebase';
import { MAX_PLAYERS, joinGame } from './mutations';
import { playerNameError } from './playerName';

// Shared by the code-entry screen and the invite link, so a link cannot drift
// into allowing something typing the code by hand would not.
export async function attemptJoin(gameCode, playerName) {
  const code = (gameCode || '').trim().toUpperCase();
  const name = (playerName || '').trim();

  const nameError = playerNameError(name);
  if (nameError) return { error: nameError };
  if (!code) return { error: 'Please enter a game code.' };

  const snapshot = await getDoc(doc(db, 'games', code));
  if (!snapshot.exists()) return { error: 'That game code does not exist.' };

  const game = snapshot.data();
  const players = game.players || [];
  const alreadySeated = players.includes(name);

  // Reclaiming your own seat is a reconnect, not a join. A seat held by a
  // different account is either somebody else or you on another browser, and
  // only the host can tell which.
  if (alreadySeated) {
    const seatHolder = (game.playerUids || {})[name];
    const yours = seatHolder === currentUid() || (game.gameStarted && !seatHolder);
    if (yours) return { code, name };
    return { seatTaken: true, code, name };
  }

  if (game.gameStarted) return { error: 'That game has already started.' };
  if (players.length >= MAX_PLAYERS) {
    return { error: 'That game is full.' };
  }

  await joinGame(code, name);
  return { code, name };
}
