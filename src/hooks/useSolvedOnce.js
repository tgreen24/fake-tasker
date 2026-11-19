import { useCallback, useState } from 'react';

// Whether a puzzle behind this key has been solved, kept for the tab's life so
// a reload or a discarded tab does not make somebody solve it again.
export function useSolvedOnce(key) {
  const [solved, setSolved] = useState(() => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  const markSolved = useCallback(() => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* a private window; solving again after a reload is fine */
    }
    setSolved(true);
  }, [key]);

  return [solved, markSolved];
}
