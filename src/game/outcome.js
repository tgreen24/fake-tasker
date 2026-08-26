// Adjudication from public data only.
//
// Roles are moving into per-player documents that only their owner can read,
// so no client will be able to see who is still what. It does not need to:
// the totals are public settings, and a role becomes public the moment its
// owner is out -- published by whoever already knew it. The killer knows their
// victim's role, and an ejected player knows their own.

export function totalsFor(gameData) {
  const players = gameData?.players || [];
  const traitors = Math.max(0, Math.min(gameData?.imposterCount || 1, players.length));
  return { players: players.length, traitors, taskers: players.length - traitors };
}

// Everyone out of the game, with the role they turned out to be.
export function revealedRoles(gameData) {
  const revealed = gameData?.revealed || {};
  const out = gameData?.killList || [];
  const counted = {};
  out.forEach((player) => {
    if (revealed[player]) counted[player] = revealed[player];
  });
  return counted;
}

export function livingCounts(gameData) {
  const totals = totalsFor(gameData);
  const revealed = revealedRoles(gameData);
  const values = Object.values(revealed);

  const traitorsOut = values.filter((role) => role === 'Imposter').length;
  const taskersOut = values.filter((role) => role === 'Crewmate').length;

  return {
    traitors: Math.max(0, totals.traitors - traitorsOut),
    taskers: Math.max(0, totals.taskers - taskersOut),
    // Anyone out whose role has not been published yet. Adjudicating while
    // this is non-zero would count them as still alive and call the game late.
    unaccounted: (gameData?.killList || []).length - values.length
  };
}

export function taskGoal(gameData) {
  const { taskers } = totalsFor(gameData);
  return taskers * (gameData?.tasksPerCrewmate || 0);
}

export function tasksDone(gameData) {
  return Math.max(0, gameData?.tasksCompleted || 0);
}

export function taskProgress(gameData) {
  const goal = taskGoal(gameData);
  const done = Math.min(tasksDone(gameData), goal);
  return { done, goal, percent: goal > 0 ? Math.round((done / goal) * 100) : 0 };
}

// Returns 'Crewmates' | 'Imposters' | null, using only what everyone can see.
export function decideOutcomeFromCounts(gameData) {
  const { traitors, taskers, unaccounted } = livingCounts(gameData);
  const { done, goal } = taskProgress(gameData);
  const tasksFinished = goal > 0 && done >= goal;

  // Who is still what cannot be worked out until everyone out has had their
  // role published, and guessing would end rounds early. Finishing the tasks
  // is the one victory that never needed to know: they are either all done or
  // they are not. That matters because the player who owes the reveal may be
  // the one who has gone -- an exiled traitor who closed the tab owes a role
  // nobody else holds, and without this the round could never end at all. A
  // traitor is dealt no tasks, so their leaving cannot put the goal out of
  // reach either.
  if (unaccounted > 0) return tasksFinished ? 'Crewmates' : null;

  if (traitors === 0) return 'Crewmates';
  if (traitors >= taskers) return 'Imposters';
  if (tasksFinished) return 'Crewmates';

  return null;
}

// Inferred from the board rather than threaded through the action that caused
// it, so whichever client settles the round reports the same reason.
export function winReasonFor(gameData, winner) {
  const { done, goal } = taskProgress(gameData);
  if (winner === 'Crewmates') {
    if (goal > 0 && done >= goal) return 'tasks';
    return 'imposters-ejected';
  }

  const ejected = gameData?.ejected;
  const wasEjected = !!ejected && (gameData?.killList || []).includes(ejected);
  return wasEjected ? 'ejection' : 'kills';
}
