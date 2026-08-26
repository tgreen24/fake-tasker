const KEY = 'fake-tasker:session';
const EXIT_KEY = 'fake-tasker:last-exit';

function readFrom(store) {
  try {
    const raw = store.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function saveSession(gameCode, playerName) {
  if (!gameCode || !playerName) return;
  const value = JSON.stringify({ gameCode, playerName });
  try {
    sessionStorage.setItem(KEY, value);
  } catch (error) {
    console.warn('[session] could not persist session', error);
  }
  // iOS discards backgrounded tabs and rebuilds them on return, and a rebuilt
  // tab does not always come back with its sessionStorage. Without a second
  // copy the app reads that as nobody playing and goes to the home screen
  // mid-game, which is what being kicked out looked like.
  try {
    localStorage.setItem(KEY, value);
  } catch (error) {
    /* private mode and full disks land here; the tab copy still works */
  }
}

// The tab copy wins: two tabs in one browser are two different players, and
// only the per-tab copy can tell them apart. The shared copy is the fallback
// for a tab that came back without one.
export function loadSession() {
  return readFrom(sessionStorage) || readFrom(localStorage);
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (error) {
    console.warn('[session] could not clear session', error);
  }
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    /* nothing to do; the tab copy is the one that matters */
  }
}

// Leaving a game is nearly always deliberate, so when it is not this is the
// only record of why. Outlives the navigation that follows it.
export function recordExit(reason, detail = {}) {
  console.warn(`[exit] sent to the home screen: ${reason}`, detail);
  try {
    localStorage.setItem(EXIT_KEY, JSON.stringify({ reason, ...detail, at: new Date().toISOString() }));
  } catch (error) {
    /* the console line above survives */
  }
}

export function lastExit() {
  try {
    const raw = localStorage.getItem(EXIT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}
