import { useEffect, useRef } from 'react';

// Reports a solve exactly once, however often the parent re-renders with a
// new callback.
export function useOnSolved(solved, onSolved) {
  const reported = useRef(false);
  const latest = useRef(onSolved);
  latest.current = onSolved;
  useEffect(() => {
    if (!solved || reported.current) return;
    reported.current = true;
    if (latest.current) latest.current();
  }, [solved]);
}
