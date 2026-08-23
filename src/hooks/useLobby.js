import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addTask as writeTask, deleteGame, kickPlayer as writeKick,
  removeTask as writeRemoveTask, startRound, updateSetting as writeSetting
} from '../game/mutations';
import { deriveLobbyState, validateNewTask, validateStart } from '../game/lobbyState';
import { buildRound } from '../game/roleAssignment';
import { currentUid } from '../firebase';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';

export function useLobby(gameCode) {
  const navigate = useNavigate();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const [newTask, setNewTask] = useState('');
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const lobby = useMemo(() => deriveLobbyState(gameData, playerName, currentUid()), [gameData, playerName]);

  const addTask = useCallback(async () => {
    const { error, task } = validateNewTask(newTask, lobby.tasks);
    if (error) {
      setErrorMessage(error);
      return;
    }
    if (!task) return;

    setNewTask('');
    setErrorMessage('');
    try {
      await writeTask(gameCode, task);
    } catch (writeError) {
      console.error('Error adding task:', writeError);
      setErrorMessage('Could not add that task. Try again.');
    }
  }, [gameCode, newTask, lobby.tasks]);

  const startGame = useCallback(async () => {
    if (starting) return;

    const problem = validateStart(lobby);
    if (problem) {
      setErrorMessage(problem);
      return;
    }

    setStarting(true);
    setErrorMessage('');
    const ok = await startRound(gameCode, buildRound(lobby), gameData?.playerUids || {});
    setStarting(false);

    if (!ok) setErrorMessage('Could not start the game. Check your connection and try again.');
  }, [gameCode, lobby, starting, gameData?.playerUids]);

  const finishGame = useCallback(async () => {
    try {
      await deleteGame(gameCode, lobby.players);
      navigate('/');
    } catch (error) {
      console.error('Error deleting document: ', error);
      setErrorMessage('Could not end the game. Try again.');
    }
  }, [gameCode, navigate, lobby.players]);

  const actions = useMemo(() => ({
    setNewTask,
    addTask,
    startGame,
    finishGame,
    removeTask: (task) => writeRemoveTask(gameCode, task).catch((error) => {
      console.error('Error removing task:', error);
    }),
    kickPlayer: (playerToKick) => {
      if (playerToKick === playerName) return undefined;
      return writeKick(gameCode, playerToKick);
    },
    updateSetting: (field, value) => writeSetting(gameCode, field, value)
  }), [gameCode, playerName, addTask, startGame, finishGame]);

  return {
    state: { ...lobby, gameCode, playerName, newTask, starting, errorMessage },
    actions,
    loading,
    connected
  };
}
