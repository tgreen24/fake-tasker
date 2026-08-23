import React from 'react';
import { useParams } from 'react-router-dom';
import { useCountdown } from './hooks/useCountdown';
import ConnectionBanner from './components/ConnectionBanner';
import Selectable from './components/Selectable';
import TimerBar from './components/TimerBar';
import ScreenHeader from './components/ScreenHeader';
import { roleName, roleNamePlural } from './game/terminology';

function Countdown() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useCountdown(gameCode);

  if (loading) {
    return <div className="countdown-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  const {
    playerName, countdown, showIntro, introKind, role, isCreator, isDead,
    tasks, completedTasks, tasksBlocked, sabotagingImposter,
    crewmates, killList, fellowImposters, killCooldownLeft,
    sabotageActive, sabotagedPlayer, sabotageDialogOpen, eligibleCrewmates,
    sabotageCooldownLeft, sabotageCooldownTotal, killCooldown,
    blended, progress
  } = state;

  return (
    <div className="countdown-screen">
      <ConnectionBanner connected={connected} />
      <div className="background-overlay">
        {showIntro ? (
          <div className="countdown">
            <div
              className={`countdown-rings ${introKind === 'return' ? 'tone-success' : ''}`}
              aria-hidden="true"
            ><span /><span /><span /></div>
            <div className="countdown-number" key={countdown}>{countdown}</div>
            <h1
              className={`countdown-timer ${introKind === 'return' ? 'tone-success' : ''}`}
              aria-live="polite"
            >
              {introKind === 'return' ? 'Meeting adjourned' : 'Assigning roles…'}
            </h1>
            <p className="countdown-caption">
              {introKind === 'return' ? 'Back to your tasks' : 'Keep your screen to yourself'}
            </p>
          </div>
        ) : (
          <div className="game-content">
            <ScreenHeader title={playerName} status="Game in progress" tone="success" />

            <h2
              className={`role-announcement role-reveal ${isDead ? role : blended ? 'Crewmate' : role || ''}`}
            >
              {isDead
                ? `You are a Dead ${roleName(role)}`
                : role === 'Imposter'
                ? `You are the ${roleName('Imposter')}!`
                : `You are a ${roleName('Crewmate')}!`}
            </h2>

            {role === 'Crewmate' && !tasksBlocked && (
              <div>
                <h3>Your Tasks</h3>
                <div className="task-list">
                  <ul>
                    {tasks.map((task) => (
                      <Selectable
                        key={task}
                        className={`task-item ${completedTasks.includes(task) ? 'selected' : ''}`}
                        selected={completedTasks.includes(task)}
                        label={`${task}${completedTasks.includes(task) ? ', done' : ''}`}
                        onSelect={() => actions.toggleTask(task)}
                      >
                        <span>{task}</span>
                      </Selectable>
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
                <h3>Targets</h3>
                <div className="kill-list">
                  <ul>
                    {crewmates.map((crewmate) => (
                      <Selectable
                        key={crewmate}
                        className={`kill-item ${killList.includes(crewmate) ? 'selected' : ''}`}
                        selected={killList.includes(crewmate)}
                        label={`${crewmate}${killList.includes(crewmate) ? ', dead' : ''}`}
                        onSelect={() => actions.toggleKill(crewmate)}
                      >
                        <span>{crewmate}</span>
                      </Selectable>
                    ))}
                  </ul>
                </div>
                {killCooldownLeft > 0 && (
                  <TimerBar
                    label="Kill cooldown"
                    secondsLeft={killCooldownLeft}
                    totalSeconds={killCooldown}
                    tone="warn"
                  />
                )}
                {fellowImposters.length > 0 && (
                  <div className="fellow-imposters">
                    <p>Other {roleNamePlural('Imposter')}: {fellowImposters.join(', ')}</p>
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
                          <Selectable
                            key={crewmate}
                            className="kill-item"
                            label={`Sabotage ${crewmate}`}
                            onSelect={() => actions.sabotage(crewmate)}
                          >
                            <span className="sabotage-option-btn">{crewmate}</span>
                          </Selectable>
                        ))}
                      </ul>
                      <button className="end-game-btn" onClick={actions.closeSabotageDialog}>Cancel</button>
                    </div>
                  </div>
                )}
                {sabotageCooldownLeft > 0 && (
                  <TimerBar
                    label="Sabotage cooldown"
                    secondsLeft={sabotageCooldownLeft}
                    totalSeconds={sabotageCooldownTotal}
                    tone="warn"
                  />
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
