import { useEffect, useRef } from 'react';
import { publishOwnRole } from '../game/mutations';

// A round cannot be adjudicated while somebody is out whose role nobody has
// published -- counting them as still playing would end games early, so the
// verdict waits instead. Kills publish the victim's role in the same commit,
// so they are fine. Exiles were not: the exiled player published their own,
// from an effect that only existed on the voting screen, and that screen is
// gone five seconds later. Close the tab inside that window and the round
// could never end again, for anybody, by any means.
//
// Two ways out of that, because one is not enough. You republish from wherever
// you are, for as long as it has not landed. And a traitor, who was handed
// everybody's role at the deal, publishes for anyone still missing -- which
// covers the player who closed the tab and never came back.
export function usePublishOutRoles(gameCode, gameData, playerName, privateData) {
  const attempted = useRef(new Set());
  const live = !!gameData?.gameStarted;
  const killList = gameData?.killList;
  const revealed = gameData?.revealed;
  const role = privateData?.role;
  const roleMap = privateData?.roleMap;

  useEffect(() => {
    if (!live || !gameCode) return;

    const out = killList || [];
    const known = revealed || {};

    // Marked before the write so a burst of snapshots does not send it twice,
    // and unmarked if it failed -- a write nobody retries is how this got
    // stranded in the first place.
    const publish = (name, theirRole) => {
      if (!theirRole || known[name] || attempted.current.has(name)) return;
      attempted.current.add(name);
      publishOwnRole(gameCode, name, theirRole).then((saved) => {
        if (!saved) attempted.current.delete(name);
      });
    };

    if (playerName && out.includes(playerName)) publish(playerName, role);
    if (roleMap) out.forEach((name) => publish(name, roleMap[name]));
  }, [live, gameCode, playerName, role, roleMap, killList, revealed]);

  // A fresh round wipes the reveals, so what was already sent stops counting.
  useEffect(() => {
    if (!live) attempted.current.clear();
  }, [live]);
}
