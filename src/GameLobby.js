import React from 'react';
import { useParams } from 'react-router-dom';
import { useLobby } from './hooks/useLobby';
import ConnectionBanner from './components/ConnectionBanner';

function GameLobby() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useLobby(gameCode);

  if (loading) {
    return <div className="game-lobby"><ConnectionBanner connected={connected} />Loading game data…</div>;
  }

  const {
    players, tasks, maxPlayers, playerName, isCreator,
    imposterCount, tasksPerCrewmate, killCooldown,
    imposterOptions, taskCountOptions,
    newTask, starting, errorMessage
  } = state;

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
          <h3>Players ({players.length}/{maxPlayers})</h3>
          <div className="player-grid">
            {players.map((player) => (
              <div key={player} className={`player-card ${player === playerName ? 'highlight' : ''}`}>
                <span>{player}</span>
                {isCreator && player !== playerName && (
                  <button className="kick-button" onClick={() => actions.kickPlayer(player)} title="Remove player">✕</button>
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
                    <button className="kick-button" onClick={() => actions.removeTask(task)} title="Remove task">✕</button>
                  </li>
                ))}
              </ul>
              <div className="task-input">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => actions.setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && actions.addTask()}
                  placeholder="Enter new task"
                />
                <button onClick={actions.addTask}>Add Task</button>
              </div>
            </div>

            <div className="controls">
              <button onClick={actions.startGame} disabled={players.length < 2 || starting} className="start-game-btn">
                {starting ? 'Starting…' : 'Start Game'}
              </button>
              <button onClick={actions.finishGame} className="end-game-btn">
                Finish Game and Delete Data
              </button>
            </div>

            {players.length > 3 ? (
              <div className="imposter-select">
                <label>Number of Imposters:</label>
                <select
                  value={imposterCount}
                  onChange={(e) => actions.updateSetting('imposterCount', Number(e.target.value))}
                >
                  {imposterOptions.map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p>There will be 1 imposter.</p>
            )}

            <div className="kill-cooldown-selection">
              <label>Kill Cooldown (seconds):</label>
              <select
                value={killCooldown}
                onChange={(e) => actions.updateSetting('killCooldown', Number(e.target.value))}
              >
                {[10, 15, 20, 25, 30].map((seconds) => (
                  <option key={seconds} value={seconds}>{seconds} seconds</option>
                ))}
              </select>
            </div>

            <div className="task-count-selection">
              <label>Number of Tasks per Crewmate:</label>
              <select
                value={tasksPerCrewmate}
                onChange={(e) => actions.updateSetting('tasksPerCrewmate', Number(e.target.value))}
              >
                {taskCountOptions.map((num) => (
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
