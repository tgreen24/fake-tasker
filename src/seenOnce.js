const PREFIX = 'fake-tasker:seen:';

// True the first time this phone asks about a moment, false after that, so a
// one-off moment (the killed screen) plays once even if the tab is rebuilt.
// Kept in localStorage because iOS can rebuild a backgrounded tab without its
// sessionStorage. Storage that is unavailable means it plays again: better
// than never playing.
export function firstTime(key) {
  try {
    if (localStorage.getItem(PREFIX + key)) return false;
    localStorage.setItem(PREFIX + key, '1');
  } catch (error) {
    /* private mode: no memory, so it shows */
  }
  return true;
}
