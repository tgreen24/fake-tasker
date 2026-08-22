import { useEffect, useMemo, useState } from 'react';
import {
  callMeeting, clearSabotage, endGame, endRound,
  recordKill, setCompletedTasks, startSabotage, undoKill
} from '../game/mutations';
import {
  deriveRoundState, everyoneFinishedTasks, toggledTaskList, winnerAfterKill
} from '../game/roundState';
import { currentUid } from '../firebase';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';

const OPENING_COUNTDOWN_SECONDS = 3;
const REVEAL_HOLD_MS = 3800;
const INTRO_WINDOW_MS = 10000;

// Only play the opening beat if we actually arrived at it. A refresh ten
// minutes into a round is not the start of anything. Compared absolutely so a
// skewed clock fails to "recent is false" rather than replaying forever.
function justHappened(timestamp, now = Date.now()) {
  return !!timestamp && Math.abs(now - timestamp) < INTRO_WINDOW_MS;
}
const SABOTAGE_COOLDOWN_SECONDS = 120;

function useSecondsRemaining(initial) {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((previous) => previous - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return [seconds, setSeconds];
}

export function useCountdown(gameCode) {
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const [countdown, setCountdown] = useState(null);
  const [killCooldownLeft, setKillCooldownLeft] = useSecondsRemaining(0);
  const [sabotageCooldownLeft, setSabotageCooldownLeft] = useSecondsRemaining(0);
  const [sabotageDialogOpen, setSabotageDialogOpen] = useState(false);
  const [blended, setBlended] = useState(false);

  const round = useMemo(() => deriveRoundState(gameData, playerName, currentUid()), [gameData, playerName]);

  const introKind = !gameData
    ? null
    : round.returningFromMeeting
      ? (justHappened(round.meetingEndedAt) ? 'return' : null)
      : (justHappened(round.roundStartedAt) ? 'opening' : null);

  useEffect(() => {
    if (countdown !== null || !gameData) return;
    setCountdown(introKind ? OPENING_COUNTDOWN_SECONDS : 0);
  }, [gameData, introKind, countdown]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((previous) => previous - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const showIntro = !!introKind && (countdown === null || countdown > 0);

  // The role reveal is deliberately loud, then the screen blends back so a
  // glance from across the room says nothing. Returning from a meeting skips
  // the reveal entirely -- everyone is stood together at exactly that moment.
  useEffect(() => {
    if (round.returningFromMeeting || showIntro) {
      setBlended(round.returningFromMeeting);
      return undefined;
    }
    const timer = setTimeout(() => setBlended(true), REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [round.returningFromMeeting, showIntro]);

  const actions = useMemo(() => ({
    toggleTask: async (task) => {
      if (round.tasksBlocked) return;

      const nextCompleted = toggledTaskList(round.completedTasks, task);
      if (!(await setCompletedTasks(gameCode, playerName, nextCompleted))) return;

      if (everyoneFinishedTasks(gameData, playerName, nextCompleted)) {
        await endGame(gameCode, 'Crewmates');
      }
    },

    toggleKill: async (crewmate) => {
      if (round.killList.includes(crewmate)) {
        setKillCooldownLeft(0);
        await undoKill(gameCode, crewmate);
        return;
      }
      if (killCooldownLeft > 0) return;

      setKillCooldownLeft(round.killCooldown);
      if (!(await recordKill(gameCode, crewmate))) {
        setKillCooldownLeft(0);
        return;
      }

      const winner = winnerAfterKill(gameData, [...round.killList, crewmate]);
      if (winner) await endGame(gameCode, winner);
    },

    callMeeting: () => callMeeting(gameCode, playerName),
    endRound: () => endRound(gameCode),

    openSabotageDialog: () => setSabotageDialogOpen(true),
    closeSabotageDialog: () => setSabotageDialogOpen(false),

    sabotage: async (crewmate) => {
      if (sabotageCooldownLeft > 0) return;
      setSabotageDialogOpen(false);
      await startSabotage(gameCode, playerName, crewmate);
    },

    clearMySabotage: async () => {
      setSabotageCooldownLeft(SABOTAGE_COOLDOWN_SECONDS);
      await clearSabotage(gameCode, playerName);
    }
  }), [
    gameCode, playerName, gameData, round,
    killCooldownLeft, sabotageCooldownLeft,
    setKillCooldownLeft, setSabotageCooldownLeft
  ]);

  return {
    state: {
      ...round, playerName,
      showIntro,
      introKind,
      countdown: countdown === null ? OPENING_COUNTDOWN_SECONDS : countdown,
      killCooldownLeft, sabotageCooldownLeft,
      sabotageCooldownTotal: SABOTAGE_COOLDOWN_SECONDS,
      sabotageDialogOpen,
      blended
    },
    actions,
    loading,
    connected
  };
}
