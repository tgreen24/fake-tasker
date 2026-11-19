import React, { useEffect, useState } from 'react';
import { LIGHTS_TO_TURN_OFF, WINDOWS, lightIntervalMs, nextLight } from '../../game/minigames/lights';
import { useOnSolved } from './useOnSolved';

const STARTING_LIGHTS = 2;

function startingLights() {
  const lit = [];
  while (lit.length < STARTING_LIGHTS) lit.push(nextLight(lit));
  return lit;
}

// Lights keep coming on around the house; tap each one off. They come on a
// little faster as you go.
function TurnOffTheLights({ onSolved }) {
  const [lit, setLit] = useState(startingLights);
  const [switchedOff, setSwitchedOff] = useState(0);
  const done = switchedOff >= LIGHTS_TO_TURN_OFF;
  useOnSolved(done, onSolved);

  useEffect(() => {
    if (done) return undefined;
    const timer = setTimeout(() => {
      setLit((now) => {
        const next = nextLight(now);
        return next === null ? now : [...now, next];
      });
    }, lightIntervalMs(switchedOff));
    return () => clearTimeout(timer);
  }, [lit, switchedOff, done]);

  const flip = (window) => {
    if (done || !lit.includes(window)) return;
    const remaining = lit.filter((entry) => entry !== window);
    const off = switchedOff + 1;
    setSwitchedOff(off);
    setLit(off >= LIGHTS_TO_TURN_OFF ? [] : remaining);
  };

  return (
    <div className="minigame turn-off-lights">
      <p className="minigame-instructions">{done ? 'Lights out. Goodnight!' : 'Tap the lit windows to switch them off'}</p>
      <p className="minigame-step">{Math.min(switchedOff, LIGHTS_TO_TURN_OFF)} of {LIGHTS_TO_TURN_OFF} switched off</p>
      <div className="house">
        <div className="house-roof" aria-hidden="true" />
        <div className="house-windows">
          {Array.from({ length: WINDOWS }, (_, window) => (
            <button
              key={window}
              type="button"
              className={`house-window ${lit.includes(window) ? 'lit' : ''}`}
              aria-label={`Window ${window + 1}, ${lit.includes(window) ? 'light on' : 'dark'}`}
              onClick={() => flip(window)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default TurnOffTheLights;
