import React from 'react';
import Selectable from './Selectable';

const OUT_NOTES = {
  'killed-by-you': () => 'killed by you',
  'killed-by-teammate': ({ killer }) => `killed by ${killer}`,
  'voted-out': () => 'voted out',
  dead: () => 'dead'
};

function armedNote({ name, out, killer }) {
  const bringBack = `Tap again to bring ${name} back`;
  return out === 'killed-by-teammate' ? `${killer} marked this. ${bringBack}` : bringBack;
}

// One target on a traitor's shared list. A dead one says how they went out,
// so a teammate's kill is never mistaken for a stray tick, and bringing
// somebody back asks for a second tap first.
function TargetRow({ target, armed, onSelect }) {
  const out = !!target.out;
  const note = armed ? armedNote(target) : out ? OUT_NOTES[target.out](target) : null;
  return (
    <Selectable
      className={`task-item target-row ${out ? 'selected' : ''} ${armed ? 'armed' : ''}`}
      selected={out}
      label={note ? `${target.name}, ${note}` : target.name}
      onSelect={onSelect}
    >
      <span className="target-name">
        {target.name}
        {note && <small className="target-note" aria-live={armed ? 'polite' : undefined}>{note}</small>}
      </span>
    </Selectable>
  );
}

export default TargetRow;
