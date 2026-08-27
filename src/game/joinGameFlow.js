import { doc, getDoc } from 'firebase/firestore';
import { currentUid, db } from '../firebase';
import { MAX_PLAYERS, joinGame } from './mutations';

// Shared by the code-entry screen and the invite link, so a link cannot drift
// into allowing something typing the code by hand would not.
export async function attemptJoin(gameCode, playerName) {
  const code = (gameCode || '').trim().toUpperCase();
  const name = (playerName || '').trim();

  if (!name) return { error: 'Please enter your name.' };
  if (!code) return { error: 'Please enter a game code.' };

  const snapshot = await getDoc(doc(db, 'games', code));
  if (!snapshot.exists()) return { error: 'That game code does not exist.' };

  const game = snapshot.data();
  const players = game.players || [];
  const alreadySeated = players.includes(name);

  // Reclaiming your own seat is a reconnect, not a join.
  if (game.gameStarted) {
    if (!alreadySeated) return { error: 'That game has already started.' };
    return { code, name };
  }

  if (alreadySeated) {
    // A join that gave up waiting may still have landed. Retrying it should put
    // you back in your own seat rather than telling you your name is taken by
    // yourself. Only the account that holds the seat gets that answer.
    const seatHolder = (game.playerUids || {})[name];
    if (seatHolder && seatHolder === currentUid()) return { code, name };
    return { error: `Somebody in this game is already called "${name}". Try another name.` };
  }
  if (players.length >= MAX_PLAYERS) {
    return { error: 'That game is full.' };
  }

  await joinGame(code, name);
  return { code, name };
}
