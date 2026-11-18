import React from 'react';
import { useParams } from 'react-router-dom';
import { useMeeting } from './hooks/useMeeting';
import ConnectionBanner from './components/ConnectionBanner';
import LoadingScreen from './components/LoadingScreen';
import PlayerAvatar from './components/PlayerAvatar';
import Selectable from './components/Selectable';
import TimerBar from './components/TimerBar';
import ScreenHeader from './components/ScreenHeader';
import TypedVerdict from './components/TypedVerdict';
import SeatRequests from './components/SeatRequests';
import { EXILED } from './game/terminology';
import { roleName, roleNameLower } from './game/terminology';

function DeadPlayersList({ deadPlayers, colors }) {
  if (deadPlayers.length === 0) return null;
  return (
    <div className="dead-players-list">
      <h3>Out of the game</h3>
      <div className="dead-grid">
        {deadPlayers.map((player) => (
          <div key={player} className="dead-card">
            <PlayerAvatar name={player} color={colors[player]} />
            <span>{player}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The traitor's correction to the dead list, for a kill they made before the
// meeting and did not get to record. It used to live only on the ballot, which
// is the one screen a traitor leaves the moment they vote -- and the room
// usually only works out somebody is unaccounted for once everyone has turned
// up and voted. A traitor who is out themselves does not get it: they could
// only have gone out to this vote, so there is nothing of theirs left to
// correct.
function MarkDeadAction({ role, isAlive, open, targets, selected, actions }) {
  if (role !== 'Imposter' || !isAlive) return null;

  return (
    <>
      <Selectable
        as="div"
        className="voting-action"
        label={`Kill a ${roleNameLower('Crewmate')}`}
        onSelect={actions.openKillDialog}
      >
        <span>Kill {roleName('Crewmate')}</span>
      </Selectable>

      {open && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Select a player to mark as killed:</h3>
            <ul>
              {targets.map((player) => (
                <Selectable
                  key={player}
                  className={`kill-item ${selected === player ? 'selected' : ''}`}
                  selected={selected === player}
                  label={`Mark ${player} as killed`}
                  onSelect={() => actions.selectKillTarget(player)}
                >
                  <span>{player}</span>
                </Selectable>
              ))}
            </ul>
            <button className="end-game-btn" onClick={actions.confirmKill} disabled={!selected}>
              Confirm Kill
            </button>
            <button className="submit-vote-button" onClick={actions.closeKillDialog}>Cancel</button>
          </div>
        </div>
      )}
    </>
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
    return <LoadingScreen className="voting-page" connected={connected} gameCode={gameCode} />;
  }

  const {
    role, isCreator, isAlive, meetingCaller, votingEnded, displayedResult,
    myVote, voidedVote, votesCast, pendingVoters, alivePlayers, ballot, deadPlayers, secondsLeft,
    selectedVote, selectedKillPlayer, killDialogOpen, killTargets,
    colors, voteTotalSeconds, ejected, ejectedWasImposter,
    displayedVerdict, verdictText, verdictComplete, seatRequests, dealtSeats, voteSending
  } = state;

  // Naming who is outstanding rather than counting them. A bare 3/4 is
  // unarguable and unactionable: the room cannot tell which of them to chase,
  // and anybody who would rather the vote never ended can simply say they have
  // already voted.
  const waitingLine = pendingVoters.length > 0
    ? `${votesCast}/${alivePlayers.length} voted — waiting on ${pendingVoters.join(', ')}`
    : `${votesCast}/${alivePlayers.length} voted`;
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
        <SeatRequests gameCode={gameCode} isHost={isCreator} requests={seatRequests} dealtSeats={dealtSeats} />
        {!votingEnded && !myVote && isAlive && voteTimer}

        {votingEnded ? (
          <div className="voting-result" aria-live="polite">
            {ejected ? (
              <div className="ejection">
                <div className="ejection-avatar">
                  <PlayerAvatar name={ejected} color={colors[ejected]} />
                </div>
                <h3 className="ejection-name">{ejected} was {EXILED}</h3>
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
            <DeadPlayersList deadPlayers={deadPlayers} colors={colors} />
          </>
        ) : myVote ? (
          <>
            <p>
              {voteSending
                ? 'Sending your vote…'
                : myVote === 'skip' ? 'You skipped voting.' : `You voted for: ${myVote}`}
            </p>
            {voteTimer}
            <MarkDeadAction
              role={role}
              isAlive={isAlive}
              open={killDialogOpen}
              targets={killTargets}
              selected={selectedKillPlayer}
              actions={actions}
            />
            <p className="vote-progress">{waitingLine}</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} colors={colors} />
          </>
        ) : (
          <>
            {voidedVote && (
              <p className="vote-voided" role="alert">
                {voidedVote} was already dead when this meeting opened, so your vote
                did not count. Vote again.
              </p>
            )}
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

            <MarkDeadAction
              role={role}
              isAlive={isAlive}
              open={killDialogOpen}
              targets={killTargets}
              selected={selectedKillPlayer}
              actions={actions}
            />

            <button className="submit-vote-button" onClick={actions.submitVote} disabled={!selectedVote}>
              Submit Vote
            </button>

            <p className="vote-progress">{waitingLine}</p>
            <EndVoteButton isCreator={isCreator} onEnd={actions.forceEndVote} />
            <DeadPlayersList deadPlayers={deadPlayers} colors={colors} />
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
