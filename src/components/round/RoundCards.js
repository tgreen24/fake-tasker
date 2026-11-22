import React from 'react';
import { CheckIcon, GhostIcon, InfoIcon, SearchIcon } from './Icons';
import { GuideCardList } from './GuideSheet';

export function DoneCard({ whatNow }) {
  return (
    <>
      <div className="round-card centered">
        <div className="round-card-tick"><CheckIcon size={30} /></div>
        <h2>Your tasks are done</h2>
        <p>The team bar fills when everyone finishes.</p>
      </div>
      <p className="round-kicker">What now</p>
      <GuideCardList cards={whatNow} />
    </>
  );
}

export function SabotagedCard({ by }) {
  return (
    <>
      <div className="round-card centered">
        <div className="round-card-badge"><SearchIcon size={32} /></div>
        <h2>Your tasks are paused</h2>
        <p>A ghost sabotaged you. Find <strong>{by}</strong> somewhere in the house. They'll unlock your tasks when you do.</p>
      </div>
      <p className="round-note"><InfoIcon />Meetings wait until you're free.</p>
    </>
  );
}

export function TasksLockedCard() {
  return <p className="round-note"><InfoIcon />Your tasks are locked until the lockdown is lifted.</p>;
}

export function GhostCard() {
  return (
    <div className="round-card">
      <div className="round-card-title">
        <GhostIcon size={28} eyes="var(--surface)" />
        <div>
          <h2>You're a ghost</h2>
          <p>Still on the team, just quieter</p>
        </div>
      </div>
      <ol className="round-card-rules">
        <li>Stay where you fell until someone finds you</li>
        <li>Don't say or hint who got you</li>
        <li>Once found, keep doing your tasks. Taskers need every one to win</li>
      </ol>
    </div>
  );
}

// A traitor who is out can still slow the taskers down: pick one, go hide,
// and their tasks wait until they find you.
export function DeadTraitorPanel({ eligible, cooling, onSabotage }) {
  return (
    <>
      <div className="round-card">
        <div className="round-card-title">
          <GhostIcon size={28} eyes="var(--surface)" />
          <div>
            <h2>You're out, but not done</h2>
            <p>Slow the taskers down from beyond</p>
          </div>
        </div>
        <p className="round-card-text">Pick a tasker, then go hide. Their tasks pause until they find you and you tap "Found me".</p>
      </div>
      {eligible.length === 0 ? (
        <p className="round-note"><InfoIcon />Nobody left to sabotage right now.</p>
      ) : (
        <ul className="target-grid">
          {eligible.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="target-tile"
                aria-label={`Sabotage ${name}`}
                disabled={cooling}
                onClick={() => onSabotage(name)}
              >
                <span className="target-name">{name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function HidingCard({ from, onFound }) {
  return (
    <div className="round-card centered">
      <div className="round-card-badge"><SearchIcon size={32} /></div>
      <h2>Go hide</h2>
      <p>Stay in one place until <strong>{from}</strong> finds you, then tap below.</p>
      <button type="button" className="round-card-button" onClick={onFound}>{from} Found Me</button>
    </div>
  );
}
