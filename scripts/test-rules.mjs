import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  arrayUnion, deleteField
} from 'firebase/firestore';

const CODE = 'AB12CD';
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

const seed = async (data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'games', CODE), data);
  });
};

const baseGame = {
  players: ['tyler'],
  creator: 'tyler',
  tasks: [],
  gameStarted: false,
  gameEnded: false,
  meetingCalled: false
};

const anon = testEnv.unauthenticatedContext().firestore();
const alice = testEnv.authenticatedContext('uid-alice').firestore();
const bob = testEnv.authenticatedContext('uid-bob').firestore();

// ── the exposure I demonstrated against the live database ──
await seed({ ...baseGame, roles: { tyler: 'Imposter' } });

await check('signed-out read is denied', assertFails(getDoc(doc(anon, 'games', CODE))));
await check('signed-out write is denied',
  assertFails(updateDoc(doc(anon, 'games', CODE), { players: arrayUnion('intruder') })));
await check('signed-out create is denied',
  assertFails(setDoc(doc(anon, 'games', 'ZZZZZZ'), baseGame)));
await check('signed-out delete is denied', assertFails(deleteDoc(doc(anon, 'games', CODE))));
await check('collection enumeration is denied even when signed in',
  assertFails(getDocs(collection(alice, 'games'))));
await check('other collections are denied outright',
  assertFails(getDoc(doc(alice, 'secrets', 'anything'))));

// ── what the app legitimately does ──
await check('signed-in player can fetch a game by code', assertSucceeds(getDoc(doc(alice, 'games', CODE))));
await check('joining a game is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { players: arrayUnion('sam') })));
await check('adding a task is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { tasks: arrayUnion('Do the dishes') })));
await check('casting a vote is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { 'votes.sam': 'tyler' })));
await check('completing a task is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { 'completedTasks.sam': ['Do the dishes'] })));
await check('recording a kill is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { killList: arrayUnion('sam') })));
await check('clearing a field is allowed',
  assertSucceeds(updateDoc(doc(alice, 'games', CODE), { meetingCaller: deleteField() })));
await check('starting a round is allowed', assertSucceeds(updateDoc(doc(alice, 'games', CODE), {
  roles: { tyler: 'Imposter', sam: 'Crewmate' },
  assignedTasks: { sam: ['Do the dishes'] },
  gameStarted: true,
  gameEnded: false
})));
await check('host can delete the game', assertSucceeds(deleteDoc(doc(alice, 'games', CODE))));

// ── creation shape ──
await check('valid game creation is allowed',
  assertSucceeds(setDoc(doc(alice, 'games', 'QQ11WW'), baseGame)));
await check('a game code of the wrong length is denied',
  assertFails(setDoc(doc(alice, 'games', 'SHORT'), baseGame)));
await check('creating a game you are not the host of is denied',
  assertFails(setDoc(doc(alice, 'games', 'RR22TT'), { ...baseGame, creator: 'someone-else' })));
await check('creating a pre-populated lobby is denied',
  assertFails(setDoc(doc(alice, 'games', 'YY33UU'), { ...baseGame, players: ['tyler', 'sam'] })));

// ── host cannot be hijacked, document cannot be inflated ──
await seed(baseGame);
await check('reassigning the host is denied',
  assertFails(updateDoc(doc(bob, 'games', CODE), { creator: 'bob' })));
await check('exceeding the player cap is denied',
  assertFails(updateDoc(doc(bob, 'games', CODE), {
    players: Array.from({ length: 26 }, (_, i) => `p${i}`)
  })));
await check('exceeding the task cap is denied',
  assertFails(updateDoc(doc(bob, 'games', CODE), {
    tasks: Array.from({ length: 61 }, (_, i) => `t${i}`)
  })));
await check('removing the players field is denied',
  assertFails(updateDoc(doc(bob, 'games', CODE), { players: deleteField() })));

await testEnv.cleanup();

const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} rules checks pass`);
process.exit(failed.length ? 1 : 0);
