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

  if (snap.exists()) {
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const isNewUser: boolean =
      typeof data.isNewUser === 'boolean' ? data.isNewUser : false;

    const email = user.email ?? null;
    const displayName = user.displayName ?? null;
    const photoURL = user.photoURL ?? null;

    /** Chỉ ghi Firestore khi có thay đổi — tránh mỗi lần Splash đều bump `updatedAt` */
    const patch: Record<string, unknown> = {};

    if (data.email !== email) patch.email = email;
    if (data.displayName !== displayName) patch.displayName = displayName;
    if (data.photoURL !== photoURL) patch.photoURL = photoURL;

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await updateDoc(ref, patch);
    }

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
  if (!snap.exists()) return null;
  const data = snap.data() ?? {};
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

