import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, deleteDoc, updateDoc, arrayRemove, arrayUnion, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import { updateGame } from './db';
import { usePlayerName } from './hooks/usePlayerName';
import { useGameSync } from './hooks/useGameSync';
import ConnectionBanner from './components/ConnectionBanner';

const MAX_PLAYERS = 25;

function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function calculateWeights(players, history) {
  const maxImposterCount = Math.max(0, ...Object.values(history));
  const weights = {};
  players.forEach((player) => {
    weights[player] = maxImposterCount - (history[player] || 0) + 1;
  });
  return weights;
}

function selectImposters(players, weights, imposterCount) {
  const weightedPlayers = [];
  players.forEach((player) => {
    for (let i = 0; i < weights[player]; i++) weightedPlayers.push(player);
  });

  const pool = shuffleArray(weightedPlayers);
  const selected = new Set();
  while (selected.size < imposterCount && pool.length > 0) {
    selected.add(pool.pop());
  }
  return Array.from(selected);
}

function assignTasksEvenly(crewmates, tasks, tasksPerCrewmate) {
  const perCrewmate = Math.min(tasksPerCrewmate, tasks.length);
  const assignedTasks = {};
  crewmates.forEach((crewmate) => {
    assignedTasks[crewmate] = [];
  });
  if (perCrewmate === 0 || crewmates.length === 0) return assignedTasks;

  let pool = [];
  for (let round = 0; round < perCrewmate; round++) {
    for (let i = 0; i < crewmates.length; i++) {
      const crewmate = crewmates[i];
      const taken = assignedTasks[crewmate];
      let index = pool.findIndex((task) => !taken.includes(task));
      if (index === -1) {
        pool = shuffleArray(tasks).filter((task) => !taken.includes(task));
        index = 0;
      }
      taken.push(pool[index]);
      pool.splice(index, 1);
    }
  }
  return assignedTasks;
}

