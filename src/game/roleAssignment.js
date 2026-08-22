const IMPOSTER = 'Imposter';
const CREWMATE = 'Crewmate';

export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Players who have been imposter least get the most entries in the draw, so
// the same person does not keep drawing it across a night of rounds.
export function calculateWeights(players, history = {}) {
  const mostTimesImposter = Math.max(0, ...Object.values(history));
  const weights = {};
  players.forEach((player) => {
    weights[player] = mostTimesImposter - (history[player] || 0) + 1;
  });
  return weights;
}

export function selectImposters(players, weights, imposterCount) {
  const draw = [];
  players.forEach((player) => {
    for (let i = 0; i < weights[player]; i++) draw.push(player);
  });

  const pool = shuffleArray(draw);
  const selected = new Set();
  while (selected.size < imposterCount && pool.length > 0) {
    selected.add(pool.pop());
  }
  return Array.from(selected);
}

// Draws from one shared shuffled pool so tasks spread across the group, while
// refilling whenever the pool holds nothing this crewmate is missing. Bounded
// loops: perCrewmate never exceeds the task count, so a fresh task always exists.
export function assignTasksEvenly(crewmates, tasks, tasksPerCrewmate) {
  const perCrewmate = Math.min(tasksPerCrewmate, tasks.length);
  const assignedTasks = {};
  crewmates.forEach((crewmate) => {
    assignedTasks[crewmate] = [];
  });
  if (perCrewmate === 0 || crewmates.length === 0) return assignedTasks;

  let pool = [];
  for (let round = 0; round < perCrewmate; round++) {
    for (let i = 0; i < crewmates.length; i++) {
      const taken = assignedTasks[crewmates[i]];
      let index = pool.findIndex((task) => !taken.includes(task));
      if (index === -1) {
        pool = shuffleArray(tasks).filter((task) => !taken.includes(task));
        index = 0;
      }
      taken.push(pool[index]);
      pool.splice(index, 1);
    }
  }
  return assignedTasks;
}

export function buildRound({ players, tasks, imposterCount, tasksPerCrewmate, imposterHistory = {} }) {
  const weights = calculateWeights(players, imposterHistory);
  const imposters = selectImposters(players, weights, imposterCount);
  const crewmates = players.filter((player) => !imposters.includes(player));

  const roles = {};
  const nextHistory = { ...imposterHistory };
  imposters.forEach((imposter) => {
    roles[imposter] = IMPOSTER;
    nextHistory[imposter] = (nextHistory[imposter] || 0) + 1;
  });
  crewmates.forEach((crewmate) => {
    roles[crewmate] = CREWMATE;
  });

  const completedTasks = {};
  players.forEach((player) => {
    completedTasks[player] = [];
  });

  return {
    roles,
    assignedTasks: assignTasksEvenly(crewmates, tasks, tasksPerCrewmate),
    imposterHistory: nextHistory,
    completedTasks
  };
}
