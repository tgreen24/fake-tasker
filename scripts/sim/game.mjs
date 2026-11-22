import { readFile } from 'node:fs/promises';
import { BASE, Phone, expectedPath, pause, readGame, readSeat, until } from './phones.mjs';

export const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];

// ── game steps, all through the real UI ──

export async function createGame(host) {
  await host.goto('/');
  await host.page.locator('.name-input').fill(host.name);
  await host.button('Create Game').click();
  await host.page.waitForURL(/\/lobby\/[A-Z0-9]{6}$/, { timeout: 15000 });
  return host.path().split('/').pop();
}

export async function join(phone, code) {
  await phone.goto(`/j/${code}`);
  await phone.page.locator('.join-input').fill(phone.name);
  await phone.button('Join Game').click();
  await phone.page.waitForURL(/\/lobby\//, { timeout: 15000 });
}

export async function setUpLobby(host, code, { tasksEach = 2 } = {}) {
  await host.page.locator('.task-editor summary').click();
  await host.page.getByRole('button', { name: /^Use House pack/ }).click();
  await until(async () => ((await readGame(code)).tasks || []).length > 10, { what: 'pack tasks' });
  await host.page.locator('.task-count-selection select').selectOption(String(tasksEach));
  await host.page.locator('.kill-cooldown-selection select').selectOption('10');
  await until(async () => (await readGame(code)).tasksPerCrewmate === tasksEach, { what: 'tasks each' });
}

export async function enableLockdown(host, code) {
  await host.page.locator('.toggle-setting input[type="checkbox"]').check();
  await until(async () => (await readGame(code)).lockdownEnabled, { what: 'lockdown on' });
}

// The Lockdown button is always there for a traitor when it is switched on;
// it only asks to go ahead once the cooldown is over.
export async function startLockdown(traitor, code) {
  await until(async () => {
    await traitor.button('Lockdown').click({ timeout: 5000 });
    const go = traitor.button('Lock everyone down');
    if (await go.count()) {
      await go.click();
      return true;
    }
    await traitor.page.keyboard.press('Escape');
    await pause(500);
    return false;
  }, { what: 'lockdown ready', timeout: 20000 });
  await until(async () => !!(await readGame(code)).lockdown, { what: 'lockdown to start' });
}

// The round screen never shows a role after the reveal, so a phone's role is
// read off the shape of its screen, the way a person glancing at it could not.
export const tab = (phone, name) => phone.page.getByRole('tab', { name: new RegExp(`^${name} ·`) });

export async function solveLockdownPuzzle(phone) {
  for (let n = 1; n <= 9; n++) {
    await phone.page.locator('.lockdown').getByRole('button', { name: `Tap ${n}`, exact: true }).click({ timeout: 10000 });
  }
}

export async function enterLockdownCode(phone, code) {
  await phone.page.locator('.lockdown-input').fill(code);
  await phone.button('Enter Code').click();
}

export async function startRound(host, code) {
  await host.button('Start Game').click();
  await until(async () => (await readGame(code)).gameStarted, { what: 'round to start' });
}

export async function seats(code, names) {
  const out = {};
  for (const name of names) out[name] = await readSeat(code, name);
  return out;
}

// Every awake phone on the screen the server says it should be on, showing
// something real rather than a spinner or a missing role.
export async function screenProblem(phone, code) {
  const game = await readGame(code);
  const want = expectedPath(game, phone.name, code);
  const have = phone.path();
  if (have !== want) return `on ${have}, should be on ${want}`;
  const text = await phone.text();
  if (/Loading…/.test(text) && text.length < 40) return 'stuck on Loading…';
  if (/Your role has not arrived/.test(text)) return 'role has not arrived';
  if (want.startsWith('/countdown') && !/Hold for role|You are|Assigning roles|Meeting adjourned/.test(text)) {
    return 'round screen without a role';
  }
  return null;
}

export async function waitForRoundScreen(phone) {
  await phone.button('Emergency Meeting').waitFor({ timeout: 20000 });
}

export async function callMeeting(phone, code) {
  await waitForRoundScreen(phone);
  await phone.button('Emergency Meeting').click();
  await until(async () => (await readGame(code)).meetingCalled, { what: 'meeting to open' });
}

export async function vote(phone, target) {
  await phone.page.getByRole('button', { name: target === 'skip' ? 'Skip the vote' : `Vote for ${target}`, exact: true })
    .click({ timeout: 15000 });
  await phone.button('Submit Vote').click();
}

export async function doTasks(phone, tasks) {
  for (const task of tasks) {
    await phone.page.getByRole('button', { name: task, exact: true }).click({ timeout: 15000 });
    await pause(300);
  }
}


// ── minigame tasks ──

const catalog = [...(await readFile('src/game/minigames/catalog.js', 'utf8'))
  .matchAll(/id: '([^']+)', name: '([^']+)', icon: '([^']+)'/g)]
  .map(([, id, name, icon]) => ({ id, name, icon }));

export function minigameOf(task) {
  const match = /^minigame:([^@]+)@(.+)$/.exec(task || '');
  if (!match) return null;
  const info = catalog.find((game) => game.id === match[1]);
  return info && { ...info, room: match[2] };
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function setTaskStyle(host, code, style) {
  await host.page.locator('#task-style').selectOption(style);
  await until(async () => (await readGame(code)).taskStyle === style, { what: `task style ${style}` });
}

// The task's row on the round screen, whichever list it is in.
export const taskRow = (phone, task) => {
  const minigame = minigameOf(task);
  return minigame
    ? phone.page.getByRole('button', { name: new RegExp(`${escape(minigame.room)}: ${escape(minigame.name)}`) })
    : phone.page.getByRole('button', { name: task, exact: true });
};

export async function openMinigameTask(phone, task) {
  await taskRow(phone, task).click({ timeout: 10000 });
  await phone.button('Start').click({ timeout: 5000 });
}

export async function playMinigameTask(phone, task, solvers) {
  const { name } = minigameOf(task);
  try {
    await openMinigameTask(phone, task);
    await solvers[name](phone);
    await phone.page.locator('.minigame-overlay').waitFor({ state: 'detached', timeout: 10000 });
  } catch (error) {
    throw new Error(`${phone.name} playing ${name}: ${error.message.split('\n')[0]}`);
  }
}
