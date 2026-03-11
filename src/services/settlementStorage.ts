import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

const firestoreInstance = getFirestore(getApp());
const userSettingsCollection = collection(firestoreInstance, 'userSettings');

export function getCurrentMonthKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export async function getLastProcessedMonth(userId: string): Promise<string | null> {
  const ref = doc(userSettingsCollection, userId);
  const snap = await getDoc(ref);
  const data = snap.data();
  return (data?.lastProcessedMonthKey as string) ?? null;
}

export async function setLastProcessedMonth(
  userId: string,
  monthKey: string,
): Promise<void> {
  const ref = doc(userSettingsCollection, userId);
  await setDoc(
    ref,
    { lastProcessedMonthKey: monthKey, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
