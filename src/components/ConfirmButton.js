import React, { useEffect, useState } from 'react';

const CONFIRM_WINDOW_MS = 4000;

// For the buttons that cannot be taken back. One tap arms it, the next does it,
// and it disarms itself so an armed button is never left lying around.
function ConfirmButton({ className = '', label, confirmLabel, onConfirm }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return undefined;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onConfirm();
  };

  return (
    <button className={`${className} ${confirming ? 'confirming' : ''}`} onClick={onClick}>
      {confirming ? confirmLabel : label}
    </button>
  );
}

export default ConfirmButton;
