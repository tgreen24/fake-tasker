import { revealRoster, deriveGameOverState, decideWinner, winReasonText } from './gameOverState';

const game = (over = {}) => ({
  players: ['tyler', 'sam', 'kai', 'rae'],
  creator: 'tyler',
  creatorUid: 'uid-tyler',
  imposterCount: 1,
  tasksPerCrewmate: 2,
  killList: ['sam'],
  // every player publishes their own role once the round is over
  revealed: { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate', rae: 'Crewmate' },
  winner: 'Imposters',
  ...over
});

describe('revealRoster', () => {
  test('splits everyone by the role they actually played', () => {
    const { imposters, crewmates } = revealRoster(game());
    expect(imposters.map((e) => e.name)).toEqual(['tyler']);
    expect(crewmates.map((e) => e.name)).toEqual(['sam', 'kai', 'rae']);
  });

  test('marks who made it to the end', () => {
    const { crewmates } = revealRoster(game());
    expect(crewmates.find((e) => e.name === 'sam').survived).toBe(false);
    expect(crewmates.find((e) => e.name === 'kai').survived).toBe(true);
  });

  test('keeps roster order so colours match what people saw all game', () => {
    const roster = revealRoster(game());
    const all = [...roster.imposters, ...roster.crewmates];
    expect(new Set(all.map((e) => e.color)).size).toBe(4);
  });

  test('leaves out anyone whose role has not been published', () => {
    const withLatecomer = game({ players: ['tyler', 'sam', 'kai', 'rae', 'ghost'] });
    const { imposters, crewmates } = revealRoster(withLatecomer);
    expect([...imposters, ...crewmates].map((e) => e.name)).not.toContain('ghost');
  });

  test('survives a game that never started', () => {
    expect(revealRoster(null)).toEqual({ imposters: [], crewmates: [], pending: 0 });
  });

  test('handles several imposters', () => {
    const twoImposters = game({ revealed: { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' } });
    expect(revealRoster(twoImposters).imposters.map((e) => e.name)).toEqual(['tyler', 'rae']);
  });
});

describe('deriveGameOverState', () => {
  test('carries the roster alongside the result', () => {
    const state = deriveGameOverState(game(), 'sam', 'uid-sam', { role: 'Crewmate' });
    expect(state.roster.imposters).toHaveLength(1);
    expect(state.playerWon).toBe(false);
  });

  test('still reports the winner it was given', () => {
    expect(decideWinner(game({ winner: 'Crewmates' }))).toBe('Crewmates');
  });
});


describe('winReasonText', () => {
  const reason = (winReason) => winReasonText({ winReason });

  test('names all four ways a round can end', () => {
    expect(reason('tasks')).toBe('All tasks completed');
    expect(reason('imposters-ejected')).toBe('Every traitor was voted out');
    expect(reason('kills')).toBe('The taskers were outnumbered');
    expect(reason('ejection')).toBe('The taskers voted out one of their own');
  });

  test('says nothing rather than inventing a reason for older rounds', () => {
    expect(reason(undefined)).toBe('');
    expect(winReasonText(null)).toBe('');
  });

  test('ignores a reason it does not recognise', () => {
    expect(reason('something-else')).toBe('');
  });
});
