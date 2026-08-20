import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  browserSessionPersistence,
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

const db = getFirestore(app);
const auth = getAuth(app);

let signInPromise = null;

// Session-scoped so each browser tab is its own player, matching how player
// identity is stored. Every Firestore call must wait on this.
export function ensureSignedIn() {
  if (!signInPromise) {
    signInPromise = setPersistence(auth, browserSessionPersistence)
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

export { db, auth };
