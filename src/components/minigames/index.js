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

import { MINIGAME_CATALOG } from '../../game/minigames/catalog';

const COMPONENTS = {
  'match-socks': MatchTheSocks,
  'charge-batteries': ChargeTheBatteries,
  'fix-wiring': FixTheWiring,
  'unscramble-groceries': UnscrambleGroceries,
  'sort-laundry': SortTheLaundry,
  'make-change': MakeChange,
  'program-microwave': ProgramTheMicrowave,
  'find-remote': FindTheRemote,
  'scrub-dishes': ScrubTheDishes,
  'turn-off-lights': TurnOffTheLights,
  'fill-glass': FillTheGlass,
  'put-away-groceries': PutAwayGroceries,
  'count-cookies': CountTheCookies,
  'game-night-dice': GameNightDice,
  'sweep-floor': SweepTheFloor,
  'tap-in-order': TapInOrder
};

// Every minigame takes onSolved and nothing else, so the same game can sit on
// the Practice page, in a lockdown, or behind a task.
export const MINIGAMES = MINIGAME_CATALOG.map((game) => ({ ...game, Component: COMPONENTS[game.id] }));

export const minigameById = (id) => MINIGAMES.find((game) => game.id === id);
