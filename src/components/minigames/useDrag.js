import { useCallback, useRef } from 'react';

// Pointer handlers for anything dragged, swiped or rubbed, made to never stick.
//
// A drag can lose its release: the browser may start its own drag of a text
// selection and stop sending pointer events, the window may lose the mouse,
// or a phone may take the touch away. Any of those left the dragged thing
// stuck to the cursor. So the drag also ends when the pointer is cancelled,
// when capture is lost, and when a mouse moves with no button held -- all of
// them as a cancel, so nothing is dropped where nobody let go -- and the
// browser's own drag is never allowed to start.
//
// One pointer at a time: a second finger is ignored until the first lifts.
// Handlers take an optional value (which piece, say) passed back to each call.
export function useDrag({ onStart, onMove, onEnd }) {
  const callbacks = useRef({ onStart, onMove, onEnd });
  callbacks.current = { onStart, onMove, onEnd };
  const active = useRef(null);

  const finish = useCallback((event, cancelled) => {
    const drag = active.current;
    if (!drag) return;
    active.current = null;
    callbacks.current.onEnd?.(event, { cancelled }, drag.value);
  }, []);

  return useCallback((value) => ({
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // The same pointer pressing again means its last release never arrived.
      if (active.current && (active.current.pointerId === event.pointerId || event.pointerType === 'mouse')) {
        finish(event, true);
      }
      if (active.current) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      active.current = { pointerId: event.pointerId, value };
      callbacks.current.onStart?.(event, value);
    },
    onPointerMove: (event) => {
      const drag = active.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        finish(event, true);
        return;
      }
      callbacks.current.onMove?.(event, drag.value);
    },
    onPointerUp: (event) => {
      if (active.current?.pointerId === event.pointerId) finish(event, false);
    },
    onPointerCancel: (event) => {
      if (active.current?.pointerId === event.pointerId) finish(event, true);
    },
    onLostPointerCapture: (event) => {
      if (active.current?.pointerId === event.pointerId) finish(event, true);
    },
    onDragStart: (event) => event.preventDefault()
  }), [finish]);
}
