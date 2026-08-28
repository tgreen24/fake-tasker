import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { routeForState } from '../gameRoute';
import { recordExit } from '../session';
import { withTimeout } from '../withTimeout';

const ROUTE_TICK_MS = 1000;
const MAX_BACKOFF_MS = 15000;
const OFFLINE_GRACE_MS = 3000;

// A dropped listener calls the error handler and gets rebuilt. A *stalled* one
// never does: the stream goes quiet, no error arrives, and the client sits on
// stale data believing it is connected.
//
// This happens with the screen on and the page in the foreground, so no
// visibility event is ever coming to the rescue and this clock is the only
// thing that will notice. It used to wait thirty seconds before trying
// anything, which is far longer than anyone waits before deciding the game is
// broken and reloading the page -- so the recovery never got to run.
const STALE_MS = 8000;

// Reading a document through a wedged connection is the least likely thing to
// work, and it can hang for as long as it likes, so give up and rebuild.
const RESYNC_TIMEOUT_MS = 6000;

// How long to wait for the server to settle whether a game exists before
// accepting that it does not. Only ever applies to a game this client has
// never successfully read; once we have seen it, a cold cache never takes it
// away again.
const MISSING_GRACE_MS = 15000;

export function useGameSync(gameCode, playerName, { enabled = true } = {}) {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);

  const dataRef = useRef(null);
  const connectedRef = useRef(true);
  const routeRef = useRef(null);

  routeRef.current = (data) => {
    if (!gameCode) return;
    if (!playerName) {
      recordExit('this tab does not know which player it is', { gameCode });
      navigate('/', { replace: true });
      return;
    }
    const target = routeForState(data, playerName, gameCode);
    if (target === window.location.pathname) return;
    // The other way to land on the home screen is abandon(), which records its
    // own reason -- this covers being dropped from the roster while the game
    // itself is still there.
    if (target === '/' && data) {
      recordExit('no longer on the roster', { gameCode, playerName });
    }
    navigate(target, { state: { playerName }, replace: true });
  };

  useEffect(() => {
    if (!gameCode || !enabled) return undefined;

    let cancelled = false;
    let unsubscribe = null;
    let retryTimer = null;
    let offlineTimer = null;
    let backoff = 1000;
    let lastSnapshotAt = Date.now();
    let missingSince = null;
    let resyncing = false;

    const gameRef = doc(db, 'games', gameCode);

    const markConnected = (value) => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      connectedRef.current = value;
      setConnected(value);
    };

    // A local pending write also reads as fromCache, so treating that as
    // offline would flash the banner on every tap. Only sustained staleness
    // counts as a dropped connection.
    const noteFreshness = (fromCache) => {
      if (!fromCache) {
        markConnected(true);
        return;
      }
      if (offlineTimer || !connectedRef.current) return;
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        connectedRef.current = false;
        setConnected(false);
      }, OFFLINE_GRACE_MS);
    };

    // Deliberately does not read playerName: this effect owns the listener and
    // must not tear it down and rebuild it just because a name changed.
    const abandon = (reason) => {
      recordExit(reason, { gameCode });
      missingSince = null;
      dataRef.current = null;
      setGameData(null);
      setLoading(false);
      routeRef.current(null);
    };

    const receive = (snapshot) => {
      if (cancelled) return;
      backoff = 1000;
      lastSnapshotAt = Date.now();
      noteFreshness(snapshot.metadata.fromCache);

      if (!snapshot.exists()) {
        // A listener rebuilt against an empty local cache reports the document
        // as missing before the server has said anything about it. That is a
        // cold cache, not a deleted game, and treating it as one is what put a
        // backgrounded phone back on the home screen mid-round. Only a server
        // answer is allowed to end somebody's game.
        if (snapshot.metadata.fromCache) {
          if (missingSince === null) missingSince = Date.now();
          resync();
          // Waiting forever is its own way of being stuck, so a game we have
          // never once read is given up on. A game already on screen is not:
          // there is nothing to wait for and nothing to gain by leaving.
          if (!dataRef.current && Date.now() - missingSince > MISSING_GRACE_MS) {
            abandon('waited for the game and it never arrived');
          }
          return;
        }

        missingSince = null;
        dataRef.current = null;
        setGameData(null);
        setLoading(false);
        routeRef.current(null);
        return;
      }

      missingSince = null;
      const data = snapshot.data();
      dataRef.current = data;
      setGameData(data);
      setLoading(false);
      routeRef.current(data);
    };

    const fail = (error) => {
      if (cancelled) return;
      console.error('[useGameSync] snapshot listener dropped', error);
      markConnected(false);
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      retryTimer = setTimeout(subscribe, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };

    // Self-cleaning, so it does not matter who calls it or what was already
    // pending. A failed listener schedules its own retry, and the staleness
    // clock rebuilds on its own account; without this the two race and leave a
    // live listener behind with nothing referencing it.
    function subscribe() {
      if (cancelled) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      lastSnapshotAt = Date.now();
      unsubscribe = onSnapshot(gameRef, receive, fail);
    }

    // Bounded, and never more than one at a time: an unbounded read on a dead
    // connection used to hang while the tick started another one every second.
    const resync = async () => {
      if (cancelled || document.hidden || resyncing) return;
      resyncing = true;
      try {
        receive(await withTimeout(getDocFromServer(gameRef), RESYNC_TIMEOUT_MS));
      } catch (error) {
        if (!cancelled) {
          console.warn('[useGameSync] forced resync failed', error);
          markConnected(false);
        }
      } finally {
        resyncing = false;
      }
    };

    const rebuild = () => {
      if (cancelled) return;
      console.warn('[useGameSync] listener went quiet, rebuilding it');
      subscribe();
      resync();
    };

    // pageshow covers iOS Safari bfcache restores, which skip visibilitychange.
    const onForeground = () => {
      if (document.hidden) return;
      if (dataRef.current) routeRef.current(dataRef.current);
      if (Date.now() - lastSnapshotAt > STALE_MS) rebuild();
      else resync();
    };

    const tick = () => {
      if (document.hidden) return;
      if (dataRef.current) routeRef.current(dataRef.current);

      // A listener that never delivers a second snapshot would otherwise leave
      // the grace period running forever.
      if (missingSince !== null && !dataRef.current && Date.now() - missingSince > MISSING_GRACE_MS) {
        abandon('waited for the game and it never arrived');
        return;
      }

      const quietFor = Date.now() - lastSnapshotAt;
      if (quietFor > STALE_MS) {
        // A silent stall produces no snapshots at all, so nothing has told the
        // banner anything is wrong and the screen looks perfectly healthy while
        // the connection is dead. Say so, then rebuild the stream.
        markConnected(false);
        rebuild();
      } else if (!connectedRef.current) {
        resync();
      }
    };

    subscribe();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onForeground);
    window.addEventListener('focus', onForeground);
    window.addEventListener('online', onForeground);
    const tickTimer = setInterval(tick, ROUTE_TICK_MS);

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (retryTimer) clearTimeout(retryTimer);
      if (offlineTimer) clearTimeout(offlineTimer);
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
    };
  }, [gameCode, enabled]);

  return { gameData, loading, connected };
}
