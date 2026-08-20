import { useCallback, useEffect, useState } from 'react';
import { ensureSignedIn } from '../firebase';

export function useAuthReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensureSignedIn().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (signInError) => {
        if (cancelled) return;
        console.error('[auth] anonymous sign-in failed', signInError);
        setError(signInError);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ready, error, retry };
}
