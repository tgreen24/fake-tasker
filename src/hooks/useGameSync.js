import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { routeForState } from '../gameRoute';

const ROUTE_TICK_MS = 1000;
const MAX_BACKOFF_MS = 15000;

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
    let backoff = 1000;

    const gameRef = doc(db, 'games', gameCode);

    const markConnected = (value) => {
      connectedRef.current = value;
      setConnected(value);
    };

    const receive = (snapshot) => {
      if (cancelled) return;
      backoff = 1000;
      markConnected(!snapshot.metadata.fromCache);

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

    // A dropped listener is never retried by the SDK, so rebuild it ourselves.
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
        if (dataRef.current) routeRef.current(dataRef.current);
      }
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
      if (!connectedRef.current) resync();
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
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onForeground);
      window.removeEventListener('focus', onForeground);
      window.removeEventListener('online', onForeground);
    };
  }, [gameCode, enabled]);

  return { gameData, loading, connected };
}
