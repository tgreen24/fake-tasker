// One badge per player. Each badge is decided across the whole table, in the
// order below, and is only handed out if the player it names is still free --
// so the traitor with three kills takes Assassin rather than also taking Most
// Suspicious, and Most Suspicious is then not awarded at all rather than
// sliding down to somebody who took a single vote.
//
// A badge that nobody clearly earned is not awarded. "Most" needs one player
// genuinely ahead of the rest, and a badge that describes what somebody did
// needs them to be the only one who did it. Four players who all voted the
// same way did not include a standout, and saying one of them had good
// instincts is a coin flip dressed up as an award.

const IMPOSTER = 'Imposter';
const CREWMATE = 'Crewmate';

function tallies(gameData) {
  const revealed = gameData?.revealed || {};
  const players = gameData?.players || [];
  const killList = gameData?.killList || [];
  const kills = gameData?.kills || {};
  const voteLog = gameData?.voteLog || [];
  const taskCounts = gameData?.taskCounts || {};
  const finishedAt = gameData?.finishedAt || {};

  const killCount = {};
  Object.values(kills).forEach((killer) => {
    if (killer) killCount[killer] = (killCount[killer] || 0) + 1;
  });

  const votesReceived = {};
  const correctVotes = {};
  const votesCast = {};
  const skipsCast = {};
  const meetingsCalled = {};
  const everVoted = new Set();
  const unanimousAgainst = new Set();

  voteLog.forEach((meeting) => {
    if (meeting?.caller) meetingsCalled[meeting.caller] = (meetingsCalled[meeting.caller] || 0) + 1;

    const cast = Object.entries(meeting?.votes || {});
    cast.forEach(([voter, target]) => {
      everVoted.add(voter);
      votesCast[voter] = (votesCast[voter] || 0) + 1;
      if (target === 'skip') {
        skipsCast[voter] = (skipsCast[voter] || 0) + 1;
        return;
      }
      votesReceived[target] = (votesReceived[target] || 0) + 1;
      if (revealed[target] === IMPOSTER) correctVotes[voter] = (correctVotes[voter] || 0) + 1;
    });

    // Everybody except the target picked the target. Their own vote is left out
    // of it -- you cannot vote for yourself, so counting it would make this
    // impossible to earn rather than merely rare.
    const named = cast.filter(([, target]) => target !== 'skip').map(([, target]) => target);
    const candidate = named[0];
    if (candidate) {
      const others = cast.filter(([voter]) => voter !== candidate);
      const allAgreed = others.length >= 3 && others.every(([, target]) => target === candidate);
      if (allAgreed) unanimousAgainst.add(candidate);
    }
  });


  return {
    players,
    revealed,
    killList,
    kills,
    voteLog,
    taskCounts,
    finishedAt,
    killCount,
    votesReceived,
    correctVotes,
    votesCast,
    skipsCast,
    meetingsCalled,
    unanimousAgainst,
    everVoted,
    survived: (name) => !killList.includes(name),
    is: (name, role) => revealed[name] === role
  };
}

// A superlative needs somebody genuinely out in front. Two people tied for
// "most" means neither was the most, and everybody tied means the word has no
// content at all -- so this returns nothing rather than picking by roster
// order and calling it an award.
function best(names, score) {
  const scored = names.map((name) => ({ name, value: score(name) })).filter((e) => e.value > 0);
  if (scored.length === 0) return null;

  const top = Math.max(...scored.map((e) => e.value));
  const leaders = scored.filter((e) => e.value === top);
  return leaders.length === 1 ? leaders[0].name : null;
}

// For badges that describe a thing somebody did rather than did most. If three
// people were never voted for, none of them was "the one nobody suspected".
function sole(names, matches) {
  const hits = names.filter(matches);
  return hits.length === 1 ? hits[0] : null;
}

