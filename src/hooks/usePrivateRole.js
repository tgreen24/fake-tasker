import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { currentUid, db } from '../firebase';
import { claimOwnSeat } from '../game/mutations';
import { noteRoleError, noteRoleRebuild, noteRoleSnapshot } from '../diagnostics';
import { withTimeout } from '../withTimeout';

const TICK_MS = 1000;
const FIRST_SNAPSHOT_MS = 2500;
const STALE_REBUILD_MS = 15000;
const MAX_BACKOFF_MS = 15000;
const RESYNC_TIMEOUT_MS = 6000;

// Your role and task list, from a document only your account can read.
//
// This carries its own recovery rather than borrowing the game listener's:
// a round screen with no role renders as neither a tasker nor a traitor -- a
// player staring at an empty screen -- so a listener that never delivers here
// is worse than one that never delivers the shared document.
//
// seatHolder is the account the game says holds this seat. While another
// account holds it this phone has no role, so the screen offers the seat back
// instead of a round it can no longer play; when it moves here the listener
// starts over at once, rather than waiting out the backoff of one that was
// being refused.
export function usePrivateRole(gameCode, playerName, seatHolder) {
  const [privateData, setPrivateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const receivedRef = useRef(false);
  const restartRef = useRef(() => {});
  const holderRef = useRef(seatHolder);
  holderRef.current = seatHolder;

  useEffect(() => {
    if (!gameCode || !playerName) {
      setPrivateData(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = null;
    let retryTimer = null;
    let backoff = 1000;
    let lastActivity = Date.now();
    let resyncing = false;
    receivedRef.current = false;
    setLoading(true);

    const ref = doc(db, 'games', gameCode, 'players', playerName);

    const receive = (snapshot) => {
      if (cancelled) return;
      lastActivity = Date.now();
      backoff = 1000;
      receivedRef.current = true;
      noteRoleSnapshot();

      const data = snapshot.exists() ? snapshot.data() : null;
      setPrivateData(data);
      setLoading(false);

      // Deal-time race: the host had not seen this account announced, so the
      // seat came out unowned. Or this phone took the seat back and lost the
      // connection before the role document followed. Either way, take it,
      // or nothing here will ever save.
      const uid = currentUid();
      const unowned = data && !data.uid;
      const movedHereOnly = data && data.uid !== uid && holderRef.current === uid;
      if (uid && (unowned || movedHereOnly)) {
        claimOwnSeat(gameCode, playerName);
      }
    };

    // Self-cleaning for the same reason the game listener is: a failed listener
    // schedules its own retry and the watchdog rebuilds on its own account, and
    // the two must not both end up live.
    const subscribe = () => {
      if (cancelled) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      lastActivity = Date.now();
      unsubscribe = onSnapshot(ref, receive, (error) => {
        // Reading somebody else's role is meant to fail; treat it as no role.
        console.warn('[role] could not read your role document', error);
        noteRoleError(error);
        if (cancelled) return;
        setLoading(false);

        // Firestore does not revive a listener that has errored. Left alone
        // this screen goes on showing a task list that has quietly stopped
        // updating, and only leaving and coming back brings it back. Backoff
        // is capped because a listener being refused would otherwise retry
        // forever and spend the day's reads doing it.
        unsubscribe = null;
        retryTimer = setTimeout(subscribe, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      });
    };

    // One at a time and bounded, as the game listener's is: on a wedged
    // connection these used to pile up at one a second, each one hanging.
    const resync = async () => {
      if (cancelled || document.hidden || resyncing) return;
      resyncing = true;
      try {
        receive(await withTimeout(getDocFromServer(ref), RESYNC_TIMEOUT_MS));
      } catch (error) {
        if (!cancelled) setLoading(false);
      } finally {
        resyncing = false;
      }
    };

    const tick = () => {
      if (document.hidden) return;
      const quietFor = Date.now() - lastActivity;
      if (!receivedRef.current && quietFor > FIRST_SNAPSHOT_MS) resync();
      else if (quietFor > STALE_REBUILD_MS) {
        noteRoleRebuild();
        subscribe();
        resync();
      }
    };

    // Back from the background the listener may be dead without having said
    // so, and waiting out the quiet clock is fifteen seconds of a stale list.
    const onForeground = () => {
      if (document.hidden) return;
      subscribe();
      resync();
    };

    restartRef.current = () => {
      subscribe();
      resync();
    };

    subscribe();
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onForeground);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onForeground);
      restartRef.current = () => {};
    };
  }, [gameCode, playerName]);

  // Only a move back to this account restarts: the holder going from unknown
  // to known is just the game loading, and restarting then would cost a read.
  const lastHolder = useRef(seatHolder);
  useEffect(() => {
    const previous = lastHolder.current;
    lastHolder.current = seatHolder;
    if (previous && seatHolder && previous !== seatHolder && seatHolder === currentUid()) restartRef.current();
  }, [seatHolder]);

  // Decided here rather than by clearing state: the cache would hand the old
  // role straight back the moment the listener restarted.
  const heldElsewhere = !!seatHolder && seatHolder !== currentUid();
  return { privateData: heldElsewhere ? null : privateData, roleLoading: loading };
}
