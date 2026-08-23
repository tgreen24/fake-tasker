// The stored role values stay 'Imposter' and 'Crewmate'. They are written into
// every game document, compared throughout, and used as CSS class names, so
// renaming them would break every in-flight game for the sake of two words.
// This is the display layer only.
export const TRAITOR = 'Traitor';
export const TASKER = 'Tasker';

const TERMS = {
  Imposter: { one: TRAITOR, many: 'Traitors', lower: 'traitor', lowerMany: 'traitors' },
  Crewmate: { one: TASKER, many: 'Taskers', lower: 'tasker', lowerMany: 'taskers' }
};

export const roleName = (role) => TERMS[role]?.one || role;
export const roleNamePlural = (role) => TERMS[role]?.many || role;
export const roleNameLower = (role) => TERMS[role]?.lower || role;
export const roleNameLowerPlural = (role) => TERMS[role]?.lowerMany || role;

// What the group does to somebody by vote. The stored field is still called
// ejected; this is the word players see.
export const EXILED = 'exiled';

// Winner is stored as the plural team name.
export const teamName = (winner) =>
  winner === 'Imposters' ? 'Traitors' : winner === 'Crewmates' ? 'Taskers' : winner;
