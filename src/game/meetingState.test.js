import {
  deriveMeetingState, resolverDelayMs, secondsUntil,
  HOST_HEAD_START_MS, PEER_STAGGER_MS
} from './meetingState';
import { RESULT_DISPLAY_MS } from '../gameRoute';

const NOW = 1_000_000;
const HOST_UID = 'uid-tyler';
const ROLES = { tyler: 'Imposter', sam: 'Crewmate', kai: 'Crewmate' };
const traitorDoc = { role: 'Imposter', roleMap: ROLES };
const taskerDoc = { role: 'Crewmate' };

const meeting = (over = {}) => ({
  players: ['tyler', 'sam', 'kai'],
  creator: 'tyler',
  creatorUid: HOST_UID,
  revealed: {},
  killList: [],
  votes: {},
  meetingCalled: true,
  meetingCaller: 'sam',
  ...over
});

describe('deriveMeetingState', () => {
  test('counts only living voters', () => {
    const s = deriveMeetingState(meeting({ killList: ['kai'], votes: { tyler: 'skip', kai: 'sam' } }), 'tyler', undefined, traitorDoc);
    expect(s.alivePlayers).toEqual(['tyler', 'sam']);
    expect(s.votesCast).toBe(1);
  });

  test('knows whether the viewer is alive and hosting', () => {
    const s = deriveMeetingState(meeting({ killList: ['sam'] }), 'sam', 'uid-sam', taskerDoc);
    expect(s.isAlive).toBe(false);
    expect(s.isCreator).toBe(false);
    expect(deriveMeetingState(meeting(), 'tyler', HOST_UID).isCreator).toBe(true);
    expect(deriveMeetingState(meeting(), 'tyler', 'uid-sam', traitorDoc).isCreator).toBe(false);
  });

  test('surfaces the viewer own vote once cast', () => {
    expect(deriveMeetingState(meeting({ votes: { sam: 'tyler' } }), 'sam', undefined, taskerDoc).myVote).toBe('tyler');
    expect(deriveMeetingState(meeting(), 'sam', undefined, taskerDoc).myVote).toBeUndefined();
  });

  test('is not ended while the meeting runs', () => {
    expect(deriveMeetingState(meeting(), 'sam', undefined, taskerDoc).votingEnded).toBe(false);
  });

  test('is ended inside the result window', () => {
    const data = meeting({ meetingCalled: false, votingResult: 'skipped', resultUntil: Date.now() + 2000 });
    expect(deriveMeetingState(data, 'sam', undefined, taskerDoc).votingEnded).toBe(true);
  });

  test('stays ended after the window lapses, so the screen does not flash back', () => {
    const data = meeting({ meetingCalled: false, votingResult: 'skipped', resultUntil: Date.now() - 1 });
    expect(deriveMeetingState(data, 'sam', undefined, taskerDoc).votingEnded).toBe(true);
  });

  test('offers an imposter only living non-imposters, never themselves', () => {
    const s = deriveMeetingState(meeting({ killList: ['kai'] }), 'tyler', undefined, traitorDoc);
    expect(s.killableBy('tyler')).toEqual(['sam']);
  });

  test('never offers a fellow imposter as a kill target', () => {
    const data = meeting({ players: ['tyler', 'rae', 'sam'] });
    const twoTraitors = { role: 'Imposter', roleMap: { tyler: 'Imposter', rae: 'Imposter', sam: 'Crewmate' } };
    expect(deriveMeetingState(data, 'tyler', undefined, twoTraitors).killableBy('tyler')).toEqual(['sam']);
  });

  test('survives a missing document', () => {
    const s = deriveMeetingState(null, 'sam', undefined, taskerDoc);
    expect(s.alivePlayers).toEqual([]);
    expect(s.votesCast).toBe(0);
    expect(s.meetingCalled).toBe(false);
  });
});

describe('resolverDelayMs', () => {
  const players = ['tyler', 'sam', 'kai'];

  test('the host attempts immediately', () => {
    expect(resolverDelayMs(players, 'tyler', true)).toBe(0);
  });

  test('peers wait behind the host so the common case is one write', () => {
    expect(resolverDelayMs(players, 'tyler', false)).toBe(HOST_HEAD_START_MS);
    expect(resolverDelayMs(players, 'sam', false)).toBe(HOST_HEAD_START_MS + PEER_STAGGER_MS);
  });

  test('peers are staggered against each other, not simultaneous', () => {
    const delays = players.map((p) => resolverDelayMs(players, p, false));
    expect(new Set(delays).size).toBe(players.length);
  });

  test('a player missing from the roster still gets a sane delay', () => {
    expect(resolverDelayMs(players, 'ghost', false)).toBe(HOST_HEAD_START_MS);
  });
});

describe('secondsUntil', () => {
  test('is null with no deadline', () => expect(secondsUntil(undefined, NOW)).toBeNull());
  test('rounds up remaining time', () => expect(secondsUntil(NOW + 2400, NOW)).toBe(3));
  test('never goes negative', () => expect(secondsUntil(NOW - 9000, NOW)).toBe(0));
  test('covers the full result window', () => {
    expect(secondsUntil(NOW + RESULT_DISPLAY_MS, NOW)).toBe(RESULT_DISPLAY_MS / 1000);
  });
});
