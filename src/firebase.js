import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously
} from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Inert until a reCAPTCHA v3 site key exists, so local dev and the current
// deploy keep working while App Check is still being set up.
const appCheckSiteKey = process.env.REACT_APP_APPCHECK_SITE_KEY;
if (appCheckSiteKey) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-restricted-globals
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

// Firestore's default WebChannel transport stalls on iOS: the stream goes
// quiet without erroring and the client sits on stale data believing it is
// connected. Auto-detect was not enough, because it chooses a transport once
// when the connection is set up and cannot tell that the stream went quiet
// twenty minutes later -- which is how a phone sat in a lobby, screen on and
// wide awake, and never saw the round start.
//
// Long polling is chattier and reconnects far more readily. For a game played
// by a houseful of phones, being told what happened beats saving requests.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const auth = getAuth(app);

let signInPromise = null;

// Deliberately local, not session-scoped. Host powers are pinned to the uid
// that created the game, and a session-scoped account dies with the tab --
// so a host who closed their tab came back as a new uid and permanently lost
// the ability to start, end, or delete their own game. Local persistence
// survives that. Which player you are is still per-tab; that lives in
// sessionStorage, so two tabs share an account but remain separate players.
export function ensureSignedIn() {
  if (!signInPromise) {
    signInPromise = setPersistence(auth, browserLocalPersistence)
      .then(() => new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            if (user) {
              resolve(user);
              return;
            }
            signInAnonymously(auth).then((credential) => resolve(credential.user), reject);
          },
          reject
        );
      }))
      .catch((error) => {
        signInPromise = null;
        throw error;
      });
  }
  return signInPromise;
}

export const currentUid = () => auth.currentUser?.uid || null;

export { db, auth };
