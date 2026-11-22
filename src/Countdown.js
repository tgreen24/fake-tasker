import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCountdown } from './hooks/useCountdown';
import ConnectionBanner from './components/ConnectionBanner';
import LoadingScreen from './components/LoadingScreen';
import { roleName } from './game/terminology';
import SeatMoves from './components/SeatMoves';
import LockdownPanel from './components/lockdown/LockdownPanel';
import MinigameTaskOverlay from './components/minigames/MinigameTaskOverlay';
import RoundHeader from './components/round/RoundHeader';
import RoundBody from './components/round/RoundBody';
import RoundDock from './components/round/RoundDock';
import GuideSheet from './components/round/GuideSheet';
import { RoundTabs, StatusLine, TeamProgress } from './components/round/RoundParts';
import { KilledMoment, RoleReveal } from './components/round/RoundMoments';

const FLASH_MS = 900;

// The round screen. One frame for every role -- header, team bar, tabs, a
// status line, the list, and a dock that never scrolls away -- filled from
// the view model useCountdown builds.
function Countdown() {
  const { gameCode } = useParams();
  const { state, actions, lockdown, loading, connected } = useCountdown(gameCode);
  const [guideOpen, setGuideOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const openGuide = useCallback(() => setGuideOpen(true), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (loading) {
    return <LoadingScreen className="countdown-screen" connected={connected} gameCode={gameCode} />;
  }

  if (state.showIntro) {
    return <Intro kind={state.introKind} countdown={state.countdown} connected={connected} />;
  }

  if (state.revealing && state.role) {
    return (
      <div className="round-shell">
        <ConnectionBanner connected={connected} />
        <RoleReveal
          role={state.role}
          fellowImposters={state.fellowImposters}
          tasksCount={state.tasks.length}
          onHide={actions.dismissReveal}
        />
      </div>
    );
  }

  const { view } = state;

  return (
    <div className="round-shell">
      <ConnectionBanner connected={connected} />
      <div className="round-screen">
        <RoundHeader
          playerName={state.playerName}
          role={state.role}
          isDead={state.isDead}
          fellowImposters={state.fellowImposters}
          isHost={state.isCreator}
          onGuide={openGuide}
          onEndRound={actions.endRound}
          leave={{
            gameCode,
            playerName: state.playerName,
            inRound: true,
            role: state.role,
            tasksOutstanding: Math.max(0, state.tasks.length - state.completedTasks.length)
          }}
        />

        <Notices state={state} lockdown={lockdown} />
        <TeamProgress percent={state.progress} />
        <RoundTabs tabs={view.tabs} active={view.tab} onSelect={actions.selectTab} />

        <main className="round-body">
          {lockdown.state.active && (
            <LockdownPanel
              key={lockdown.state.startedAt}
              gameCode={gameCode}
              playerName={state.playerName}
              lockdown={lockdown.state}
              onEnterCode={lockdown.actions.enterCode}
            />
          )}
          <StatusLine status={view.status} flash={flash} />
          <RoundBody gameCode={gameCode} state={state} actions={actions} onNudge={() => setFlash(true)} />
        </main>

        <RoundDock
          dock={view.dock}
          onGuide={openGuide}
          onMeeting={actions.callMeeting}
          findName={state.sabotagingImposter}
          lockdown={lockdown}
        />
      </div>

      {guideOpen && <GuideSheet cards={view.guide} onClose={closeGuide} />}
      {state.killedMoment && <KilledMoment playerName={state.playerName} onDone={actions.dismissKilled} />}
      {state.playing && (
        <MinigameTaskOverlay
          key={state.playing.task}
          task={state.playing.task}
          onSolved={actions.solvePlaying}
          onClose={actions.stopPlaying}
        />
      )}
    </div>
  );
}

function Intro({ kind, countdown, connected }) {
  const returning = kind === 'return';
  return (
    <div className="countdown-screen">
      <ConnectionBanner connected={connected} />
      <div className="background-overlay">
        <div className="countdown">
          <div className={`countdown-rings ${returning ? 'tone-success' : ''}`} aria-hidden="true"><span /><span /><span /></div>
          <div className="countdown-number" key={countdown}>{countdown}</div>
          <h1 className={`countdown-timer ${returning ? 'tone-success' : ''}`} aria-live="polite">
            {returning ? 'Meeting adjourned' : 'Assigning roles…'}
          </h1>
          <p className="countdown-caption">{returning ? 'Back to your tasks' : 'Keep your screen to yourself'}</p>
        </div>
      </div>
    </div>
  );
}

// The short-lived lines that need saying to everybody: who took their seat
// back, whose role is still to land, and the lockdown lifting.
function Notices({ state, lockdown }) {
  const { lateReveal, awaitingOthers } = state;
  return (
    <div className="round-notices">
      <SeatMoves isHost={state.isCreator} seatMoves={state.seatMoves} />
      {awaitingOthers.length > 0 && (
        <p className="reveal-notice" role="status">
          Waiting for {awaitingOthers.join(' and ')}'s phone to reveal their role. Ask them to open the game.
        </p>
      )}
      {lateReveal && (
        <p className={`reveal-notice landed ${lateReveal.role}`} role="status">
          {lateReveal.name} was {lateReveal.role === 'Imposter' ? 'the' : 'not the'} {roleName('Imposter')}
        </p>
      )}
      {lockdown.state.justLifted && (
        <p className="reveal-notice landed lockdown-lifted" role="status">Lockdown lifted!</p>
      )}
    </div>
  );
}

export default Countdown;
