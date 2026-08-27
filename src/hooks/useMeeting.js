import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closeMeeting, markKilledDuringMeeting, submitVote as writeVote
} from '../game/mutations';
import { useSettleOutcome } from './useSettleOutcome';
import { deriveMeetingState, resolverDelayMs, secondsUntil } from '../game/meetingState';
import {
  VOTE_DURATION_MS, alivePlayersOf, shouldResolveMeeting, votesCastBy
} from '../voteLogic';
import { currentUid } from '../firebase';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';
import { roleName } from '../game/terminology';
import { usePrivateRole } from './usePrivateRole';
import { usePublishOutRoles } from './usePublishOutRoles';

const TYPEWRITER_MS = 40;
const VERDICT_DELAY_MS = 700;

function useTypewriter(text, delayMs = 0) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!text) {
      setShown('');
      return undefined;
    }
    setShown('');
    let timer = null;
    const start = setTimeout(() => {
      let index = 0;
      timer = setInterval(() => {
        index += 1;
        setShown(text.slice(0, index));
        if (index >= text.length) clearInterval(timer);
      }, TYPEWRITER_MS);
    }, delayMs);

    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [text, delayMs]);

  return shown;
}

export function useMeeting(gameCode) {
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);
  const { privateData } = usePrivateRole(gameCode, playerName);
  useSettleOutcome(gameCode, gameData);

  const [selectedVote, setSelectedVote] = useState('');
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [selectedKillPlayer, setSelectedKillPlayer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const meeting = useMemo(() => deriveMeetingState(gameData, playerName, currentUid(), privateData), [gameData, playerName, privateData]);

  usePublishOutRoles(gameCode, gameData, playerName, privateData);
  const displayedResult = useTypewriter(meeting.votingResult);
  const verdictText = meeting.ejected
    ? (meeting.ejectedWasImposter
        ? `They were the ${roleName('Imposter')}`
        : `They were not the ${roleName('Imposter')}`)
    : '';
  const displayedVerdict = useTypewriter(verdictText, VERDICT_DELAY_MS);

  const { meetingCalled, voteDeadline, isCreator, players } = meeting;
  const myTurnDelay = resolverDelayMs(players, playerName, isCreator);

  // How long this client has actually watched the meeting. Elapsed local time
  // rather than a comparison against a deadline somebody else's clock wrote,
  // so a device set to the wrong time cannot end a vote the moment it opens.
  const watchingSince = useRef(null);
  useEffect(() => {
    if (!meetingCalled) {
      watchingSince.current = null;
      return;
    }
    if (watchingSince.current === null) watchingSince.current = Date.now();
  }, [meetingCalled]);

  useEffect(() => {
    if (!meetingCalled) return undefined;

    const attempt = () => {
      if (document.hidden) return;

      // Everybody having voted is a fact any client can check. Running out of
      // time is not, so only a client that has sat through the whole vote is
      // allowed to be the one who calls it.
      const alive = alivePlayersOf(gameData);
      const everyoneVoted = alive.length === 0 || votesCastBy(gameData, alive) >= alive.length;
      const watchedFor = watchingSince.current === null ? 0 : Date.now() - watchingSince.current;
      if (!everyoneVoted && watchedFor < VOTE_DURATION_MS) return;

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
    const update = () => setSecondsLeft(secondsUntil(voteDeadline));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [meetingCalled, voteDeadline]);

  const submitVote = useCallback(async () => {
    if (!selectedVote || meeting.myVote) return;
    await writeVote(gameCode, playerName, selectedVote);
  }, [gameCode, playerName, selectedVote, meeting.myVote]);

  const confirmKill = useCallback(async () => {
    if (!selectedKillPlayer) return;

    const nextKillList = [...meeting.deadPlayers, selectedKillPlayer];
    setKillDialogOpen(false);
    setSelectedKillPlayer('');
    await markKilledDuringMeeting(
      gameCode, selectedKillPlayer, nextKillList, meeting.roles, gameData, playerName
    );
  }, [gameCode, selectedKillPlayer, meeting.deadPlayers, meeting.roles, gameData, playerName]);


  const actions = useMemo(() => ({
    selectVote: setSelectedVote,
    submitVote,
    forceEndVote: () => closeMeeting(gameCode, { force: true }),
    openKillDialog: () => setKillDialogOpen(true),
    closeKillDialog: () => setKillDialogOpen(false),
    selectKillTarget: setSelectedKillPlayer,
    confirmKill
  }), [gameCode, submitVote, confirmKill]);

  return {
    state: {
      ...meeting,
      playerName,
      selectedVote,
      selectedKillPlayer,
      killDialogOpen,
      secondsLeft,
      voteTotalSeconds: VOTE_DURATION_MS / 1000,
      displayedResult,
      displayedVerdict,
      verdictText,
      verdictComplete: !!verdictText && displayedVerdict.length >= verdictText.length,
      killTargets: meeting.killableBy(playerName)
    },
    actions,
    loading,
    connected
  };
}
