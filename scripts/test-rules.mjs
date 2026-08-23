import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  arrayUnion, arrayRemove, deleteField
} from 'firebase/firestore';

const CODE = 'AB12CD';
const HOST = 'uid-host';
const PLAYER = 'uid-player';
const results = [];

const check = async (label, promise) => {
  try {
    await promise;
    results.push([label, true]);
    console.log(`PASS  ${label}`);
  } catch (error) {
    results.push([label, false]);
    console.log(`FAIL  ${label}\n        ${String(error).split('\n')[0]}`);
  }
};

const testEnv = await initializeTestEnvironment({
  projectId: 'rules-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
});

const baseGame = {
  players: ['tyler', 'sam'],
  creator: 'tyler',
  creatorUid: HOST,
  tasks: ['Dishes'],
  roles: { tyler: 'Imposter', sam: 'Crewmate' },
  gameStarted: true,
  gameEnded: false,
  meetingCalled: false
};

const seed = async (data = baseGame) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'games', CODE), data);
  });
};

const anon = testEnv.unauthenticatedContext().firestore();
const host = testEnv.authenticatedContext(HOST).firestore();
const player = testEnv.authenticatedContext(PLAYER).firestore();
const anotherPlayer = testEnv.authenticatedContext('uid-thief').firestore();

// ── unauthenticated access, the original exposure ──
await seed();
await check('signed-out read is denied', assertFails(getDoc(doc(anon, 'games', CODE))));
await check('signed-out write is denied',
  assertFails(updateDoc(doc(anon, 'games', CODE), { players: arrayUnion('x') })));
await check('signed-out delete is denied', assertFails(deleteDoc(doc(anon, 'games', CODE))));
await check('enumeration is denied even when signed in',
  assertFails(getDocs(collection(player, 'games'))));
await check('other collections are denied outright',
  assertFails(getDoc(doc(player, 'secrets', 'x'))));

// ── ordinary play, by a non-host player ──
await check('a player can fetch the game by code', assertSucceeds(getDoc(doc(player, 'games', CODE))));
await check('a player can join', assertSucceeds(updateDoc(doc(player, 'games', CODE), { players: arrayUnion('kai') })));
await check('a player can cast their vote',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), { 'votes.sam': 'tyler' })));
await check('a player can complete a task',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), { 'completedTasks.sam': ['Dishes'] })));
await check('a player can record a kill',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), { killList: arrayUnion('sam') })));
await check('a player can call an emergency meeting',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), {
    meetingCalled: true, meetingCaller: 'sam', voteDeadline: 123, votes: {}, sabotages: {}
  })));
await check('any player can close a meeting (the deadlock fix)',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), {
    meetingCalled: false, votingResult: 'skipped', resultUntil: 456, voteDeadline: deleteField()
  })));
await check('a player can end the game when they detect a win',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), { gameEnded: true, winner: 'Crewmates' })));
await check('a player can sabotage',
  assertSucceeds(updateDoc(doc(player, 'games', CODE), { 'sabotages.tyler': { sabotagedPlayer: 'sam' } })));

// ── what a non-host player must NOT be able to do ──
await seed();
await check('a player cannot reassign roles',
  assertFails(updateDoc(doc(player, 'games', CODE), { roles: { tyler: 'Crewmate', sam: 'Imposter' } })));
await check('a player cannot rewrite task assignments',
  assertFails(updateDoc(doc(player, 'games', CODE), { assignedTasks: { sam: [] } })));
await check('a player cannot start or stop a round',
  assertFails(updateDoc(doc(player, 'games', CODE), { gameStarted: false })));
await check('a player cannot edit the task list',
  assertFails(updateDoc(doc(player, 'games', CODE), { tasks: arrayUnion('rigged') })));
await check('a player cannot change game settings',
  assertFails(updateDoc(doc(player, 'games', CODE), { imposterCount: 5 })));
await check('a player cannot kick anyone',
  assertFails(updateDoc(doc(player, 'games', CODE), { players: arrayRemove('sam') })));
await check('a player cannot delete the game', assertFails(deleteDoc(doc(player, 'games', CODE))));
await check('a player cannot seize the host slot',
  assertFails(updateDoc(doc(player, 'games', CODE), { creatorUid: PLAYER })));
await check('a player cannot rename the host',
  assertFails(updateDoc(doc(player, 'games', CODE), { creator: 'sam' })));

// ── the host can do all of it ──
await check('the host can assign roles',
  assertSucceeds(updateDoc(doc(host, 'games', CODE), { roles: { tyler: 'Crewmate', sam: 'Imposter' } })));
await check('the host can start a round',
  assertSucceeds(updateDoc(doc(host, 'games', CODE), { gameStarted: true, assignedTasks: { sam: ['Dishes'] } })));
await check('the host can edit the task list',
  assertSucceeds(updateDoc(doc(host, 'games', CODE), { tasks: arrayUnion('Sweep') })));
await check('the host can change settings',
  assertSucceeds(updateDoc(doc(host, 'games', CODE), { imposterCount: 2 })));
await check('the host can kick a player',
  assertSucceeds(updateDoc(doc(host, 'games', CODE), { players: arrayRemove('sam') })));
