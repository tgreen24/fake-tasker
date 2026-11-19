import TapInOrder from './TapInOrder';
import MatchTheSocks from './MatchTheSocks';
import ChargeTheBatteries from './ChargeTheBatteries';
import FixTheWiring from './FixTheWiring';
import UnscrambleGroceries from './UnscrambleGroceries';
import SortTheLaundry from './SortTheLaundry';

// Every minigame takes onSolved and nothing else, so the same game can sit on
// the Practice page, in a lockdown, or behind a task.
export const MINIGAMES = [
  { id: 'match-socks', name: 'Match the Socks', icon: '🧦', Component: MatchTheSocks },
  { id: 'charge-batteries', name: 'Charge the Batteries', icon: '🔋', Component: ChargeTheBatteries },
  { id: 'fix-wiring', name: 'Fix the Wiring', icon: '🔌', Component: FixTheWiring },
  { id: 'unscramble-groceries', name: 'Unscramble the Grocery List', icon: '🛒', Component: UnscrambleGroceries },
  { id: 'sort-laundry', name: 'Sort the Laundry', icon: '🧺', Component: SortTheLaundry },
  { id: 'tap-in-order', name: 'Tap in Order', icon: '🔢', Component: TapInOrder }
];

export const minigameById = (id) => MINIGAMES.find((game) => game.id === id);
