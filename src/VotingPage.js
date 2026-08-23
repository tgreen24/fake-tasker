import React from 'react';
import { useParams } from 'react-router-dom';
import { useMeeting } from './hooks/useMeeting';
import ConnectionBanner from './components/ConnectionBanner';
import PlayerAvatar from './components/PlayerAvatar';
import Selectable from './components/Selectable';
import TimerBar from './components/TimerBar';
import ScreenHeader from './components/ScreenHeader';
import TypedVerdict from './components/TypedVerdict';
import { roleName, roleNameLower } from './game/terminology';

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
    myVote, votesCast, alivePlayers, ballot, deadPlayers, secondsLeft,
    selectedVote, selectedKillPlayer, killDialogOpen, killTargets,
    colors, voteTotalSeconds, ejected, ejectedWasImposter,
    displayedVerdict, verdictText, verdictComplete
  } = state;

  const waitingLine = `${votesCast}/${alivePlayers.length} voted`;
  const voteTimer = secondsLeft !== null && (
    <TimerBar label="Vote ends in" secondsLeft={secondsLeft} totalSeconds={voteTotalSeconds} />
  );

  return (
    <div className="voting-page">
      <ConnectionBanner connected={connected} />
      <div className="voting-card-container">
        <ScreenHeader
          title="Emergency Meeting"
          subtitle={meetingCaller ? `Called by ${meetingCaller}` : null}
          tone="danger"
          icon="🚨"
        />
        {!votingEnded && !myVote && isAlive && voteTimer}

        {votingEnded ? (
          <div className="voting-result" aria-live="polite">
            {ejected ? (
              <div className="ejection">
                <div className="ejection-avatar">
                  <PlayerAvatar name={ejected} color={colors[ejected]} />
                </div>
                <h3 className="ejection-name">{ejected} was ejected</h3>
                <p className="ejection-verdict">
                  <TypedVerdict
                    text={verdictText}
                    revealed={displayedVerdict.length}
                    highlightWord={roleName('Imposter')}
                    highlight={ejectedWasImposter}
                  />
                  {!verdictComplete && <span className="caret" aria-hidden="true" />}
                </p>
              </div>
            ) : (
              <h3>{displayedResult}</h3>
            )}
          </div>
        ) : !isAlive ? (
          <>
            {voteTimer}
            <div className="spectator">
              <h3>You are dead</h3>
              <p>Watch the vote play out. You cannot vote, and nobody can vote for you.</p>
            </div>
            <p className="vote-progress">{waitingLine}</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} />
          </>
        ) : myVote ? (
          <>
            <p>{myVote === 'skip' ? 'You skipped voting.' : `You voted for: ${myVote}`}</p>
            {voteTimer}
            <p className="vote-progress">Waiting for other players… ({waitingLine})</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} />
          </>
        ) : (
          <>
            <div className="voting-grid">
              {ballot.map((player) => (
                <Selectable
                  as="div"
                  key={player}
                  className={`voting-card ${selectedVote === player ? 'selected' : ''}`}
                  selected={selectedVote === player}
                  label={`Vote for ${player}`}
                  onSelect={() => actions.selectVote(player)}
                >
                  <PlayerAvatar name={player} color={colors[player]} hollow />
                  <span>{player}</span>
                </Selectable>
              ))}
              <Selectable
                as="div"
                className={`voting-card skip ${selectedVote === 'skip' ? 'selected' : ''}`}
                selected={selectedVote === 'skip'}
                label="Skip the vote"
                onSelect={() => actions.selectVote('skip')}
              >
                <span className="avatar skip-mark" aria-hidden="true">✕</span>
                <span>Skip</span>
              </Selectable>
            </div>

            {role === 'Imposter' && (
              <Selectable
                as="div"
                className="voting-action"
                label={`Kill a ${roleNameLower('Crewmate')}`}
                onSelect={actions.openKillDialog}
              >
                <span>Kill {roleName('Crewmate')}</span>
              </Selectable>
            )}

            <button className="submit-vote-button" onClick={actions.submitVote} disabled={!selectedVote}>
              Submit Vote
            </button>

            <p className="vote-progress">{waitingLine}</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} />

            {killDialogOpen && (
              <div className="dialog-overlay">
                <div className="dialog">
                  <h3>Select a player to mark as killed:</h3>
                  <ul>
                    {killTargets.map((player) => (
                      <Selectable
                        key={player}
                        className={`kill-item ${selectedKillPlayer === player ? 'selected' : ''}`}
                        selected={selectedKillPlayer === player}
                        label={`Mark ${player} as killed`}
                        onSelect={() => actions.selectKillTarget(player)}
                      >
                        <span>{player}</span>
                      </Selectable>
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
        {!votingEnded && (
          <p className="footnote">
            <span aria-hidden="true">ⓘ</span> You get one vote, and it is final once submitted.
          </p>
        )}
      </div>
    </div>
  );
}

export default VotingPage;
