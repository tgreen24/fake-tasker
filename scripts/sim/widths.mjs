import { chromium } from 'playwright';
import { Phone, pause, readGame, serve, until } from './phones.mjs';
import {
  NAMES, callMeeting, createGame, enableLockdown, join, seats, setUpLobby,
  solveLockdownPuzzle, startLockdown, startRound
} from './game.mjs';

// Walks every screen at real phone widths and reports anything that makes the
// page scroll sideways, naming the elements that stick out.

const WIDTHS = [320, 375, 390];
const findings = [];

async function measure(phone, screen) {
  for (const width of WIDTHS) {
    await phone.page.setViewportSize({ width, height: 800 });
    await pause(screen.includes('wrong tap') ? 60 : 150);
    const result = await phone.page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
      const describe = (el) => {
        const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
        return `${el.tagName.toLowerCase()}${cls}`;
      };
      const offenders = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.right > viewport + 0.5 || box.left < -0.5);
        })
        .map((el) => `${describe(el)} (${Math.round(el.getBoundingClientRect().width)}px)`);
      return { overflow, offenders: [...new Set(offenders)].slice(0, 6) };
    });
    const line = `${screen} @${width}px: ${result.overflow > 0 ? `scrolls sideways by ${result.overflow}px` : 'fits'}`
      + (result.offenders.length ? ` -- sticks out: ${result.offenders.join(', ')}` : '');
    console.log(line);
    if (result.overflow > 0 || result.offenders.length) findings.push(line);
  }
  await phone.page.setViewportSize({ width: 390, height: 844 });
}

const server = await serve('build-sim');
const browser = await chromium.launch();
const phones = await Promise.all(NAMES.slice(0, 6).map((name) => new Phone(browser, name).open()));
const [host, ...others] = phones;

await host.goto('/');
await measure(host, 'home');
await host.goto('/practice');
await measure(host, 'practice list');
await host.button('Tap in Order').click();
await measure(host, 'practice: tap in order');
await host.goto('/join');
await measure(host, 'join');

const code = await createGame(host);
for (const phone of others) await join(phone, code);
await setUpLobby(host, code);
await enableLockdown(host, code);
await host.page.locator('.task-editor summary').click().catch(() => {});
await measure(host, 'lobby (host, task editor open)');
await measure(others[0], 'lobby (player)');

await startRound(host, code);
const dealt = await seats(code, NAMES.slice(0, 6));
const byName = Object.fromEntries(phones.map((phone) => [phone.name, phone]));
const traitor = byName[Object.keys(dealt).find((name) => dealt[name].role === 'Imposter')];
const tasker = phones.find((phone) => phone !== traitor);
await pause(6000);
await measure(tasker, 'round (tasker)');
await until(async () => (await traitor.button('Lockdown').count()) > 0, { timeout: 20000, what: 'lockdown ready' });
await measure(traitor, 'round (traitor, lockdown available)');

await startLockdown(traitor, code);
await pause(1500);
await measure(tasker, 'lockdown: puzzle');
const { lockdown } = await readGame(code);
const pair = lockdown.pairs.find((p) => p.giver !== traitor.name && !p.receivers.includes(traitor.name));
const giver = byName[pair.giver];
const receiver = byName[pair.receivers[0]];
await solveLockdownPuzzle(giver);
await measure(giver, `lockdown: giving to ${pair.receivers.join(', ')}`);
await receiver.page.locator('.lockdown').getByRole('button', { name: 'Tap 9', exact: true }).click();
await measure(receiver, 'lockdown: puzzle after a wrong tap');
await solveLockdownPuzzle(receiver);
await measure(receiver, 'lockdown: empty code box');
await receiver.page.locator('.lockdown-input').fill('ZZZZZZZZZ');
await receiver.button('Enter Code').click();
await pause(1500);
await measure(receiver, 'lockdown: entering, wrong code shown');
await receiver.page.locator('.lockdown-input').fill(pair.code);
await receiver.button('Enter Code').click();
await pause(1500);
await measure(receiver, 'lockdown: code accepted');

await until(async () => !(await readGame(code)).gameEnded && !(await readGame(code)).lockdown, { timeout: 40000, what: 'lockdown over' }).catch(() => {});
await callMeeting(tasker, code).catch(() => {});
await pause(2000);
await measure(tasker, 'voting');

await Promise.all(phones.map((phone) => phone.close()));
await browser.close();
server.close();

console.log(findings.length ? `\n${findings.length} problems` : '\nevery screen fits');
process.exit(0);
