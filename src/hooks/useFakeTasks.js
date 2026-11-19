import { useCallback, useEffect, useMemo, useState } from 'react';
import { setFakeTaskDone } from '../game/mutations';

// A traitor's cover list. Ticks show at once and are saved to their own seat,
// so the list survives a reload; nothing here touches the shared progress. A
// save that fails puts the list back to what the seat says.
export function useFakeTasks(gameCode, playerName, fakeTasks, savedCompleted, roundStartedAt) {
  const [completed, setCompleted] = useState(null);

  useEffect(() => {
    setCompleted(null);
  }, [roundStartedAt]);

  const current = completed || savedCompleted;
  const save = useCallback(async (task, done) => {
    setCompleted((now) => {
      const base = (now || savedCompleted).filter((t) => t !== task);
      return done ? [...base, task] : base;
    });
    try {
      await setFakeTaskDone(gameCode, playerName, task, done);
      return true;
    } catch (error) {
      console.warn('[cover] could not save a fake task', error);
      setCompleted(null);
      return false;
    }
  }, [gameCode, playerName, savedCompleted]);

  const toggleFake = useCallback((task) => save(task, !current.includes(task)), [save, current]);
  const completeFake = useCallback(
    (task) => (current.includes(task) ? Promise.resolve(true) : save(task, true)),
    [save, current]
  );

  return useMemo(() => ({ fakeTasks, fakeCompleted: current, toggleFake, completeFake }),
    [fakeTasks, current, toggleFake, completeFake]);
}
