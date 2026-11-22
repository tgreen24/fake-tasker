import { parseMinigameTask } from './minigameTasks';
import { formatClock } from './playerColor';

// What the round screen shows, decided in one place from the round's state,
// so the screen only has to draw it. Every role gets the same frame -- header,
// team bar, two tabs, a status line, a dock with one round button and one
// wide one -- so a glance across the room cannot tell a tasker from a traitor.

const IMPOSTER = 'Imposter';
const CREWMATE = 'Crewmate';

export const TASK_TABS = ['todo', 'done'];
export const TRAITOR_TABS = ['targets', 'tasks'];

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const outstanding = (tasks, completed) => tasks.filter((task) => !completed.includes(task));

function roomsOf(tasks) {
  const rooms = [];
  tasks.forEach((task) => {
    const room = parseMinigameTask(task)?.room;
    if (room && !rooms.includes(room)) rooms.push(room);
  });
  return rooms.slice(0, 2).join(', ');
}

const killStatus = (killCooldownLeft) => (killCooldownLeft > 0 ? `Next kill in ${formatClock(killCooldownLeft)}` : 'Ready');

// Which body the screen shows. Ordered by what overrides what: no role, then
// being out, then whatever has stopped tasks, then the tabs.
export function roundBody({ role, isDead, tasksBlocked, lockdownActive, sabotageActive, tab, tasks = [], completed = [] }) {
  if (!role) return 'no-role';
  if (role === IMPOSTER) {
    if (isDead) return sabotageActive ? 'sabotage-hiding' : 'dead-traitor';
    if (tab === 'tasks') return lockdownActive ? 'tasks-locked' : 'cover';
    return 'targets';
  }
  if (isDead) return tab === 'done' ? 'ghost-done' : 'ghost';
  if (tasksBlocked) return 'sabotaged';
  if (lockdownActive) return 'tasks-locked';
  if (tab === 'done') return 'done-list';
  return outstanding(tasks, completed).length === 0 && tasks.length > 0 ? 'tasks-done' : 'tasks';
}

// A ghost tasker keeps both tabs: they still have tasks to finish, and the
// ones they had done are still theirs to see.
export function roundTabs({ role, isDead, tasksBlocked, lockdownActive, tasks = [], completed = [], fakeTasks = [], targetsLeft = 0 }) {
  if (!role || (isDead && role === IMPOSTER)) return null;
  if (role === IMPOSTER) {
    return [
      { id: 'targets', label: `Targets · ${targetsLeft}` },
      { id: 'tasks', label: `Tasks · ${fakeTasks.length}` }
    ];
  }
  if ((tasksBlocked && !isDead) || lockdownActive) return null;
  return [
    { id: 'todo', label: `To do · ${outstanding(tasks, completed).length}` },
    { id: 'done', label: `Done · ${tasks.filter((task) => completed.includes(task)).length}` }
  ];
}

// The dock: one round button beside one wide one. The round button is the
// guide for everyone, except a living traitor in a game with Lockdown on, for
// whom it is Lockdown -- same size, same gray, same spot.
export function roundDock({ role, isDead, tasksBlocked, lockdownActive, lockdownEnabled }) {
  const side = role === IMPOSTER && !isDead && lockdownEnabled ? 'lockdown' : 'guide';
  let main = 'meeting';
  if (!role) main = 'none';
  else if (isDead) main = 'ghost';
  else if (lockdownActive) main = 'locked-down';
  else if (role === CREWMATE && tasksBlocked) main = 'find';
  return { side, main };
}

// The quiet line over the list. A tasker's and a traitor's sit in the same
// place in the same gray, so the kill timer reads like any other count.
export function statusLine(body, {
  tasks = [], completed = [], fakeTasks = [], fakeCompleted = [], fellowImposters = [],
  killCooldownLeft = 0, sabotageCooldownLeft = 0
}) {
  switch (body) {
    case 'tasks':
    case 'ghost': {
      const left = outstanding(tasks, completed);
      return { left: `${plural(left.length, 'task', 'tasks')} left`, right: roomsOf(left) };
    }
    case 'done-list':
    case 'ghost-done':
      return { left: `${tasks.filter((task) => completed.includes(task)).length} done`, right: '' };
    case 'targets':
      return {
        left: fellowImposters.length ? `Team: ${fellowImposters.join(', ')}` : 'On your own',
        right: killStatus(killCooldownLeft)
      };
    case 'cover':
      return {
        left: `${plural(outstanding(fakeTasks, fakeCompleted).length, 'task', 'tasks')} left`,
        right: killStatus(killCooldownLeft)
      };
    case 'dead-traitor':
      return {
        left: 'Sabotage a tasker',
        right: sabotageCooldownLeft > 0 ? `Ready in ${formatClock(sabotageCooldownLeft)}` : 'Ready'
      };
    default:
      return null;
  }
}

