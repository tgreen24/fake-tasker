import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  callMeeting, clearSabotage, endRound, publishFinishTime,
  recordKill, startSabotage, toggleTaskCompletion, undoKill
} from '../game/mutations';
import { useSettleOutcome } from './useSettleOutcome';
import { deriveRoundState, targetTap, toggledTaskList } from '../game/roundState';
import { guideCards, roundBody, roundDock, roundTabs, statusLine } from '../game/roundView';
import { firstTime } from '../seenOnce';
import { currentUid } from '../firebase';
import { seatTakenElsewhere } from '../game/seats';
import { SABOTAGE_COOLDOWN_SECONDS, isTicking, remainingCooldownSeconds } from '../game/cooldown';
import { useNow } from './useNow';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';
import { usePrivateRole } from './usePrivateRole';
import { usePublishOutRoles } from './usePublishOutRoles';
import { useLockdown } from './useLockdown';
import { useFakeTasks } from './useFakeTasks';
import { isMinigameTask } from '../game/minigameTasks';
import { withTimeout } from '../withTimeout';

const TASK_WAIT_MS = 10000;
const BRING_BACK_WINDOW_MS = 4000;

const OPENING_COUNTDOWN_SECONDS = 3;
// How long the role stays up at the start of a round before it hides itself.
const REVEAL_MS = Number(process.env.REACT_APP_REVEAL_MS) || 6000;
const KILLED_MS = 6500;
const INTRO_WINDOW_MS = 10000;
const LATE_REVEAL_MS = 8000;

// Only play the opening beat if we actually arrived at it. A refresh ten
// minutes into a round is not the start of anything. Compared absolutely so a
// skewed clock fails to "recent is false" rather than replaying forever.
function justHappened(timestamp, now = Date.now()) {
  return !!timestamp && Math.abs(now - timestamp) < INTRO_WINDOW_MS;
}

