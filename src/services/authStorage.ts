import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_STORAGE_KEY } from '../constants';

export type AuthStoredUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  /** Đã hoàn thành setup quỹ (có ít nhất 1 quỹ) → vào thẳng app, không check Firestore nữa */
  hasCompletedFundSetup?: boolean;
};

export async function getStoredUser(): Promise<AuthStoredUser | null> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthStoredUser;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: AuthStoredUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

