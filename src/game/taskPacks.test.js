import {
  TASK_PACKS, packById, taskTexts, roomsIn, packSupports,
  taskMetaFor, roomFor, lengthFor, SHORT, LONG
} from './taskPacks';

const house = packById('house');

describe('the house pack', () => {
  test('has enough tasks to deal without repeats for a normal group', () => {
    expect(house.tasks.length).toBeGreaterThanOrEqual(25);
    expect(packSupports(house, 3)).toBeGreaterThanOrEqual(8);
  });

  test('never lists the same task twice', () => {
    const texts = taskTexts(house);
    expect(new Set(texts).size).toBe(texts.length);
  });

  test('sends every task to a named room, since one you can do where you stand is worthless',
    () => {
      house.tasks.forEach((task) => expect(task.room).toBeTruthy());
    });

  test('tags every task short or long, so nobody is dealt three quick ones', () => {
    house.tasks.forEach((task) => expect([SHORT, LONG]).toContain(task.length));
  });

  test('spreads across several rooms so players scatter', () => {
    expect(roomsIn(house).length).toBeGreaterThanOrEqual(4);
  });

  test('has more long tasks than short ones', () => {
    const long = house.tasks.filter((t) => t.length === LONG).length;
    expect(long).toBeGreaterThan(house.tasks.length / 2);
  });
});

describe('recovering a task from its text', () => {
  test('a pack task keeps its room and length even though only text is stored', () => {
    const task = house.tasks[0];
    expect(taskMetaFor(task.text)).toMatchObject({ room: task.room, length: task.length });
    expect(roomFor(task.text)).toBe(task.room);
    expect(lengthFor(task.text)).toBe(task.length);
  });

  // A host typing their own task should not have to answer two dropdowns.
  test('a task somebody typed themselves simply has none', () => {
    expect(taskMetaFor('Take the recycling out')).toBeNull();
    expect(roomFor('Take the recycling out')).toBeNull();
    expect(lengthFor('Take the recycling out')).toBeNull();
  });
});

describe('adding another pack', () => {
  test('every pack carries what the picker needs to render it', () => {
    TASK_PACKS.forEach((pack) => {
      expect(pack.id).toBeTruthy();
      expect(pack.name).toBeTruthy();
      expect(pack.description).toBeTruthy();
      expect(pack.tasks.length).toBeGreaterThan(0);
    });
  });

  test('pack ids are unique, since they key the list', () => {
    const ids = TASK_PACKS.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
