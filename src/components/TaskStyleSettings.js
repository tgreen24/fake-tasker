import React, { useState } from 'react';
import { MAX_ROOM_LENGTH, MAX_ROOMS } from '../game/minigameTasks';

const STYLES = [
  { id: 'physical', label: 'Physical tasks' },
  { id: 'minigames', label: 'Minigames' },
  { id: 'mixed', label: 'Mixed' }
];

function RoomsEditor({ rooms, onAdd, onRemove }) {
  const [typed, setTyped] = useState('');
  const add = (event) => {
    event.preventDefault();
    if (!typed.trim()) return;
    onAdd(typed);
    setTyped('');
  };

  return (
    <div className="rooms-editor">
      <p className="rooms-hint">Minigames are played in these rooms. Each player is sent to different ones.</p>
      <ul className="room-chips">
        {rooms.map((room) => (
          <li key={room} className="room-chip">
            {room}
            <button type="button" aria-label={`Remove ${room}`} onClick={() => onRemove(room)}>✕</button>
          </li>
        ))}
      </ul>
      {rooms.length < MAX_ROOMS && (
        <form className="task-input" onSubmit={add}>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Add a room, like Bedroom 2"
            aria-label="Room name"
            maxLength={MAX_ROOM_LENGTH}
          />
          <button type="submit">Add</button>
        </form>
      )}
    </div>
  );
}

function TaskStyleSettings({ taskStyle, rooms, onStyle, onAddRoom, onRemoveRoom }) {
  return (
    <div className="task-style-settings">
      <div className="task-style-selection">
        <label htmlFor="task-style">Task style:</label>
        <select id="task-style" value={taskStyle} onChange={(event) => onStyle(event.target.value)}>
          {STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
        </select>
      </div>
      {taskStyle !== 'physical' && <RoomsEditor rooms={rooms} onAdd={onAddRoom} onRemove={onRemoveRoom} />}
    </div>
  );
}

export default TaskStyleSettings;
