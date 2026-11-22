import React, { useEffect, useState } from 'react';
import { formatClock } from '../../game/playerColor';
import { GhostIcon, HelpIcon, LockIcon, SirenIcon } from './Icons';

// One round button beside one wide one, the same shapes on every phone.
function RoundDock({ dock, onGuide, onMeeting, findName, lockdown }) {
  return (
    <div className="round-dock">
      {dock.side === 'lockdown'
        ? <LockdownButton lockdown={lockdown} />
        : (
          <button type="button" className="round-dock-side" aria-label="How to play" onClick={onGuide}>
            <HelpIcon />
          </button>
        )}
      <DockMain kind={dock.main} onMeeting={onMeeting} findName={findName} />
    </div>
  );
}

function DockMain({ kind, onMeeting, findName }) {
  switch (kind) {
    case 'meeting':
      return (
        <button type="button" className="round-dock-main emergency-meeting-btn" onClick={onMeeting}>
          <SirenIcon />
          Emergency Meeting
        </button>
      );
    case 'locked-down':
      return <div className="round-dock-main quiet">No meetings during lockdown</div>;
    case 'find':
      return <div className="round-dock-main quiet">Meeting after you find {findName}</div>;
    case 'ghost':
      return (
        <div className="round-dock-main quiet ghost">
          <GhostIcon size={16} eyes="transparent" />
          Ghosts don't call meetings
        </div>
      );
    default:
      return null;
  }
}

// Gray like the guide button it stands in for. A small dot says it is ready;
// pressing it asks first, so a stray tap never sets one off.
function LockdownButton({ lockdown }) {
  const [asking, setAsking] = useState(false);
  const { canStart, cooldownLeft, active } = lockdown.state;

  useEffect(() => {
    if (!asking) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setAsking(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [asking]);

  let waiting = null;
  if (active) waiting = 'A lockdown is on right now.';
  else if (cooldownLeft > 0) waiting = `Lockdown is ready in ${formatClock(cooldownLeft)}.`;
  else if (!canStart) waiting = 'Not right now.';

  return (
    <div className="lockdown-dock">
      <button
        type="button"
        className="round-dock-side"
        aria-label="Lockdown"
        aria-expanded={asking}
        onClick={() => setAsking((now) => !now)}
      >
        <LockIcon />
        {canStart && <span className="round-dock-dot" aria-hidden="true" />}
      </button>
      {asking && (
        <>
          <button type="button" className="round-menu-scrim" aria-label="Close" onClick={() => setAsking(false)} />
          <div className="lockdown-ask" role="dialog" aria-label="Lockdown">
            {waiting ? (
              <p>{waiting}</p>
            ) : (
              <>
                <p>Lock everyone down? Taskers swap codes to lift it before the timer runs out.</p>
                <button
                  type="button"
                  className="round-menu-item"
                  onClick={() => {
                    setAsking(false);
                    lockdown.actions.start();
                  }}
                >
                  Lock everyone down
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RoundDock;
