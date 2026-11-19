import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PLATES, isClean, makeGrime } from '../../game/minigames/dishes';
import { useOnSolved } from './useOnSolved';
import { useDrag } from './useDrag';

const NEXT_PLATE_MS = 500;
const BRUSH = 0.14;
const SAMPLE_STEP = 6;
const CHECK_EVERY_MS = 120;

function drawGrime(context, size, blobs) {
  const radius = size / 2;
  blobs.forEach(({ x, y, r }) => {
    const cx = radius + x * radius;
    const cy = radius + y * radius;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, r * radius);
    gradient.addColorStop(0, 'rgba(110, 72, 30, 0.95)');
    gradient.addColorStop(0.7, 'rgba(140, 98, 45, 0.85)');
    gradient.addColorStop(1, 'rgba(140, 98, 45, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, r * radius, 0, Math.PI * 2);
    context.fill();
  });
}

function grimeLeft(context, size) {
  const { data } = context.getImageData(0, 0, size, size);
  let left = 0;
  for (let y = 0; y < size; y += SAMPLE_STEP) {
    for (let x = 0; x < size; x += SAMPLE_STEP) {
      if (data[(y * size + x) * 4 + 3] > 40) left++;
    }
  }
  return left;
}

function Plate({ number, onDone }) {
  const blobs = useMemo(() => makeGrime(), []);
  const canvas = useRef(null);
  const state = useRef({ initial: 0, last: null, scrubbing: false, checkedAt: 0 });
  const [clean, setClean] = useState(false);
  const [percent, setPercent] = useState(0);
  useOnSolved(clean, onDone);

  useLayoutEffect(() => {
    const node = canvas.current;
    const size = Math.round(node.clientWidth * (window.devicePixelRatio || 1));
    node.width = size;
    node.height = size;
    const context = node.getContext('2d', { willReadFrequently: true });
    drawGrime(context, size, blobs);
    state.current.initial = grimeLeft(context, size);
  }, [blobs]);

  const point = (event) => {
    const node = canvas.current;
    const box = node.getBoundingClientRect();
    const scale = node.width / box.width;
    return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
  };

  // Reading the pixels back is the slow part, so it happens every so often
  // while rubbing and once more when the finger lifts. On a timer rather than
  // an animation frame: browsers may hold frames back during a drag, and a
  // plate that is clean has to say so straight away.
  const check = ({ now = false } = {}) => {
    const at = Date.now();
    if (!now && at - state.current.checkedAt < CHECK_EVERY_MS) return;
    state.current.checkedAt = at;
    const node = canvas.current;
    if (!node) return;
    const left = grimeLeft(node.getContext('2d', { willReadFrequently: true }), node.width);
    const { initial } = state.current;
    setPercent(Math.round(100 * (1 - left / initial)));
    if (isClean(left, initial)) setClean(true);
  };

  const scrub = (to) => {
    const node = canvas.current;
    const context = node.getContext('2d', { willReadFrequently: true });
    const from = state.current.last || to;
    context.globalCompositeOperation = 'destination-out';
    context.lineCap = 'round';
    context.lineWidth = node.width * BRUSH;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    state.current.last = to;
    check();
  };

  const dragHandlers = useDrag({
    onStart: (event) => {
      if (clean) return;
      state.current.scrubbing = true;
      state.current.last = null;
      scrub(point(event));
    },
    onMove: (event) => {
      if (state.current.scrubbing && !clean) scrub(point(event));
    },
    onEnd: () => {
      if (state.current.scrubbing && !clean) check({ now: true });
      state.current.scrubbing = false;
      state.current.last = null;
    }
  });

  return (
    <>
      <p className="minigame-step">Plate {number} of {PLATES}</p>
      <div
        className={`plate ${clean ? 'clean' : ''}`}
        {...dragHandlers()}
      >
        <canvas
          ref={canvas}
          className="plate-grime"
          aria-label={`Dirty plate, ${percent} percent clean`}
          role="img"
        />
        {clean && <span className="plate-sparkle" aria-hidden="true">✨</span>}
      </div>
    </>
  );
}

// Rub each plate until the grime is gone. The whole plate listens, not just
// the round grime layer, so a rub that starts on the rim still counts.
function ScrubTheDishes({ onSolved }) {
  const [plate, setPlate] = useState(1);
  const [finished, setFinished] = useState(false);
  useOnSolved(finished, onSolved);

  const plateDone = () => {
    if (plate === PLATES) {
      setFinished(true);
      return;
    }
    setTimeout(() => setPlate((n) => n + 1), NEXT_PLATE_MS);
  };

  return (
    <div className="minigame scrub-dishes">
      <p className="minigame-instructions">{finished ? 'Dishes done!' : 'Rub the plate until it is clean'}</p>
      <Plate key={plate} number={plate} onDone={plateDone} />
    </div>
  );
}

export default ScrubTheDishes;
