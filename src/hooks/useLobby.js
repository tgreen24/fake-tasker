import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addTask as writeTask, deleteGame, kickPlayer as writeKick, removeTask as writeRemoveTask,
  setMinigameRooms, setTaskStyle as writeTaskStyle, setTasks as writeTaskList, startRound,
  updateSetting as writeSetting
} from '../game/mutations';
import { roomsWithAdded, roomsWithout, startingRooms } from '../game/minigameTasks';
import { deriveLobbyState, tasksEachWithin, validateNewTask, validateStart } from '../game/lobbyState';
import { activePackId, packById, roomsIn, withPackSelected } from '../game/taskPacks';
import { buildRound } from '../game/roleAssignment';
import { currentUid } from '../firebase';
import { seatTakenElsewhere } from '../game/seats';
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
    removeTask: (task) => writeRemoveTask(
      gameCode, task, tasksEachWithin(lobby.tasksPerCrewmate, lobby.taskStyle, lobby.tasks.length - 1)
    ).catch((error) => {
      console.error('Error removing task:', error);
    }),
    addOneTask: (task) => writeTask(gameCode, task).catch((error) => {
      console.error('Error adding task:', error);
    }),
    selectPack: (packId) => {
      const next = withPackSelected(lobby.tasks, packId);
      const clamped = tasksEachWithin(lobby.tasksPerCrewmate, lobby.taskStyle, next.length);
      return writeTaskList(gameCode, next, clamped).catch((error) => {
        console.error('Error choosing a task pack:', error);
      });
    },
    kickPlayer: (playerToKick) => {
      if (playerToKick === playerName) return undefined;
      return writeKick(gameCode, playerToKick);
    },
    updateSetting: (field, value) => writeSetting(gameCode, field, value),
    // Turning minigames on with no rooms yet fills them in from the pack, so
    // the host has something to edit rather than a blank list.
    setTaskStyle: (style) => {
      const needsRooms = style !== 'physical' && !lobby.minigameRooms.length;
      const rooms = needsRooms ? startingRooms(roomsIn(packById(activePackId(lobby.tasks)))) : null;
      const clamped = tasksEachWithin(lobby.tasksPerCrewmate, style, lobby.tasks.length);
      return writeTaskStyle(gameCode, style, rooms, clamped)
        .catch((error) => console.error('Error setting task style:', error));
    },
    addRoom: (name) => {
      const next = roomsWithAdded(lobby.minigameRooms, name);
      if (next === lobby.minigameRooms) return undefined;
      return setMinigameRooms(gameCode, next).catch((error) => console.error('Error adding a room:', error));
    },
    removeRoom: (name) => setMinigameRooms(gameCode, roomsWithout(lobby.minigameRooms, name))
      .catch((error) => console.error('Error removing a room:', error))
  }), [gameCode, playerName, addTask, startGame, finishGame, lobby]);

  return {
    state: {
      ...lobby, gameCode, playerName, newTask, starting, errorMessage,
      seatLost: seatTakenElsewhere(gameData, playerName, currentUid()),
      seatMoves: gameData?.seatMoves || {},
      activePack: activePackId(lobby.tasks)
    },
    actions,
    loading,
    connected
  };
}
