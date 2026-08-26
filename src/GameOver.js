import React from 'react';
import { useParams } from 'react-router-dom';
import { useGameOver } from './hooks/useGameOver';
import ConnectionBanner from './components/ConnectionBanner';
import RevealRoster from './components/RevealRoster';
import AwardList from './components/AwardList';
import { formatClock } from './game/playerColor';
import { teamName } from './game/terminology';
import LeaveGame from './components/LeaveGame';

function GameOver() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useGameOver(gameCode);

  if (loading) {
    return <div className="gameover-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  const { playerName, winner, role, playerWon, isCreator, hostReachable, errorMessage, roster, winReason, badges, roundMs, colors } = state;

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
            {teamName(winner)} Win
          </h1>

          {winReason && <p className="win-reason reveal-fade">{winReason}</p>}

          <h2 className="player-result reveal-fade">{role ? (playerWon ? 'You Win!' : 'You Lose!') : ''}</h2>

          {roundMs > 0 && (
            <p className="round-length">
              Round lasted <strong>{formatClock(Math.round(roundMs / 1000))}</strong>
            </p>
          )}

          <RevealRoster roster={roster} winner={winner} />

          <AwardList badges={badges} colors={colors} />

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

          <LeaveGame gameCode={gameCode} playerName={playerName} />
        </div>
      </div>
    </div>
  );
}

export default GameOver;
