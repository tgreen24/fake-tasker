// Tasks that survived play. The rules they follow, learned the hard way:
//
//   already in the house    nothing to fetch or set up
//   nothing to reset       the next player can do it too, so it can be dealt widely
//   nothing consumed       no water, no power, no food
//   bounded                you can see the end of it when you start
//   nothing valuable       no electronics, nothing fragile
//   somewhere specific     if you can do it where you stand, it buys the traitor nothing
//
// Most are answerable -- they end in a number or a word -- so anyone can ask
// "how many?" and somebody who faked it has to guess.
//
// room and length are used for dealing, not display: spread a player across
// rooms, and do not hand one person three fifteen-second tasks.

export const SHORT = 'short';
export const LONG = 'long';

const HOUSE_TASKS = [
  { text: 'Count the forks in the silverware drawer', room: 'Kitchen', length: LONG },
  { text: 'Count the mugs in the cupboard', room: 'Kitchen', length: LONG },
  { text: 'Count the plates in the cabinet', room: 'Kitchen', length: LONG },
  { text: 'Count the cabinet doors in the kitchen', room: 'Kitchen', length: LONG },
  { text: 'Find the expiration date on something in the fridge', room: 'Kitchen', length: LONG },
  { text: 'Read the ingredients on something from the pantry, remember the third one', room: 'Kitchen', length: LONG },
  { text: 'Count the buttons on the microwave', room: 'Kitchen', length: SHORT },

  { text: 'Wash your hands, singing Happy Birthday twice through', room: 'Bathroom', length: LONG },
  { text: 'Count everything on the bathroom counter', room: 'Bathroom', length: LONG },
  { text: 'Count the outlets in the bathroom', room: 'Bathroom', length: SHORT },
  { text: 'Count the towels hanging up', room: 'Bathroom', length: SHORT },
  { text: 'Count the rolls of toilet paper in the bathroom', room: 'Bathroom', length: SHORT },

  { text: 'Count the pillows on the bed', room: 'Bedroom', length: SHORT },
  { text: 'Count the drawers in the bedroom', room: 'Bedroom', length: LONG },
  { text: 'Count the slats in the blinds', room: 'Bedroom', length: LONG },
  { text: 'Read the care label on a shirt in the closet', room: 'Bedroom', length: LONG },
  { text: 'Find the tag on the mattress and read what it says', room: 'Bedroom', length: LONG },

  { text: 'Count the light switches in the living room', room: 'Living room', length: SHORT },
  { text: 'Count the outlets in the living room', room: 'Living room', length: LONG },
  { text: 'Count the windows in the living room', room: 'Living room', length: SHORT },
  { text: 'Count the remotes you can find in the living room', room: 'Living room', length: SHORT },
  { text: 'Count the legs on every piece of furniture in the living room', room: 'Living room', length: LONG },

  { text: 'Find the model number on the washing machine', room: 'Laundry', length: LONG },
  { text: 'Count the buttons on the washing machine', room: 'Laundry', length: LONG },
  { text: 'Count the settings on the dryer dial', room: 'Laundry', length: LONG }
];

