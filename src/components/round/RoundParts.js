import React from 'react';

export function TeamProgress({ percent }) {
  return (
    <div className="team-progress">
      <div className="team-progress-row">
        <span>Team tasks</span>
        <span className="team-progress-value">{percent}%</span>
      </div>
      <div
        className="team-progress-track"
        role="progressbar"
        aria-label="Team tasks"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="team-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function RoundTabs({ tabs, active, onSelect }) {
  if (!tabs) return null;
  return (
    <div className="round-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          className={`round-tab ${tab.id === active ? 'on' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StatusLine({ status, flash }) {
  if (!status) return null;
  return (
    <div className="round-status">
      <span>{status.left}</span>
      <span className={flash ? 'flash' : ''}>{status.right}</span>
    </div>
  );
}
