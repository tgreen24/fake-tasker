import React from 'react';
import { parseMinigameTask, taskLabel } from '../game/minigameTasks';
import { PlayIcon } from './round/Icons';

const SHOWS = {
  all: () => true,
  todo: (done) => !done,
  done: (done) => done
};

// One task list for taskers and for a traitor's cover alike, so the two can
// never look different. A physical task ticks on and off; a minigame opens to
// be played, and once won it stays done.
function TaskList({ tasks, completed, onToggle, onPlay, show = 'all' }) {
  const shown = tasks.filter((task) => SHOWS[show](completed.includes(task)));

  if (shown.length === 0 && show !== 'all') {
    return (
      <p className="task-list-empty">
        {show === 'done' ? 'Nothing done yet. Finished tasks land here.' : 'All your tasks are done.'}
      </p>
    );
  }

  return (
    <ul className="task-list">
      {shown.map((task) => {
        const done = completed.includes(task);
        const minigame = parseMinigameTask(task);
        return (
          <li key={task}>
            <button
              type="button"
              className={`task-row ${done ? 'done' : ''}`}
              aria-pressed={done}
              aria-label={`${taskLabel(task)}${done ? ', done' : minigame ? ', tap to play' : ''}`}
              onClick={() => {
                if (!minigame) onToggle(task);
                else if (!done) onPlay(task);
              }}
            >
              {minigame && !done
                ? <span className="task-play" aria-hidden="true"><PlayIcon /></span>
                : <span className="task-check" aria-hidden="true" />}
              {minigame ? (
                <span className="task-text">
                  <span>{minigame.name}</span>
                  <span className="task-room">{minigame.room} · {done ? 'done' : 'tap to play'}</span>
                </span>
              ) : (
                <span className="task-text">{task}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default TaskList;
