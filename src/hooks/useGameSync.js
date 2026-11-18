import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db, resetConnection } from '../firebase';
import { routeForState } from '../gameRoute';
import { clearSession, recordExit } from '../session';
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
// thing that will notice.
//
// Two clocks, because silence has two meanings. A game document is quiet most
// of the time -- nobody is joining, nobody has finished a task -- so time since
// any data arrived says only that nothing has happened, and a cheap read is
// enough to confirm we are not behind. Time since the *listener* last spoke is
// the one that says the stream itself may be gone, and that wants rebuilding.
//
// Neither of them is a connection problem, so neither of them says a word to
// the player. Only a read that actually fails does that.
//
// The cheap read turned out not to be a check at all: with a listener already
// attached to the document, Firestore answers it from that listener's copy, so
// a dead stream reports itself healthy. The phone simulator caught it -- a dead
// connection went unnoticed for over half a minute. So silence from the
// listener is met with a rebuild, which forces a real round trip.
const STALE_PROBE_MS = 12000;
const STALE_REBUILD_MS = 12000;

// Reading a document through a wedged connection is the least likely thing to
// work, and it can hang for as long as it likes, so give up and rebuild.
const RESYNC_TIMEOUT_MS = 6000;

// Away long enough that the connection may have died under it.
const LONG_AWAY_MS = 10000;

export function useGameSync(gameCode, playerName, { enabled = true } = {}) {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [pendingWrites, setPendingWrites] = useState(false);

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
    // Dropped from the roster while the game itself is still there: kicked, or
    // left from another tab. The session goes too, or Home would keep offering
    // a way back into a seat that no longer exists.
    if (target === '/' && data) {
      recordExit('no longer on the roster', { gameCode, playerName });
      clearSession();
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
    let resyncing = false;
    let lastListenerAt = Date.now();

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
        //
        // Nor is a slow network: a phone reopened on bad signal used to be sent
        // home after fifteen seconds of this, from a game that was fine. It
        // keeps asking, and the loading screen offers a way out instead.
        if (snapshot.metadata.fromCache) {
          resync();
          return;
        }

        recordExit('the server says this game is gone', { gameCode });
        clearSession();
        dataRef.current = null;
        setGameData(null);
        setLoading(false);
        routeRef.current(null);
        return;
      }

      const data = snapshot.data();
      setPendingWrites(snapshot.metadata.hasPendingWrites);
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
      lastListenerAt = Date.now();
      // Metadata changes too, so the screen learns when its own write has
      // actually reached the server rather than only that it was made.
      unsubscribe = onSnapshot(
        gameRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          lastListenerAt = Date.now();
          receive(snapshot);
        },
        fail
      );
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
    let hiddenAt = null;
    const onForeground = () => {
      if (document.hidden) {
        hiddenAt = hiddenAt || Date.now();
        return;
      }
      const awayFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (dataRef.current) routeRef.current(dataRef.current);
      if (awayFor > LONG_AWAY_MS) {
        resetConnection().then(() => rebuild());
        return;
      }
      if (Date.now() - lastListenerAt > STALE_PROBE_MS) rebuild();
      else resync();
    };

    const tick = () => {
      if (document.hidden) return;
      if (dataRef.current) routeRef.current(dataRef.current);

      // Rebuilding is what brings live updates back, so it is driven by the
      // stream's own silence rather than by nothing having happened. A read
      // that keeps succeeding would otherwise leave a dead listener in place
      // and quietly turn the whole game into a poll.
      if (Date.now() - lastListenerAt > STALE_REBUILD_MS) {
        if (connectedRef.current) rebuild();
        else resetConnection().then(() => rebuild());
        return;
      }

      const quietFor = Date.now() - lastSnapshotAt;
      if (quietFor > STALE_PROBE_MS || !connectedRef.current) resync();
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

  return { gameData, loading, connected, pendingWrites };
}
