import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  callMeeting, clearSabotage, endGame, endRound,
  recordKill, setCompletedTasks, startSabotage, undoKill
} from './game/mutations';
import { usePlayerName } from './hooks/usePlayerName';
import { useGameSync } from './hooks/useGameSync';
import ConnectionBanner from './components/ConnectionBanner';

const SABOTAGE_COOLDOWN_SECONDS = 120;

function Countdown() {
  const { gameCode } = useParams();
  const playerName = usePlayerName(gameCode);
  const { gameData, loading, connected } = useGameSync(gameCode, playerName);

  const [countdown, setCountdown] = useState(3);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [sabotageCooldown, setSabotageCooldown] = useState(0);
  const [isSabotageDialogOpen, setIsSabotageDialogOpen] = useState(false);

  const roles = useMemo(() => gameData?.roles || {}, [gameData]);
  const killList = useMemo(() => gameData?.killList || [], [gameData]);
  const sabotages = useMemo(() => gameData?.sabotages || {}, [gameData]);

  const role = roles[playerName];
  const isCreator = gameData?.creator === playerName;
  const isDead = killList.includes(playerName);
  const killCooldown = gameData?.killCooldown || 30;

  const tasks = useMemo(() => gameData?.assignedTasks?.[playerName] || [], [gameData, playerName]);
  const completedTasks = useMemo(() => gameData?.completedTasks?.[playerName] || [], [gameData, playerName]);

  const crewmates = useMemo(
    () => Object.keys(roles).filter((player) => roles[player] === 'Crewmate').sort(),
    [roles]
  );
  const fellowImposters = useMemo(
    () => Object.keys(roles).filter((player) => roles[player] === 'Imposter' && player !== playerName).sort(),
    [roles, playerName]
  );

  const mySabotage = sabotages[playerName];
  const sabotagingImposter = Object.keys(sabotages).find(
    (imposter) => sabotages[imposter]?.sabotagedPlayer === playerName
  );
  const tasksBlocked = !!sabotagingImposter;
  const sabotageActive = !!mySabotage;
  const sabotagedPlayer = mySabotage?.sabotagedPlayer || '';

  const eligibleCrewmates = crewmates.filter((crewmate) => {
    const assigned = gameData?.assignedTasks?.[crewmate] || [];
    const done = gameData?.completedTasks?.[crewmate] || [];
    const alreadySabotaged = Object.values(sabotages).some((s) => s.sabotagedPlayer === crewmate);
    return assigned.length > done.length && !alreadySabotaged && !killList.includes(crewmate);
  });

  const totalTasks = crewmates.reduce(
    (total, crewmate) => total + (gameData?.assignedTasks?.[crewmate]?.length || 0), 0
  );
  const totalCompletedTasks = crewmates.reduce(
    (total, crewmate) => total + (gameData?.completedTasks?.[crewmate]?.length || 0), 0
  );
  const progress = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (cooldownTimer <= 0) return undefined;
    const timer = setTimeout(() => setCooldownTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownTimer]);

  useEffect(() => {
    if (sabotageCooldown <= 0) return undefined;
    const timer = setTimeout(() => setSabotageCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [sabotageCooldown]);

  const endRoundIfImpostersWin = async (nextKillList) => {
    const aliveCrewmates = Object.keys(roles).filter(
      (player) => roles[player] === 'Crewmate' && !nextKillList.includes(player)
    ).length;
    const aliveImposters = Object.keys(roles).filter(
      (player) => roles[player] === 'Imposter' && !nextKillList.includes(player)
    ).length;

    if (aliveImposters > 0 && aliveImposters >= aliveCrewmates) {
      await endGame(gameCode, 'Imposters');
    }
  };

  const toggleCrewmateDeath = async (crewmate) => {
    if (killList.includes(crewmate)) {
      setCooldownTimer(0);
      await undoKill(gameCode, crewmate);
      return;
    }

    if (cooldownTimer > 0) return;

    setCooldownTimer(killCooldown);
    const ok = await recordKill(gameCode, crewmate);
    if (!ok) {
      setCooldownTimer(0);
      return;
    }
    await endRoundIfImpostersWin([...killList, crewmate]);
  };

  const toggleTaskCompletion = async (task) => {
    if (tasksBlocked) return;

    const nextCompleted = completedTasks.includes(task)
      ? completedTasks.filter((t) => t !== task)
      : [...completedTasks, task];

    const ok = await setCompletedTasks(gameCode, playerName, nextCompleted);
    if (!ok) return;

    const allTasksDone = crewmates.length > 0 && crewmates.every((crewmate) => {
      const assigned = gameData?.assignedTasks?.[crewmate] || [];
      const done = crewmate === playerName ? nextCompleted : (gameData?.completedTasks?.[crewmate] || []);
      return done.length >= assigned.length;
    });

    if (allTasksDone) {
      await endGame(gameCode, 'Crewmates');
    }
  };

  const callEmergencyMeeting = () => callMeeting(gameCode, playerName);

  const initiateFindMeSabotage = async (crewmate) => {
    if (sabotageCooldown > 0) return;
    setIsSabotageDialogOpen(false);
    await startSabotage(gameCode, playerName, crewmate);
  };

  const handleSabotageReset = async () => {
    setSabotageCooldown(SABOTAGE_COOLDOWN_SECONDS);
    await clearSabotage(gameCode, playerName);
  };

  const endGameRound = () => endRound(gameCode);

  if (loading) {
    return <div className="countdown-screen"><ConnectionBanner connected={connected} />Loading…</div>;
  }

  return (
    <div className="countdown-screen">
      <ConnectionBanner connected={connected} />
      <div className="background-overlay">
        {countdown > 0 ? (
          <div className="countdown">
            <h1 className="countdown-timer">Game starting in... {countdown}</h1>
          </div>
        ) : (
          <div className="game-content">
            <div className="player-info">
              <h2 className="player-name">{playerName}</h2>
            </div>

            <h2 className={`role-announcement ${role || ''}`}>
              {isDead ? `You are a Dead ${role}` : role === 'Imposter' ? 'You are the Imposter!' : 'You are a Crewmate!'}
            </h2>

            {role === 'Crewmate' && !tasksBlocked && (
              <div>
                <h3>Your Tasks</h3>
                <div className="task-list">
                  <ul>
                    {tasks.map((task) => (
                      <li
                        key={task}
                        className={`task-item ${completedTasks.includes(task) ? 'selected' : ''}`}
                        onClick={() => toggleTaskCompletion(task)}
                      >
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {role === 'Crewmate' && tasksBlocked && (
              <div>
                <h3>You have been sabotaged</h3>
                <p>Find {sabotagingImposter} to resume your tasks!</p>
              </div>
            )}

            {role === 'Imposter' && !isDead && (
              <div>
                <h3>Kill List</h3>
                <div className="kill-list">
                  <ul>
                    {crewmates.map((crewmate) => (
                      <li
                        key={crewmate}
                        className={`kill-item ${killList.includes(crewmate) ? 'selected' : ''}`}
                        onClick={() => toggleCrewmateDeath(crewmate)}
                      >
                        <label>{crewmate}</label>
                      </li>
                    ))}
                  </ul>
                </div>
                {cooldownTimer > 0 && <div className="cooldown-timer">Cooldown: {cooldownTimer}s</div>}
                {fellowImposters.length > 0 && (
                  <div className="fellow-imposters">
                    <p>Other Imposters: {fellowImposters.join(', ')}</p>
                  </div>
                )}
              </div>
            )}

            {role === 'Imposter' && isDead && !sabotageActive && (
              <div>
                <button
                  className="end-game-btn"
                  onClick={() => setIsSabotageDialogOpen(true)}
                  disabled={sabotageCooldown > 0 || eligibleCrewmates.length === 0}
                >
                  Sabotage
                </button>
                {isSabotageDialogOpen && (
                  <div className="dialog-overlay">
                    <div className="dialog">
                      <h3>Select a player to sabotage:</h3>
                      <ul>
                        {eligibleCrewmates.map((crewmate) => (
                          <li className="kill-item" key={crewmate} onClick={() => initiateFindMeSabotage(crewmate)}>
                            <label className="sabotage-option-btn">{crewmate}</label>
                          </li>
                        ))}
                      </ul>
                      <button className="end-game-btn" onClick={() => setIsSabotageDialogOpen(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                {sabotageCooldown > 0 && (
                  <div className="sabotage-cooldown">Sabotage Cooldown: {sabotageCooldown}s</div>
                )}
              </div>
            )}

            {role === 'Imposter' && isDead && sabotageActive && (
              <div>
                <p>Hide in one place and wait for {sabotagedPlayer} to find you. Once they do, press the button below.</p>
                <button className="reset-sabotage-btn" onClick={handleSabotageReset}>
                  {sabotagedPlayer} Found Me
                </button>
              </div>
            )}

            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div>
            </div>

            <div className="buttons">
              {role && !isDead && !tasksBlocked && (
                <button className="emergency-meeting-btn" onClick={callEmergencyMeeting}>
                  🚨 Emergency Meeting
                </button>
              )}
              {isCreator && (
                <button className="end-game-btn" onClick={endGameRound}>End Game Round</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Countdown;
