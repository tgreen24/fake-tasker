import React from 'react';

// The task list, kill list and voting cards were clickable div/li elements:
// no keyboard access, no announced state. Same look, real button semantics.
function Selectable({ as: Tag = 'li', className, onSelect, selected, label, children }) {
  const activate = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Tag
      className={className}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={activate}
    >
      {children}
    </Tag>
  );
}

export default Selectable;
