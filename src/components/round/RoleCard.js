import React, { useEffect, useState } from 'react';
import { roleName } from '../../game/terminology';
import { EyeIcon } from './Icons';

// After the opening reveal the role is never on screen unless you are holding
// this. The card is the same gray for every role, so a glance over a shoulder
// shows a gray card either way.
export function HoldForRole({ role, isDead, fellowImposters }) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!held) return undefined;
    const hide = () => setHeld(false);
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [held]);

  const press = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setHeld(true);
  };
  const release = () => setHeld(false);
  const key = (down) => (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    setHeld(down);
  };

  return (
    <>
      <button
        type="button"
        className={`role-peek-button ${held ? 'held' : ''}`}
        aria-label="Hold to see your role"
        aria-expanded={held}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={key(true)}
        onKeyUp={key(false)}
        onBlur={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <EyeIcon />
        {held ? 'Holding…' : 'Hold for role'}
      </button>
      {held && <RoleCard role={role} isDead={isDead} fellowImposters={fellowImposters} />}
    </>
  );
}

function RoleCard({ role, isDead, fellowImposters = [] }) {
  const traitor = role === 'Imposter';
  return (
    <div className="role-card" role="status">
      <p className="role-card-label">Your role</p>
      <p className="role-card-role">{role ? `${isDead ? 'Dead ' : ''}${roleName(role)}` : 'Not here yet'}</p>
      <p className="role-card-note">
        {traitor && fellowImposters.length > 0 && <>With <strong>{fellowImposters.join(' and ')}</strong>. </>}
        {traitor && !isDead && 'Tap a name in Targets once you\'ve got them. '}
        Let go to hide this.
      </p>
    </div>
  );
}
