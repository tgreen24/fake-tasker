import { useEffect, useMemo, useState } from 'react';
import {
  callMeeting, clearSabotage, endGame, endRound,
  recordKill, setCompletedTasks, startSabotage, undoKill
} from '../game/mutations';
import {
  deriveRoundState, everyoneFinishedTasks, toggledTaskList, winnerAfterKill
} from '../game/roundState';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';

const OPENING_COUNTDOWN_SECONDS = 3;
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

  const [countdown] = useSecondsRemaining(OPENING_COUNTDOWN_SECONDS);
  const [killCooldownLeft, setKillCooldownLeft] = useSecondsRemaining(0);
  const [sabotageCooldownLeft, setSabotageCooldownLeft] = useSecondsRemaining(0);
  const [sabotageDialogOpen, setSabotageDialogOpen] = useState(false);

  const round = useMemo(() => deriveRoundState(gameData, playerName), [gameData, playerName]);

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
    state: { ...round, playerName, countdown, killCooldownLeft, sabotageCooldownLeft, sabotageDialogOpen },
    actions,
    loading,
    connected
  };
}
