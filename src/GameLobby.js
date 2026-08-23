import React from 'react';
import { useParams } from 'react-router-dom';
import { useLobby } from './hooks/useLobby';
import ConnectionBanner from './components/ConnectionBanner';
import PlayerAvatar from './components/PlayerAvatar';
import ScreenHeader from './components/ScreenHeader';
import HowToPlay from './components/HowToPlay';
import InviteButton from './components/InviteButton';
import { roleNameLower, roleNamePlural } from './game/terminology';
import LeaveGame from './components/LeaveGame';

function GameLobby() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useLobby(gameCode);

  if (loading) {
    return <div className="game-lobby"><ConnectionBanner connected={connected} />Loading game data…</div>;
  }

  const {
    players, tasks, maxPlayers, playerName, isCreator,
    imposterCount, tasksPerCrewmate, killCooldown,
    imposterOptions, taskCountOptions, colors,
    newTask, starting, errorMessage
  } = state;

  return (
    <div className="game-lobby">
      <ConnectionBanner connected={connected} />
      <ScreenHeader title="Lobby" />
      <div className="lobby-header">
        <div className="game-code">
          Game Code: <strong>{gameCode}</strong>
          <InviteButton gameCode={gameCode} />
        </div>
      </div>

      <div className="lobby-content">
        <div className="players-list">
          <h3>Players ({players.length}/{maxPlayers})</h3>
          <div className="player-grid">
            {players.map((player) => (
              <div key={player} className={`player-card ${player === playerName ? 'highlight' : ''}`}>
                <PlayerAvatar name={player} color={colors[player]} />
                <span>{player}{player === playerName ? ' (You)' : ''}</span>
                {isCreator && player !== playerName && (
                  <button
                    className="kick-button"
                    onClick={() => actions.kickPlayer(player)}
                    aria-label={`Remove ${player}`}
                    title="Remove player"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <HowToPlay />

        <LeaveGame />

        {isCreator && (
          <div className="creator-controls">
            <div className="task-section">
              <h3>Tasks</h3>
              <ul>
                {tasks.map((task) => (
                  <li key={task} className="task-row">
                    <span>{task}</span>
                    <button
                      className="kick-button"
                      onClick={() => actions.removeTask(task)}
                      aria-label={`Remove ${task}`}
                      title="Remove task"
                    >✕</button>
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
                <label>Number of {roleNamePlural('Imposter')}:</label>
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
              <p>There will be 1 {roleNameLower('Imposter')}.</p>
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
              <label>Tasks each:</label>
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