export function useCountdown(gameCode) {
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);
  const { privateData, roleLoading } = usePrivateRole(gameCode, playerName, gameData?.playerUids?.[playerName]);
  useSettleOutcome(gameCode, gameData);
  usePublishOutRoles(gameCode, gameData, playerName, privateData);
  const lockdown = useLockdown(gameCode, gameData, playerName, privateData);

  const [countdown, setCountdown] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [killedMoment, setKilledMoment] = useState(false);
  const [taskTab, setTaskTab] = useState('todo');
  // The dead target waiting on a second tap to be brought back.
  const [armedTarget, setArmedTarget] = useState(null);
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
  const cover = useFakeTasks(gameCode, playerName, round.fakeTasks, round.fakeCompleted, roundStartedAt);

  // The minigame open on screen, if any, and whether it is real or cover.
  // Anything that stops tasks closes it: the next try starts fresh.
  const [playing, setPlaying] = useState(null);
  const [showingCover, setShowingCover] = useState(false);
  const tasksStopped = round.tasksBlocked || lockdown.state.active;
  useEffect(() => {
    if (tasksStopped) setPlaying(null);
  }, [tasksStopped]);
  useEffect(() => {
    setPlaying(null);
    setShowingCover(false);
    setTaskTab('todo');
  }, [roundStartedAt]);

  // A role that lands after the vote's result screen has gone would otherwise
  // never be announced to the room, so the round screen says it instead.
  const awaitingKey = round.awaitingReveal.join('\n');
  const revealed = gameData?.revealed;
  const previouslyAwaiting = useRef([]);
  const [lateReveal, setLateReveal] = useState(null);
  useEffect(() => {
    const landed = previouslyAwaiting.current.find((name) => revealed?.[name]);
    previouslyAwaiting.current = awaitingKey ? awaitingKey.split('\n') : [];
    if (landed) setLateReveal({ name: landed, role: revealed[landed] });
  }, [awaitingKey, revealed]);
  useEffect(() => {
    if (!lateReveal) return undefined;
    const timer = setTimeout(() => setLateReveal(null), LATE_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [lateReveal]);

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

  // The role is shown once, full screen, as the round opens -- then hidden, so
  // a glance from across the room says nothing. Returning from a meeting skips
  // it: everyone is stood together at exactly that moment.
  const revealedFor = useRef(null);
  useEffect(() => {
    if (introKind !== 'opening' || showIntro || revealedFor.current === round.roundStartedAt) return;
    revealedFor.current = round.roundStartedAt;
    setRevealing(true);
  }, [introKind, showIntro, round.roundStartedAt]);
  useEffect(() => {
    if (!revealing) return undefined;
    const timer = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealing]);

  // Being killed plays once, quietly, the first time this phone sees it --
  // not for being voted out, which everyone has just watched happen.
  useEffect(() => {
    if (!round.wasKilled || round.role !== 'Crewmate' || !gameCode || !round.roundStartedAt) return;
    if (firstTime(`killed:${gameCode}:${round.roundStartedAt}`)) setKilledMoment(true);
  }, [round.wasKilled, round.role, gameCode, round.roundStartedAt]);
  useEffect(() => {
    if (!killedMoment) return undefined;
    const timer = setTimeout(() => setKilledMoment(false), KILLED_MS);
    return () => clearTimeout(timer);
  }, [killedMoment]);

  const actions = useMemo(() => ({
    // Resolves true once the change has landed, false if it did not.
    toggleTask: async (task) => {
      if (round.tasksBlocked || lockdown.state.active || inFlight.current.has(task)) return false;
      // A minigame proved it was done; it is not untickable like a chore.
      if (isMinigameTask(task) && completedTasks.includes(task)) return true;
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
      let timedOut = false;
      const nextCompleted = await withTimeout(toggleTaskCompletion(gameCode, playerName, task), TASK_WAIT_MS)
        .catch(() => {
          timedOut = true;
          return null;
        })
        .finally(() => inFlight.current.delete(task));
      // A tap that never came back may still land, so neither the guess nor the
      // old list is safe to keep: go back to whatever the server says.
      if (timedOut) {
        setOwnTasks(null);
        return false;
      }
      if (!nextCompleted) {
        setOwnTasks(previous);
        return false;
      }

      setOwnTasks(nextCompleted);

      const justFinished = round.tasks.length > 0 && nextCompleted.length >= round.tasks.length;
      if (justFinished && !gameData?.finishedAt?.[playerName]) {
        await publishFinishTime(gameCode, playerName);
      }
      return true;
    },

    toggleKill: async (crewmate) => {
      const target = round.targets.find((entry) => entry.name === crewmate);
      if (!target) return;
      const tap = targetTap(target, armedTarget);
      if (tap === 'none') return;
      if (tap === 'arm') {
        setArmedTarget(crewmate);
        return;
      }
      setArmedTarget(null);
      if (tap === 'bring-back') {
        await undoKill(gameCode, crewmate, round.killerOf(crewmate));
        return;
      }
      if (killCooldownLeft > 0) return;

      const victimRole = round.roleOf(crewmate);
      await recordKill(gameCode, crewmate, playerName, round.killCooldown, victimRole);
    },

    callMeeting: () => callMeeting(gameCode, playerName),
    endRound: () => endRound(gameCode),

    sabotage: async (crewmate) => {
      if (sabotageCooldownLeft > 0) return;
      await startSabotage(gameCode, playerName, crewmate);
    },

    clearMySabotage: () => clearSabotage(gameCode, playerName),

    playTask: (task, { asCover = false } = {}) => {
      if (!tasksStopped) setPlaying({ task, asCover });
    },
    stopPlaying: () => setPlaying(null),
    toggleCoverTask: (task) => {
      if (!lockdown.state.active) cover.toggleFake(task);
    },
    selectTab: (tab) => {
      setPlaying(null);
      if (round.role === 'Imposter') setShowingCover(tab === 'tasks');
      else setTaskTab(tab);
    },
    dismissReveal: () => setRevealing(false),
    dismissKilled: () => setKilledMoment(false)
  }), [
    cover, tasksStopped,
    lockdown.state.active,
    gameCode, playerName, round, completedTasks,
    killCooldownLeft, sabotageCooldownLeft, gameData?.finishedAt, armedTarget
  ]);

  useEffect(() => {
    if (!armedTarget) return undefined;
    const timer = setTimeout(() => setArmedTarget(null), BRING_BACK_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armedTarget]);

  // A won minigame, counted as a real task or as cover depending on which
  // list it was opened from. Resolves whether the win was saved.
  const solvePlaying = useCallback(async () => {
    if (!playing) return false;
    if (playing.asCover) return cover.completeFake(playing.task);
    return actions.toggleTask(playing.task);
  }, [playing, cover, actions]);

  const tab = round.role === 'Imposter' ? (showingCover ? 'tasks' : 'targets') : taskTab;
  const situation = {
    role: round.role,
    isDead: round.isDead,
    tasksBlocked: round.tasksBlocked,
    lockdownActive: lockdown.state.active,
    lockdownEnabled: lockdown.state.enabled,
    sabotageActive: round.sabotageActive,
    tab,
    tasks: round.tasks,
    completed: completedTasks,
    fakeTasks: cover.fakeTasks,
    targetsLeft: round.targets.filter((target) => !target.out).length
  };
  const body = roundBody(situation);
  const view = {
    body,
    tab,
    tabs: roundTabs(situation),
    dock: roundDock(situation),
    status: statusLine(body, {
      tasks: round.tasks,
      completed: completedTasks,
      fakeTasks: cover.fakeTasks,
      fakeCompleted: cover.fakeCompleted,
      fellowImposters: round.fellowImposters,
      killCooldownLeft,
      sabotageCooldownLeft
    }),
    guide: guideCards({
      body,
      role: round.role,
      tasksLeft: round.tasks.filter((task) => !completedTasks.includes(task)).length,
      sabotagingImposter: round.sabotagingImposter,
      killCooldown: round.killCooldown,
      lockdownEnabled: lockdown.state.enabled
    })
  };

  return {
    state: {
      ...round, completedTasks, playerName,
      fakeTasks: cover.fakeTasks, fakeCompleted: cover.fakeCompleted, playing, showingCover,
      seatLost: seatTakenElsewhere(gameData, playerName, currentUid()),
      seatMoves: gameData?.seatMoves || {},
      showIntro,
      introKind,
      countdown: countdown === null ? OPENING_COUNTDOWN_SECONDS : countdown,
      killCooldownLeft, sabotageCooldownLeft, armedTarget,
      // Also true in the one render between the countdown ending and the
      // effect starting the reveal, so the round screen never flashes first.
      revealing: revealing
        || (introKind === 'opening' && !showIntro && revealedFor.current !== round.roundStartedAt),
      killedMoment,
      lateReveal,
      awaitingOthers: round.awaitingReveal.filter((name) => name !== playerName),
      view
    },
    actions: { ...actions, solvePlaying },
    lockdown,
    loading: loading || roleLoading,
    connected
  };
}
