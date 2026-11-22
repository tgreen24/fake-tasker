import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { Phone, pause, readGame, readSeat, serve, until } from './phones.mjs';
import {
  NAMES as ALL_NAMES, callMeeting, createGame, doTasks, enableLockdown, enterLockdownCode, join, minigameOf,
  openMinigameTask, playMinigameTask, screenProblem, seats, setTaskStyle, setUpLobby, solveLockdownPuzzle,
  startLockdown, startRound, taskRow, vote, waitForRoundScreen
} from './game.mjs';
import { makeSolvers } from './solvers.mjs';

const solvers = makeSolvers();

const VOTE_MS = Number(process.env.SIM_VOTE_MS || 20000);
const RECOVER_MS = 6000;
const NAMES = ALL_NAMES.slice(0, 6);
const only = [...process.argv.slice(2), ...(process.env.SIM_ONLY || '').split(',').filter(Boolean)];

const results = [];
let current = '';

function record(check, pass, detail = '') {
  results.push({ scenario: current, check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? `  (${detail})` : ''}`);
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

// A fresh game of six with one traitor, everyone on the round screen.
async function freshRound(browser, {
  tasksEach = 2, traitors = 1, lockdown = false, taskStyle = null, names: NAMES = ALL_NAMES.slice(0, 6)
} = {}) {
  const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
  const [host, ...others] = phones;
  const code = await createGame(host);
  for (const phone of others) await join(phone, code);
  await setUpLobby(host, code, { tasksEach });
  if (traitors > 1) {
    await host.page.locator('.imposter-select select').selectOption(String(traitors));
    await until(async () => (await readGame(code)).imposterCount === traitors, { what: 'traitor count' });
  }
  if (lockdown) await enableLockdown(host, code);
  if (taskStyle) await setTaskStyle(host, code, taskStyle);
  await startRound(host, code);
  const dealt = await seats(code, NAMES);
  const traitor = NAMES.find((name) => dealt[name].role === 'Imposter');
  const traitorNames = NAMES.filter((name) => dealt[name].role === 'Imposter');
  const taskers = NAMES.filter((name) => dealt[name].role !== 'Imposter');
  const byName = Object.fromEntries(phones.map((phone) => [phone.name, phone]));
  return { phones, host, code, dealt, traitor, traitorNames, taskers, byName };
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

  async 'lockdown lifted by passing codes between screens'(browser) {
    const game = await freshRound(browser, { lockdown: true, names: ALL_NAMES });
    await settled(game.phones, game.code, { timeout: 15000, label: 'everyone sees their role' });
    await startLockdown(game.byName[game.traitor], game.code);
    const { lockdown } = await readGame(game.code);
    const missing = [];
    await Promise.all(game.phones.map((phone) => until(async () => (await phone.page.locator('.lockdown').count()) > 0, { timeout: 6000, what: phone.name })
      .catch(async () => missing.push(`${phone.name}: ${(await phone.text()).slice(0, 120).replace(/\s+/g, ' ')}`))));
    record('every phone shows the lockdown', missing.length === 0, missing.join(' | '));
    record('nobody can call a meeting during it',
      (await game.byName[game.taskers[0]].button('🚨 Emergency Meeting').count()) === 0);
    const tasker = game.byName[game.taskers[0]];
    record('taskers cannot tick off tasks during it',
      (await tasker.page.locator('.task-list').count()) === 0 && /tasks are locked/.test(await tasker.text()));

    const taskerPairs = lockdown.pairs.filter((pair) => game.taskers.includes(pair.giver)
      && pair.receivers.some((name) => game.taskers.includes(name)));
    record('taskers have enough pairs to lift it alone', taskerPairs.length >= lockdown.needed,
      `${taskerPairs.length} tasker pairs, ${lockdown.needed} needed`);

    const passCode = async (pair, { lockFirst = false } = {}) => {
      const giver = game.byName[pair.giver];
      const receiver = game.byName[pair.receivers.find((name) => game.taskers.includes(name))];
      if (lockFirst) {
        await receiver.sleep();
        await pause(8000);
        await receiver.wake();
      }
      await solveLockdownPuzzle(giver);
      const shown = (await giver.page.locator('.lockdown-code').innerText()).trim();
      await solveLockdownPuzzle(receiver);
      return { receiver, shown };
    };

    const first = await passCode(taskerPairs[0]);
    await enterLockdownCode(first.receiver, 'ZZZ-ZZZ');
    await first.receiver.page.getByText("That's not the code.").waitFor({ timeout: 8000 })
      .then(() => record('a wrong code is turned away', true))
      .catch(() => record('a wrong code is turned away', false));
    await enterLockdownCode(first.receiver, first.shown.toLowerCase());
    await first.receiver.page.getByText('Your code is in').waitFor({ timeout: 8000 })
      .then(() => record('the code read off the giver\'s screen is accepted, typed in lower case', true))
      .catch(() => record('the code read off the giver\'s screen is accepted, typed in lower case', false));

    for (const pair of taskerPairs.slice(1, lockdown.needed)) {
      const next = await passCode(pair, { lockFirst: true });
      await enterLockdownCode(next.receiver, next.shown);
    }

    await until(async () => !(await readGame(game.code)).lockdown, { timeout: 8000, what: 'lifted' })
      .then(({ ms }) => record('enough codes lift it', true, `${ms}ms`))
      .catch(() => record('enough codes lift it', false));
    await Promise.all(game.phones.map((phone) => until(async () => /Lockdown lifted/.test(await phone.text()), { timeout: 6000, what: phone.name })))
      .then(() => record('every phone says it was lifted', true))
      .catch(() => record('every phone says it was lifted', false));
    const after = await readGame(game.code);
    record('the round carries on, with the lockdown cooling down', !after.gameEnded && !!after.lockdownCooldown);
    record('the traitor sees no lockdown button while it cools down',
      (await game.byName[game.traitor].button('Lockdown').count()) === 0);
    await until(async () => (await game.byName[game.traitor].button('Lockdown').count()) > 0, { timeout: 12000, what: 'button back' })
      .then(() => record('the button comes back once it is ready', true))
      .catch(() => record('the button comes back once it is ready', false));
    await until(async () => (await tasker.page.locator('.task-list').count()) > 0, { timeout: 6000, what: 'tasks back' })
      .then(() => record('tasks come back once it is lifted', true))
      .catch(() => record('tasks come back once it is lifted', false));
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone back on the round' });
    return game.phones;
  },

  async 'lockdown runs out while a phone is locked'(browser) {
    const game = await freshRound(browser, { lockdown: true });
    await settled(game.phones, game.code, { timeout: 15000 });
    const sleeper = game.byName[game.taskers[1]];
    await sleeper.sleep();
    await startLockdown(game.byName[game.traitor], game.code);
    const { lockdown } = await readGame(game.code);
    await until(async () => (await readGame(game.code)).gameEnded, { timeout: lockdown.until - Date.now() + 12000, what: 'traitors win' })
      .then(({ value }) => record('the traitors win when time runs out', true, `${Math.round((Date.now() - lockdown.until) / 100) / 10}s after the deadline`))
      .catch(() => record('the traitors win when time runs out', false));
    const ended = await readGame(game.code);
    record('it is put down to the lockdown', ended.winner === 'Imposters' && ended.winReason === 'lockdown', `${ended.winner} / ${ended.winReason}`);
    await sleeper.wake();
    await recovers(sleeper, game.code, `${sleeper.name} wakes onto game over`);
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone reaches game over' });
    record('game over says why', /lockdown was never lifted/.test(await game.host.text()));
    return game.phones;
  },

  async 'traitors see who made each kill, and bringing someone back takes two taps'(browser) {
    // Enough players that two kills still leave the taskers ahead.
    const game = await freshRound(browser, { traitors: 2, names: ALL_NAMES.slice(0, 8) });
    await settled(game.phones, game.code, { timeout: 15000 });
    const [a, b] = game.traitorNames;
    const [victim, other] = game.taskers;
    const targets = (name) => game.byName[name].page.locator('.kill-list');
    const row = (name, who) => targets(name).getByRole('button', { name: new RegExp(`^${who}(,|$)`) });

    await targets(b).getByRole('button', { name: other, exact: true }).click();
    await until(async () => ((await readGame(game.code)).killList || []).includes(other), { what: `${b}'s kill` });
    await targets(a).getByRole('button', { name: victim, exact: true }).click();
    await until(async () => ((await readGame(game.code)).killList || []).includes(victim), { what: `${a}'s kill` });

    await row(b, victim).getByText(`killed by ${a}`).waitFor({ timeout: 5000 })
      .then(() => record('a teammate sees who made the kill', true))
      .catch(() => record('a teammate sees who made the kill', false));
    record('the killer sees it as theirs', (await row(a, victim).getByText('killed by you').count()) === 1);

    await row(b, victim).click();
    await pause(1500);
    record('one tap does not bring them back', ((await readGame(game.code)).killList || []).includes(victim));
    record('it asks for a second tap, naming who marked it',
      (await row(b, victim).getByText(`${a} marked this. Tap again to bring ${victim} back`).count()) === 1);

    const cooldownB = (await readGame(game.code)).killCooldowns?.[b];
    await row(b, victim).click();
    await until(async () => !((await readGame(game.code)).killList || []).includes(victim), { what: 'brought back' })
      .then(() => record('a second tap brings them back', true))
      .catch(() => record('a second tap brings them back', false));
    const after = (await readGame(game.code)).killCooldowns || {};
    record('the killer gets their cooldown back, not the teammate who tapped',
      !after[a] && JSON.stringify(after[b]) === JSON.stringify(cooldownB), JSON.stringify(after));
    return game.phones;
  },

  async 'a kill during lockdown changes nobody else\'s screen'(browser) {
    const game = await freshRound(browser, { lockdown: true, names: ALL_NAMES });
    await settled(game.phones, game.code, { timeout: 15000 });
    await startLockdown(game.byName[game.traitor], game.code);
    const { lockdown } = await readGame(game.code);
    const pair = lockdown.pairs.find((p) => game.taskers.includes(p.giver) && p.receivers.every((n) => game.taskers.includes(n)));
    const receiver = game.byName[pair.receivers[0]];
    await solveLockdownPuzzle(receiver);
    const watcher = game.phones.find((phone) => phone.name !== pair.giver && !pair.receivers.includes(phone.name));
    const before = await receiver.page.locator('.lockdown-entry').innerText();
    const countBefore = (await watcher.page.locator('.lockdown-count').innerText()).trim();

    await game.byName[game.traitor].page.locator('.kill-list').getByRole('button', { name: pair.giver, exact: true }).click();
    await until(async () => ((await readGame(game.code)).killList || []).includes(pair.giver), { what: 'kill' });
    await pause(3000);
    const afterText = await receiver.page.locator('.lockdown-entry').innerText().catch(() => '(gone)');
    record('the partner of the one killed still sees the same thing', afterText === before, afterText.slice(0, 60));
    const countAfter = (await watcher.page.locator('.lockdown-count').innerText().catch(() => '')).trim();
    record('the pair counts as done', countAfter !== countBefore || !(await readGame(game.code)).lockdown, `${countBefore} → ${countAfter || 'lifted'}`);
    return game.phones;
  },

  async 'a round won on minigame tasks alone'(browser) {
    const game = await freshRound(browser, { taskStyle: 'minigames' });
    await settled(game.phones, game.code, { timeout: 15000, label: 'everyone sees their role' });
    const first = game.taskers[0];
    const hand = game.dealt[first].tasks;
    record('every tasker was dealt only minigames', game.taskers.every((name) => game.dealt[name].tasks.every(minigameOf)));
    await playMinigameTask(game.byName[first], hand[0], solvers);
    const afterOne = (await readGame(game.code)).tasksCompleted;
    record('winning a minigame counts the task', afterOne === 1, `total ${afterOne}`);
    await taskRow(game.byName[first], hand[0]).click();
    await pause(1500);
    record('a won minigame cannot be unticked', (await readGame(game.code)).tasksCompleted === 1);
    for (const name of game.taskers) {
      for (const task of game.dealt[name].tasks) {
        if (name === first && task === hand[0]) continue;
        await playMinigameTask(game.byName[name], task, solvers);
      }
    }
    await until(async () => (await readGame(game.code)).gameEnded, { what: 'game over', timeout: 15000 })
      .then(async () => record('the round ends on the last minigame', (await readGame(game.code)).winReason === 'tasks'))
      .catch(() => record('the round ends on the last minigame', false));
    await settled(game.phones, game.code, { timeout: 8000, label: 'everyone reaches game over' });
    return game.phones;
  },

  async 'a traitor\'s cover list never counts'(browser) {
    const game = await freshRound(browser, { taskStyle: 'mixed', tasksEach: 2 });
    await settled(game.phones, game.code, { timeout: 15000 });
    const traitor = game.byName[game.traitor];
    const cover = game.dealt[game.traitor].fakeTasks;
    record('the traitor was dealt a mixed cover list', cover.length === 2 && cover.filter(minigameOf).length === 1,
      cover.join(' | '));
    record('the traitor starts on the targets screen', (await traitor.page.getByText('Targets').count()) > 0);
    await traitor.button('Switch').click();
    record('Switch shows a task list instead', (await traitor.page.getByText('Your Tasks').count()) > 0
      && (await traitor.page.locator('.kill-list').count()) === 0);
    const chore = cover.find((task) => !minigameOf(task));
    await taskRow(traitor, chore).click();
    await playMinigameTask(traitor, cover.find(minigameOf), solvers);
    await pause(1500);
    const { tasksCompleted } = await readGame(game.code);
    const seat = await readSeat(game.code, game.traitor);
    record('the cover tasks are saved as done', (seat.fakeCompleted || []).length === 2, (seat.fakeCompleted || []).join(' | '));
    record('and the progress bar never moved', tasksCompleted === 0, `total ${tasksCompleted}`);
    await traitor.reload();
    await traitor.button('Switch').click({ timeout: 15000 });
    record('they are still done after a reload', (await traitor.page.locator('.task-item.selected').count()) === 2);
    await traitor.button('Switch').click();
    record('Switch goes back to the targets', (await traitor.page.locator('.kill-list').count()) === 1);
    return game.phones;
  },

  async 'a minigame closes and starts over when interrupted'(browser) {
    const game = await freshRound(browser, { taskStyle: 'minigames', lockdown: true });
    await settled(game.phones, game.code, { timeout: 15000 });
    const phone = game.byName[game.taskers[0]];
    const [task] = game.dealt[phone.name].tasks;
    const overlay = phone.page.locator('.minigame-overlay');

    await openMinigameTask(phone, task);
    await phone.sleep();
    await pause(3000);
    await phone.wake();
    await overlay.waitFor({ state: 'detached', timeout: 5000 })
      .then(() => record('locking the phone closes the minigame', true))
      .catch(() => record('locking the phone closes the minigame', false));
    await taskRow(phone, task).click();
    record('opening it again starts fresh', (await phone.button('Start').count()) === 1);
    await phone.button('Start').click();

    await callMeeting(game.byName[game.taskers[1]], game.code);
    await overlay.waitFor({ state: 'detached', timeout: 8000 })
      .then(() => record('a meeting closes the minigame', true))
      .catch(() => record('a meeting closes the minigame', false));
    for (const other of game.phones) await vote(other, 'skip').catch(() => {});
    await until(async () => !(await readGame(game.code)).meetingCalled, { what: 'meeting over', timeout: VOTE_MS + 10000 });
    await waitForRoundScreen(phone).catch(() => {});
    await pause(6500);

    await openMinigameTask(phone, task);
    await startLockdown(game.byName[game.traitor], game.code);
    await overlay.waitFor({ state: 'detached', timeout: 6000 })
      .then(() => record('a lockdown closes the minigame', true))
      .catch(() => record('a lockdown closes the minigame', false));
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

  async 'the old browser cannot take the seat back'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const name = game.taskers[2];
    const old = game.byName[name];
    const fresh = await new Phone(browser, name).open();
    await fresh.goto(`/j/${game.code}`);
    await fresh.page.locator('.join-input').fill(name);
    await fresh.button('Join Game').click();
    await fresh.button(`That's me — take ${name}'s seat`).click({ timeout: 8000 });
    await game.host.button(`Let ${name} back in`).click({ timeout: 8000 });
    await recovers(fresh, game.code, `${name} plays from the new browser`);
    const handedTo = (await readGame(game.code)).playerUids[name];
    await old.reload();
    await pause(5000);
    record('the old tab leaves the seat where the host put it', (await readGame(game.code)).playerUids[name] === handedTo);
    record('the old tab offers to ask for it instead', /in use on another phone/.test(await old.text()));
    record('the new browser still has its role', !(await screenProblem(fresh, game.code)));
    await fresh.close();
    return game.phones;
  },

  async 'sent to the home screen mid-round'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const lost = game.byName[game.taskers[1]];
    await lost.goto('/');
    await lost.button(`Back to game ${game.code} as ${lost.name}`).click({ timeout: 8000 })
      .then(() => record('home offers the way back', true))
      .catch(() => record('home offers the way back', false));
    await recovers(lost, game.code, 'one tap puts them back in the round');
    return game.phones;
  },

  async 'a vote sent over a dead connection'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const voter = game.byName[game.taskers[1]];
    await callMeeting(game.byName[game.taskers[0]], game.code);
    await voter.page.getByRole('button', { name: 'Skip the vote', exact: true }).click({ timeout: 15000 });
    const hung = [];
    await voter.context.route(/:8080\//, (route) => hung.push(route));
    await voter.button('Submit Vote').click();
    await pause(2000);
    record('the voter is told it is still sending', /Sending your vote/.test(await voter.text()));
    record('and it really has not arrived', !((await readGame(game.code)).votes || {})[voter.name]);
    await voter.context.unroute(/:8080\//);
    await until(async () => ((await readGame(game.code)).votes || {})[voter.name], { timeout: 20000, what: 'vote' })
      .then(({ ms }) => record('the vote arrives once the connection is back', true, `${ms}ms`))
      .catch(() => record('the vote arrives once the connection is back', false));
    await until(async () => /You skipped voting/.test(await voter.text()), { timeout: 8000, what: 'confirmed' })
      .then(() => record('and the screen says so', true))
      .catch(() => record('and the screen says so', false));
    hung.forEach((route) => route.abort().catch(() => {}));
    return game.phones;
  },

  async 'opening the game with no way to reach it'(browser) {
    const game = await freshRound(browser);
    await settled(game.phones, game.code, { timeout: 15000 });
    const phone = game.byName[game.taskers[3]];
    const hung = [];
    await phone.context.route(/:8080\//, (route) => hung.push(route));
    await phone.reload();
    await until(async () => /Can't reach game/.test(await phone.text()), { timeout: 25000, what: 'way out' })
      .then(({ ms }) => record('it offers Try Again and Leave instead of loading forever', true, `${ms}ms`))
      .catch(async () => record('it offers Try Again and Leave instead of loading forever', false, (await phone.text()).slice(0, 80)));
    record('it was not sent to the home screen', phone.path() !== '/');
    await phone.context.unroute(/:8080\//);
    hung.forEach((route) => route.abort().catch(() => {}));
    await phone.button('Try Again').click({ timeout: 3000 }).catch(() => {});
    phone.wokeAt = Date.now();
    await recovers(phone, game.code, 'Try Again gets back into the round');
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

  async 'a traitor\'s phone is locked when the taskers win'(browser) {
    const game = await freshRound(browser, { tasksEach: 1, traitors: 2 });
    await settled(game.phones, game.code, { timeout: 15000 });
    const [awakeTraitor, lockedTraitor] = game.traitorNames;
    await game.byName[lockedTraitor].sleep();
    for (const name of game.taskers) await doTasks(game.byName[name], game.dealt[name].tasks);
    await until(async () => (await readGame(game.code)).gameEnded, { what: 'game over', timeout: 15000 });
    const watcher = game.byName[game.taskers[0]];
    await until(async () => {
      const text = await watcher.text();
      return text.includes(lockedTraitor) && text.includes(awakeTraitor) && !/Waiting for .* to open the game/.test(text);
    }, { timeout: 8000, what: 'full reveal' })
      .then(({ ms }) => record('the locked traitor is still revealed at game over', true, `${ms}ms`))
      .catch(() => record('the locked traitor is still revealed at game over', false));
    await game.byName[lockedTraitor].wake();
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
