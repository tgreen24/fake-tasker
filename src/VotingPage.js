import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { closeMeeting, markKilledDuringMeeting, submitVote as writeVote } from './game/mutations';
import { usePlayerName } from './hooks/usePlayerName';
import { useGameSync } from './hooks/useGameSync';
import { showingVoteResult } from './gameRoute';
import { alivePlayersOf, shouldResolveMeeting, votesCastBy } from './voteLogic';
import ConnectionBanner from './components/ConnectionBanner';

const HOST_HEAD_START_MS = 2500;
const PEER_STAGGER_MS = 750;

function DeadPlayersList({ deadPlayers }) {
  if (deadPlayers.length === 0) return null;
  return (
    <div className="dead-players-list">
      <h3>Dead Players</h3>
      <p className="dead-player">{deadPlayers.join(', ')}</p>
    </div>
  );
}

function VotingPage() {
  const { gameCode } = useParams();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const [selectedVote, setSelectedVote] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKillPlayer, setSelectedKillPlayer] = useState('');
  const [displayedResult, setDisplayedResult] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const players = useMemo(() => gameData?.players || [], [gameData]);
  const roles = useMemo(() => gameData?.roles || {}, [gameData]);
  const deadPlayers = useMemo(() => gameData?.killList || [], [gameData]);
  const votes = useMemo(() => gameData?.votes || {}, [gameData]);

  const role = roles[playerName];
  const isCreator = gameData?.creator === playerName;
  const isAlive = !deadPlayers.includes(playerName);
  const meetingCaller = gameData?.meetingCaller || '';
  const votingResult = gameData?.votingResult || '';
  const votingEnded = showingVoteResult(gameData) || (!gameData?.meetingCalled && !!votingResult);
  const myVote = votes[playerName];

  const alivePlayers = useMemo(() => alivePlayersOf(gameData), [gameData]);
  const votesCast = votesCastBy(gameData, alivePlayers);
  const meetingCalled = !!gameData?.meetingCalled;
  const voteDeadline = gameData?.voteDeadline;

  // Everyone is a candidate resolver. The host tries first; peers back it up
  // on a stagger so a sleeping host cannot hang the meeting.
  const myTurnDelay = isCreator ? 0 : HOST_HEAD_START_MS + Math.max(0, players.indexOf(playerName)) * PEER_STAGGER_MS;

  useEffect(() => {
    if (!meetingCalled) return undefined;

    const attempt = () => {
      if (document.hidden) return;
      if (!shouldResolveMeeting(gameData)) return;
      closeMeeting(gameCode);
    };

    const timer = setTimeout(attempt, myTurnDelay);
    return () => clearTimeout(timer);
  }, [gameData, meetingCalled, gameCode, myTurnDelay]);

  useEffect(() => {
    if (!meetingCalled || !voteDeadline) {
      setSecondsLeft(null);
      return undefined;
    }
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [meetingCalled, voteDeadline]);

  useEffect(() => {
    if (!votingResult) {
      setDisplayedResult('');
      return undefined;
    }
    setDisplayedResult('');
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setDisplayedResult(votingResult.slice(0, index));
      if (index >= votingResult.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [votingResult]);

  const forceEndVote = useCallback(() => closeMeeting(gameCode, { force: true }), [gameCode]);

  const submitVote = async () => {
    if (!selectedVote || myVote) return;
    await writeVote(gameCode, playerName, selectedVote);
  };

  const handleMarkAsKilled = async () => {
    if (!selectedKillPlayer) return;

    const nextKillList = [...deadPlayers, selectedKillPlayer];
    setIsDialogOpen(false);
    setSelectedKillPlayer('');

    await markKilledDuringMeeting(gameCode, selectedKillPlayer, nextKillList, roles);
  };

  if (loading) {
    return <div className="voting-page"><ConnectionBanner connected={connected} />Loading…</div>;
  }

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
            {isCreator && <button className="end-game-btn" onClick={forceEndVote}>End Vote Now</button>}
            <DeadPlayersList deadPlayers={deadPlayers} />
          </>
        ) : (
          <>
            <div className="voting-grid">
              {alivePlayers.map((player) => (
                <div
                  key={player}
                  className={`voting-card ${selectedVote === player ? 'selected' : ''}`}
                  onClick={() => setSelectedVote(player)}
                >
                  <span>{player}</span>
                </div>
              ))}
            </div>

            <div
              className={`voting-card ${selectedVote === 'skip' ? 'selected' : ''}`}
              onClick={() => setSelectedVote('skip')}
            >
              <span>Skip Vote</span>
            </div>

            {role === 'Imposter' && isAlive && (
              <label className="voting-card" onClick={() => setIsDialogOpen(true)}>
                <span>Kill Crewmate</span>
              </label>
            )}

            {isAlive && (
              <button className="submit-vote-button" onClick={submitVote} disabled={!selectedVote}>
                Submit Vote
              </button>
            )}

            <p className="vote-progress">{waitingLine}{timerLine}</p>
            {isCreator && <button className="end-game-btn" onClick={forceEndVote}>End Vote Now</button>}
            <DeadPlayersList deadPlayers={deadPlayers} />

            {isDialogOpen && (
              <div className="dialog-overlay">
                <div className="dialog">
                  <h3>Select a player to mark as killed:</h3>
                  <ul>
                    {players
                      .filter((player) =>
                        !deadPlayers.includes(player) &&
                        player !== playerName &&
                        roles[player] !== 'Imposter')
                      .map((player) => (
                        <li
                          key={player}
                          onClick={() => setSelectedKillPlayer(player)}
                          className={`kill-item ${selectedKillPlayer === player ? 'selected' : ''}`}
                        >
                          <label>{player}</label>
                        </li>
                      ))}
                  </ul>
                  <button className="end-game-btn" onClick={handleMarkAsKilled} disabled={!selectedKillPlayer}>
                    Confirm Kill
                  </button>
                  <button className="submit-vote-button" onClick={() => setIsDialogOpen(false)}>Cancel</button>
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
