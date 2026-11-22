import React from 'react';
import { roleName } from '../../game/terminology';
import { DaggerIcon, GhostIcon, WrenchIcon } from './Icons';

// The one private moment: the role, full screen, as the round opens. A
// traitor's starts red and fades to the same blue every tasker's is, so even
// a glance during the reveal soon says nothing.
export function RoleReveal({ role, fellowImposters = [], tasksCount, onHide }) {
  const traitor = role === 'Imposter';
  const Icon = traitor ? DaggerIcon : WrenchIcon;
  const steps = traitor
    ? ['Get taskers alone, then tap their name in Targets', 'Blend in: your Tasks tab looks just like theirs', 'Hold "Hold for role" any time to check']
    : [`Finish your ${tasksCount} ${tasksCount === 1 ? 'task' : 'tasks'} around the house`, 'Stick with people. A traitor is hunting you', 'Saw something? Call an Emergency Meeting'];

  return (
    <div className={`role-reveal-screen ${traitor ? 'traitor' : ''}`}>
      <p className="role-reveal-kicker">Keep your screen to yourself</p>
      <div className="role-reveal-middle">
        <div className="role-reveal-badge"><Icon size={64} /></div>
        <div>
          <p className="role-reveal-you">You are {traitor ? 'the' : 'a'}</p>
          <h1 className="role-reveal-role">{roleName(role)}</h1>
          {traitor && fellowImposters.length > 0 && (
            <p className="role-reveal-team">with <strong>{fellowImposters.join(' and ')}</strong></p>
          )}
        </div>
        <ol className="role-reveal-steps">
          {steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <button type="button" className="role-reveal-hide" onClick={onHide}>Hide role and start</button>
      <p className="role-reveal-foot">Hides by itself in a few seconds</p>
    </div>
  );
}

// Quiet on purpose: the screen drains to gray and a ghost rises. No red, no
// sound -- whoever is stood next to you would notice.
export function KilledMoment({ playerName, onDone }) {
  return (
    <div className="killed-screen" role="alertdialog" aria-label="You've been killed">
      <div className="killed-figure" aria-hidden="true">
        <div className="killed-avatar">{(playerName || '?').slice(0, 1).toUpperCase()}</div>
        <div className="killed-ghost"><GhostIcon size={80} eyes="var(--bg)" /></div>
      </div>
      <div className="killed-words">
        <h1>You've been killed</h1>
        <p>Stay right where you are until someone finds you. No gasps, no hints. Once you're found, keep doing your tasks.</p>
      </div>
      <button type="button" className="killed-ok" onClick={onDone}>Got it</button>
    </div>
  );
}
