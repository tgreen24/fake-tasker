import React, { useEffect, useRef, useState } from 'react';
import { minigameById } from './index';
import { parseMinigameTask } from '../../game/minigameTasks';

const DONE_SHOWN_MS = 900;

// A minigame task played full screen: go to the room, tap Start, win it. The
// game lives only on this screen, so locking the phone, a meeting, a lockdown
// or a sabotage closes it and the next try starts fresh.
//
// "Task done" is only said once the win has been saved. If saving fails the
// win is kept on screen with a button to send it again, rather than claiming
// a task that the list will then show as not done.
function MinigameTaskOverlay({ task, onSolved, onClose }) {
  const minigame = parseMinigameTask(task);
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(null);
  const solvedRef = useRef(onSolved);
  solvedRef.current = onSolved;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stopButton = useRef(null);

  useEffect(() => {
    stopButton.current?.focus();
    const onHide = () => {
      if (document.hidden) closeRef.current();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (saving !== 'saved') return undefined;
    const timer = setTimeout(() => closeRef.current(), DONE_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [saving]);

  if (!minigame) return null;
  const { Component } = minigameById(minigame.gameId);

  const save = async () => {
    setSaving('saving');
    const saved = await solvedRef.current();
    setSaving(saved ? 'saved' : 'failed');
  };

  return (
    <div className="minigame-overlay" role="dialog" aria-modal="true" aria-label={minigame.name}>
      <div className="minigame-overlay-card">
        <div className="minigame-overlay-header">
          <span className="minigame-overlay-room">{minigame.icon} {minigame.room}</span>
          <button ref={stopButton} type="button" className="leave-game" onClick={onClose}>Stop</button>
        </div>
        <h2>{minigame.name}</h2>
        {started ? (
          <Component onSolved={save} />
        ) : (
          <div className="minigame-overlay-start">
            <p>Go to the <strong>{minigame.room}</strong>, then start.</p>
            <button type="button" className="start-game-btn" onClick={() => setStarted(true)}>Start</button>
          </div>
        )}
        {saving === 'saving' && <p className="minigame-overlay-done" role="status">Saving…</p>}
        {saving === 'saved' && <p className="minigame-overlay-done" role="status">✓ Task done!</p>}
        {saving === 'failed' && (
          <div className="minigame-overlay-failed" role="alert">
            <p>Couldn't save that. Check your connection.</p>
            <button type="button" onClick={save}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MinigameTaskOverlay;
