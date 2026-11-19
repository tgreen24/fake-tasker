import { useEffect, useMemo, useRef, useState } from 'react';
import { enterLockdownCode, settleLockdown, startLockdown } from '../game/lockdownMutations';
import {
  LOCKDOWN_COOLDOWN_SECONDS, LOCKDOWN_SECONDS, lockdownPartFor, lockdownProgress, lockdownVerdict
} from '../game/lockdown';
import { isTicking, remainingCooldownSeconds } from '../game/cooldown';
import { withTimeout } from '../withTimeout';
import { useNow } from './useNow';

const SETTLE_WAIT_MS = 8000;
// An entry typed in the last second may still be on its way. Lifting wins a
// tie, so the clock is given a moment before anyone calls it lost.
const FAIL_GRACE_MS = 1500;
const LIFTED_NOTICE_MS = 5000;

export function useLockdown(gameCode, gameData, playerName, privateData) {
  const progress = useMemo(() => lockdownProgress(gameData), [gameData]);
  const part = useMemo(() => lockdownPartFor(gameData, playerName), [gameData, playerName]);
  const cooldownEntry = gameData?.lockdownCooldown;
  const enabled = !!gameData?.lockdownEnabled;
  const now = useNow(progress.active || (enabled && isTicking(cooldownEntry)));

  const secondsLeft = progress.active
    ? Math.max(0, Math.min(LOCKDOWN_SECONDS, Math.ceil((progress.until - now) / 1000)))
    : 0;
  const cooldownLeft = remainingCooldownSeconds(cooldownEntry, LOCKDOWN_COOLDOWN_SECONDS, now);

  // Every phone watches for the end, so it does not depend on the one that
  // started it, or on anybody in particular, still being awake.
  const settling = useRef(false);
  const verdict = lockdownVerdict(gameData, now - FAIL_GRACE_MS);
  const playing = !!gameData?.gameStarted && !gameData?.gameEnded;
  useEffect(() => {
    if (!verdict || !playing) {
      settling.current = false;
      return;
    }
    if (settling.current) return;
    settling.current = true;
    withTimeout(settleLockdown(gameCode), SETTLE_WAIT_MS)
      .catch(() => null)
      .then((settled) => {
        if (!settled) settling.current = false;
      });
  }, [gameCode, verdict, playing, now]);

  // Lifting just makes the lockdown disappear, which on its own reads as a
  // glitch. Said out loud for a few seconds instead.
  const [liftedNotice, setLiftedNotice] = useState(false);
  const wasActive = useRef(progress.active);
  useEffect(() => {
    if (wasActive.current && !progress.active && playing) setLiftedNotice(true);
    wasActive.current = progress.active;
  }, [progress.active, playing]);
  useEffect(() => {
    if (!liftedNotice) return undefined;
    const timer = setTimeout(() => setLiftedNotice(false), LIFTED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [liftedNotice]);

  const actions = useMemo(() => ({
    start: () => startLockdown(gameCode, playerName, privateData?.roleMap || {}),
    enterCode: (typed) => withTimeout(enterLockdownCode(gameCode, playerName, typed), SETTLE_WAIT_MS)
      .catch(() => 'failed')
  }), [gameCode, playerName, privateData?.roleMap]);

  return {
    state: {
      enabled,
      active: progress.active,
      startedAt: gameData?.lockdown?.startedAt || null,
      done: Math.min(progress.done, progress.needed),
      needed: progress.needed,
      secondsLeft,
      secondsTotal: LOCKDOWN_SECONDS,
      part,
      cooldownLeft,
      cooldownTotal: LOCKDOWN_COOLDOWN_SECONDS,
      justLifted: liftedNotice
    },
    actions
  };
}
