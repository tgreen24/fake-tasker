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
  if (want.startsWith('/countdown') && !/You are|Assigning roles|Meeting adjourned/.test(text)) {
    return 'round screen without a role';
  }
  return null;
}

export async function waitForRoundScreen(phone) {
  await phone.button('🚨 Emergency Meeting').waitFor({ timeout: 20000 });
}

export async function callMeeting(phone, code) {
  await waitForRoundScreen(phone);
  await phone.button('🚨 Emergency Meeting').click();
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

