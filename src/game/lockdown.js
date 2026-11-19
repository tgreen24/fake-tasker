// Lockdown: a sabotage a living traitor sets off. Every living player is put in
// a pair, as either the one giving a code or the one entering it, and the
// taskers have a short time to pass enough codes along by hand.
//
// Two rules shape everything here:
//
//   Taskers can always lift it by themselves. Traitors are paired with each
//   other wherever possible, and the target only counts pairs with no traitor
//   in them -- so a traitor refusing to give or enter a code can slow things
//   down but never block them.
//
//   Nobody's screen changes because of somebody else. A pair whose giver or
//   receiver is killed quietly counts as done, so the partner keeps looking for
//   them exactly as before and the counter moves the way it would for an entry.

// Overridable so the phone simulator does not sit through two real minutes.
export const LOCKDOWN_SECONDS = Number(process.env.REACT_APP_LOCKDOWN_SECONDS) || 90;
export const LOCKDOWN_COOLDOWN_SECONDS = Number(process.env.REACT_APP_LOCKDOWN_COOLDOWN_SECONDS) || 120;
export const CODE_LENGTH = 6;

// No 0/O, 1/I/L: codes are read aloud across a room and typed on a phone.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const TRAITOR = 'Imposter';

function shuffled(list, random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export const formatCode = (code = '') => `${code.slice(0, 3)}-${code.slice(3)}`;

export const normalizeCode = (typed = '') => typed.toUpperCase().replace(/[^A-Z0-9]/g, '');

function pairUp(names, random) {
  const order = shuffled(names, random);
  const pairs = [];
  while (order.length >= 2) {
    const [giver, receiver] = order.splice(0, 2);
    pairs.push({ giver, receivers: [receiver] });
  }
  return { pairs, leftover: order[0] || null };
}

// Built on the phone of the traitor setting it off, since only a traitor knows
// who everyone is. Returns null when there are not two taskers left to pair,
// which only happens in a round that is already over.
export function buildLockdown({ players = [], killList = [], roleMap = {} }, now = Date.now(), random = Math.random) {
  const alive = players.filter((name) => !killList.includes(name));
  const traitors = alive.filter((name) => roleMap[name] === TRAITOR);
  const taskers = alive.filter((name) => roleMap[name] && roleMap[name] !== TRAITOR);
  if (taskers.length < 2) return null;

  const taskerSide = pairUp(taskers, random);
  const traitorSide = pairUp(traitors, random);
  const pairs = [...taskerSide.pairs, ...traitorSide.pairs];
  const spareTasker = taskerSide.leftover;
  const spareTraitor = traitorSide.leftover;

  if (spareTasker && spareTraitor) {
    const giverIsTasker = random() < 0.5;
    pairs.push({
      giver: giverIsTasker ? spareTasker : spareTraitor,
      receivers: [giverIsTasker ? spareTraitor : spareTasker]
    });
  } else if (spareTasker || spareTraitor) {
    // Nobody to pair with, so they become a second receiver of somebody's code.
    // A spare tasker joins a tasker pair, keeping it solvable twice over; a
    // spare traitor goes wherever, since the pair they join never depended on
    // them.
    const spare = spareTasker || spareTraitor;
    const homes = spareTasker
      ? pairs.filter((pair) => taskers.includes(pair.giver))
      : pairs;
    homes[Math.floor(random() * homes.length)].receivers.push(spare);
  }

  const used = new Set();
  const coded = shuffled(pairs, random).map((pair) => {
    let code = makeCode(random);
    while (used.has(code)) code = makeCode(random);
    used.add(code);
    return { ...pair, code };
  });

  const taskerLinks = linksOf({ pairs: coded })
    .filter((link) => taskers.includes(link.giver) && taskers.includes(link.receiver)).length;

  return {
    startedAt: now,
    until: now + LOCKDOWN_SECONDS * 1000,
    pairs: coded,
    needed: Math.max(1, Math.ceil(taskerLinks / 2)),
    entered: {}
  };
}

// One giver handing one receiver a code. A giver with two receivers is two.
export function linksOf(lockdown) {
  return (lockdown?.pairs || []).flatMap((pair) =>
    pair.receivers.map((receiver) => ({ giver: pair.giver, receiver, code: pair.code }))
  );
}

export function lockdownProgress(gameData) {
  const lockdown = gameData?.lockdown;
  if (!lockdown?.pairs) return { active: false, done: 0, needed: 0 };
  const out = gameData?.killList || [];
  const entered = lockdown.entered || {};
  const done = linksOf(lockdown).filter(
    (link) => entered[link.receiver] || out.includes(link.giver) || out.includes(link.receiver)
  ).length;
  return { active: true, done, needed: lockdown.needed, until: lockdown.until };
}

// 'lifted' | 'failed' | null. Lifting wins a tie with the clock: a code that
// made it in counts even if the phone settling it is a second late.
export function lockdownVerdict(gameData, now = Date.now()) {
  const progress = lockdownProgress(gameData);
  if (!progress.active) return null;
  if (progress.done >= progress.needed) return 'lifted';
  if (now >= progress.until) return 'failed';
  return null;
}

// What this player has to do, or null if they are not in it.
export function lockdownPartFor(gameData, playerName) {
  const lockdown = gameData?.lockdown;
  if (!lockdown?.pairs || (gameData?.killList || []).includes(playerName)) return null;
  for (const pair of lockdown.pairs) {
    if (pair.giver === playerName) return { kind: 'give', code: pair.code, to: pair.receivers };
    if (pair.receivers.includes(playerName)) {
      return {
        kind: 'receive',
        from: pair.giver,
        code: pair.code,
        entered: !!(lockdown.entered || {})[playerName]
      };
    }
  }
  return null;
}
