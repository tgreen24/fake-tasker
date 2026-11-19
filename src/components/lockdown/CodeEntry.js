import React, { useState } from 'react';

function CodeEntry({ from, onEnter }) {
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!typed.trim() || status === 'sending') return;
    setStatus('sending');
    const result = await onEnter(typed);
    setStatus(result === 'wrong' || result === 'failed' ? result : null);
  };

  return (
    <form className="lockdown-entry" onSubmit={submit}>
      <p>Get your code from <strong>{from}</strong> and type it in.</p>
      <input
        className="lockdown-input"
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
          if (status === 'wrong') setStatus(null);
        }}
        placeholder="ABC-123"
        aria-label="Lockdown code"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={9}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Checking…' : 'Enter Code'}
      </button>
      {status === 'wrong' && <p className="lockdown-error" role="alert">That's not the code.</p>}
      {status === 'failed' && <p className="lockdown-error" role="alert">Couldn't send it. Try again.</p>}
    </form>
  );
}

export default CodeEntry;
