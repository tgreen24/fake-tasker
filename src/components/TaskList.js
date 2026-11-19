import React from 'react';
import Selectable from './Selectable';
import { isMinigameTask, taskLabel } from '../game/minigameTasks';

// One task list for taskers and for a traitor's cover alike, so the two can
// never look different. A physical task ticks on and off; a minigame opens to
// be played, and once won it stays done.
function TaskList({ tasks, completed, onToggle, onPlay }) {
  return (
    <div className="task-list">
      <ul>
        {tasks.map((task) => {
          const done = completed.includes(task);
          const minigame = isMinigameTask(task);
          return (
            <Selectable
              key={task}
              className={`task-item ${done ? 'selected' : ''} ${minigame ? 'minigame-task' : ''}`}
              selected={done}
              label={`${taskLabel(task)}${done ? ', done' : minigame ? ', tap to play' : ''}`}
              onSelect={() => {
                if (!minigame) onToggle(task);
                else if (!done) onPlay(task);
              }}
            >
              <span>{taskLabel(task)}</span>
            </Selectable>
          );
        })}
      </ul>
    </div>
  );
}

export default TaskList;
