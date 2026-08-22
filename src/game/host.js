// The rules decide the host by uid, so the UI has to ask the same question.
// Deciding by display name shows buttons the server will refuse, and a
// rejected write reverts after Firestore has already applied it locally --
// which looks like the screen bouncing rather than an error.
export function isHost(gameData, uid) {
  return !!uid && !!gameData?.creatorUid && gameData.creatorUid === uid;
}

// A game created before creatorUid existed, or whose host lost their account,
// has nobody who can start, end or delete it.
export function hasReachableHost(gameData) {
  return !!gameData?.creatorUid;
}
