import React from 'react';
import { useParams } from 'react-router-dom';
import { returnToLobby } from './game/mutations';
import { usePlayerName } from './hooks/usePlayerName';
import { useGameSync } from './hooks/useGameSync';
import ConnectionBanner from './components/ConnectionBanner';

function decideWinner(gameData) {
  if (gameData?.winner) return gameData.winner;

  const roles = gameData?.roles || {};
  const killList = gameData?.killList || [];
  const crewmates = Object.keys(roles).filter((player) => roles[player] === 'Crewmate');
  const imposters = Object.keys(roles).filter((player) => roles[player] === 'Imposter');

  const allTasksDone = crewmates.length > 0 && crewmates.every((crewmate) => {
    const assigned = gameData?.assignedTasks?.[crewmate] || [];
    const done = gameData?.completedTasks?.[crewmate] || [];
    return done.length >= assigned.length;
  });
  const allImpostersOut = imposters.length > 0 && imposters.every((imposter) => killList.includes(imposter));

  return allTasksDone || allImpostersOut ? 'Crewmates' : 'Imposters';
}

function GameOver() {
  const { gameCode } = useParams();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const isCreator = gameData?.creator === playerName;
  const winner = decideWinner(gameData);
  const role = gameData?.roles?.[playerName];
  const playerWon = (winner === 'Crewmates' && role === 'Crewmate') || (winner === 'Imposters' && role === 'Imposter');

  const endGameAndReturnToLobby = () => returnToLobby(gameCode);

  if (loading) {
    return <div className="gameover-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  return (
    <div className="gameover-screen">
      <ConnectionBanner connected={connected} />
      <div className="background-overlay">
        <div className="gameover-content">
          <div className="player-name">
            <h2>{playerName}</h2>
          </div>

          <h1 className={`winning-team ${winner === 'Imposters' ? 'imposters-win' : 'crewmates-win'}`}>
            {winner} Win
          </h1>

          <h2 className="player-result">{role ? (playerWon ? 'You Win!' : 'You Lose!') : ''}</h2>

          {isCreator && (
            <button className="end-game-btn" onClick={endGameAndReturnToLobby}>
              End Game and Return to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameOver;
