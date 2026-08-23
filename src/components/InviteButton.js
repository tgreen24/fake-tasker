import React, { useEffect, useState } from 'react';

export function inviteUrlFor(gameCode) {
  return `${window.location.origin}/j/${gameCode}`;
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const TickIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Native share first, because on a phone that is two taps into a group chat.
// Both APIs need a secure context, so over plain http the link is shown to be
// copied by hand instead.
function InviteButton({ gameCode }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');
  const url = inviteUrlFor(gameCode);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

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
      setCopied(true);
    } catch (error) {
      setFallbackUrl(url);
    }
  };

  return (
    <>
      <button
        className={`invite-icon ${copied ? 'copied' : ''}`}
        onClick={invite}
        aria-label={copied ? 'Invite link copied' : 'Copy invite link'}
        title="Copy invite link"
      >
        {copied ? <TickIcon /> : <CopyIcon />}
      </button>
      {fallbackUrl && <p className="invite-status">{fallbackUrl}</p>}
    </>
  );
}

export default InviteButton;
