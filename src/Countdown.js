import React from 'react';
import { useParams } from 'react-router-dom';
import { useCountdown } from './hooks/useCountdown';
import ConnectionBanner from './components/ConnectionBanner';

function Countdown() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useCountdown(gameCode);

  if (loading) {
    return <div className="countdown-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  const {
    playerName, countdown, role, isCreator, isDead,
    tasks, completedTasks, tasksBlocked, sabotagingImposter,
    crewmates, killList, fellowImposters, killCooldownLeft,
    sabotageActive, sabotagedPlayer, sabotageDialogOpen, eligibleCrewmates, sabotageCooldownLeft,
    progress
  } = state;

  return (
    <div className="countdown-screen">
      <ConnectionBanner connected={connected} />
      <div className="background-overlay">
        {countdown > 0 ? (
          <div className="countdown">
            <h1 className="countdown-timer">Game starting in... {countdown}</h1>
          </div>
        ) : (
          <div className="game-content">
            <div className="player-info">
              <h2 className="player-name">{playerName}</h2>
            </div>

            <h2 className={`role-announcement ${role || ''}`}>
              {isDead ? `You are a Dead ${role}` : role === 'Imposter' ? 'You are the Imposter!' : 'You are a Crewmate!'}
            </h2>

            {role === 'Crewmate' && !tasksBlocked && (
              <div>
                <h3>Your Tasks</h3>
                <div className="task-list">
                  <ul>
                    {tasks.map((task) => (
                      <li
                        key={task}
                        className={`task-item ${completedTasks.includes(task) ? 'selected' : ''}`}
                        onClick={() => actions.toggleTask(task)}
                      >
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {role === 'Crewmate' && tasksBlocked && (
              <div>
                <h3>You have been sabotaged</h3>
                <p>Find {sabotagingImposter} to resume your tasks!</p>
              </div>
            )}

            {role === 'Imposter' && !isDead && (
              <div>
                <h3>Kill List</h3>
                <div className="kill-list">
                  <ul>
                    {crewmates.map((crewmate) => (
                      <li
                        key={crewmate}
                        className={`kill-item ${killList.includes(crewmate) ? 'selected' : ''}`}
                        onClick={() => actions.toggleKill(crewmate)}
                      >
                        <label>{crewmate}</label>
                      </li>
                    ))}
                  </ul>
                </div>
                {killCooldownLeft > 0 && <div className="cooldown-timer">Cooldown: {killCooldownLeft}s</div>}
                {fellowImposters.length > 0 && (
                  <div className="fellow-imposters">
                    <p>Other Imposters: {fellowImposters.join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {role === 'Imposter' && isDead && !sabotageActive && (
              <div>
                <button
                  className="end-game-btn"
                  onClick={actions.openSabotageDialog}
                  disabled={sabotageCooldownLeft > 0 || eligibleCrewmates.length === 0}
                >
                  Sabotage
                </button>
                {sabotageDialogOpen && (
                  <div className="dialog-overlay">
                    <div className="dialog">
                      <h3>Select a player to sabotage:</h3>
                      <ul>
                        {eligibleCrewmates.map((crewmate) => (
                          <li className="kill-item" key={crewmate} onClick={() => actions.sabotage(crewmate)}>
                            <label className="sabotage-option-btn">{crewmate}</label>
                          </li>
                        ))}
                      </ul>
                      <button className="end-game-btn" onClick={actions.closeSabotageDialog}>Cancel</button>
                    </div>
                  </div>
                )}
                {sabotageCooldownLeft > 0 && (
                  <div className="sabotage-cooldown">Sabotage Cooldown: {sabotageCooldownLeft}s</div>
                )}
              </div>
            )}

            {role === 'Imposter' && isDead && sabotageActive && (
              <div>
                <p>Hide in one place and wait for {sabotagedPlayer} to find you. Once they do, press the button below.</p>
                <button className="reset-sabotage-btn" onClick={actions.clearMySabotage}>
                  {sabotagedPlayer} Found Me
                </button>
              </div>
            )}

            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div>
            </div>

            <div className="buttons">
              {role && !isDead && !tasksBlocked && (
                <button className="emergency-meeting-btn" onClick={actions.callMeeting}>
                  🚨 Emergency Meeting
                </button>
              )}
              {isCreator && (
                <button className="end-game-btn" onClick={actions.endRound}>End Game Round</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Countdown;
