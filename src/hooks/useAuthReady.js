import { useCallback, useEffect, useState } from 'react';
import { ensureSignedIn } from '../firebase';
import { isTimeout, withTimeout } from '../withTimeout';

// iOS can restore a tab whose storage hangs, and signing in waits on it.
const SIGN_IN_WAIT_MS = 12000;

export function useAuthReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    // A sign-in that hung is still hung; only a fresh page starts a new one.
    if (isTimeout(error)) {
      window.location.reload();
      return;
    }
    setError(null);
    setAttempt((previous) => previous + 1);
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    withTimeout(ensureSignedIn(), SIGN_IN_WAIT_MS).then(
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
