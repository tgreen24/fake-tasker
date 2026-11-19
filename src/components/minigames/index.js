import TapInOrder from './TapInOrder';
import MatchTheSocks from './MatchTheSocks';
import ChargeTheBatteries from './ChargeTheBatteries';
import FixTheWiring from './FixTheWiring';
import UnscrambleGroceries from './UnscrambleGroceries';
import SortTheLaundry from './SortTheLaundry';
import MakeChange from './MakeChange';
import ProgramTheMicrowave from './ProgramTheMicrowave';
import FindTheRemote from './FindTheRemote';
import ScrubTheDishes from './ScrubTheDishes';
import TurnOffTheLights from './TurnOffTheLights';
import FillTheGlass from './FillTheGlass';
import PutAwayGroceries from './PutAwayGroceries';
import CountTheCookies from './CountTheCookies';
import GameNightDice from './GameNightDice';
import SweepTheFloor from './SweepTheFloor';

// Every minigame takes onSolved and nothing else, so the same game can sit on
// the Practice page, in a lockdown, or behind a task.
export const MINIGAMES = [
  { id: 'match-socks', name: 'Match the Socks', icon: '🧦', Component: MatchTheSocks },
  { id: 'charge-batteries', name: 'Charge the Batteries', icon: '🔋', Component: ChargeTheBatteries },
  { id: 'fix-wiring', name: 'Fix the Wiring', icon: '🔌', Component: FixTheWiring },
  { id: 'unscramble-groceries', name: 'Unscramble the Grocery List', icon: '🛒', Component: UnscrambleGroceries },
  { id: 'sort-laundry', name: 'Sort the Laundry', icon: '🧺', Component: SortTheLaundry },
  { id: 'make-change', name: 'Make Change', icon: '💵', Component: MakeChange },
  { id: 'program-microwave', name: 'Program the Microwave', icon: '📟', Component: ProgramTheMicrowave },
  { id: 'find-remote', name: 'Find the Remote', icon: '🛋️', Component: FindTheRemote },
  { id: 'scrub-dishes', name: 'Scrub the Dishes', icon: '🍽️', Component: ScrubTheDishes },
  { id: 'turn-off-lights', name: 'Turn Off the Lights', icon: '💡', Component: TurnOffTheLights },
  { id: 'fill-glass', name: 'Fill the Glass', icon: '🥛', Component: FillTheGlass },
  { id: 'put-away-groceries', name: 'Put Away the Groceries', icon: '🧊', Component: PutAwayGroceries },
  { id: 'count-cookies', name: 'Count the Cookies', icon: '🍪', Component: CountTheCookies },
  { id: 'game-night-dice', name: 'Game Night Dice', icon: '🎲', Component: GameNightDice },
  { id: 'sweep-floor', name: 'Sweep the Floor', icon: '🧹', Component: SweepTheFloor },
  { id: 'tap-in-order', name: 'Tap in Order', icon: '🔢', Component: TapInOrder }
];

export const minigameById = (id) => MINIGAMES.find((game) => game.id === id);
