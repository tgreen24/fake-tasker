// Every minigame by id, name and icon -- what dealing and the task list need,
// without reaching into the screens. components/minigames attaches each id to
// the component that plays it.
export const MINIGAME_CATALOG = [
  { id: 'match-socks', name: 'Match the Socks', icon: '🧦' },
  { id: 'charge-batteries', name: 'Charge the Batteries', icon: '🔋' },
  { id: 'fix-wiring', name: 'Fix the Wiring', icon: '🔌' },
  { id: 'unscramble-groceries', name: 'Unscramble the Grocery List', icon: '🛒' },
  { id: 'sort-laundry', name: 'Sort the Laundry', icon: '🧺' },
  { id: 'make-change', name: 'Make Change', icon: '💵' },
  { id: 'program-microwave', name: 'Program the Microwave', icon: '📟' },
  { id: 'find-remote', name: 'Find the Remote', icon: '🛋️' },
  { id: 'scrub-dishes', name: 'Scrub the Dishes', icon: '🍽️' },
  { id: 'turn-off-lights', name: 'Turn Off the Lights', icon: '💡' },
  { id: 'fill-glass', name: 'Fill the Glass', icon: '🥛' },
  { id: 'put-away-groceries', name: 'Put Away the Groceries', icon: '🧊' },
  { id: 'count-cookies', name: 'Count the Cookies', icon: '🍪' },
  { id: 'game-night-dice', name: 'Game Night Dice', icon: '🎲' },
  { id: 'sweep-floor', name: 'Sweep the Floor', icon: '🧹' },
  { id: 'tap-in-order', name: 'Tap in Order', icon: '🔢' }
];

export const minigameInfo = (id) => MINIGAME_CATALOG.find((game) => game.id === id) || null;
