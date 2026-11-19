import { doc, runTransaction, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { cooldownExpiryFor, cooldownMsLeft } from './cooldown';
import {
  LOCKDOWN_COOLDOWN_SECONDS, buildLockdown, lockdownPartFor, lockdownVerdict, normalizeCode
} from './lockdown';

// Every write Lockdown makes. Each is a transaction decided against the
// server's copy of the game, since several phones act on it at once.

const gameRef = (gameCode) => doc(db, 'games', gameCode);

// Decided against the server's copy, so two traitors tapping at once, or one
// tapping as a meeting is called, cannot start two or start one mid-meeting.
export async function startLockdown(gameCode, playerName, roleMap) {
  try {
    return await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(gameRef(gameCode));
      if (!snapshot.exists()) return false;
      const data = snapshot.data();
      if (!data.lockdownEnabled || !data.gameStarted || data.gameEnded || data.meetingCalled) return false;
      if (data.lockdown || cooldownMsLeft(data.lockdownCooldown) > 0) return false;
      const killList = data.killList || [];
      if (killList.includes(playerName)) return false;

      const lockdown = buildLockdown({ players: data.players || [], killList, roleMap });
      if (!lockdown) return false;
      tx.update(gameRef(gameCode), { lockdown, lockdownCooldown: deleteField() });
      return true;
    });
  } catch (error) {
    console.warn('[lockdown] could not start it', error);
    return false;
  }
}

// Checked against the server's copy rather than written blind, so an entry
// that lands after the lockdown ended cannot leave a half-made one behind.
export async function enterLockdownCode(gameCode, playerName, typed) {
  try {
    return await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(gameRef(gameCode));
      if (!snapshot.exists()) return 'over';
      const data = snapshot.data();
      if (!data.lockdown || data.gameEnded) return 'over';
      const part = lockdownPartFor(data, playerName);
      if (!part || part.kind !== 'receive') return 'over';
      if (normalizeCode(typed) !== part.code) return 'wrong';
      if (!part.entered) tx.update(gameRef(gameCode), { [`lockdown.entered.${playerName}`]: true });
      return 'accepted';
    });
  } catch (error) {
    console.warn('[lockdown] could not send the code', error);
    return 'failed';
  }
}

// Any phone may settle it, the way any phone may close a vote: the
// transaction makes it happen once.
export async function settleLockdown(gameCode) {
  try {
    return await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(gameRef(gameCode));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      if (!data.gameStarted || data.gameEnded) return null;
      const verdict = lockdownVerdict(data);
      if (verdict === 'lifted') {
        tx.update(gameRef(gameCode), {
          lockdown: deleteField(),
          lockdownCooldown: cooldownExpiryFor(LOCKDOWN_COOLDOWN_SECONDS)
        });
      } else if (verdict === 'failed') {
        tx.update(gameRef(gameCode), {
          lockdown: deleteField(),
          gameEnded: true,
          winner: 'Imposters',
          winReason: 'lockdown',
          endedAt: Date.now()
        });
      }
      return verdict;
    });
  } catch (error) {
    console.warn('[lockdown] could not settle it', error);
    return null;
  }
}
