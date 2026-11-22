import React, { useEffect, useState } from 'react';
import { orderedTargets } from '../../game/roundView';

const NUDGE_MS = 450;

// What a tile says under an out name, and the fuller phrase read aloud.
const OUT_NOTES = {
  'killed-by-you': () => ['by you', 'killed by you'],
  'killed-by-teammate': ({ killer }) => [`by ${killer}`, `killed by ${killer}`],
  'voted-out': () => ['voted out', 'voted out'],
  dead: () => ['out', 'out']
};

// Short enough to fit the tile; the full sentence is what is read aloud.
function armedNotes({ name, out, killer }) {
  const bringBack = `Tap again to bring ${name} back`;
  return out === 'killed-by-teammate'
    ? [`${killer}'s kill · tap again`, `${killer} marked this. ${bringBack}`]
    : ['Tap again to undo', bringBack];
}

// The traitors' shared list, as big tiles so the name you want is easy to hit
// with a lot of people playing. Out targets sit at the end, ticked the way a
// done task is, saying how they went out. Tapping a name during the cooldown
// does nothing but wiggle, and the status line flashes the time left.
function TargetGrid({ targets, armedTarget, cooling, onSelect, onNudge }) {
  const [nudged, setNudged] = useState(null);

  useEffect(() => {
    if (!nudged) return undefined;
    const timer = setTimeout(() => setNudged(null), NUDGE_MS);
    return () => clearTimeout(timer);
  }, [nudged]);

  const tap = (target) => {
    if (!target.out && cooling) {
      setNudged(target.name);
      onNudge();
    }
    onSelect(target.name);
  };

  return (
    <ul className="target-grid">
      {orderedTargets(targets).map((target) => {
        const armed = armedTarget === target.name;
        const [note, spoken] = armed
          ? armedNotes(target)
          : target.out ? OUT_NOTES[target.out](target) : [null, null];
        return (
          <li key={target.name}>
            <button
              type="button"
              className={`target-tile ${target.out ? 'out' : ''} ${armed ? 'armed' : ''} ${nudged === target.name ? 'missed' : ''}`}
              aria-pressed={!!target.out}
              aria-label={spoken ? `${target.name}, ${spoken}` : target.name}
              onClick={() => tap(target)}
            >
              <span className="target-name">{target.name}</span>
              {note && <span className="target-note" aria-live={armed ? 'polite' : undefined}>{note}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default TargetGrid;
