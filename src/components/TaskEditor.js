import React from 'react';
import { roomFor, taskTexts } from '../game/taskPacks';

const OTHER = 'Other';

// Collapsed by default: with a pack added this is 25 rows, and the host only
// opens it when they actually want to change something. Grouped by room so
// that list stays scannable; anything typed by hand has no room and falls to
// the end.
function groupByRoom(tasks) {
  const groups = new Map();
  tasks.forEach((task) => {
    const room = roomFor(task) || OTHER;
    if (!groups.has(room)) groups.set(room, []);
    groups.get(room).push(task);
  });

  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === OTHER) return 1;
    if (b === OTHER) return -1;
    return a.localeCompare(b);
  });
}

function TaskEditor({ tasks, packs, newTask, onSetNewTask, onAddTask, onRemoveTask, onAddPack }) {
  const grouped = groupByRoom(tasks);

  return (
    <details className="task-editor">
      <summary>Tasks <span className="task-count">{tasks.length}</span></summary>

      <div className="task-editor-body">
        {packs.map((pack) => {
          const missing = taskTexts(pack).filter((text) => !tasks.includes(text));
          return (
            <button
              key={pack.id}
              className="pack-add-all"
              onClick={() => onAddPack(missing)}
              disabled={missing.length === 0}
              title={pack.description}
            >
              {missing.length === 0
                ? `${pack.name} pack added`
                : `Add ${pack.name} pack — ${missing.length} tasks`}
            </button>
          );
        })}

        <div className="task-input">
          <input
            type="text"
            value={newTask}
            onChange={(e) => onSetNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTask()}
            placeholder="Add your own task"
          />
          <button onClick={onAddTask}>Add</button>
        </div>

        {grouped.map(([room, roomTasks]) => (
          <div key={room} className="task-group">
            <h5>{room}</h5>
            <ul>
              {roomTasks.map((task) => (
                <li key={task} className="task-row">
                  <span>{task}</span>
                  <button
                    className="kick-button"
                    onClick={() => onRemoveTask(task)}
                    aria-label={`Remove ${task}`}
                    title="Remove task"
                  >✕</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default TaskEditor;
