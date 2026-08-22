import React from 'react';
import { useParams } from 'react-router-dom';
import { useGameOver } from './hooks/useGameOver';
import ConnectionBanner from './components/ConnectionBanner';

function GameOver() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useGameOver(gameCode);

  if (loading) {
    return <div className="gameover-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  const { playerName, winner, role, playerWon, isCreator, hostReachable, errorMessage } = state;

  return (
    <div className="gameover-screen">
      <ConnectionBanner connected={connected} />
      <div className={`background-overlay ${winner === 'Imposters' ? 'menace' : ''}`}>
        {winner === 'Crewmates' && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => <span key={i} style={{ '--i': i }} />)}
          </div>
        )}
        <div className="gameover-content">
          <div className="player-name">
            <h2>{playerName}</h2>
          </div>

          <p className="gameover-eyebrow">Game Over</p>
          <h1 className={`winning-team reveal-pop ${winner === 'Imposters' ? 'imposters-win' : 'crewmates-win'}`}>
            {winner} Win
          </h1>

          <h2 className="player-result reveal-fade">{role ? (playerWon ? 'You Win!' : 'You Lose!') : ''}</h2>

          {errorMessage && <p className="error-message">{errorMessage}</p>}

          {isCreator && (
            <button className="end-game-btn" onClick={actions.endGameAndReturnToLobby}>
              End Game and Return to Lobby
            </button>
          )}

          {!isCreator && (
            <p className="vote-progress">
              {hostReachable
                ? 'Waiting for the host to return everyone to the lobby.'
                : 'This game has no host any more, so nobody can restart it. Leave and start a new game.'}
            </p>
          )}

          {!isCreator && !hostReachable && (
            <button className="submit-vote-button" onClick={actions.leaveGame}>Leave Game</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameOver;
