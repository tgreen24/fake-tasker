import { useCallback, useEffect, useMemo, useState } from 'react';
import { closeMeeting, markKilledDuringMeeting, submitVote as writeVote } from '../game/mutations';
import { deriveMeetingState, resolverDelayMs, secondsUntil } from '../game/meetingState';
import { VOTE_DURATION_MS, shouldResolveMeeting } from '../voteLogic';
import { currentUid } from '../firebase';
import { usePlayerName } from './usePlayerName';
import { useGameSync } from './useGameSync';
import { roleName } from '../game/terminology';

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

  const [selectedVote, setSelectedVote] = useState('');
  const [killDialogOpen, setKillDialogOpen] = useState(false);
  const [selectedKillPlayer, setSelectedKillPlayer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const meeting = useMemo(() => deriveMeetingState(gameData, playerName, currentUid()), [gameData, playerName]);
  const displayedResult = useTypewriter(meeting.votingResult);
  const verdictText = meeting.ejected
    ? (meeting.ejectedWasImposter
        ? `They were the ${roleName('Imposter')}`
        : `They were not the ${roleName('Imposter')}`)
    : '';
  const displayedVerdict = useTypewriter(verdictText, VERDICT_DELAY_MS);

  const { meetingCalled, voteDeadline, isCreator, players } = meeting;
  const myTurnDelay = resolverDelayMs(players, playerName, isCreator);

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
    await markKilledDuringMeeting(gameCode, selectedKillPlayer, nextKillList, meeting.roles);
  }, [gameCode, selectedKillPlayer, meeting.deadPlayers, meeting.roles]);

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
