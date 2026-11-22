import React from 'react';
import { useParams } from 'react-router-dom';
import { useCountdown } from './hooks/useCountdown';
import ConnectionBanner from './components/ConnectionBanner';
import LoadingScreen from './components/LoadingScreen';
import Selectable from './components/Selectable';
import TimerBar from './components/TimerBar';
import ScreenHeader from './components/ScreenHeader';
import { roleName, roleNamePlural } from './game/terminology';
import LeaveGame from './components/LeaveGame';
import ConfirmButton from './components/ConfirmButton';
import SeatRequests from './components/SeatRequests';
import ClaimSeat from './components/ClaimSeat';
import LockdownPanel from './components/lockdown/LockdownPanel';
import LockdownTrigger from './components/lockdown/LockdownTrigger';
import TaskList from './components/TaskList';
import MinigameTaskOverlay from './components/minigames/MinigameTaskOverlay';
import TargetRow from './components/TargetRow';

function Countdown() {
  const { gameCode } = useParams();
  const { state, actions, lockdown, loading, connected } = useCountdown(gameCode);

  if (loading) {
    return <LoadingScreen className="countdown-screen" connected={connected} gameCode={gameCode} />;
  }

  const {
    playerName, countdown, showIntro, introKind, role, isCreator, isDead,
    tasks, completedTasks, tasksBlocked, sabotagingImposter,
    targets, armedTarget, fellowImposters, killCooldownLeft,
    sabotageActive, sabotagedPlayer, sabotageDialogOpen, eligibleCrewmates,
    sabotageCooldownLeft, sabotageCooldownTotal, killCooldown,
    blended, progress, seatRequests, dealtSeats, awaitingOthers, lateReveal, seatLost,
    fakeTasks, fakeCompleted, playing, showingCover
  } = state;
  const traitorAlive = role === 'Imposter' && !isDead;

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
            <SeatRequests gameCode={gameCode} isHost={isCreator} requests={seatRequests} dealtSeats={dealtSeats} />

            {awaitingOthers.length > 0 && (
              <p className="reveal-notice" role="status">
                Waiting for {awaitingOthers.join(' and ')}'s phone to reveal their role. Ask them to
                open the game.
              </p>
            )}
            {lateReveal && (
              <p className={`reveal-notice landed ${lateReveal.role}`} role="status">
                {lateReveal.name} was {lateReveal.role === 'Imposter' ? 'the' : 'not the'} {roleName('Imposter')}
              </p>
            )}

            {lockdown.state.justLifted && (
              <p className="reveal-notice landed lockdown-lifted" role="status">🔓 Lockdown lifted!</p>
            )}
            {lockdown.state.active && (
              <LockdownPanel
                key={lockdown.state.startedAt}
                gameCode={gameCode}
                playerName={playerName}
                lockdown={lockdown.state}
                onEnterCode={lockdown.actions.enterCode}
              />
            )}

            {role ? (
              <h2
                className={`role-announcement role-reveal ${isDead ? role : blended ? 'Crewmate' : role}`}
              >
                {isDead
                  ? `You are a Dead ${roleName(role)}`
                  : role === 'Imposter'
                  ? `You are the ${roleName('Imposter')}!`
                  : `You are a ${roleName('Crewmate')}!`}
              </h2>
            ) : (
              // Falling through to the tasker line here would state a role we do
              // not have, and the one it would mislead worst is the traitor.
              <div className="role-unavailable" role="alert">
                {seatLost ? (
                  <ClaimSeat
                    gameCode={gameCode}
                    playerName={playerName}
                    message="Your seat is in use on another phone or browser."
                  />
                ) : (
                  <>
                    <h2>Your role has not arrived</h2>
                    <p>Keep your screen to yourself until it does.</p>
                    <button onClick={() => window.location.reload()}>Reload</button>
                  </>
                )}
              </div>
            )}

            {role === 'Crewmate' && !tasksBlocked && lockdown.state.active && (
              <p className="tasks-locked">Your tasks are locked until the lockdown is lifted.</p>
            )}

            {role === 'Crewmate' && !tasksBlocked && !lockdown.state.active && (
              <div>
                <h3>Your Tasks</h3>
                <TaskList
                  tasks={tasks}
                  completed={completedTasks}
                  onToggle={actions.toggleTask}
                  onPlay={(task) => actions.playTask(task)}
                />
              </div>
            )}

            {traitorAlive && showingCover && (
              lockdown.state.active ? (
                <p className="tasks-locked">Your tasks are locked until the lockdown is lifted.</p>
              ) : (
                <div>
                  <h3>Your Tasks</h3>
                  <TaskList
                    tasks={fakeTasks}
                    completed={fakeCompleted}
                    onToggle={actions.toggleCoverTask}
                    onPlay={(task) => actions.playTask(task, { asCover: true })}
                  />
                </div>
              )
            )}

            {role === 'Crewmate' && tasksBlocked && (
              <div>
                <h3>You have been sabotaged</h3>
                <p>Find {sabotagingImposter} to resume your tasks!</p>
              </div>
            )}

            {traitorAlive && !showingCover && (
              <div>
                <h3>Targets</h3>
                <div className="kill-list">
                  <ul>
                    {targets.map((target) => (
                      <TargetRow
                        key={target.name}
                        target={target}
                        armed={armedTarget === target.name}
                        onSelect={() => actions.toggleKill(target.name)}
                      />
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
              {role && !isDead && !tasksBlocked && !lockdown.state.active && (
                <button className="emergency-meeting-btn" onClick={actions.callMeeting}>
                  🚨 Emergency Meeting
                </button>
              )}
              {isCreator && (
                <ConfirmButton
                  className="end-game-btn"
                  label="End Game Round"
                  confirmLabel="Tap again to end the round"
                  onConfirm={actions.endRound}
                />
              )}
            </div>

            {lockdown.state.canStart && !showingCover && <LockdownTrigger onStart={lockdown.actions.start} />}
            {traitorAlive && (
              <button type="button" className="leave-game cover-switch" onClick={actions.switchView}>Switch</button>
            )}

            <LeaveGame
              gameCode={gameCode}
              playerName={playerName}
              inRound
              role={role}
              tasksOutstanding={Math.max(0, tasks.length - completedTasks.length)}
            />

            {playing && (
              <MinigameTaskOverlay
                key={playing.task}
                task={playing.task}
                onSolved={actions.solvePlaying}
                onClose={actions.stopPlaying}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Countdown;