// A school building after hours, so nothing in here needs a class to be in
// session or a room to be unlocked by somebody who is not playing. Trophy
// case, banners and the library are the first things to cut if the building
// does not have them -- an undoable task is one the tasker goal counts and
// nobody can ever clear.
const SCHOOL_TASKS = [
  { text: 'Count the desks in the classroom', room: 'Classroom', length: LONG },
  { text: 'Count the ceiling tiles along one wall of the classroom', room: 'Classroom', length: LONG },
  { text: 'Find the evacuation map in the classroom and name the nearest exit', room: 'Classroom', length: LONG },
  { text: "Read the teacher's name off the classroom door", room: 'Classroom', length: SHORT },
  { text: 'Count the outlets along one classroom wall', room: 'Classroom', length: SHORT },
  { text: 'Count the posters on the classroom walls', room: 'Classroom', length: SHORT },

  { text: 'Count the lockers between the two closest doorways', room: 'Hallway', length: LONG },
  { text: 'Count the drinking fountains on this floor', room: 'Hallway', length: LONG },
  { text: 'Count the doors along one hallway', room: 'Hallway', length: LONG },
  { text: 'Count the fire extinguishers you can find in the hallways', room: 'Hallway', length: LONG },
  { text: 'Count the classrooms on this floor', room: 'Hallway', length: LONG },
  { text: 'Read the oldest year you can find in the trophy case', room: 'Hallway', length: LONG },
  { text: 'Read the room number on the door at the end of the hall', room: 'Hallway', length: SHORT },

  { text: 'Count the banners hanging in the gym', room: 'Gym', length: LONG },
  { text: 'Count the rows on the gym bleachers', room: 'Gym', length: LONG },
  { text: 'Touch all four corners of the gym floor', room: 'Gym', length: LONG },
  { text: 'Count the basketball hoops in the gym', room: 'Gym', length: SHORT },
  { text: 'Count the doors into the gym', room: 'Gym', length: SHORT },

  { text: 'Count the tables in the cafeteria', room: 'Cafeteria', length: LONG },
  { text: 'Count the seats at one cafeteria table', room: 'Cafeteria', length: SHORT },
  { text: 'Count the trash cans in the cafeteria', room: 'Cafeteria', length: SHORT },
  { text: 'Count the windows in the cafeteria', room: 'Cafeteria', length: SHORT },

  { text: 'Count the computers in the library', room: 'Library', length: LONG },
  { text: 'Read the call number on the book at the end of the top shelf', room: 'Library', length: LONG },
  { text: "Find a library book whose title starts with S and read its author's name", room: 'Library', length: LONG },
  { text: 'Count the tables in the library', room: 'Library', length: SHORT },
  { text: 'Count the shelves on one library bookcase', room: 'Library', length: SHORT },

  { text: 'Read what time the office opens off the sign on its door', room: 'Front office', length: LONG },
  { text: 'Count the chairs in the office waiting area', room: 'Front office', length: SHORT },
  { text: "Count the doors on the school's front entrance", room: 'Front office', length: SHORT }
];

// An LDS meetinghouse. The chapel is in, but only the benches and the
// hymnbooks sitting on them -- nothing on the stand, nothing on the sacrament
// table, nothing near the font.
const CHURCH_TASKS = [
  { text: 'Count the rows of benches on one side of the chapel', room: 'Chapel', length: LONG },
  { text: 'Look up hymn 30 in a hymnbook and read its title', room: 'Chapel', length: LONG },
  { text: 'Count the light fixtures in the chapel', room: 'Chapel', length: LONG },
  { text: 'Count the hymnbooks in one bench row', room: 'Chapel', length: SHORT },
  { text: 'Count the doors into the chapel', room: 'Chapel', length: SHORT },

  { text: 'Read the meeting times off the board in the foyer', room: 'Foyer', length: LONG },
  { text: 'Count the couches in the foyer', room: 'Foyer', length: SHORT },
  { text: 'Count the pictures hanging in the foyer', room: 'Foyer', length: SHORT },
  { text: 'Read the ward name off the sign by the front doors', room: 'Foyer', length: SHORT },

  { text: 'Count the folding chairs on the nearest rack', room: 'Cultural hall', length: LONG },
  { text: 'Touch all four corners of the cultural hall', room: 'Cultural hall', length: LONG },
  { text: 'Count the tables stacked along the cultural hall wall', room: 'Cultural hall', length: LONG },
  { text: 'Count the basketball hoops in the cultural hall', room: 'Cultural hall', length: SHORT },
  { text: 'Count the steps up to the stage', room: 'Cultural hall', length: SHORT },

  { text: 'Count the chairs in one classroom', room: 'Classroom', length: LONG },
  { text: 'Read the room number off a classroom door', room: 'Classroom', length: SHORT },
  { text: 'Count the pictures on one classroom wall', room: 'Classroom', length: SHORT },
  { text: 'Count the tables in one classroom', room: 'Classroom', length: SHORT },

  { text: 'Count the shelves in the library', room: 'Library', length: LONG },
  { text: 'Count the chairs in the library', room: 'Library', length: SHORT },

  { text: 'Count the cupboard doors in the kitchen', room: 'Kitchen', length: LONG },
  { text: 'Count the sinks in the kitchen', room: 'Kitchen', length: SHORT },
  { text: 'Count the ovens in the kitchen', room: 'Kitchen', length: SHORT },

  { text: 'Count the drinking fountains in the building', room: 'Hallway', length: LONG },
  { text: 'Count the doors along the main hallway', room: 'Hallway', length: LONG },
  { text: 'Count the framed pictures in the hallways', room: 'Hallway', length: LONG },
  { text: 'Count the classrooms along the main hallway', room: 'Hallway', length: LONG },
  { text: 'Find the evacuation map and name the nearest exit', room: 'Hallway', length: LONG },
  { text: 'Count the fire extinguishers you can find', room: 'Hallway', length: LONG }
];

