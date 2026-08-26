import {
  doc, setDoc, updateDoc, runTransaction, writeBatch, increment,
  arrayUnion, arrayRemove, deleteField, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { updateGame } from '../db';
import { RESULT_DISPLAY_MS } from '../gameRoute';
import { VOTE_DURATION_MS, resolveVote, shouldResolveMeeting } from '../voteLogic';
import { decideOutcomeFromCounts } from './outcome';
import {
  SABOTAGE_COOLDOWN_SECONDS, cooldownExpiryFor, pauseCooldowns, resumeCooldowns
} from './cooldown';

import { GAME_LIFETIME_MS, MAX_PLAYERS } from './constants';

export { GAME_LIFETIME_MS, MAX_PLAYERS };

const gameRef = (gameCode) => doc(db, 'games', gameCode);
const playerRef = (gameCode, playerName) => doc(db, 'games', gameCode, 'players', playerName);
const expiry = () => Timestamp.fromMillis(Date.now() + GAME_LIFETIME_MS);

// ── lifecycle ──────────────────────────────────────────────

export function createGame(gameCode, playerName) {
  return setDoc(gameRef(gameCode), {
    players: [playerName],
    creator: playerName,
    creatorUid: auth.currentUser?.uid || null,
    playerUids: { [playerName]: auth.currentUser?.uid || null },
    tasks: [],
    gameStarted: false,
    gameEnded: false,
    meetingCalled: false,
    imposterHistory: {},
    imposterCount: 1,
    tasksPerCrewmate: 3,
    killCooldown: 30,
    createdAt: serverTimestamp(),
    expiresAt: expiry()
  });
}

export function joinGame(gameCode, playerName) {
  return updateDoc(gameRef(gameCode), {
    players: arrayUnion(playerName),
    [`playerUids.${playerName}`]: auth.currentUser?.uid || null
  });
}

// Stamps your account onto your own role document. The host addresses it at
// deal time from what has been announced; this repairs the case where that had
// not arrived yet, which otherwise locks a player out of their own role.
export const claimOwnSeat = (gameCode, playerName) =>
  updateDoc(playerRef(gameCode, playerName), { uid: auth.currentUser?.uid || null });

// Re-announced on every load: an account can change between sessions, and a
// private document addressed to a stale one is unreadable by its owner.
export const claimSeat = (gameCode, playerName) =>
  updateGame(gameCode, { [`playerUids.${playerName}`]: auth.currentUser?.uid || null });

// Firestore does not cascade, so the private documents have to go explicitly --
// and by the seats that were dealt, not the current roster. Anyone kicked or
// who left since the deal still has one, and once the parent is gone nothing
// can reach it: the rules resolve the host by reading the parent, so an orphan
// has no host and can never be read or deleted again.
export async function deleteGame(gameCode, players = [], dealtSeats = []) {
  const seats = Array.from(new Set([...players, ...dealtSeats]));
  const batch = writeBatch(db);
  seats.forEach((playerName) => batch.delete(playerRef(gameCode, playerName)));
  batch.delete(gameRef(gameCode));
  await batch.commit();
}

// Leaving before a round removes the seat outright. Leaving during one cannot:
// the totals adjudication rests on are derived from the roster and the imposter
// count, so shrinking it mid-round would make a departed traitor look
// permanently alive. So leaving mid-round is being out, and their unfinished
// tasks are credited -- otherwise the goal counts work nobody can ever do and
// the round can never be won by tasks.
export function leaveGame(gameCode, playerName, { inRound = false, role, tasksOutstanding = 0 } = {}) {
  if (!inRound) {
    // leftBy names the departing seat so the rules can tell leaving from
    // kicking; without it the write reads as removing somebody else.
    return updateGame(gameCode, {
      players: arrayRemove(playerName),
      leftBy: playerName,
      [`playerUids.${playerName}`]: deleteField()
    });
  }

  return updateGame(gameCode, {
    killList: arrayUnion(playerName),
    ...(role ? { [`revealed.${playerName}`]: role } : {}),
    ...(tasksOutstanding > 0 ? { tasksCompleted: increment(tasksOutstanding) } : {})
  });
}

// Removing the seat has to remove the account behind it too. It did not, so
// playerUids grew every time somebody was kicked -- and that map is what the
// private role documents are addressed by.
export const kickPlayer = (gameCode, playerName) =>
  updateGame(gameCode, {
    players: arrayRemove(playerName),
    [`playerUids.${playerName}`]: deleteField()
  });

// ── lobby ──────────────────────────────────────────────────

export const addTask = (gameCode, task) =>
  updateDoc(gameRef(gameCode), { tasks: arrayUnion(task) });

// arrayUnion ignores anything already there, so adding a pack twice is a no-op
// rather than a list full of duplicates.
export const addTasks = (gameCode, tasks) =>
  updateDoc(gameRef(gameCode), { tasks: arrayUnion(...tasks) });

export const removeTask = (gameCode, task) =>
  updateDoc(gameRef(gameCode), { tasks: arrayRemove(task) });

export const updateSetting = (gameCode, field, value) =>
  updateGame(gameCode, { [field]: value });

// Roles and task lists live in games/{code}/players/{name}, addressed to the
// account that holds the seat. The shared document never carries them again.
// Traitors get the whole map in theirs, because a traitor legitimately knows
// who everyone is -- that is what the target list has always been.
export async function startRound(gameCode, { roles, assignedTasks, imposterHistory }, playerUids = {}) {
  try {
    const batch = writeBatch(db);

    Object.keys(roles).forEach((playerName) => {
      const isTraitor = roles[playerName] === 'Imposter';
      batch.set(playerRef(gameCode, playerName), {
        uid: playerUids[playerName] || null,
        role: roles[playerName],
        tasks: assignedTasks[playerName] || [],
        completedTasks: [],
        ...(isTraitor ? { roleMap: roles } : {})
      });
    });

    batch.update(gameRef(gameCode), {
      imposterHistory,
      dealtSeats: arrayUnion(...Object.keys(roles)),
      killList: [],
      votes: {},
      sabotages: {},
      revealed: {},
      tasksCompleted: 0,
      killCooldowns: {},
      sabotageCooldowns: {},
      kills: {},
      voteLog: [],
      taskCounts: {},
      finishedAt: {},
      endedAt: deleteField(),
      gameStarted: true,
      gameEnded: false,
      meetingCalled: false,
      roundStartedAt: Date.now(),
      expiresAt: expiry(),
      roles: deleteField(),
      assignedTasks: deleteField(),
      completedTasks: deleteField(),
      meetingCaller: deleteField(),
      votingResult: deleteField(),
      resultUntil: deleteField(),
      voteDeadline: deleteField(),
      ejected: deleteField(),
      leftBy: deleteField(),
      winner: deleteField(),
      winReason: deleteField()
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('[round] could not start the round', error);
    return false;
  }
}

export const endRound = (gameCode) => updateGame(gameCode, {
  gameStarted: false,
  gameEnded: false,
  meetingCalled: false,
  sabotages: {},
  votes: {},
  killCooldowns: {},
  sabotageCooldowns: {},
  revealed: {},
  tasksCompleted: 0,
  kills: {},
  voteLog: [],
  taskCounts: {},
  finishedAt: {},
  endedAt: deleteField(),
  voteDeadline: deleteField(),
  votingResult: deleteField(),
  resultUntil: deleteField(),
  ejected: deleteField()
});

export const returnToLobby = (gameCode) => updateGame(gameCode, {
  gameStarted: false,
  gameEnded: false,
  meetingCalled: false,
  votes: {},
  sabotages: {},
  killCooldowns: {},
  sabotageCooldowns: {},
  revealed: {},
  tasksCompleted: 0,
  kills: {},
  voteLog: [],
  taskCounts: {},
  finishedAt: {},
  endedAt: deleteField(),
  voteDeadline: deleteField(),
  votingResult: deleteField(),
  resultUntil: deleteField(),
  ejected: deleteField(),
  winner: deleteField(),
  winReason: deleteField()
});

// ── round play ─────────────────────────────────────────────

export const endGame = (gameCode, winner, winReason) =>
  updateGame(gameCode, { gameEnded: true, winner, winReason, endedAt: Date.now() });

// Kill and cooldown land in one write, so a cooldown cannot be lost by the
// second write failing after the first succeeded.
export const recordKill = (gameCode, crewmate, playerName, cooldownSeconds, victimRole) =>
  updateGame(gameCode, {
    killList: arrayUnion(crewmate),
    [`revealed.${crewmate}`]: victimRole,
    [`kills.${crewmate}`]: playerName,
    [`killCooldowns.${playerName}`]: cooldownExpiryFor(cooldownSeconds)
  });

export const undoKill = (gameCode, crewmate, playerName) =>
  updateGame(gameCode, {
    killList: arrayRemove(crewmate),
    [`revealed.${crewmate}`]: deleteField(),
    [`kills.${crewmate}`]: deleteField(),
    [`killCooldowns.${playerName}`]: deleteField()
  });

// Published by the player themselves once they are out, since being out makes
// it public anyway and nobody else will be able to read it.
export const publishOwnRole = (gameCode, playerName, role) =>
  updateGame(gameCode, { [`revealed.${playerName}`]: role });

// Task progress lives in a document only its owner can read, so the counts the
// badges need have to be published by each player themselves.
export const publishTaskCount = (gameCode, playerName, done) =>
  updateGame(gameCode, { [`taskCounts.${playerName}`]: done });

// Both facts in one write. Every player publishes at the same moment when a
// round ends, and each write is a snapshot delivered to everybody -- so two
// writes each is quadratic reads for no reason.
export const publishOwnSummary = (gameCode, playerName, role, done) =>
  updateGame(gameCode, {
    [`revealed.${playerName}`]: role,
    ...(typeof done === 'number' ? { [`taskCounts.${playerName}`]: done } : {})
  });

export const publishFinishTime = (gameCode, playerName) =>
  updateGame(gameCode, { [`finishedAt.${playerName}`]: Date.now() });

// Marking the task and crediting the shared total are one commit, decided from
// the server's copy of your list rather than the screen's.
//
// They used to be two writes. The credit was an increment, which always lands;
// the mark was a whole-array overwrite built from whatever the screen last
// showed, which could be a snapshot that had not caught up or one a forced
// resync had just reverted to server state. So the credit stuck and the mark
// did not, and the next tap overwrote the lost one for good -- a round that
// reaches its target with tasks still showing undone.
//
// One shared total rather than a count per player: a traitor having no task
// count would identify them.
export async function toggleTaskCompletion(gameCode, playerName, task) {
  try {
    return await runTransaction(db, async (tx) => {
      const seat = playerRef(gameCode, playerName);
      const snapshot = await tx.get(seat);
      if (!snapshot.exists()) return null;

      const current = snapshot.data().completedTasks || [];
      const wasDone = current.includes(task);
      const next = wasDone ? current.filter((entry) => entry !== task) : [...current, task];

      tx.update(seat, { completedTasks: next });
      tx.update(gameRef(gameCode), { tasksCompleted: increment(wasDone ? -1 : 1) });
      return next;
    });
  } catch (error) {
    console.error('[tasks] could not save progress', error);
    return null;
  }
}

export const startSabotage = (gameCode, imposter, crewmate) =>
  updateGame(gameCode, { [`sabotages.${imposter}`]: { sabotagedPlayer: crewmate } });

export const clearSabotage = (gameCode, imposter) =>
  updateGame(gameCode, {
    [`sabotages.${imposter}`]: deleteField(),
    [`sabotageCooldowns.${imposter}`]: cooldownExpiryFor(SABOTAGE_COOLDOWN_SECONDS)
  });

// ── meetings ───────────────────────────────────────────────

// Freezes both cooldowns for the duration, so a long meeting does not quietly
// serve someone's sabotage cooldown while nobody is playing.
export async function callMeeting(gameCode, playerName) {
  try {
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(gameRef(gameCode));
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const now = Date.now();

      tx.update(gameRef(gameCode), {
        meetingCalled: true,
        meetingCaller: playerName,
        voteDeadline: now + VOTE_DURATION_MS,
        votes: {},
        sabotages: {},
        killCooldowns: pauseCooldowns(data.killCooldowns, now),
        sabotageCooldowns: pauseCooldowns(data.sabotageCooldowns, now),
        votingResult: deleteField(),
        resultUntil: deleteField(),
        ejected: deleteField()
      });
    });
    return true;
  } catch (error) {
    console.warn('[meeting] could not call a meeting', error);
    return false;
  }
}

export const submitVote = (gameCode, playerName, vote) =>
  updateGame(gameCode, { [`votes.${playerName}`]: vote });

export async function markKilledDuringMeeting(gameCode, crewmate, nextKillList, roles, gameDataForOutcome, killerName) {
  const ok = await updateGame(gameCode, {
    killList: nextKillList,
    [`revealed.${crewmate}`]: roles[crewmate],
    // Firestore rejects undefined outright, which would fail the whole write
    // and silently lose the kill rather than just the attribution.
    ...(killerName ? { [`kills.${crewmate}`]: killerName } : {})
  });
  if (!ok) return false;

  const winner = decideOutcomeFromCounts({
    ...gameDataForOutcome,
    killList: nextKillList,
    revealed: { ...(gameDataForOutcome?.revealed || {}), [crewmate]: roles[crewmate] }
  });
  if (winner) {
    await updateGame(gameCode, {
      gameEnded: true,
      winner,
      winReason: 'kills',
      meetingCalled: false,
      voteDeadline: deleteField(),
      resultUntil: deleteField()
    });
  }
  return true;
}

// Any awake client may close the meeting; the transaction makes it happen once.
export async function closeMeeting(gameCode, { force = false } = {}) {
  try {
    await runTransaction(db, async (tx) => {
      const snapshot = await tx.get(gameRef(gameCode));
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      if (!data.meetingCalled) return;
      if (!force && !shouldResolveMeeting(data)) return;

      const { message, votedOut } = resolveVote(data);
      const alive = (data.players || []).filter((p) => !(data.killList || []).includes(p));
      const castThisMeeting = Object.fromEntries(
        Object.entries(data.votes || {}).filter(([voter]) => alive.includes(voter))
      );
      const killList = data.killList || [];
      const nextKillList = votedOut ? [...killList, votedOut] : killList;

      // The ejected player publishes their own role, so the winner cannot be
      // settled in this transaction -- it is decided once that lands.
      const winner = votedOut ? null : decideOutcomeFromCounts(data);

      tx.update(gameRef(gameCode), {
        // Appended rather than unioned: two meetings can genuinely produce the
        // same tally, and arrayUnion would silently drop the second.
        voteLog: [
          ...(data.voteLog || []),
          { caller: data.meetingCaller || null, votes: castThisMeeting, exiled: votedOut || null }
        ],
        meetingCalled: false,
        votingResult: message,
        ejected: votedOut || deleteField(),
        resultUntil: Date.now() + RESULT_DISPLAY_MS,
        killCooldowns: resumeCooldowns(data.killCooldowns),
        sabotageCooldowns: resumeCooldowns(data.sabotageCooldowns),
        voteDeadline: deleteField(),
        ...(votedOut ? { killList: nextKillList } : {}),
        ...(winner ? {
          gameEnded: true,
          winner,
          winReason: winner === 'Crewmates'
            ? 'imposters-ejected'
            : votedOut ? 'ejection' : 'outnumbered'
        } : {})
      });
    });
  } catch (error) {
    console.warn('[voting] could not close the meeting', error);
  }
}
