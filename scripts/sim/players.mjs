import { pause, readGame, readSeat } from './phones.mjs';
import { enterLockdownCode, minigameOf, playMinigameTask, solveLockdownPuzzle, taskRow, vote } from './game.mjs';
import { makeSolvers } from './solvers.mjs';

const solvers = makeSolvers();

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (low, high) => low + Math.random() * (high - low);

// A phone that plays the way a person does: it only ever acts on what its own
// screen shows, at a human pace, and does nothing while it is asleep.
export function playLikeAPerson(phone, code, { stop, log = () => {}, meetingEveryMs = 60000 }) {
  let lastMeetingCall = Date.now();

  const act = async () => {
    if (phone.asleep || phone.page.isClosed()) return;
    const path = phone.path();
    const game = await readGame(code);
    if (!game) return;
    const out = game.killList || [];
    const alive = (game.players || []).filter((name) => !out.includes(name));
    const me = phone.name;

    if (path.startsWith('/voting')) {
      if (!alive.includes(me)) return;
      const ballot = phone.page.getByRole('button', { name: /^Vote for |^Skip the vote$/ });
      if (!(await ballot.count())) return;
      await pause(between(1000, 6000));
      if (phone.asleep) return;
      const others = alive.filter((name) => name !== me);
      const choice = Math.random() < 0.35 ? 'skip' : pick(others);
      await vote(phone, choice);
      log(`${me} voted ${choice}`);
      return;
    }

    if (!path.startsWith('/countdown') || !alive.includes(me)) return;
    const seat = await readSeat(code, me);
    if (!seat) return;

    // A lockdown comes first, the way it would for a person. Only the
    // receiver's side needs doing: the code is read where the giver would have
    // said it out loud.
    if (game.lockdown && await phone.page.locator('.lockdown').count()) {
      if (await phone.page.locator('.lockdown .tap-in-order').count()) {
        await solveLockdownPuzzle(phone);
        log(`${me} solved the lockdown puzzle`);
        return;
      }
      const mine = game.lockdown.pairs.find((pair) => pair.receivers.includes(me));
      const traitorHoldingOut = seat.role === 'Imposter' && Math.random() < 0.7;
      if (mine && !game.lockdown.entered?.[me] && !traitorHoldingOut && Math.random() < 0.3
        && await phone.page.locator('.lockdown-input').count()) {
        await enterLockdownCode(phone, mine.code);
        log(`${me} entered a lockdown code`);
        return;
      }
    }

    if (seat.role === 'Crewmate') {
      const todo = (seat.tasks || []).filter((task) => !(seat.completedTasks || []).includes(task));
      if (todo.length && Math.random() < 0.25) {
        const task = pick(todo);
        if (minigameOf(task)) {
          await playMinigameTask(phone, task, solvers);
          log(`${me} won ${minigameOf(task).name}`);
        } else {
          await taskRow(phone, task).click({ timeout: 1500 });
          log(`${me} did a task`);
        }
      }
    } else if (seat.role === 'Imposter') {
      const targets = alive.filter((name) => name !== me && (seat.roleMap || {})[name] !== 'Imposter');
      const cooling = /kill cooldown/i.test(await phone.text());
      // Now and then a traitor flips to their cover list and does a chore.
      const cover = (seat.fakeTasks || []).filter((task) => !minigameOf(task) && !(seat.fakeCompleted || []).includes(task));
      if (cover.length && Math.random() < 0.05) {
        await phone.button('Switch').click({ timeout: 1500 });
        await taskRow(phone, pick(cover)).click({ timeout: 1500 });
        await pause(between(1000, 3000));
        await phone.button('Switch').click({ timeout: 1500 });
        log(`${me} faked a task`);
        return;
      }
      const lockdownButton = phone.button('Lockdown');
      if (await lockdownButton.count() && Math.random() < 0.04) {
        await lockdownButton.click({ timeout: 1500 });
        await phone.button('Tap again to lock everyone down').click({ timeout: 1500 });
        log(`${me} started a lockdown`);
        return;
      }
      if (targets.length && !cooling && Math.random() < 0.08) {
        const target = pick(targets);
        await phone.page.getByRole('button', { name: target, exact: true }).click({ timeout: 1500 });
        await pause(1500);
        if (((await readGame(code)).killList || []).includes(target)) log(`${me} killed ${target}`);
      }
    }

    if (Date.now() - lastMeetingCall > meetingEveryMs && Math.random() < 0.15) {
      await phone.button('🚨 Emergency Meeting').click({ timeout: 1500 });
      lastMeetingCall = Date.now();
      log(`${me} called a meeting`);
    }
  };

  return (async () => {
    while (!stop.done) {
      try {
        await act();
      } catch {
        /* the screen moved under us; a person would just look again */
      }
      await pause(between(2000, 5000));
    }
  })();
}
