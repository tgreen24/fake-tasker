import React, { useMemo, useState } from 'react';
import { WIRING_PANELS, dealWires, wireById } from '../../game/minigames/wiring';
import { useOnSolved } from './useOnSolved';

const rowY = (index, count) => ((index + 0.5) / count) * 100;

// Tap a wire, then the socket of the same color. Tapping is steadier than
// dragging on a phone held in one hand.
function WiringPanel({ panel, panels, onDone }) {
  const { left, right } = useMemo(() => dealWires(), []);
  const [picked, setPicked] = useState(null);
  const [connected, setConnected] = useState([]);
  const [missed, setMissed] = useState(null);

  const done = connected.length === left.length;
  useOnSolved(done, onDone);

  const pickWire = (id) => {
    if (connected.includes(id)) return;
    setMissed(null);
    setPicked(id);
  };

  const pickSocket = (id) => {
    if (!picked || connected.includes(id)) return;
    if (id === picked) {
      setConnected((now) => [...now, id]);
    } else {
      setMissed(id);
    }
    setPicked(null);
  };

  return (
    <>
      <p className="minigame-instructions">
        {done && panel === panels
          ? 'Power restored!'
          : picked ? 'Now tap the matching socket' : 'Tap a wire, then its matching socket'}
      </p>
      <p className="minigame-step">Panel {panel} of {panels}</p>
      <div className="wiring-board">
        <svg className="wiring-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {connected.map((id) => (
            <line
              key={id}
              x1="0"
              y1={rowY(left.indexOf(id), left.length)}
              x2="100"
              y2={rowY(right.indexOf(id), right.length)}
              stroke={wireById(id).color}
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="wiring-column">
          {left.map((id) => (
            <button
              key={id}
              type="button"
              className={`wire-end ${picked === id ? 'picked' : ''} ${connected.includes(id) ? 'connected' : ''}`}
              style={{ '--wire': wireById(id).color }}
              aria-label={`Wire ${id}`}
              aria-pressed={picked === id}
              onClick={() => pickWire(id)}
            >
              {wireById(id).mark}
            </button>
          ))}
        </div>
        <div className="wiring-column">
          {right.map((id) => (
            <button
              key={id}
              type="button"
              className={`wire-end socket ${connected.includes(id) ? 'connected' : ''} ${missed === id ? 'missed' : ''}`}
              style={{ '--wire': wireById(id).color }}
              aria-label={`Socket ${id}`}
              onClick={() => pickSocket(id)}
            >
              {wireById(id).mark}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const NEXT_PANEL_MS = 400;

function FixTheWiring({ onSolved }) {
  const [panel, setPanel] = useState(1);
  const [finished, setFinished] = useState(false);
  useOnSolved(finished, onSolved);

  const panelDone = () => {
    if (panel === WIRING_PANELS) {
      setFinished(true);
      return;
    }
    setTimeout(() => setPanel((now) => now + 1), NEXT_PANEL_MS);
  };

  return (
    <div className="minigame fix-wiring">
      <WiringPanel key={panel} panel={panel} panels={WIRING_PANELS} onDone={panelDone} />
    </div>
  );
}

export default FixTheWiring;
