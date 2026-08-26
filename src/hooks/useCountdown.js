import { useEffect, useMemo, useRef, useState } from 'react';
import {
  callMeeting, clearSabotage, endRound, publishFinishTime,
  recordKill, startSabotage, toggleTaskCompletion, undoKill
} from '../game/mutations';
import { useSettleOutcome } from './useSettleOutcome';
import { deriveRoundState, toggledTaskList } from '../game/roundState';
import { currentUid } from '../firebase';
import { SABOTAGE_COOLDOWN_SECONDS, isTicking, remainingCooldownSeconds } from '../game/cooldown';
import { useNow } from './useNow';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';
import { usePrivateRole } from './usePrivateRole';

const OPENING_COUNTDOWN_SECONDS = 3;
const REVEAL_HOLD_MS = 3800;
const INTRO_WINDOW_MS = 10000;

// Only play the opening beat if we actually arrived at it. A refresh ten
// minutes into a round is not the start of anything. Compared absolutely so a
// skewed clock fails to "recent is false" rather than replaying forever.
function justHappened(timestamp, now = Date.now()) {
  return !!timestamp && Math.abs(now - timestamp) < INTRO_WINDOW_MS;
}

export function useCountdown(gameCode) {
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);
  const { privateData, roleLoading } = usePrivateRole(gameCode, playerName);
  useSettleOutcome(gameCode, gameData);

  const [countdown, setCountdown] = useState(null);
  const [sabotageDialogOpen, setSabotageDialogOpen] = useState(false);
  const [blended, setBlended] = useState(false);
  // A tap that has not come back yet. Completing is a toggle decided from the
  // server, so a second tap on the same task while the first is still in the
  // air reads as "undo" -- and tapping again to make sure it registered is
  // exactly what somebody does when marking has been unreliable.
  const inFlight = useRef(new Set());
  // What our own writes actually did, which outranks the listener. Nobody else
  // ever writes your task list, so the list a write hands back is the truth
  // even when the role listener has gone quiet and the screen is showing a
  // stale copy. Without this a stalled listener leaves a completed task
  // looking undone, and completing is a toggle read from the server -- so
  // tapping the thing that looks undone would quietly un-complete it.
  const [ownTasks, setOwnTasks] = useState(null);

  const round = useMemo(() => deriveRoundState(gameData, playerName, currentUid(), privateData), [gameData, playerName, privateData]);

  // A fresh deal wipes the list on the server, so our copy of it stops being
  // the truth at exactly that moment.
  const roundStartedAt = round.roundStartedAt;
  useEffect(() => {
    setOwnTasks(null);
  }, [roundStartedAt]);

  const completedTasks = ownTasks || round.completedTasks;

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

  // Only tick while something is actually counting; a frozen cooldown is static.
  const now = useNow(isTicking(round.killCooldownUntil) || isTicking(round.sabotageCooldownUntil));
  const killCooldownLeft = remainingCooldownSeconds(round.killCooldownUntil, round.killCooldown, now);
  const sabotageCooldownLeft = remainingCooldownSeconds(
    round.sabotageCooldownUntil, SABOTAGE_COOLDOWN_SECONDS, now
  );

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
      if (round.tasksBlocked || inFlight.current.has(task)) return;
      inFlight.current.add(task);

      // Tick it now. A transaction has to reach the server before it can say
      // what it did, and a tap that sits there doing nothing reads as one that
      // was missed -- which is the thing that got tapped twice in the first
      // place. This is a guess at the answer, replaced by the real one below.
      const previous = completedTasks;
      setOwnTasks(toggledTaskList(previous, task));

      // The list comes back from the write itself, decided on the server, so
      // what we act on next is what actually landed rather than what the
      // screen believed a moment ago.
      const nextCompleted = await toggleTaskCompletion(gameCode, playerName, task)
        .finally(() => inFlight.current.delete(task));
      if (!nextCompleted) {
        setOwnTasks(previous);
        return;
      }

      setOwnTasks(nextCompleted);

      const justFinished = round.tasks.length > 0 && nextCompleted.length >= round.tasks.length;
      if (justFinished && !gameData?.finishedAt?.[playerName]) {
        await publishFinishTime(gameCode, playerName);
      }
    },

    toggleKill: async (crewmate) => {
      if (round.killList.includes(crewmate)) {
        await undoKill(gameCode, crewmate, playerName);
        return;
      }
      if (killCooldownLeft > 0) return;

      const victimRole = round.roleOf(crewmate);
      await recordKill(gameCode, crewmate, playerName, round.killCooldown, victimRole);
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

    clearMySabotage: () => clearSabotage(gameCode, playerName)
  }), [
    gameCode, playerName, round, completedTasks,
    killCooldownLeft, sabotageCooldownLeft, gameData?.finishedAt
  ]);

  return {
    state: {
      ...round, completedTasks, playerName,
      showIntro,
      introKind,
      countdown: countdown === null ? OPENING_COUNTDOWN_SECONDS : countdown,
      killCooldownLeft, sabotageCooldownLeft,
      sabotageCooldownTotal: SABOTAGE_COOLDOWN_SECONDS,
      sabotageDialogOpen,
      blended
    },
    actions,
    loading: loading || roleLoading,
    connected
  };
}
