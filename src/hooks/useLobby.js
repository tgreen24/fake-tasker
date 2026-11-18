import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addTask as writeTask, deleteGame, kickPlayer as writeKick, removeTask as writeRemoveTask,
  setTasks as writeTaskList, startRound, updateSetting as writeSetting
} from '../game/mutations';
import { deriveLobbyState, validateNewTask, validateStart } from '../game/lobbyState';
import { activePackId, withPackSelected } from '../game/taskPacks';
import { buildRound } from '../game/roleAssignment';
import { currentUid } from '../firebase';
import { withTimeout, isTimeout } from '../withTimeout';
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
    try {
      const outcome = await withTimeout(
        startRound(gameCode, buildRound(lobby), gameData?.playerUids || {})
      );
      if (outcome === 'roster-changed') {
        setErrorMessage('Somebody joined or left just then. Tap Start Game again.');
      } else if (outcome !== 'started') {
        setErrorMessage('Could not start the game. Check your connection and try again.');
      }
    } catch (error) {
      setErrorMessage(
        isTimeout(error)
          ? 'That is taking longer than it should. Check your connection and tap Start Game again.'
          : 'Could not start the game. Check your connection and try again.'
      );
    } finally {
      setStarting(false);
    }
  }, [gameCode, lobby, starting, gameData?.playerUids]);

  const finishGame = useCallback(async () => {
    try {
      await deleteGame(gameCode, lobby.players, gameData?.dealtSeats || []);
      navigate('/');
    } catch (error) {
      console.error('Error deleting document: ', error);
      setErrorMessage('Could not end the game. Try again.');
    }
  }, [gameCode, navigate, lobby.players, gameData?.dealtSeats]);

  const actions = useMemo(() => ({
    setNewTask,
    addTask,
    startGame,
    finishGame,
    removeTask: (task) => writeRemoveTask(gameCode, task).catch((error) => {
      console.error('Error removing task:', error);
    }),
    addOneTask: (task) => writeTask(gameCode, task).catch((error) => {
      console.error('Error adding task:', error);
    }),
    selectPack: (packId) => {
      const next = withPackSelected(lobby.tasks, packId);
      return writeTaskList(gameCode, next).catch((error) => {
        console.error('Error choosing a task pack:', error);
      });
    },
    kickPlayer: (playerToKick) => {
      if (playerToKick === playerName) return undefined;
      return writeKick(gameCode, playerToKick);
    },
    updateSetting: (field, value) => writeSetting(gameCode, field, value)
  }), [gameCode, playerName, addTask, startGame, finishGame, lobby.tasks]);

  return {
    state: {
      ...lobby, gameCode, playerName, newTask, starting, errorMessage,
      seatLost: !!gameData?.playerUids?.[playerName] && gameData.playerUids[playerName] !== currentUid(),
      seatRequests: gameData?.seatRequests || {}, dealtSeats: gameData?.dealtSeats || [],
      activePack: activePackId(lobby.tasks)
    },
    actions,
    loading,
    connected
  };
}
