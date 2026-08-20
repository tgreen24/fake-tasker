const KEY = 'fake-tasker:session';

export function saveSession(gameCode, playerName) {
  if (!gameCode || !playerName) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ gameCode, playerName }));
  } catch (error) {
    console.warn('[session] could not persist session', error);
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (error) {
    console.warn('[session] could not clear session', error);
  }
}
