// Firestore calls have no deadline of their own. On a phone that has lost the
// network without noticing, a tap sits on "Creating…" for as long as the user
// is willing to look at it, which reads as a button that does nothing.
//
// The underlying write is not cancelled -- it cannot be -- we just stop waiting
// on it and say so.
export const NETWORK_TIMEOUT_MS = 10000;

export class TimedOut extends Error {
  constructor() {
    super('timed out');
    this.name = 'TimedOut';
  }
}

export function withTimeout(promise, ms = NETWORK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimedOut()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export const isTimeout = (error) => error instanceof TimedOut;