// Out targets last, so the names still worth tapping sit together at the top.
export const orderedTargets = (targets = []) => [...targets.filter((t) => !t.out), ...targets.filter((t) => t.out)];

// The ? guide: what to do right now, for this player in this state.
export function guideCards({ body, role, tasksLeft = 0, sabotagingImposter = '', killCooldown = 0, lockdownEnabled = false }) {
  const meeting = {
    id: 'meeting',
    title: 'Call a meeting',
    text: 'When you find someone out, or see something odd. Everyone heads to the meeting spot to vote.'
  };
  const killed = {
    id: 'ghost',
    title: 'If you\'re killed',
    text: 'Stay where you fell until someone finds you, then keep doing your tasks.'
  };

  if (role === IMPOSTER) {
    if (body === 'dead-traitor' || body === 'sabotage-hiding') {
      return [
        { id: 'sabotage', title: 'Sabotage a tasker', text: 'Pick a tasker, then go hide. Their tasks pause until they find you and you tap "Found me".' },
        { id: 'quiet', title: 'Stay quiet', text: 'You\'re out, so no meetings and no voting. Don\'t give your team away.' }
      ];
    }
    return [
      { id: 'targets', title: 'Get taskers alone', text: `Once you've got someone, tap their name in Targets. Then wait ${killCooldown}s for your next kill.` },
      { id: 'cover', title: 'Blend in', text: 'Your Tasks tab looks just like everyone else\'s. Ticking them does nothing, but it looks right.' },
      {
        id: 'win',
        title: 'How you win',
        text: `Kill until taskers are no more than traitors${lockdownEnabled ? ', or keep a lockdown from being lifted' : ''}.`
      },
      meeting
    ];
  }

  switch (body) {
    case 'sabotaged':
      return [
        { id: 'find', title: `Find ${sabotagingImposter}`, text: `${sabotagingImposter} is hiding somewhere in the house. Your tasks unlock when you find them.` },
        { id: 'meeting-wait', title: 'Meetings wait', text: 'You can call one again once you\'re free.' }
      ];
    case 'tasks-locked':
      return [
        { id: 'lockdown', title: 'Lift the lockdown', text: 'Give your code to your partner, or type in the one they give you. Half the codes lift it.' },
        { id: 'lockdown-lose', title: 'Before time runs out', text: 'If the timer runs out, the traitors win. Meetings are off until it lifts.' }
      ];
    case 'ghost':
    case 'ghost-done':
      return [
        { id: 'ghost-stay', title: 'Stay where you fell', text: 'Until someone finds you. Don\'t say or hint who got you.' },
        { id: 'ghost-tasks', title: 'Keep doing tasks', text: 'Once you\'re found. Taskers need every task to win.' },
        { id: 'ghost-no-meetings', title: 'No meetings or votes', text: 'Ghosts can\'t call meetings or vote.' }
      ];
    case 'tasks-done':
      return [
        { id: 'watch', title: 'Keep watching', text: 'Keep moving and watch who\'s alone with who.' },
        { id: 'group', title: 'Stay with a group', text: 'A traitor can\'t strike in a crowd.' },
        meeting,
        killed
      ];
    default:
      return [
        {
          id: 'tasks',
          title: `Do your ${plural(tasksLeft, 'task', 'tasks')} left`,
          text: 'Do it in real life, then tap it. For a minigame, go to the room first, then tap to play.'
        },
        { id: 'win', title: 'How you win', text: 'Fill the team bar, or vote out every traitor.' },
        meeting,
        killed
      ];
  }
}
