import React from 'react';

function ScreenHeader({ title, subtitle, tone = 'accent', icon, status }) {
  return (
    <header className={`screen-header tone-${tone}`}>
      <p className="screen-title">
        {icon && <span className="screen-icon" aria-hidden="true">{icon}</span>}
        {title}
      </p>
      {status && (
        <p className="screen-status">
          <span className="status-dot" aria-hidden="true" />
          {status}
        </p>
      )}
      {subtitle && <p className="screen-subtitle">{subtitle}</p>}
    </header>
  );
}

export default ScreenHeader;
