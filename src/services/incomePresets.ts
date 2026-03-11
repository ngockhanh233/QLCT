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

export type IncomePresetAllocation = {
  fundId: string;
  /** Amount in VND (integer, > 0). */
  amount: number;
};

export type IncomePreset = {
  id: string;
  name: string;
  allocations: IncomePresetAllocation[];
  createdAt?: any;
  updatedAt?: any;
};

export type IncomePresetSettings = {
  presets: IncomePreset[];
  defaultPresetId?: string;
};

const SETTINGS_KEY_PRESETS = 'incomePresets';
const SETTINGS_KEY_DEFAULT = 'defaultIncomePresetId';

export async function getIncomePresetSettings(
  userId: string,
): Promise<IncomePresetSettings> {
  const ref = doc(userSettingsCollection, userId);
  const snap = await getDoc(ref);
  const data = snap.data() as any;

  const presets = (data?.[SETTINGS_KEY_PRESETS] as IncomePreset[]) ?? [];
  const defaultPresetId = (data?.[SETTINGS_KEY_DEFAULT] as string) ?? undefined;
  return { presets, defaultPresetId };
}

export async function saveIncomePresetSettings(
  userId: string,
  settings: IncomePresetSettings,
): Promise<void> {
  const ref = doc(userSettingsCollection, userId);
  await setDoc(
    ref,
    {
      [SETTINGS_KEY_PRESETS]: settings.presets,
      [SETTINGS_KEY_DEFAULT]: settings.defaultPresetId ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

