import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { routeForState } from '../gameRoute';

const ROUTE_TICK_MS = 1000;
const MAX_BACKOFF_MS = 15000;
const OFFLINE_GRACE_MS = 3000;

// A dropped listener calls the error handler and gets rebuilt. A *stalled* one
// never does: the stream goes quiet, no error arrives, and the client sits on
// stale data believing it is connected. iOS Safari does this after suspending a
// tab. So we also watch how long it has been since a snapshot landed.
const STALE_RESYNC_MS = 30000;
const STALE_REBUILD_MS = 60000;

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
      navigate('/', { replace: true });
      return;
    }
    const target = routeForState(data, playerName, gameCode);
    if (target === window.location.pathname) return;
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
        dataRef.current = null;
        setGameData(null);
        setLoading(false);
        routeRef.current(null);
        return;
      }

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

    function subscribe() {
      if (cancelled) return;
      lastSnapshotAt = Date.now();
      unsubscribe = onSnapshot(gameRef, receive, fail);
    }

    const resync = async () => {
      if (cancelled || document.hidden) return;
      try {
        receive(await getDocFromServer(gameRef));
      } catch (error) {
        if (cancelled) return;
        console.warn('[useGameSync] forced resync failed', error);
        markConnected(false);
      }
    };

    const rebuild = () => {
      if (cancelled) return;
      console.warn('[useGameSync] listener went quiet, rebuilding it');
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      subscribe();
      resync();
    };

    // pageshow covers iOS Safari bfcache restores, which skip visibilitychange.
    const onForeground = () => {
      if (document.hidden) return;
      if (dataRef.current) routeRef.current(dataRef.current);
      resync();
    };

    const tick = () => {
      if (document.hidden) return;
      if (dataRef.current) routeRef.current(dataRef.current);

      const quietFor = Date.now() - lastSnapshotAt;
      if (quietFor > STALE_REBUILD_MS) rebuild();
      else if (quietFor > STALE_RESYNC_MS || !connectedRef.current) resync();
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
