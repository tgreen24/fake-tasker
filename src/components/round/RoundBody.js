import React from 'react';
import TaskList from '../TaskList';
import ClaimSeat from '../ClaimSeat';
import TargetGrid from './TargetGrid';
import { DeadTraitorPanel, DoneCard, GhostCard, HidingCard, SabotagedCard, TasksLockedCard } from './RoundCards';

// Draws whichever body the view model picked. Every decision about what to
// show was made before it got here.
function RoundBody({ gameCode, state, actions, onNudge }) {
  const { view } = state;

  switch (view.body) {
    case 'tasks':
    case 'done-list':
      return (
        <TaskList
          tasks={state.tasks}
          completed={state.completedTasks}
          show={view.body === 'done-list' ? 'done' : 'todo'}
          onToggle={actions.toggleTask}
          onPlay={(task) => actions.playTask(task)}
        />
      );
    case 'tasks-done':
      return <DoneCard whatNow={view.guide} />;
    case 'cover':
      return (
        <TaskList
          tasks={state.fakeTasks}
          completed={state.fakeCompleted}
          onToggle={actions.toggleCoverTask}
          onPlay={(task) => actions.playTask(task, { asCover: true })}
        />
      );
    case 'targets':
      return (
        <TargetGrid
          targets={state.targets}
          armedTarget={state.armedTarget}
          cooling={state.killCooldownLeft > 0}
          onSelect={actions.toggleKill}
          onNudge={onNudge}
        />
      );
    case 'tasks-locked':
      return <TasksLockedCard />;
    case 'sabotaged':
      return <SabotagedCard by={state.sabotagingImposter} />;
    case 'ghost':
    case 'ghost-done':
      return (
        <>
          <GhostCard />
          <TaskList
            tasks={state.tasks}
            completed={state.completedTasks}
            show={view.body === 'ghost-done' ? 'done' : 'todo'}
            onToggle={actions.toggleTask}
            onPlay={(task) => actions.playTask(task)}
          />
        </>
      );
    case 'dead-traitor':
      return (
        <DeadTraitorPanel
          eligible={state.eligibleCrewmates}
          cooling={state.sabotageCooldownLeft > 0}
          onSabotage={actions.sabotage}
        />
      );
    case 'sabotage-hiding':
      return <HidingCard from={state.sabotagedPlayer} onFound={actions.clearMySabotage} />;
    default:
      return <NoRole gameCode={gameCode} playerName={state.playerName} seatLost={state.seatLost} />;
  }
}

// Falling through to the tasker layout here would state a role we do not
// have, and the one it would mislead worst is the traitor.
function NoRole({ gameCode, playerName, seatLost }) {
  return (
    <div className="role-unavailable" role="alert">
      {seatLost ? (
        <ClaimSeat
          gameCode={gameCode}
          playerName={playerName}
          message="Your seat moved to another phone or browser. If that wasn't you, take it back."
        />
      ) : (
        <>
          <h2>Your role has not arrived</h2>
          <p>Keep your screen to yourself until it does.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </>
      )}
    </div>
  );
}

export default RoundBody;
