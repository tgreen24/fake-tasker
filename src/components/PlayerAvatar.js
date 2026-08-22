import React from 'react';
import { initials } from '../game/playerColor';

function PlayerAvatar({ name, color, hollow = false }) {
  return (
    <span
      className={`avatar ${hollow ? 'avatar-hollow' : ''}`}
      style={{ '--player-color': color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export default PlayerAvatar;
