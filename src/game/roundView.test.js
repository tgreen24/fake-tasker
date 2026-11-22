import { guideCards, orderedTargets, roundBody, roundDock, roundTabs, statusLine } from './roundView';

const tasker = { role: 'Crewmate', isDead: false, tasksBlocked: false, lockdownActive: false, tasks: ['Dishes', 'Sweep'], completed: [] };
const traitor = { role: 'Imposter', isDead: false, lockdownActive: false, lockdownEnabled: false };

test('each state gets the body that overrides the rest', () => {
  expect(roundBody({ role: undefined })).toBe('no-role');
  expect(roundBody({ ...tasker, tab: 'todo' })).toBe('tasks');
  expect(roundBody({ ...tasker, tab: 'done' })).toBe('done-list');
  expect(roundBody({ ...tasker, completed: ['Dishes', 'Sweep'] })).toBe('tasks-done');
  expect(roundBody({ ...tasker, tasksBlocked: true, tab: 'done' })).toBe('sabotaged');
  expect(roundBody({ ...tasker, lockdownActive: true })).toBe('tasks-locked');
  expect(roundBody({ ...tasker, isDead: true, tasksBlocked: true })).toBe('ghost');
  expect(roundBody({ ...tasker, isDead: true, tab: 'done' })).toBe('ghost-done');
  expect(roundBody({ ...traitor })).toBe('targets');
  expect(roundBody({ ...traitor, tab: 'tasks' })).toBe('cover');
  expect(roundBody({ ...traitor, tab: 'tasks', lockdownActive: true })).toBe('tasks-locked');
  expect(roundBody({ ...traitor, isDead: true })).toBe('dead-traitor');
  expect(roundBody({ ...traitor, isDead: true, sabotageActive: true })).toBe('sabotage-hiding');
});

test('taskers, ghosts and traitors get two tabs each, and a traitor who is out gets none', () => {
  expect(roundTabs({ ...tasker, completed: ['Dishes'] }).map((t) => t.label)).toEqual(['To do · 1', 'Done · 1']);
  expect(roundTabs({ ...traitor, fakeTasks: ['a', 'b', 'c'], targetsLeft: 5 }).map((t) => t.label))
    .toEqual(['Targets · 5', 'Tasks · 3']);
  expect(roundTabs({ ...tasker, isDead: true, completed: ['Dishes'] }).map((t) => t.label)).toEqual(['To do · 1', 'Done · 1']);
  expect(roundTabs({ ...traitor, isDead: true })).toBeNull();
  expect(roundTabs({ ...tasker, lockdownActive: true })).toBeNull();
  expect(roundTabs({ ...traitor, lockdownActive: true })).toHaveLength(2);
});

test('the round button is Lockdown only for a living traitor with it switched on', () => {
  expect(roundDock({ ...traitor, lockdownEnabled: true })).toEqual({ side: 'lockdown', main: 'meeting' });
  expect(roundDock({ ...traitor })).toEqual({ side: 'guide', main: 'meeting' });
  expect(roundDock({ ...traitor, lockdownEnabled: true, isDead: true })).toEqual({ side: 'guide', main: 'ghost' });
  expect(roundDock({ ...tasker, lockdownEnabled: true })).toEqual({ side: 'guide', main: 'meeting' });
  expect(roundDock({ ...tasker, tasksBlocked: true }).main).toBe('find');
  expect(roundDock({ ...traitor, lockdownActive: true }).main).toBe('locked-down');
  expect(roundDock({ role: undefined }).main).toBe('none');
});

test('the status line reads the same way for a tasker and a traitor', () => {
  const minigames = ['minigame:fix-wiring@Garage', 'minigame:match-socks@Bedroom 2', 'minigame:fill-glass@Garage', 'Dishes'];
  expect(statusLine('tasks', { tasks: minigames, completed: ['Dishes'] })).toEqual({ left: '3 tasks left', right: 'Garage, Bedroom 2' });
  expect(statusLine('tasks', { tasks: ['Dishes'], completed: [] })).toEqual({ left: '1 task left', right: '' });
  expect(statusLine('targets', { fellowImposters: ['Maya', 'Jo'], killCooldownLeft: 12 }))
    .toEqual({ left: 'Team: Maya, Jo', right: 'Next kill in 0:12' });
  expect(statusLine('targets', { killCooldownLeft: 0 })).toEqual({ left: 'On your own', right: 'Ready' });
  expect(statusLine('cover', { fakeTasks: ['a', 'b'], fakeCompleted: ['a'], killCooldownLeft: 75 }))
    .toEqual({ left: '1 task left', right: 'Next kill in 1:15' });
  expect(statusLine('dead-traitor', { sabotageCooldownLeft: 3 }).right).toBe('Ready in 0:03');
  expect(statusLine('sabotaged', {})).toBeNull();
});

test('the guide speaks to what is happening, and only mentions lockdown when it is on', () => {
  expect(guideCards({ body: 'tasks', role: 'Crewmate', tasksLeft: 4 })[0].title).toBe('Do your 4 tasks left');
  expect(guideCards({ body: 'sabotaged', role: 'Crewmate', sabotagingImposter: 'Cal' })[0].title).toBe('Find Cal');
  expect(guideCards({ body: 'ghost', role: 'Crewmate' }).map((c) => c.id)).toContain('ghost-no-meetings');
  const win = (lockdownEnabled) => guideCards({ body: 'targets', role: 'Imposter', lockdownEnabled }).find((c) => c.id === 'win').text;
  expect(win(false)).not.toMatch(/lockdown/);
  expect(win(true)).toMatch(/lockdown/);
});

test('out targets drop to the end, keeping their order', () => {
  const targets = [{ name: 'Ava', out: 'dead' }, { name: 'Ben', out: null }, { name: 'Cal', out: 'voted-out' }, { name: 'Dee', out: null }];
  expect(orderedTargets(targets).map((t) => t.name)).toEqual(['Ben', 'Dee', 'Ava', 'Cal']);
});
