import React, { useEffect, useRef } from 'react';
import { CloseIcon, guideIcon } from './Icons';
import { useScrollLock } from '../../hooks/useScrollLock';

// What to do right now, for this player in this state. The cards come from
// the round's view model, so they change as the round does.
function GuideSheet({ cards, onClose }) {
  const closeButton = useRef(null);
  useScrollLock(true);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="guide-overlay">
      <button type="button" className="guide-scrim" aria-label="Close guide" onClick={onClose} />
      <div className="guide-sheet" role="dialog" aria-modal="true" aria-label="How to play">
        <div className="guide-head">
          <h2>Right now</h2>
          <button ref={closeButton} type="button" className="round-icon-button boxed" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <GuideCardList cards={cards} />
      </div>
    </div>
  );
}

export function GuideCardList({ cards }) {
  return (
    <ul className="guide-cards">
      {cards.map((card) => {
        const Icon = guideIcon(card.id);
        return (
          <li key={card.id} className="guide-card">
            <span className="guide-card-icon"><Icon size={20} /></span>
            <span>
              <strong>{card.title}</strong>
              <span>{card.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default GuideSheet;
