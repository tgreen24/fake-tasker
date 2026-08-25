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

const TASK_PACKS_SOURCE = [
  {
    id: 'house',
    name: 'House',
    description: 'Indoors. Nothing to set up, nothing to clean up.',
    tasks: HOUSE_TASKS
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

// What the pack can supply before anybody has to double up on a chore.
export function packSupports(pack, tasksEach) {
  if (!tasksEach) return 0;
  return Math.floor((pack?.tasks || []).length / tasksEach);
}