export const BADGES = [
  {
    id: 'mostKills',
    label: 'Assassin',
    tone: 'danger',
    // With a single traitor this says nothing -- of course they got the most.
    // It only means anything when traitors are competing with each other.
    find: (t, all) => {
      const traitors = Object.keys(t.revealed).filter((n) => t.revealed[n] === IMPOSTER);
      if (traitors.length < 2) return null;
      return best(all, (n) => t.killCount[n] || 0);
    }
  },
  {
    id: 'cleanHands',
    tone: 'danger',
    label: 'Clean Hands',
    describe: 'Won without a single kill',
    find: (t, all, gameData) => {
      if (gameData?.winner !== 'Imposters') return null;
      return sole(all, (n) => t.is(n, IMPOSTER) && !t.killCount[n]);
    }
  },
  {
    id: 'doubleAgent',
    label: 'Double Agent',
    tone: 'danger',
    describe: 'Voted against their own',
    // Only possible with more than one traitor, which is also the only shape
    // Most Kills fires in -- so those rounds get their own flavour.
    find: (t, all) => sole(all, (n) => {
      if (!t.is(n, IMPOSTER)) return false;
      return t.voteLog.some((meeting) => {
        const target = meeting?.votes?.[n];
        return target && target !== 'skip' && target !== n && t.is(target, IMPOSTER);
      });
    })
  },
  {
    id: 'gotAwayWithIt',
    label: 'Betrayer',
    tone: 'danger',
    describe: 'Won without ever being voted for',
    find: (t, all, gameData) => {
      if (gameData?.winner !== 'Imposters' || t.voteLog.length === 0) return null;
      return sole(all, (n) => t.is(n, IMPOSTER) && !t.votesReceived[n]);
    }
  },
  {
    id: 'unanimous',
    label: 'Unanimous',
    tone: 'violet',
    describe: 'Everybody voted the same way',
    find: (t, all) => sole(all, (n) => t.unanimousAgainst.has(n))
  },
  {
    id: 'rightEveryTime',
    label: 'Detective',
    tone: 'accent',
    describe: 'Every vote was a traitor',
    find: (t, all) => sole(all, (n) => {
      const cast = t.votesCast[n] || 0;
      return cast >= 2 && (t.correctVotes[n] || 0) === cast;
    })
  },
  {
    id: 'selfReport',
    label: 'Self Report',
    tone: 'violet',
    describe: 'Called the meeting themselves',
    find: (t, all) => sole(all, (n) => t.is(n, IMPOSTER) && (t.meetingsCalled[n] || 0) > 0)
  },
  {
    id: 'fastestTasker',
    tone: 'success',
    label: 'Fastest Tasker',
    find: (t, all) => {
      const finishers = all.filter((n) => t.is(n, CREWMATE) && t.finishedAt[n]);
      if (finishers.length === 0) return null;
      return finishers.reduce((a, b) => (t.finishedAt[a] <= t.finishedAt[b] ? a : b));
    }
  },
  {
    id: 'mostSuspicious',
    tone: 'warn',
    label: 'Most Suspicious',
    describe: 'Took the most votes',
    find: (t, all) => best(all, (n) => t.votesReceived[n] || 0)
  },
  {
    id: 'mostIntuitive',
    tone: 'accent',
    label: 'Good Instincts',
    describe: 'Voted for a traitor most often',
    find: (t, all) => best(all, (n) => t.correctVotes[n] || 0)
  },
  {
    id: 'mostMeetings',
    label: 'Whistle Blower',
    tone: 'warn',
    describe: 'Called the most meetings',
    find: (t, all) => best(all, (n) => t.meetingsCalled[n] || 0)
  },
  {
    id: 'neverSuspected',
    label: 'Trustworthy',
    tone: 'success',
    describe: 'Nobody voted for them all game',
    // Taskers only. Betrayer catches a traitor who won unsuspected, but one who
    // lost would otherwise fall through to here -- and this badge's entire
    // meaning is that you were not the traitor.
    find: (t, all) => {
      if (t.voteLog.length === 0) return null;
      return sole(all, (n) => t.is(n, CREWMATE) && !t.votesReceived[n]);
    }
  },
  {
    id: 'firstOut',
    tone: 'violet',
    label: 'First Out',
    find: (t, all) => {
      const first = t.killList[0];
      return first && all.includes(first) ? first : null;
    }
  },
  {
    id: 'lazyTasker',
    tone: 'muted',
    label: 'Lazy Tasker',
    describe: 'Finished the fewest tasks',
    // Traitors are excluded, or they would win this every single game with none.
    find: (t, all) => {
      const taskers = all.filter((n) => t.is(n, CREWMATE));
      if (taskers.length < 2) return null;
      const counts = taskers.map((n) => t.taskCounts[n] || 0);
      const fewest = Math.min(...counts);
      if (fewest === Math.max(...counts)) return null;
      return sole(taskers, (n) => (t.taskCounts[n] || 0) === fewest);
    }
  },
  {
    id: 'skippedEverything',
    label: 'Unsure',
    tone: 'muted',
    describe: 'Skipped every vote they cast',
    find: (t, all) => sole(all, (n) => {
      const cast = t.votesCast[n] || 0;
      return cast >= 2 && (t.skipsCast[n] || 0) === cast;
    })
  },
  {
    id: 'neverVoted',
    tone: 'muted',
    label: 'Distracted',
    describe: 'Never cast a vote',
    find: (t, all) => {
      if (t.voteLog.length === 0) return null;
      return sole(all, (n) => t.survived(n) && !t.everVoted.has(n));
    }
  }
];

export function awardBadges(gameData) {
  const t = tallies(gameData);
  const taken = new Set();
  const awarded = {};

  // Every badge is decided across the whole roster. If the player it belongs to
  // already has one, it simply is not awarded -- handing it to the runner-up
  // would name somebody the most suspicious when they took a single vote.
  const dealt = t.players.filter((name) => t.revealed[name]);

  BADGES.forEach((badge) => {
    const winner = badge.find(t, dealt, gameData);
    if (!winner || taken.has(winner)) return;

    taken.add(winner);
    awarded[winner] = {
      id: badge.id,
      label: badge.label,
      tone: badge.tone || 'muted',
      describe: badge.describe || ''
    };
  });

  return awarded;
}

export function roundDurationMs(gameData) {
  const start = gameData?.roundStartedAt;
  const end = gameData?.endedAt;
  if (!start || !end || end < start) return 0;
  return end - start;
}
