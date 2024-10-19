import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Fake Tasker</h1>
      <button onClick={() => alert('Create Game clicked')} disabled>
        Create Game
      </button>
      <button onClick={() => alert('Join Game clicked')} disabled>
        Join Game
      </button>
    </div>
  );
}

export default App;
