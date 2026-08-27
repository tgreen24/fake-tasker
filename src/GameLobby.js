import React from 'react';
import { useParams } from 'react-router-dom';
import { useLobby } from './hooks/useLobby';
import ConnectionBanner from './components/ConnectionBanner';
import PlayerAvatar from './components/PlayerAvatar';
import ScreenHeader from './components/ScreenHeader';
import HowToPlay from './components/HowToPlay';
import InviteButton from './components/InviteButton';
import TaskEditor from './components/TaskEditor';
import { TASK_PACKS } from './game/taskPacks';
import { roleNameLower, roleNamePlural } from './game/terminology';
import LeaveGame from './components/LeaveGame';
import { MIN_PLAYERS } from './game/lobbyState';

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
          <div className="game-code-text">
            Game Code
            <strong>{gameCode}</strong>
          </div>
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

        <LeaveGame gameCode={gameCode} playerName={playerName} />

        {isCreator && (
          <div className="creator-controls">
            <button
              onClick={actions.startGame}
              disabled={players.length < MIN_PLAYERS || starting}
              className="start-game-btn"
            >
              {starting ? 'Starting…' : 'Start Game'}
            </button>

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
              <p className="vote-progress">There will be 1 {roleNameLower('Imposter')}.</p>
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

            <TaskEditor
              tasks={tasks}
              packs={TASK_PACKS}
              newTask={newTask}
              onSetNewTask={actions.setNewTask}
              onAddTask={actions.addTask}
              onRemoveTask={actions.removeTask}
              onAddPack={actions.addManyTasks}
            />

            <button onClick={actions.finishGame} className="end-game-btn">
              Finish Game and Delete Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameLobby;
