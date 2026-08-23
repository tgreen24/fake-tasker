import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { currentUid, db } from '../firebase';
import { claimOwnSeat } from '../game/mutations';

const TICK_MS = 1000;
const FIRST_SNAPSHOT_MS = 2500;
const STALE_REBUILD_MS = 15000;

// Your role and task list, from a document only your account can read.
//
// This carries its own recovery rather than borrowing the game listener's:
// a round screen with no role renders as neither a tasker nor a traitor -- a
// player staring at an empty screen -- so a listener that never delivers here
// is worse than one that never delivers the shared document.
export function usePrivateRole(gameCode, playerName) {
  const [privateData, setPrivateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const receivedRef = useRef(false);

  useEffect(() => {
    if (!gameCode || !playerName) {
      setPrivateData(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = null;
    let lastActivity = Date.now();
    receivedRef.current = false;
    setLoading(true);

    const ref = doc(db, 'games', gameCode, 'players', playerName);

    const receive = (snapshot) => {
      if (cancelled) return;
      lastActivity = Date.now();
      receivedRef.current = true;

      const data = snapshot.exists() ? snapshot.data() : null;
      setPrivateData(data);
      setLoading(false);

      // Deal-time race: the host had not seen this account announced, so the
      // seat came out unowned. Take it, or nothing here will ever save.
      if (data && !data.uid && currentUid()) {
        claimOwnSeat(gameCode, playerName);
      }
    };

    const subscribe = () => {
      if (cancelled) return;
      lastActivity = Date.now();
      unsubscribe = onSnapshot(ref, receive, (error) => {
        // Reading somebody else's role is meant to fail; treat it as no role.
        console.warn('[role] could not read your role document', error);
        if (!cancelled) setLoading(false);
      });
    };

    const resync = async () => {
      if (cancelled || document.hidden) return;
      try {
        receive(await getDocFromServer(ref));
      } catch (error) {
        if (!cancelled) setLoading(false);
      }
    };

    const tick = () => {
      if (document.hidden) return;
      const quietFor = Date.now() - lastActivity;
      if (!receivedRef.current && quietFor > FIRST_SNAPSHOT_MS) resync();
      else if (quietFor > STALE_REBUILD_MS) {
        if (unsubscribe) unsubscribe();
        subscribe();
        resync();
      }
    };

    const onForeground = () => { if (!document.hidden) resync(); };

    subscribe();
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onForeground);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onForeground);
    };
  }, [gameCode, playerName]);

  return { privateData, roleLoading: loading };
}
