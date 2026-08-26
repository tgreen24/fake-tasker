import React from 'react';
import PlayerAvatar from './PlayerAvatar';

// Badges sat on the roster cards, under the name and the survived-or-out line,
// which made three stacked labels under every hexagon and buried the thing
// worth reading. The roster answers who was what and who made it; awards are a
// different question, so they get their own section and room to breathe.
function AwardList({ badges, colors }) {
  const entries = Object.entries(badges || {});
  if (entries.length === 0) return null;

  return (
    <div className="awards">
      <h3>Highlights</h3>
      <div className="award-list">
        {entries.map(([name, badge], index) => (
          <div
            key={name}
            className={`award tone-${badge.tone}`}
            style={{ '--reveal-order': index }}
          >
            <PlayerAvatar name={name} color={colors[name]} />
            <div className="award-text">
              <span className="award-label">{badge.label}</span>
              <span className="award-name">{name}</span>
              {badge.describe && <span className="award-note">{badge.describe}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AwardList;