function GameLobby() {
  const { gameCode } = useParams();
  const navigate = useNavigate();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const [newTask, setNewTask] = useState('');
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const players = gameData?.players || [];
  const tasks = gameData?.tasks || [];
  const isCreator = !!gameData && gameData.creator === playerName;
  const imposterCount = gameData?.imposterCount || 1;
  const tasksPerCrewmate = gameData?.tasksPerCrewmate || 3;
  const killCooldown = gameData?.killCooldown || 30;

  const addTask = async () => {
    const task = newTask.trim();
    if (!task) return;
    if (tasks.includes(task)) {
      setErrorMessage('That task is already on the list.');
      return;
    }
    setNewTask('');
    setErrorMessage('');
    await updateDoc(doc(db, 'games', gameCode), { tasks: arrayUnion(task) }).catch((error) => {
      console.error('Error adding task:', error);
      setErrorMessage('Could not add that task. Try again.');
    });
  };

  const removeTask = async (task) => {
    await updateDoc(doc(db, 'games', gameCode), { tasks: arrayRemove(task) }).catch((error) => {
      console.error('Error removing task:', error);
    });
  };

  const startGame = async () => {
    if (starting) return;

    if (players.length < 2) {
      setErrorMessage('You need at least 2 players.');
      return;
    }
    if (tasks.length < tasksPerCrewmate) {
      setErrorMessage(`Not enough tasks. You need at least ${tasksPerCrewmate}.`);
      return;
    }
    if (imposterCount > players.length - 1) {
      setErrorMessage('Invalid imposter count. Must have at least 1 crewmate.');
      return;
    }

    setStarting(true);
    setErrorMessage('');

    const history = gameData?.imposterHistory || {};
    const weights = calculateWeights(players, history);
    const imposters = selectImposters(players, weights, imposterCount);
    const crewmates = players.filter((player) => !imposters.includes(player));

    const roles = {};
    const nextHistory = { ...history };
    imposters.forEach((imposter) => {
      roles[imposter] = 'Imposter';
      nextHistory[imposter] = (nextHistory[imposter] || 0) + 1;
    });
    crewmates.forEach((crewmate) => {
      roles[crewmate] = 'Crewmate';
    });

    const completedTasks = {};
    players.forEach((player) => {
      completedTasks[player] = [];
    });

    const ok = await updateGame(gameCode, {
      roles,
      assignedTasks: assignTasksEvenly(crewmates, tasks, tasksPerCrewmate),
      imposterHistory: nextHistory,
      completedTasks,
      killList: [],
      votes: {},
      sabotages: {},
      gameStarted: true,
      gameEnded: false,
      meetingCalled: false,
      meetingCaller: deleteField(),
      voteDeadline: deleteField(),
      votingResult: deleteField(),
      resultUntil: deleteField(),
      winner: deleteField()
    });

    setStarting(false);
    if (!ok) setErrorMessage('Could not start the game. Check your connection and try again.');
  };

  const finishGame = async () => {
    try {
      await deleteDoc(doc(db, 'games', gameCode));
      navigate('/');
    } catch (error) {
      console.error('Error deleting document: ', error);
      setErrorMessage('Could not end the game. Try again.');
    }
  };

  const kickPlayer = async (playerToKick) => {
    if (playerToKick === playerName) return;
    await updateGame(gameCode, { players: arrayRemove(playerToKick) });
  };

  const updateSetting = (field, value) => updateGame(gameCode, { [field]: value });

  if (loading) {
    return <div className="game-lobby"><ConnectionBanner connected={connected} />Loading game data…</div>;
  }

  return (
    <div className="game-lobby">
      <ConnectionBanner connected={connected} />
      <div className="lobby-header">
        <div className="game-code">
          Game Code: <strong>{gameCode}</strong>
        </div>
      </div>

      <div className="lobby-content">
        <div className="players-list">
          <h3>Players ({players.length}/{MAX_PLAYERS})</h3>
          <div className="player-grid">
            {players.map((player) => (
              <div key={player} className={`player-card ${player === playerName ? 'highlight' : ''}`}>
                <span>{player}</span>
                {isCreator && player !== playerName && (
                  <button className="kick-button" onClick={() => kickPlayer(player)} title="Remove player">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {isCreator && (
          <div className="creator-controls">
            <div className="task-section">
              <h3>Tasks</h3>
              <ul>
                {tasks.map((task) => (
                  <li key={task} className="task-item">
                    {task}
                    <button className="kick-button" onClick={() => removeTask(task)} title="Remove task">✕</button>
                  </li>
                ))}
              </ul>
              <div className="task-input">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  placeholder="Enter new task"
                />
                <button onClick={addTask}>Add Task</button>
              </div>
            </div>

            <div className="controls">
              <button onClick={startGame} disabled={players.length < 2 || starting} className="start-game-btn">
                {starting ? 'Starting…' : 'Start Game'}
              </button>
              <button onClick={finishGame} className="end-game-btn">
                Finish Game and Delete Data
              </button>
            </div>

            {players.length > 3 ? (
              <div className="imposter-select">
                <label>Number of Imposters:</label>
                <select value={imposterCount} onChange={(e) => updateSetting('imposterCount', Number(e.target.value))}>
                  {Array.from({ length: Math.max(1, Math.floor(players.length / 3)) }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p>There will be 1 imposter.</p>
            )}

            <div className="kill-cooldown-selection">
              <label>Kill Cooldown (seconds):</label>
              <select value={killCooldown} onChange={(e) => updateSetting('killCooldown', Number(e.target.value))}>
                {[10, 15, 20, 25, 30].map((seconds) => (
                  <option key={seconds} value={seconds}>{seconds} seconds</option>
                ))}
              </select>
            </div>

            <div className="task-count-selection">
              <label>Number of Tasks per Crewmate:</label>
              <select value={tasksPerCrewmate} onChange={(e) => updateSetting('tasksPerCrewmate', Number(e.target.value))}>
                {Array.from({ length: Math.max(1, Math.min(tasks.length, 10)) }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLobby;
