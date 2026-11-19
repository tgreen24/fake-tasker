import React, { useMemo, useRef, useState } from 'react';
import Clothing from './Clothing';
import { BASKETS, dealLaundry } from '../../game/minigames/laundry';
import { useOnSolved } from './useOnSolved';
import { useDrag } from './useDrag';

const DRAG_START_PX = 8;
const LABELS = { whites: 'Whites', colors: 'Colors' };

// Drag a piece onto its basket, or tap the piece and then the basket. The tap
// way is there for anyone whose drag keeps scrolling the page instead.
function SortTheLaundry({ onSolved }) {
  const pile = useMemo(() => dealLaundry(), []);
  const [sorted, setSorted] = useState([]);
  const [selected, setSelected] = useState(null);
  const [drag, setDrag] = useState(null);
  const [missed, setMissed] = useState(null);
  const baskets = useRef({});

  const done = sorted.length === pile.length;
  useOnSolved(done, onSolved);

  const drop = (pieceId, basket) => {
    const piece = pile.find((entry) => entry.id === pieceId);
    setSelected(null);
    if (!piece || !basket) return;
    if (piece.basket === basket) {
      setSorted((now) => [...now, pieceId]);
      setMissed(null);
    } else {
      setMissed(pieceId);
    }
  };

  const basketAt = (x, y) => BASKETS.find((name) => {
    const box = baskets.current[name]?.getBoundingClientRect();
    return box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });

  // Where the current drag started and whether it has gone far enough to be
  // a drag rather than a tap. Kept in a ref so the release reads it directly.
  const start = useRef(null);
  const dragHandlers = useDrag({
    onStart: (event, id) => {
      start.current = { x: event.clientX, y: event.clientY, moving: false };
      setDrag({ id, dx: 0, dy: 0, moving: false });
    },
    onMove: (event, id) => {
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      start.current.moving = start.current.moving || Math.hypot(dx, dy) > DRAG_START_PX;
      setDrag({ id, dx, dy, moving: start.current.moving });
    },
    onEnd: (event, { cancelled }, id) => {
      const { moving } = start.current;
      setDrag(null);
      if (cancelled) return;
      if (moving) drop(id, basketAt(event.clientX, event.clientY));
      else setSelected((now) => (now === id ? null : id));
    }
  });

  return (
    <div className="minigame sort-laundry">
      <p className="minigame-instructions">
        {done ? 'Laundry sorted!' : selected ? 'Now tap the basket it goes in' : 'Drag each piece into the right basket'}
      </p>
      <div className="laundry-pile">
        {pile.map((piece) => {
          const dragging = drag?.id === piece.id && drag.moving;
          return (
            <button
              key={piece.id}
              type="button"
              className={[
                'laundry-piece',
                sorted.includes(piece.id) ? 'sorted' : '',
                selected === piece.id ? 'selected' : '',
                dragging ? 'dragging' : '',
                missed === piece.id ? 'missed' : ''
              ].join(' ')}
              style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
              aria-label={`${piece.basket === 'whites' ? 'White' : 'Colored'} ${piece.kind}`}
              aria-pressed={selected === piece.id}
              disabled={sorted.includes(piece.id)}
              {...dragHandlers(piece.id)}
              onClick={(event) => {
                if (event.detail === 0) setSelected((now) => (now === piece.id ? null : piece.id));
              }}
            >
              <Clothing kind={piece.kind} color={piece.color} />
            </button>
          );
        })}
      </div>
      <div className="laundry-baskets">
        {BASKETS.map((name) => (
          <button
            key={name}
            ref={(node) => { baskets.current[name] = node; }}
            type="button"
            className={`laundry-basket ${name}`}
            aria-label={`${LABELS[name]} basket`}
            onClick={() => selected && drop(selected, name)}
          >
            <span aria-hidden="true">🧺</span>
            {LABELS[name]}
            <small>{sorted.filter((id) => pile.find((p) => p.id === id).basket === name).length} in</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SortTheLaundry;
