import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
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
  /** Optional: danh mục thu nhập mặc định khi chọn preset này. */
  categoryId?: string;
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

/** Lắng nghe realtime cấu hình nguồn thu của user. Trả về hàm hủy đăng ký. */
export function subscribeIncomePresetSettings(
  userId: string,
  onChange: (settings: IncomePresetSettings) => void,
  onError?: (error: Error) => void,
): () => void {
  const ref = doc(userSettingsCollection, userId);
  console.log('[IncomePresets] subscribing for', userId);
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() as any;
      console.log('[IncomePresets] snapshot fired, exists=', snap.exists, 'fromCache=', snap.metadata?.fromCache);
      const presets = (data?.[SETTINGS_KEY_PRESETS] as IncomePreset[]) ?? [];
      const defaultPresetId = (data?.[SETTINGS_KEY_DEFAULT] as string) ?? undefined;
      onChange({ presets, defaultPresetId });
    },
    (error) => {
      console.error('[IncomePresets] snapshot error:', error);
      onError?.(error);
    },
  );
}

