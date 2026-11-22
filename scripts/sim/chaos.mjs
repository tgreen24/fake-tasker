import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { Phone, pause, readGame, serve, until } from './phones.mjs';
import { NAMES, createGame, enableLockdown, join, screenProblem, setTaskStyle, setUpLobby, startRound } from './game.mjs';
import { playLikeAPerson } from './players.mjs';

// Whole games played by eight phones while their owners keep locking them,
// losing signal, reloading and having tabs thrown away -- the evening the app
// has to survive, compressed. Every few seconds every awake phone is held to
// the screen the server says it should be on.

const ROUNDS = Number(process.env.CHAOS_ROUNDS || 3);
const ROUND_LIMIT_MS = Number(process.env.CHAOS_ROUND_MS || 240000);
const VOTE_MS = Number(process.env.SIM_VOTE_MS || 20000);
const GRACE_MS = 8000;
const engine = process.env.SIM_ENGINE === 'webkit' ? webkit : chromium;
const canFreeze = engine === chromium;

const between = (low, high) => low + Math.random() * (high - low);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const stamp = () => new Date().toISOString().slice(11, 19);
const events = [];
const log = (line) => {
  events.push(`${stamp()} ${line}`);
  if (process.env.CHAOS_VERBOSE) console.log(`${stamp()} ${line}`);
};

const problems = [];

async function misbehave(phones, host, stop) {
  while (!stop.done) {
    await pause(between(3000, 8000));
    const awake = phones.filter((phone) => !phone.asleep && !phone.busy);
    if (!awake.length) continue;
    const phone = Math.random() < 0.15 ? host : pick(awake.filter((p) => p !== host));
    if (!phone || phone.asleep || phone.busy) continue;
    phone.busy = true;
    const kind = pick(canFreeze
      ? ['lock', 'lock', 'stall', 'nap', 'reload', 'discard']
      : ['offline', 'offline', 'reload', 'reload']);
    const length = phone === host ? between(3000, 15000) : between(4000, 40000);
    (async () => {
      try {
        if (kind === 'reload') {
          log(`${phone.name} reloads`);
          await phone.reload();
          phone.wokeAt = Date.now();
        } else if (kind === 'offline') {
          log(`${phone.name} loses signal for ${Math.round(length / 1000)}s`);
          phone.asleep = true;
          await phone.context.setOffline(true);
          await pause(length);
          await phone.context.setOffline(false);
          phone.asleep = false;
          phone.wokeAt = Date.now();
          log(`${phone.name} has signal again`);
        } else {
          log(`${phone.name} ${kind}s for ${Math.round(length / 1000)}s`);
          await phone.sleep({ offline: kind !== 'nap', stall: kind === 'stall' });
          await pause(length);
          await phone.wake({ discarded: kind === 'discard' });
          log(`${phone.name} wakes`);
        }
      } catch (error) {
        log(`${phone.name} ${kind} failed: ${error.message.split('\n')[0]}`);
      } finally {
        phone.busy = false;
      }
    })();
  }
}

// A phone is only judged once it has been awake a while and the game has sat
// still long enough that being a beat behind is not a fault.
async function watch(phones, code, stop, round) {
  const wrongSince = {};
  let lastRoute = '';
  let routeSince = Date.now();
  while (!stop.done) {
    await pause(2000);
    const game = await readGame(code).catch(() => null);
    if (!game) continue;
    const fingerprint = JSON.stringify([game.gameStarted, game.gameEnded, game.meetingCalled, game.resultUntil, !!game.lockdown]);
    if (fingerprint !== lastRoute) {
      lastRoute = fingerprint;
      routeSince = Date.now();
    }
    for (const phone of phones) {
      if (phone.asleep || phone.busy || phone.page.isClosed()) {
        delete wrongSince[phone.name];
        continue;
      }
      const settledFor = Math.min(Date.now() - (phone.wokeAt || 0), Date.now() - routeSince);
      const problem = settledFor > 3000 ? await screenProblem(phone, code).catch(() => null) : null;
      if (!problem) {
        delete wrongSince[phone.name];
        continue;
      }
      wrongSince[phone.name] = wrongSince[phone.name] || Date.now();
      const stuckFor = Date.now() - wrongSince[phone.name];
      if (stuckFor > GRACE_MS && !wrongSince[`${phone.name}:reported`]) {
        wrongSince[`${phone.name}:reported`] = true;
        problems.push({ round, phone: phone.name, problem, at: stamp() });
        log(`STUCK ${phone.name}: ${problem} for ${Math.round(stuckFor / 1000)}s`);
        await phone.page.screenshot({ path: `sim-results/chaos-r${round}-${phone.name}.png` }).catch(() => {});
        if (phone.logs.length) await writeFile(`sim-results/chaos-r${round}-${phone.name}.log`, phone.logs.join('\n'));
      }
    }
  }
}

