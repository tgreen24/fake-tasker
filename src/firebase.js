// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase, ref, onDisconnect, set, remove } from "firebase/database";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxLCiUR9KPn5IgxZee5v2ZF_1me8ylSoM",
  authDomain: "fake-tasker-770e9.firebaseapp.com",
  projectId: "fake-tasker-770e9",
  storageBucket: "fake-tasker-770e9.appspot.com",
  messagingSenderId: "495962316387",
  appId: "1:495962316387:web:227d16d0c1e4151c0be256"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

const realtimeDb = getDatabase(app);

export { db, realtimeDb, ref, onDisconnect, set, remove };