await check('the host can delete the game', assertSucceeds(deleteDoc(doc(host, 'games', CODE))));

// ── creation shape ──
await check('valid creation is allowed', assertSucceeds(setDoc(doc(host, 'games', 'QQ11WW'), {
  players: ['tyler'], creator: 'tyler', creatorUid: HOST, tasks: []
})));
await check('creating a game under someone else uid is denied',
  assertFails(setDoc(doc(host, 'games', 'RR22TT'), {
    players: ['tyler'], creator: 'tyler', creatorUid: PLAYER, tasks: []
  })));
await check('creating without a creatorUid is denied',
  assertFails(setDoc(doc(host, 'games', 'TT44YY'), { players: ['tyler'], creator: 'tyler', tasks: [] })));
await check('a game code of the wrong length is denied',
  assertFails(setDoc(doc(host, 'games', 'SHORT'), {
    players: ['tyler'], creator: 'tyler', creatorUid: HOST, tasks: []
  })));

// ── document cannot be inflated ──
await seed();
await check('exceeding the player cap is denied', assertFails(updateDoc(doc(host, 'games', CODE), {
  players: Array.from({ length: 26 }, (_, i) => `p${i}`)
})));
await check('exceeding the task cap is denied', assertFails(updateDoc(doc(host, 'games', CODE), {
  tasks: Array.from({ length: 61 }, (_, i) => `t${i}`)
})));

// ── private role documents: the point of the whole phase ──
const HOST_SEAT = 'tyler';
const PLAYER_SEAT = 'sam';

await env2Seed();

async function env2Seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'games', CODE), {
      players: ['tyler', 'sam'], creator: 'tyler', creatorUid: HOST,
      playerUids: { tyler: HOST, sam: PLAYER }, gameStarted: true
    });
    await setDoc(doc(db, 'games', CODE, 'players', HOST_SEAT), {
      uid: HOST, role: 'Imposter', tasks: [], roleMap: { tyler: 'Imposter', sam: 'Crewmate' }
    });
    await setDoc(doc(db, 'games', CODE, 'players', PLAYER_SEAT), {
      uid: PLAYER, role: 'Crewmate', tasks: ['Dishes'], completedTasks: []
    });
  });
}

await check('you can read your own role',
  assertSucceeds(getDoc(doc(player, 'games', CODE, 'players', PLAYER_SEAT))));
await check('you CANNOT read another player role',
  assertFails(getDoc(doc(player, 'games', CODE, 'players', HOST_SEAT))));
await check('the host cannot read a player role either',
  assertFails(getDoc(doc(host, 'games', CODE, 'players', PLAYER_SEAT))));
await check('signed-out cannot read any role',
  assertFails(getDoc(doc(anon, 'games', CODE, 'players', PLAYER_SEAT))));
await check('nobody can list the roles collection',
  assertFails(getDocs(collection(player, 'games', CODE, 'players'))));

await check('you can record your own task progress',
  assertSucceeds(updateDoc(doc(player, 'games', CODE, 'players', PLAYER_SEAT), { completedTasks: ['Dishes'] })));
await check('you cannot rewrite your own role',
  assertFails(updateDoc(doc(anon, 'games', CODE, 'players', PLAYER_SEAT), { role: 'Imposter' })));
await check('you cannot touch another player document',
  assertFails(updateDoc(doc(player, 'games', CODE, 'players', HOST_SEAT), { role: 'Crewmate' })));

await check('the host can deal a round',
  assertSucceeds(setDoc(doc(host, 'games', CODE, 'players', 'kai'), { uid: 'uid-kai', role: 'Crewmate', tasks: [] })));
await check('a player cannot deal themselves a role',
  assertFails(setDoc(doc(player, 'games', CODE, 'players', 'rae'), { uid: PLAYER, role: 'Imposter', tasks: [] })));

// ── the deal-time race: a seat dealt before its account was announced ──
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'games', CODE, 'players', 'rae'), {
    uid: null, role: 'Crewmate', tasks: ['Dishes'], completedTasks: []
  });
  await setDoc(doc(db, 'games', CODE, 'players', 'dal'), {
    uid: null, role: 'Crewmate', tasks: [], completedTasks: []
  });
});

await check('an unowned seat can be read, so its player is not locked out',
  assertSucceeds(getDoc(doc(player, 'games', CODE, 'players', 'rae'))));

await check('and claimed by whoever holds it',
  assertSucceeds(updateDoc(doc(player, 'games', CODE, 'players', 'rae'), { uid: PLAYER })));

await check('claiming cannot rewrite the role it came with',
  assertFails(updateDoc(doc(player, 'games', CODE, 'players', 'dal'), { uid: PLAYER, role: 'Imposter' })));

// The host writes every seat when dealing a round, so they can reach them all.
// What must not happen is another player taking one.
await check('another player cannot take an owned seat',
  assertFails(updateDoc(doc(anotherPlayer, 'games', CODE, 'players', PLAYER_SEAT), { uid: 'uid-thief' })));

await testEnv.cleanup();

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} rules checks pass`);
process.exit(failed.length ? 1 : 0);
