import React, { useEffect, useState } from 'react';

export function inviteUrlFor(gameCode) {
  return `${window.location.origin}/j/${gameCode}`;
}

// Native share first, because on a phone that is two taps into a group chat.
// Both APIs need a secure context, so on the dev server over plain http the
// link is shown to copy by hand instead.
function InviteButton({ gameCode }) {
  const [status, setStatus] = useState('');
  const url = inviteUrlFor(gameCode);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const invite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fake Tasker', text: 'Join my game', url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied');
    } catch (error) {
      setStatus(url);
    }
  };

  return (
    <div className="invite">
      <button className="invite-button" onClick={invite}>Invite players</button>
      {status && <p className="invite-status">{status}</p>}
    </div>
  );
}

export default InviteButton;
