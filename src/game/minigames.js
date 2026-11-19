import TapInOrder from '../components/minigames/TapInOrder';

// Every minigame takes onSolved and nothing else it needs, so the same game
// can sit on the Practice page, in a lockdown, or behind a task.
export const MINIGAMES = [
  { id: 'tap-in-order', name: 'Tap in Order', Component: TapInOrder }
];

export const minigameById = (id) => MINIGAMES.find((game) => game.id === id);
