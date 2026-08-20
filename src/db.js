import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const RETRY_DELAY_MS = 800;

export async function updateGame(gameCode, data) {
  const gameRef = doc(db, 'games', gameCode);
  try {
    await updateDoc(gameRef, data);
    return true;
  } catch (error) {
    console.warn('[firestore] write failed, retrying', error);
    try {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      await updateDoc(gameRef, data);
      return true;
    } catch (retryError) {
      console.error('[firestore] write failed permanently', retryError);
      return false;
    }
  }
}
