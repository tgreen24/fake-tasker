import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { Phone, pause } from './phones.mjs';

// Fills a real game with players so one person on a real phone can test it.
//
//   node scripts/sim/bots.mjs ABC123 5          five bots join game ABC123
//   node scripts/sim/bots.mjs --host 5          a bot hosts a new game; you join it
//   BOT_BASE=http://localhost:3000 …            against a local dev server instead
//
// Lockdown: a bot hands its code straight to another bot, and prints any code
// meant for a person. A code a person gives a bot goes in sim-results/bot-inbox.txt
// as a line like "Bot Ava K7M-4QX" (or BOT_INBOX for another file).
//
// Bots read only their own screens -- they cannot see the database -- so they
// play the way a person holding that phone would. Ctrl-C to stop them.

const BASE = process.env.BOT_BASE || 'https://fake-tasker-770e9.web.app';
const args = process.argv.slice(2);
const hosting = args.includes('--host');
const [codeArg, countArg] = args.filter((arg) => arg !== '--host');
const count = Number(hosting ? codeArg || 5 : countArg || 5);
const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];

const INBOX = process.env.BOT_INBOX || 'sim-results/bot-inbox.txt';
const codesFromBots = {};

function inboxCodeFor(name) {
  let lines = [];
  try {
    lines = readFileSync(INBOX, 'utf8').split('\n');
  } catch {
    return null;
  }
  const line = lines.reverse().find((entry) => entry.toLowerCase().startsWith(`${name.toLowerCase()} `));
  return line ? line.slice(name.length).trim() : null;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (low, high) => low + Math.random() * (high - low);
const stamp = () => new Date().toLocaleTimeString();
const say = (line) => console.log(`${stamp()}  ${line}`);

async function unpressed(phone, scope) {
  const buttons = phone.page.locator(`${scope} [role="button"][aria-pressed="false"]`);
  const labels = [];
  for (let i = 0; i < await buttons.count(); i++) labels.push(await buttons.nth(i).getAttribute('aria-label'));
  return labels.filter(Boolean);
}

async function lockdownTurn(phone, state, text) {
  const panel = phone.page.locator('.lockdown');
  if (await panel.locator('.tap-in-order').count()) {
    await pause(between(2000, 6000));
    for (let n = 1; n <= 9; n++) await panel.getByRole('button', { name: `Tap ${n}`, exact: true }).click();
    say(`${phone.name} solved the lockdown puzzle`);
    return;
  }

  const shown = phone.page.locator('.lockdown-code');
  if (await shown.count()) {
    const code = (await shown.innerText()).trim();
    if (state.announced === code) return;
    state.announced = code;
    codesFromBots[phone.name] = code;
    const to = (await panel.locator('.lockdown-step p').first().innerText()).replace(/^Give this code to |:$/g, '');
    const people = to.split(/, | and /).filter((name) => !name.startsWith('Bot '));
    if (people.length) say(`🔑 ${phone.name} gives code ${code} to ${people.join(' and ')}`);
    return;
  }

  const entry = phone.page.locator('.lockdown-entry');
  if (!(await entry.count()) || /You are the Traitor/.test(text)) return;
  const from = (await entry.locator('strong').innerText()).trim();
  const code = codesFromBots[from] || inboxCodeFor(phone.name);
  if (!code || state.tried === code) return;
  state.tried = code;
  await pause(between(2000, 8000));
  await phone.page.locator('.lockdown-input').fill(code);
  await phone.button('Enter Code').click();
  say(`${phone.name} entered the code from ${from}`);
}

async function turn(phone, state) {
  const path = new URL(phone.page.url()).pathname;
  const text = await phone.page.locator('body').innerText().catch(() => '');

  if (path.startsWith('/countdown') && await phone.page.locator('.lockdown').count()) {
    await lockdownTurn(phone, state, text);
    return;
  }

  if (path.startsWith('/voting')) {
    const ballot = phone.page.getByRole('button', { name: /^Vote for |^Skip the vote$/ });
    const options = await ballot.count();
    if (!options || !(await phone.button('Submit Vote').count())) return;
    await pause(between(3000, 15000));
    const choice = Math.random() < 0.4 ? options - 1 : Math.floor(Math.random() * (options - 1));
    await ballot.nth(choice).click();
    await phone.button('Submit Vote').click();
    say(`${phone.name} voted`);
    return;
  }

  if (!path.startsWith('/countdown') || /You are a Dead/.test(text)) return;

  if (/You are a Tasker/.test(text) && Math.random() < 0.1) {
    const todo = await unpressed(phone, '.task-list');
    if (todo.length) {
      await phone.page.getByRole('button', { name: pick(todo), exact: true }).click();
      say(`${phone.name} did a task`);
    }
  }

  const lockdownButton = phone.button('🔒 Start Lockdown');
  if (/You are the Traitor/.test(text) && await lockdownButton.count() && await lockdownButton.isEnabled()
    && Math.random() < 0.02) {
    await lockdownButton.click();
    say(`${phone.name} started a lockdown`);
    return;
  }

  if (/You are the Traitor/.test(text) && !/kill cooldown/i.test(text) && Math.random() < 0.05) {
    const targets = await unpressed(phone, '.kill-list');
    if (targets.length) {
      const target = pick(targets);
      await phone.page.getByRole('button', { name: target, exact: true }).click();
      say(`${phone.name} killed ${target}`);
    }
  }

  if (Date.now() - state.lastMeeting > 60000 && Math.random() < 0.03) {
    const button = phone.button('🚨 Emergency Meeting');
    if (await button.count()) {
      await button.click();
      state.lastMeeting = Date.now();
      say(`${phone.name} called a meeting`);
    }
  }
}

async function play(phone) {
  const state = { lastMeeting: Date.now() };
  for (;;) {
    try {
      await turn(phone, state);
    } catch {
      /* the screen moved; look again */
    }
    await pause(between(2000, 4000));
  }
}

async function joinAs(phone, code) {
  await phone.page.goto(`${BASE}/j/${code}`);
  await phone.page.locator('.join-input').fill(phone.name);
  await phone.button('Join Game').click();
  await phone.page.waitForURL(/\/(lobby|countdown|voting|gameover)\//, { timeout: 20000 });
  say(`${phone.name} joined`);
}

const browser = await chromium.launch({ headless: process.env.BOT_HEADED !== '1' });
const bots = await Promise.all(NAMES.slice(0, count).map((name) => new Phone(browser, `Bot ${name}`).open()));

let code = codeArg;
if (hosting) {
  const [host] = bots;
  await host.page.goto(BASE);
  await host.page.locator('.name-input').fill(host.name);
  await host.button('Create Game').click();
  await host.page.waitForURL(/\/lobby\/[A-Z0-9]{6}$/, { timeout: 20000 });
  code = new URL(host.page.url()).pathname.split('/').pop();
  say(`${host.name} is hosting game ${code} -- join at ${BASE}/j/${code}`);
}

for (const bot of bots.slice(hosting ? 1 : 0)) await joinAs(bot, code);
say(`${bots.length} bots in game ${code}. Ctrl-C to stop.`);
await Promise.all(bots.map(play));