const TASK_PACKS_SOURCE = [
  {
    id: 'house',
    name: 'House',
    description: 'Indoors. Nothing to set up, nothing to clean up.',
    tasks: HOUSE_TASKS
  },
  {
    id: 'school',
    name: 'School',
    description: 'A school after hours. Classrooms, halls, gym, cafeteria, library.',
    tasks: SCHOOL_TASKS
  },
  {
    id: 'church',
    name: 'Church',
    description: 'An LDS meetinghouse. Chapel benches, cultural hall, classrooms.',
    tasks: CHURCH_TASKS
  }
];

// Add a pack by appending one object here. Nothing else needs to change --
// the picker renders whatever is in this list, grouped by the rooms it uses.
export const TASK_PACKS = TASK_PACKS_SOURCE;

// Only the text is ever stored, so room and length are recovered by looking
// the text back up. A task the host typed themselves has neither, and that is
// fine: the dealer treats an untagged task as fitting anywhere, so nobody has
// to answer two dropdowns to add "take the recycling out".
const BY_TEXT = new Map(
  TASK_PACKS_SOURCE.flatMap((pack) => pack.tasks.map((task) => [task.text, task]))
);

export const taskMetaFor = (text) => BY_TEXT.get(text) || null;
export const roomFor = (text) => taskMetaFor(text)?.room || null;
export const lengthFor = (text) => taskMetaFor(text)?.length || null;

export const packById = (id) => TASK_PACKS.find((pack) => pack.id === id);

export const taskTexts = (pack) => (pack?.tasks || []).map((task) => task.text);

export function roomsIn(pack) {
  return Array.from(new Set((pack?.tasks || []).map((task) => task.room)));
}

const ALL_PACK_TEXTS = new Set(TASK_PACKS_SOURCE.flatMap((pack) => pack.tasks.map((t) => t.text)));

// One pack at a time: two packs is two buildings, and half the list is then in
// a place nobody is playing in -- a task nobody can reach still counts toward
// the tasker goal, so it is a round the taskers cannot win. A pack counts as
// in use while any of its tasks are on the list, so removing a couple by hand
// does not read as switching away from it.
export function activePackId(tasks = []) {
  const chosen = TASK_PACKS_SOURCE.find(
    (pack) => pack.tasks.some((task) => tasks.includes(task.text))
  );
  return chosen?.id || null;
}

// Swapping packs keeps whatever the host typed themselves. Only pack tasks are
// swept, and only by exact text, so 'Take the recycling out' survives every
// change of building.
export function withPackSelected(tasks = [], packId) {
  const typedByHand = tasks.filter((text) => !ALL_PACK_TEXTS.has(text));
  const pack = packById(packId);
  return pack ? [...taskTexts(pack), ...typedByHand] : typedByHand;
}

// What the pack can supply before anybody has to double up on a chore.
export function packSupports(pack, tasksEach) {
  if (!tasksEach) return 0;
  return Math.floor((pack?.tasks || []).length / tasksEach);
}
