import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  BASE, Phone, expectedPath, pause, readGame, readSeat, serve, until
} from './phones.mjs';

const VOTE_MS = Number(process.env.SIM_VOTE_MS || 20000);
const RECOVER_MS = 6000;
const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay'];
const only = [...process.argv.slice(2), ...(process.env.SIM_ONLY || '').split(',').filter(Boolean)];

const results = [];
let current = '';

function record(check, pass, detail = '') {
  results.push({ scenario: current, check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? `  (${detail})` : ''}`);
}

// ── game steps, all through the real UI ──

async function createGame(host) {
  await host.goto('/');
  await host.page.locator('.name-input').fill(host.name);
  await host.button('Create Game').click();
  await host.page.waitForURL(/\/lobby\/[A-Z0-9]{6}$/, { timeout: 15000 });
  return host.path().split('/').pop();
}

async function join(phone, code) {
  await phone.goto(`/j/${code}`);
  await phone.page.locator('.join-input').fill(phone.name);
  await phone.button('Join Game').click();
  await phone.page.waitForURL(/\/lobby\//, { timeout: 15000 });
}

async function setUpLobby(host, code, { tasksEach = 2 } = {}) {
  await host.page.locator('.task-editor summary').click();
  await host.page.getByRole('button', { name: /^Use House pack/ }).click();
  await until(async () => ((await readGame(code)).tasks || []).length > 10, { what: 'pack tasks' });
  await host.page.locator('.task-count-selection select').selectOption(String(tasksEach));
  await host.page.locator('.kill-cooldown-selection select').selectOption('10');
  await until(async () => (await readGame(code)).tasksPerCrewmate === tasksEach, { what: 'tasks each' });
}

async function startRound(host, code) {
  await host.button('Start Game').click();
  await until(async () => (await readGame(code)).gameStarted, { what: 'round to start' });
}

async function seats(code, names) {
  const out = {};
  for (const name of names) out[name] = await readSeat(code, name);
  return out;
}

// Every awake phone on the screen the server says it should be on, showing
// something real rather than a spinner or a missing role.
async function screenProblem(phone, code) {
  const game = await readGame(code);
  const want = expectedPath(game, phone.name, code);
  const have = phone.path();
  if (have !== want) return `on ${have}, should be on ${want}`;
  const text = await phone.text();
  if (/Loading…/.test(text) && text.length < 40) return 'stuck on Loading…';
  if (/Your role has not arrived/.test(text)) return 'role has not arrived';
  if (want.startsWith('/countdown') && !/You are|Assigning roles|Meeting adjourned/.test(text)) {
    return 'round screen without a role';
  }
  return null;
}

async function settled(phones, code, { timeout = RECOVER_MS, label = 'every phone on the right screen' } = {}) {
  const awake = phones.filter((phone) => !phone.asleep);
  const started = Date.now();
  const problems = {};
  await Promise.all(awake.map(async (phone) => {
    try {
      await until(async () => !(await screenProblem(phone, code)), { timeout, what: phone.name });
    } catch {
      problems[phone.name] = await screenProblem(phone, code);
    }
  }));
  const failed = Object.entries(problems).filter(([, problem]) => problem);
  record(label, failed.length === 0,
    failed.length ? failed.map(([name, problem]) => `${name}: ${problem}`).join('; ') : `${Date.now() - started}ms`);
  return failed.length === 0;
}

async function recovers(phone, code, label) {
  const started = Date.now();
  try {
    await until(async () => !(await screenProblem(phone, code)), { timeout: 30000, what: phone.name });
    const ms = Date.now() - started;
    record(label, ms <= RECOVER_MS, `${ms}ms after waking`);
  } catch {
    record(label, false, `still ${await screenProblem(phone, code)} after 30s`);
  }
}

async function waitForRoundScreen(phone) {
  await phone.button('🚨 Emergency Meeting').waitFor({ timeout: 20000 });
}

async function callMeeting(phone, code) {
  await waitForRoundScreen(phone);
  await phone.button('🚨 Emergency Meeting').click();
  await until(async () => (await readGame(code)).meetingCalled, { what: 'meeting to open' });
}

async function vote(phone, target) {
  await phone.page.getByRole('button', { name: target === 'skip' ? 'Skip the vote' : `Vote for ${target}`, exact: true })
    .click({ timeout: 15000 });
  await phone.button('Submit Vote').click();
}

async function doTasks(phone, tasks) {
  for (const task of tasks) {
    await phone.page.getByRole('button', { name: task, exact: true }).click({ timeout: 15000 });
    await pause(300);
  }
}

// A fresh game of six with one traitor, everyone on the round screen.
async function freshRound(browser, { tasksEach = 2 } = {}) {
  const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
  const [host, ...others] = phones;
  const code = await createGame(host);
  for (const phone of others) await join(phone, code);
  await setUpLobby(host, code, { tasksEach });
  await startRound(host, code);
  const dealt = await seats(code, NAMES);
  const traitor = NAMES.find((name) => dealt[name].role === 'Imposter');
  const taskers = NAMES.filter((name) => name !== traitor);
  const byName = Object.fromEntries(phones.map((phone) => [phone.name, phone]));
  return { phones, host, code, dealt, traitor, taskers, byName };
}

// ── scenarios ──

const scenarios = {
  async 'a round with nobody asleep, won on tasks'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000, label: 'everyone sees their role' });
    for (const name of game.taskers) await doTasks(game.byName[name], game.dealt[name].tasks);
    await until(async () => (await readGame(game.code)).gameEnded, { what: 'game over', timeout: 15000 })
      .then(() => record('the round ends on the last task', true))
      .catch(() => record('the round ends on the last task', false));
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone reaches game over' });
    return game.phones;
  },

  async 'asleep when the round starts'(browser) {
    const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
    const [host, ...others] = phones;
    const code = await createGame(host);
    for (const phone of others) await join(phone, code);
    await setUpLobby(host, code);
    const sleeper = phones[4];
    const napper = phones[5];
    await sleeper.sleep({ offline: true });
    await napper.sleep({ offline: false });
    await startRound(host, code);
    await settled(phones, code, { timeout: 15000, label: 'awake phones get the round' });
    await pause(8000);
    await napper.wake();
    await recovers(napper, code, `${napper.name}, screen off briefly, gets the round on waking`);
    await pause(17000);
    await sleeper.wake();
    await recovers(sleeper, code, `${sleeper.name}, locked 25s and offline, gets the round on waking`);
    return phones;
  },

  async 'asleep when a meeting is called'(browser) {
    const game = await freshRound(browser);
    const sleeper = game.byName[game.taskers[3]];
    await settled(game.phones, game.code, { timeout: 15000 });
    await sleeper.sleep();
    const caller = game.byName[game.taskers[0]];
    await callMeeting(caller, game.code);
    await settled(game.phones, game.code, { label: 'awake phones go to the meeting' });
    for (const phone of game.phones) {
      if (phone !== sleeper) await vote(phone, 'skip');
    }
    await pause(5000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} wakes into the meeting`);
    await vote(sleeper, 'skip');
    await until(async () => !(await readGame(game.code)).meetingCalled, { what: 'meeting to close', timeout: 8000 })
      .then(({ ms }) => record('the last vote closes the meeting', true, `${ms}ms`))
      .catch(() => record('the last vote closes the meeting', false));
    await pause(6500);
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone back on the round' });
    return game.phones;
  },

  async 'stalled connection through a meeting and its result'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const sleeper = game.byName[game.taskers[3]];
    await sleeper.sleep({ stall: true });
    await callMeeting(game.byName[game.taskers[0]], game.code);
    for (const phone of game.phones) if (phone !== sleeper) await vote(phone, 'skip');
    await pause(8000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name}, connection stalled, wakes into the meeting`);
    await vote(sleeper, 'skip').catch(() => {});
    await until(async () => !(await readGame(game.code)).meetingCalled, { what: 'close', timeout: VOTE_MS + 10000 });
    await pause(6500);
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone back on the round, stalled phone included' });

    await sleeper.sleep({ stall: true });
    await doTasks(game.byName[game.taskers[0]], game.dealt[game.taskers[0]].tasks.slice(0, 1));
    await pause(40000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name}, stalled 40s, comes back onto the round`);
    const { tasksCompleted } = await readGame(game.code);
    await until(async () => (await sleeper.text()).includes(`${Math.round((tasksCompleted / 10) * 100)}%`), { timeout: 8000, what: 'progress' })
      .then(({ ms }) => record('it sees what happened while it was stalled', true, `${ms}ms`))
      .catch(() => record('it sees what happened while it was stalled', false));
    return game.phones;
  },

  async 'connection dies silently with the screen on'(browser) {
    const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
    const [host, ...others] = phones;
    const code = await createGame(host);
    for (const phone of others) await join(phone, code);
    await setUpLobby(host, code);
    const victim = phones[3];
    const hung = [];
    await victim.context.route(/:8080\//, (route) => hung.push(route));
    await pause(3000);
    await startRound(host, code);
    await pause(Number(process.env.SIM_DEAD_MS || 20000));
    const stuck = await screenProblem(victim, code);
    if (process.env.SIM_DEBUG) console.log((await victim.text()).slice(0, 300), '\n', victim.logs.join('\n'), '\nhung:', hung.length);
    record('while dead, the phone at least says it has lost the connection',
      /connection|reconnect|offline/i.test(await victim.text()), stuck || 'not stuck');
    await victim.context.unroute(/:8080\//);
    const started = Date.now();
    await until(async () => !(await screenProblem(victim, code)), { timeout: 30000, what: 'recovery' })
      .then(() => record('once the network answers again it catches up', Date.now() - started <= 8000, `${Date.now() - started}ms`))
      .catch(async () => record('once the network answers again it catches up', false, await screenProblem(victim, code)));
    await settled(phones, code, { timeout: 8000 });
    hung.forEach((route) => route.abort().catch(() => {}));
    return phones;
  },

  async 'tab thrown away while locked'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const sleeper = game.byName[game.taskers[2]];
    await sleeper.sleep();
    await callMeeting(game.byName[game.taskers[0]], game.code);
    await pause(4000);
    await sleeper.wake({ discarded: true });
    await recovers(sleeper, game.code, `${sleeper.name}'s reopened tab lands in the meeting`);
    await vote(sleeper, 'skip')
      .then(() => record('it can still vote', true))
      .catch(() => record('it can still vote', false));
    return game.phones;
  },

  async 'time runs out with everyone awake'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    await callMeeting(game.byName[game.taskers[0]], game.code);
    await vote(game.byName[game.taskers[1]], 'skip');
    const { voteDeadline } = await readGame(game.code);
    await until(async () => !(await readGame(game.code)).meetingCalled, {
      what: 'meeting to close', timeout: VOTE_MS + 30000, every: 200
    });
    const lag = Date.now() - voteDeadline;
    record('the vote closes when its time runs out', lag <= 4000, `${lag}ms after the deadline`);
    return game.phones;
  },

  async 'host asleep when time runs out'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const caller = game.byName[game.taskers.find((name) => name !== 'Ava')];
    await callMeeting(caller, game.code);
    await game.host.sleep();
    const { voteDeadline } = await readGame(game.code);
    await until(async () => !(await readGame(game.code)).meetingCalled, {
      what: 'meeting to close', timeout: VOTE_MS + 30000, every: 200
    });
    const lag = Date.now() - voteDeadline;
    record('the other phones close the vote without the host', lag <= 6000, `${lag}ms after the deadline`);
    await pause(6000);
    await game.host.wake();
    await recovers(game.host, game.code, 'the host wakes onto the round');
    return game.phones;
  },

  async 'asleep through the exile'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const [caller, target, , sleeperName] = game.taskers;
    const sleeper = game.byName[sleeperName];
    await callMeeting(game.byName[caller], game.code);
    await sleeper.sleep();
    for (const phone of game.phones) {
      if (phone !== sleeper && phone.name !== target) await vote(phone, target);
    }
    await vote(game.byName[target], 'skip');
    await until(async () => !(await readGame(game.code)).meetingCalled, { what: 'meeting to close', timeout: VOTE_MS + 15000 });
    const textDuringResult = await game.byName[caller].text();
    record('the exile is shown', /was exiled/.test(textDuringResult));
    await pause(9000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} skips the stale result and lands on the round`);
    return game.phones;
  },

  async 'the lone traitor is exiled with their phone locked'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const traitor = game.byName[game.traitor];
    await callMeeting(game.byName[game.taskers[0]], game.code);
    await vote(traitor, 'skip');
    await traitor.sleep();
    for (const name of game.taskers) await vote(game.byName[name], game.traitor);
    await until(async () => (await readGame(game.code)).ejected === game.traitor, { what: 'exile', timeout: VOTE_MS + 15000 });

    const watcher = game.byName[game.taskers[0]];
    let sawWrongVerdict = false;
    let sawWaiting = false;
    for (let i = 0; i < 16; i++) {
      const text = await watcher.text();
      if (/were not the Traitor/.test(text)) sawWrongVerdict = true;
      if (/Waiting for .*phone/.test(text)) sawWaiting = true;
      await pause(300);
    }
    record('nobody is told the traitor was innocent', !sawWrongVerdict);
    record('the room is told whose phone it is waiting on', sawWaiting);

    await pause(4000);
    const waitingOnRound = /Waiting for .*phone/.test(await watcher.text());
    record('the round screen keeps naming the phone it needs', waitingOnRound);

    await traitor.wake();
    await until(async () => (await readGame(game.code)).gameEnded, { what: 'game over', timeout: 15000 })
      .then(({ ms }) => record('the round ends once that phone wakes', true, `${ms}ms`))
      .catch(() => record('the round ends once that phone wakes', false));
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone reaches game over' });
    return game.phones;
  },

  async 'a stale screen presses Emergency Meeting mid-vote'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const stale = game.byName[game.taskers[3]];
    await waitForRoundScreen(stale);
    await stale.sleep();
    const caller = game.byName[game.taskers[0]];
    await callMeeting(caller, game.code);
    await vote(game.byName[game.taskers[1]], 'skip');
    await vote(game.byName[game.taskers[2]], 'skip');
    await until(async () => Object.keys((await readGame(game.code)).votes || {}).length >= 2, { what: 'votes' });
    await pause(1500);
    await stale.wake();
    await stale.button('🚨 Emergency Meeting').click({ timeout: 500 }).catch(() => {});
    await pause(2500);
    const after = await readGame(game.code);
    record('votes already cast survive', Object.keys(after.votes || {}).length >= 2, `${Object.keys(after.votes || {}).length} votes`);
    record('the meeting keeps its caller', after.meetingCaller === caller.name, `caller ${after.meetingCaller}`);
    return game.phones;
  },

  async 'reload mid-vote'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const voter = game.byName[game.taskers[1]];
    await callMeeting(game.byName[game.taskers[0]], game.code);
    await vote(voter, 'skip');
    await voter.reload();
    await until(async () => /You skipped voting/.test(await voter.text()), { timeout: 10000, what: 'kept vote' })
      .then(({ ms }) => record('the vote is still there after a reload', true, `${ms}ms`))
      .catch(() => record('the vote is still there after a reload', false));
    return game.phones;
  },

  async 'back in from a different browser mid-round'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const name = game.taskers[2];
    await game.byName[name].close();
    const fresh = await new Phone(browser, name).open();
    game.phones[game.phones.indexOf(game.byName[name])] = fresh;
    await fresh.goto(`/j/${game.code}`);
    await fresh.page.locator('.join-input').fill(name);
    await fresh.button('Join Game').click();
    await fresh.button(`That's me — take ${name}'s seat`).click({ timeout: 8000 });
    await game.host.button(`Let ${name} back in`).click({ timeout: 8000 })
      .then(() => record('the host is asked to let them back in', true))
      .catch(() => record('the host is asked to let them back in', false));
    await recovers(fresh, game.code, `${name} sees their role in the new browser`);
    const task = game.dealt[name].tasks[0];
    await fresh.page.getByRole('button', { name: task, exact: true }).click({ timeout: 5000 }).catch(() => {});
    await until(async () => ((await readSeat(game.code, name)).completedTasks || []).includes(task), { timeout: 8000, what: 'task' })
      .then(() => record(`${name} can tick a task from the new browser`, true))
      .catch(() => record(`${name} can tick a task from the new browser`, false));
    return game.phones;
  },

  async 'back in from a different browser in the lobby'(browser) {
    const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
    const [host, ...others] = phones;
    const code = await createGame(host);
    for (const phone of others) await join(phone, code);
    await setUpLobby(host, code);
    const name = 'Fay';
    await phones[5].close();
    const fresh = await new Phone(browser, name).open();
    phones[5] = fresh;
    await fresh.goto(`/j/${code}`);
    await fresh.page.locator('.join-input').fill(name);
    await fresh.button('Join Game').click();
    const claim = fresh.button(`That's me — take ${name}'s seat`);
    await claim.click({ timeout: 5000 })
      .then(() => record('the lobby offers the old seat back', true))
      .catch(() => record('the lobby offers the old seat back', false));
    await host.button(`Let ${name} back in`).click({ timeout: 8000 }).catch(() => {});
    await fresh.page.waitForURL(/\/lobby\//, { timeout: 8000 }).catch(() => {});
    const game = await readGame(code);
    record('no ghost seat is left behind', game.players.length === 6, `${game.players.length} seats`);
    await startRound(host, code);
    await recovers(fresh, code, `${name} gets a role in the new browser`);
    return phones;
  },

  async 'somebody types another player\'s name on a spare phone'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const victim = game.traitor;
    const spy = await new Phone(browser, victim).open();
    await spy.goto(`/j/${game.code}`);
    await spy.page.locator('.join-input').fill(victim);
    await spy.button('Join Game').click();
    await spy.button(`That's me — take ${victim}'s seat`).click({ timeout: 8000 });
    await game.host.button('Not them').click({ timeout: 8000 });
    await until(async () => /did not let you in/.test(await spy.text()), { timeout: 8000, what: 'refusal' })
      .then(() => record('the spare phone is told no', true))
      .catch(() => record('the spare phone is told no', false));
    record('the spare phone never reaches the round', !spy.path().startsWith('/countdown'));
    const seat = await readSeat(game.code, victim);
    record('the real player keeps their seat', seat.uid !== null && (await readGame(game.code)).playerUids[victim] === seat.uid);
    await settled(game.phones, game.code, { timeout: 5000, label: 'the real players are undisturbed' });
    await spy.close();
    return game.phones;
  },

  async 'asleep when the game ends, then a new round'(browser) {
    const game = await freshRound(browser, { tasksEach: 1 });
    await settled(game.phones, game.code, { timeout: 15000 });
    const sleeper = game.byName[game.taskers[4]];
    await sleeper.sleep();
    for (const name of game.taskers) {
      if (game.byName[name] !== sleeper) await doTasks(game.byName[name], game.dealt[name].tasks);
    }
    await callMeeting(game.byName[game.taskers[0]], game.code);
    for (const name of game.taskers) {
      if (game.byName[name] !== sleeper) await vote(game.byName[name], game.traitor);
    }
    await vote(game.byName[game.traitor], 'skip');
    await until(async () => (await readGame(game.code)).gameEnded, { what: 'game over', timeout: VOTE_MS + 15000 });
    await settled(game.phones, game.code, { timeout: 12000, label: 'awake phones reach game over' });
    await pause(5000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} wakes onto game over`);

    await sleeper.sleep();
    await game.host.button('End Game and Return to Lobby').click();
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone back in the lobby' });
    await pause(1500);
    await startRound(game.host, game.code);
    await settled(game.phones, game.code, { timeout: 15000, label: 'the second round reaches every awake phone' });
    await pause(10000);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} slept through the lobby and wakes into round two`);
    return game.phones;
  },

  async 'locked for over a minute while the game moves on'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const sleeper = game.byName[game.taskers[4]];
    await sleeper.sleep();
    await pause(20000);
    await callMeeting(game.byName[game.taskers[0]], game.code);
    for (const phone of game.phones) if (phone !== sleeper) await vote(phone, 'skip');
    await pause(VOTE_MS + 10000);
    await pause(Math.max(0, 70000 - VOTE_MS - 30000));
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} wakes after 70s onto the round`);
    await doTasks(game.byName[game.taskers[0]], game.dealt[game.taskers[0]].tasks.slice(0, 1));
    const { tasksCompleted } = await readGame(game.code);
    await until(async () => (await sleeper.text()).includes(`${Math.round((tasksCompleted / (5 * 2)) * 100)}%`), { timeout: 8000, what: 'progress' })
      .then(({ ms }) => record('live updates reach it again afterwards', true, `${ms}ms`))
      .catch(() => record('live updates reach it again afterwards', false));
    return game.phones;
  }
};

