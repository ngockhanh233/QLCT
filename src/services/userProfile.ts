import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import type { AuthStoredUser } from './authStorage';

const firestoreInstance = getFirestore(getApp());
const USERS_COLLECTION = 'users';

export async function ensureUserProfile(user: AuthStoredUser): Promise<{ isNewUser: boolean }> {
  const ref = doc(firestoreInstance, USERS_COLLECTION, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists) {
    const data = snap.data() as any;
    const isNewUser: boolean = typeof data.isNewUser === 'boolean' ? data.isNewUser : false;
    // Optionally refresh basic profile fields.
    await updateDoc(ref, {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      updatedAt: serverTimestamp(),
    });
    return { isNewUser };
  }

  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    isNewUser: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { isNewUser: true };
}

export async function getUserIsNewFlag(uid: string): Promise<boolean | null> {
  const ref = doc(firestoreInstance, USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists) return null;
  const data = snap.data() as any;
  if (typeof data.isNewUser === 'boolean') return data.isNewUser;
  return null;
}

export async function markUserFinishedInitialFund(uid: string): Promise<void> {
  const ref = doc(firestoreInstance, USERS_COLLECTION, uid);
  await setDoc(
    ref,
    {
      isNewUser: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

