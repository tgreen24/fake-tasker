import {
  TASK_PACKS, packById, taskTexts, roomsIn, packSupports,
  taskMetaFor, roomFor, lengthFor, activePackId, withPackSelected, SHORT, LONG
} from './taskPacks';

const house = packById('house');

// Every pack earns its place the same way, so the bar is applied to all of
// them rather than to the one that happened to be written first.
describe.each(TASK_PACKS.map((pack) => [pack.name, pack]))('the %s pack', (name, pack) => {
  test('has enough tasks to deal without repeats for a normal group', () => {
    expect(pack.tasks.length).toBeGreaterThanOrEqual(25);
    expect(packSupports(pack, 3)).toBeGreaterThanOrEqual(8);
  });

  test('never lists the same task twice', () => {
    const texts = taskTexts(pack);
    expect(new Set(texts).size).toBe(texts.length);
  });

  test('sends every task to a named room, since one you can do where you stand is worthless',
    () => {
      pack.tasks.forEach((task) => expect(task.room).toBeTruthy());
    });

  test('tags every task short or long, so nobody is dealt three quick ones', () => {
    pack.tasks.forEach((task) => expect([SHORT, LONG]).toContain(task.length));
  });

  test('spreads across several rooms so players scatter', () => {
    expect(roomsIn(pack).length).toBeGreaterThanOrEqual(4);
  });

  test('has more long tasks than short ones', () => {
    const long = pack.tasks.filter((t) => t.length === LONG).length;
    expect(long).toBeGreaterThan(pack.tasks.length / 2);
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

  // Only the text is stored, and the room and length are recovered by looking
  // it back up in one map across every pack. The same sentence in two packs
  // would take the other pack's room with it.
  test('no two packs share a task, because the text is the only key', () => {
    const all = TASK_PACKS.flatMap(taskTexts);
    expect(new Set(all).size).toBe(all.length);
  });

  // The rules bound the game document's task list. Only one pack is ever on it,
  // so the bound has to hold for the largest pack plus room for the host's own.
  test('a pack leaves room under the document bound for tasks of the host own', () => {
    TASK_PACKS.forEach((pack) => expect(pack.tasks.length).toBeLessThanOrEqual(40));
  });
});

describe('one pack at a time', () => {
  const school = taskTexts(packById('school'));
  const church = taskTexts(packById('church'));

  test('nothing is in use on an empty list', () => {
    expect(activePackId([])).toBeNull();
    expect(activePackId(['Take the recycling out'])).toBeNull();
  });

  test('names the pack a list came from', () => {
    expect(activePackId(school)).toBe('school');
    expect(activePackId(withPackSelected([], 'church'))).toBe('church');
  });

  // Pulling a task the building does not have is not switching buildings.
  test('still names it after the host removes a couple by hand', () => {
    expect(activePackId(school.slice(2))).toBe('school');
  });

  test('choosing another pack takes the first one off the list', () => {
    const next = withPackSelected(school, 'church');
    expect(next).toEqual(expect.arrayContaining(church));
    school.forEach((text) => expect(next).not.toContain(text));
    expect(activePackId(next)).toBe('church');
  });

  test('keeps what the host typed themselves through every change', () => {
    const own = ['Take the recycling out', 'Find the dog'];
    const withSchool = withPackSelected([...own, 'Count the mugs in the cupboard'], 'school');
    expect(withSchool).toEqual(expect.arrayContaining(own));

    const cleared = withPackSelected(withSchool, null);
    expect(cleared).toEqual(own);
  });

  test('choosing the same pack twice changes nothing', () => {
    const once = withPackSelected([], 'school');
    expect(withPackSelected(once, 'school')).toEqual(once);
  });
});