async function watchMeetings(code, stop, round) {
  let openedAt = null;
  let lockdownSeen = null;
  let lockdownReported = null;
  while (!stop.done) {
    await pause(1000);
    const game = await readGame(code).catch(() => null);
    if (!game) continue;
    const lockdown = game.lockdown;
    if (lockdown && lockdownSeen !== lockdown.startedAt) {
      lockdownSeen = lockdown.startedAt;
      log(`lockdown starts, ${lockdown.needed} codes needed`);
    }
    if (!lockdown && lockdownSeen) {
      log(game.gameEnded && game.winReason === 'lockdown' ? 'lockdown was never lifted' : 'lockdown lifted');
      lockdownSeen = null;
    }
    if (lockdown && Date.now() > lockdown.until + 12000 && lockdownReported !== lockdown.startedAt) {
      lockdownReported = lockdown.startedAt;
      problems.push({ round, phone: 'everyone', problem: 'a lockdown outlived its timer', at: stamp() });
      log('STUCK lockdown outlived its timer');
    }
    if (game.meetingCalled && !openedAt) openedAt = Date.now();
    if (!game.meetingCalled && openedAt) {
      log(`meeting lasted ${Math.round((Date.now() - openedAt) / 1000)}s`);
      openedAt = null;
    }
    if (openedAt && Date.now() - openedAt > VOTE_MS + 12000) {
      problems.push({ round, phone: 'everyone', problem: 'a meeting outlived its timer', at: stamp() });
      log('STUCK meeting outlived its timer');
      openedAt = Date.now() + 1e9;
    }
  }
}

const server = await serve('build-sim');
const browser = await engine.launch({ headless: process.env.SIM_HEADED !== '1' });
await mkdir('sim-results', { recursive: true });

const phones = await Promise.all(NAMES.map((name) => new Phone(browser, name).open()));
const [host, ...others] = phones;
const code = await createGame(host);
for (const phone of others) await join(phone, code);
await setUpLobby(host, code, { tasksEach: 3 });
await host.page.locator('.imposter-select select').selectOption('2');
await until(async () => (await readGame(code)).imposterCount === 2, { what: 'two traitors' });
if (process.env.CHAOS_LOCKDOWN !== '0') await enableLockdown(host, code);
await setTaskStyle(host, code, process.env.CHAOS_TASKS || 'mixed');
console.log(`chaos on ${process.env.SIM_ENGINE || 'chromium'}: game ${code}, ${phones.length} phones, ${ROUNDS} rounds`);

const outcomes = [];
for (let round = 1; round <= ROUNDS; round++) {
  await until(async () => !(await readGame(code)).gameStarted, { what: 'lobby', timeout: 20000 });
  await pause(1500);
  await startRound(host, code);
  const started = Date.now();
  log(`round ${round} starts`);

  const stop = { done: false };
  const loops = [
    misbehave(phones, host, stop),
    watch(phones, code, stop, round),
    watchMeetings(code, stop, round),
    ...phones.map((phone) => playLikeAPerson(phone, code, { stop, log }))
  ];

  let ended = null;
  try {
    ({ value: ended } = await until(async () => {
      const game = await readGame(code);
      return game.gameEnded ? game : null;
    }, { timeout: ROUND_LIMIT_MS, every: 1000, what: 'round to end' }));
  } catch {
    problems.push({ round, phone: 'everyone', problem: `round did not end within ${ROUND_LIMIT_MS / 1000}s`, at: stamp() });
  }
  stop.done = true;
  await Promise.all(loops);

  for (const phone of phones) {
    while (phone.busy) await pause(500);
    if (phone.asleep) await phone.wake().catch(() => {});
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  outcomes.push(ended ? `round ${round}: ${ended.winner} by ${ended.winReason} in ${minutes} min` : `round ${round}: no result`);
  console.log(outcomes[outcomes.length - 1]);

  const lagging = [];
  await Promise.all(phones.map(async (phone) => {
    try {
      await until(async () => !(await screenProblem(phone, code)), { timeout: GRACE_MS, what: phone.name });
    } catch {
      lagging.push(`${phone.name}: ${await screenProblem(phone, code)}`);
    }
  }));
  if (lagging.length) problems.push({ round, phone: 'end', problem: `not on game over: ${lagging.join('; ')}`, at: stamp() });
  else log(`round ${round}: every phone reached game over`);

  if (ended) {
    await pause(4000);
    await host.button('End Game and Return to Lobby').click({ timeout: 10000 }).catch(() => {});
  } else {
    await host.button('Menu').click({ timeout: 3000 }).catch(() => {});
    await host.button('End Game Round').click({ timeout: 3000 }).catch(() => {});
    await host.button('Tap again to end the round').click({ timeout: 3000 }).catch(() => {});
  }
}

await writeFile(`sim-results/chaos-${process.env.SIM_ENGINE || 'chromium'}.log`, events.join('\n'));
await browser.close();
server.close();

const disruptions = events.filter((line) => / (locks|stalls|naps|discards|reloads|loses signal) /.test(line)).length;
console.log(`\n${disruptions} disruptions across ${ROUNDS} rounds`);
const lockdowns = events.filter((line) => /lockdown starts/.test(line)).length;
const lifted = events.filter((line) => /lockdown lifted$/.test(line)).length;
console.log(`${lockdowns} lockdowns, ${lifted} lifted`);
outcomes.forEach((line) => console.log(`  ${line}`));
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  problems.forEach((p) => console.log(`  round ${p.round} ${p.at} ${p.phone}: ${p.problem}`));
} else {
  console.log('\nno phone was ever stuck');
}
process.exit(problems.length ? 1 : 0);
