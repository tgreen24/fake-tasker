import React from 'react';

function ConnectionBanner({ connected }) {
  if (connected) return null;
  return <div className="connection-banner">Reconnecting…</div>;
}

export default ConnectionBanner;
