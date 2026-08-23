import React from 'react';
import PlayerAvatar from './PlayerAvatar';
import { roleNamePlural } from '../game/terminology';

function RosterGroup({ title, entries, winners, startIndex }) {
  if (entries.length === 0) return null;

  return (
    <div className={`roster-group ${winners ? 'winners' : ''}`}>
      <h3>{title} ({entries.length})</h3>
      <div className="roster-grid">
        {entries.map((entry, i) => (
          <div
            key={entry.name}
            className={`roster-card ${entry.survived ? '' : 'out'}`}
            style={{ '--reveal-order': startIndex + i }}
          >
            <PlayerAvatar name={entry.name} color={entry.color} />
            <span className="roster-name">{entry.name}</span>
            <span className="roster-status">{entry.survived ? 'Survived' : 'Out'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevealRoster({ roster, winner }) {
  const { imposters, crewmates } = roster;
  if (imposters.length === 0 && crewmates.length === 0) return null;

  // Whoever won is read first.
  const impostersWon = winner === 'Imposters';
  const first = impostersWon
    ? { title: roleNamePlural('Imposter'), entries: imposters }
    : { title: roleNamePlural('Crewmate'), entries: crewmates };
  const second = impostersWon
    ? { title: roleNamePlural('Crewmate'), entries: crewmates }
    : { title: roleNamePlural('Imposter'), entries: imposters };

  return (
    <div className="reveal-roster">
      <RosterGroup {...first} winners startIndex={0} />
      <RosterGroup {...second} winners={false} startIndex={first.entries.length} />
    </div>
  );
}

export default RevealRoster;