// ── run ──

const server = await serve('build-sim');
const browser = await chromium.launch({ headless: process.env.SIM_HEADED !== '1' });
await mkdir('sim-results', { recursive: true });

for (const [name, run] of Object.entries(scenarios)) {
  if (only.length && !only.some((word) => name.includes(word))) continue;
  current = name;
  console.log(`\n▶ ${name}`);
  let phones = [];
  try {
    phones = await run(browser);
  } catch (error) {
    record('scenario ran to the end', false, error.message.split('\n')[0]);
  }
  const failed = results.some((r) => r.scenario === name && !r.pass);
  if (failed) {
    const slug = name.replace(/[^a-z0-9]+/gi, '-');
    for (const phone of phones || []) {
      if (!phone?.page || phone.page.isClosed()) continue;
      if (phone.asleep) await phone.wake().catch(() => {});
      await phone.page.screenshot({ path: `sim-results/${slug}-${phone.name}.png` }).catch(() => {});
      if (phone.logs.length) await writeFile(`sim-results/${slug}-${phone.name}.log`, phone.logs.join('\n'));
    }
  }
  await Promise.all((phones || []).map((phone) => phone?.close()));
}

await browser.close();
server.close();

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks pass`);
failures.forEach((r) => console.log(`  FAIL  [${r.scenario}] ${r.check}  ${r.detail}`));
await writeFile('sim-results/summary.json', JSON.stringify(results, null, 2));
process.exit(failures.length ? 1 : 0);
