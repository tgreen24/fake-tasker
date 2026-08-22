import React from 'react';
import { useParams } from 'react-router-dom';
import { useMeeting } from './hooks/useMeeting';
import ConnectionBanner from './components/ConnectionBanner';

function DeadPlayersList({ deadPlayers }) {
  if (deadPlayers.length === 0) return null;
  return (
    <div className="dead-players-list">
      <h3>Dead Players</h3>
      <p className="dead-player">{deadPlayers.join(', ')}</p>
    </div>
  );
}

function EndVoteButton({ isCreator, onEnd }) {
  if (!isCreator) return null;
  return <button className="end-game-btn" onClick={onEnd}>End Vote Now</button>;
}

function VotingPage() {
  const { gameCode } = useParams();
  const { state, actions, loading, connected } = useMeeting(gameCode);

  if (loading) {
    return <div className="voting-page"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  const {
    role, isCreator, isAlive, meetingCaller, votingEnded, displayedResult,
    myVote, votesCast, alivePlayers, deadPlayers, secondsLeft,
    selectedVote, selectedKillPlayer, killDialogOpen, killTargets
  } = state;

  const waitingLine = `${votesCast}/${alivePlayers.length} voted`;
  const timerLine = secondsLeft !== null ? ` · vote ends in ${secondsLeft}s` : '';

  return (
    <div className="voting-page">
      <ConnectionBanner connected={connected} />
      <div className="voting-card-container">
        <h2>Emergency Meeting called by {meetingCaller}</h2>

        {votingEnded ? (
          <div className="voting-result">
            <h3>{displayedResult}</h3>
          </div>
        ) : myVote ? (
          <>
            <p>{myVote === 'skip' ? 'You skipped voting.' : `You voted for: ${myVote}`}</p>
            <p className="vote-progress">Waiting for other players… ({waitingLine}{timerLine})</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} />
          </>
        ) : (
          <>
            <div className="voting-grid">
              {alivePlayers.map((player) => (
                <div
                  key={player}
                  className={`voting-card ${selectedVote === player ? 'selected' : ''}`}
                  onClick={() => actions.selectVote(player)}
                >
                  <span>{player}</span>
                </div>
              ))}
            </div>

            <div
              className={`voting-card ${selectedVote === 'skip' ? 'selected' : ''}`}
              onClick={() => actions.selectVote('skip')}
            >
              <span>Skip Vote</span>
            </div>

            {role === 'Imposter' && isAlive && (
              <label className="voting-card" onClick={actions.openKillDialog}>
                <span>Kill Crewmate</span>
              </label>
            )}

            {isAlive && (
              <button className="submit-vote-button" onClick={actions.submitVote} disabled={!selectedVote}>
                Submit Vote
              </button>
            )}

            <p className="vote-progress">{waitingLine}{timerLine}</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} />

            {killDialogOpen && (
              <div className="dialog-overlay">
                <div className="dialog">
                  <h3>Select a player to mark as killed:</h3>
                  <ul>
                    {killTargets.map((player) => (
                      <li
                        key={player}
                        onClick={() => actions.selectKillTarget(player)}
                        className={`kill-item ${selectedKillPlayer === player ? 'selected' : ''}`}
                      >
                        <label>{player}</label>
                      </li>
                    ))}
                  </ul>
                  <button className="end-game-btn" onClick={actions.confirmKill} disabled={!selectedKillPlayer}>
                    Confirm Kill
                  </button>
                  <button className="submit-vote-button" onClick={actions.closeKillDialog}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default VotingPage;
