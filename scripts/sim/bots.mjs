import { chromium } from 'playwright';
import { Phone, pause } from './phones.mjs';

// Fills a real game with players so one person on a real phone can test it.
//
//   node scripts/sim/bots.mjs ABC123 5          five bots join game ABC123
//   node scripts/sim/bots.mjs --host 5          a bot hosts a new game; you join it
//   BOT_BASE=http://localhost:3000 …            against a local dev server instead
//
// Bots read only their own screens -- they cannot see the database -- so they
// play the way a person holding that phone would. Ctrl-C to stop them.

const BASE = process.env.BOT_BASE || 'https://fake-tasker-770e9.web.app';
const args = process.argv.slice(2);
const hosting = args.includes('--host');
const [codeArg, countArg] = args.filter((arg) => arg !== '--host');
const count = Number(hosting ? codeArg || 5 : countArg || 5);
const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];

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

async function turn(phone, state) {
  const path = new URL(phone.page.url()).pathname;
  const text = await phone.page.locator('body').innerText().catch(() => '');

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
