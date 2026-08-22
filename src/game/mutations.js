import {
  doc, setDoc, deleteDoc, updateDoc, runTransaction,
  arrayUnion, arrayRemove, deleteField, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { updateGame } from '../db';
import { RESULT_DISPLAY_MS } from '../gameRoute';
import { VOTE_DURATION_MS, decideOutcome, resolveVote, shouldResolveMeeting } from '../voteLogic';

export const GAME_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const MAX_PLAYERS = 25;

const gameRef = (gameCode) => doc(db, 'games', gameCode);
const expiry = () => Timestamp.fromMillis(Date.now() + GAME_LIFETIME_MS);

// ── lifecycle ──────────────────────────────────────────────

export function createGame(gameCode, playerName) {
  return setDoc(gameRef(gameCode), {
    players: [playerName],
    creator: playerName,
    creatorUid: auth.currentUser?.uid || null,
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
  return updateDoc(gameRef(gameCode), { players: arrayUnion(playerName) });
}

export function deleteGame(gameCode) {
  return deleteDoc(gameRef(gameCode));
}

export const kickPlayer = (gameCode, playerName) =>
  updateGame(gameCode, { players: arrayRemove(playerName) });

// ── lobby ──────────────────────────────────────────────────

export const addTask = (gameCode, task) =>
  updateDoc(gameRef(gameCode), { tasks: arrayUnion(task) });

export const removeTask = (gameCode, task) =>
  updateDoc(gameRef(gameCode), { tasks: arrayRemove(task) });

export const updateSetting = (gameCode, field, value) =>
  updateGame(gameCode, { [field]: value });

export const startRound = (gameCode, { roles, assignedTasks, imposterHistory, completedTasks }) =>
  updateGame(gameCode, {
    roles,
    assignedTasks,
    imposterHistory,
    completedTasks,
    killList: [],
    votes: {},
    sabotages: {},
    gameStarted: true,
    gameEnded: false,
    meetingCalled: false,
    expiresAt: expiry(),
    meetingCaller: deleteField(),
    votingResult: deleteField(),
    resultUntil: deleteField(),
    voteDeadline: deleteField(),
    winner: deleteField()
  });

export const endRound = (gameCode) => updateGame(gameCode, {
  gameStarted: false,
  gameEnded: false,
  meetingCalled: false,
  sabotages: {},
  votes: {},
  voteDeadline: deleteField(),
  votingResult: deleteField(),
  resultUntil: deleteField()
});

export const returnToLobby = (gameCode) => updateGame(gameCode, {
  gameStarted: false,
  gameEnded: false,
  meetingCalled: false,
  votes: {},
  sabotages: {},
  voteDeadline: deleteField(),
  votingResult: deleteField(),
  resultUntil: deleteField(),
  winner: deleteField()
});

// ── round play ─────────────────────────────────────────────

export const endGame = (gameCode, winner) =>
  updateGame(gameCode, { gameEnded: true, winner });

export const recordKill = (gameCode, crewmate) =>
  updateGame(gameCode, { killList: arrayUnion(crewmate) });

export const undoKill = (gameCode, crewmate) =>
  updateGame(gameCode, { killList: arrayRemove(crewmate) });

export const setCompletedTasks = (gameCode, playerName, tasks) =>
  updateGame(gameCode, { [`completedTasks.${playerName}`]: tasks });

export const startSabotage = (gameCode, imposter, crewmate) =>
  updateGame(gameCode, { [`sabotages.${imposter}`]: { sabotagedPlayer: crewmate } });

export const clearSabotage = (gameCode, imposter) =>
  updateGame(gameCode, { [`sabotages.${imposter}`]: deleteField() });

// ── meetings ───────────────────────────────────────────────

export const callMeeting = (gameCode, playerName) => updateGame(gameCode, {
  meetingCalled: true,
  meetingCaller: playerName,
  voteDeadline: Date.now() + VOTE_DURATION_MS,
  votes: {},
  sabotages: {},
  votingResult: deleteField(),
  resultUntil: deleteField()
});

export const submitVote = (gameCode, playerName, vote) =>
  updateGame(gameCode, { [`votes.${playerName}`]: vote });

export async function markKilledDuringMeeting(gameCode, crewmate, nextKillList, roles) {
  const ok = await updateGame(gameCode, { killList: nextKillList });
  if (!ok) return false;

  const winner = decideOutcome(roles, nextKillList);
  if (winner) {
    await updateGame(gameCode, {
      gameEnded: true,
      winner,
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
      const killList = data.killList || [];
      const nextKillList = votedOut ? [...killList, votedOut] : killList;
      const winner = decideOutcome(data.roles || {}, nextKillList);

      tx.update(gameRef(gameCode), {
        meetingCalled: false,
        votingResult: message,
        resultUntil: Date.now() + RESULT_DISPLAY_MS,
        voteDeadline: deleteField(),
        ...(votedOut ? { killList: nextKillList } : {}),
        ...(winner ? { gameEnded: true, winner } : {})
      });
    });
  } catch (error) {
    console.warn('[voting] could not close the meeting', error);
  }
}
