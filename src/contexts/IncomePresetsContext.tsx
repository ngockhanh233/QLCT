import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
  saveIncomePresetSettings,
  subscribeIncomePresetSettings,
  type IncomePreset,
} from '../services/incomePresets';

type IncomePresetsContextValue = {
  presets: IncomePreset[];
  isLoading: boolean;
  reload: () => Promise<void>;
  savePresets: (next: IncomePreset[]) => Promise<void>;
};

const IncomePresetsContext = createContext<IncomePresetsContextValue | null>(null);

async function getCurrentUserId(): Promise<string | null> {
  try {
    const auth = getAuth(getApp());
    const user = auth.currentUser;
    return user?.uid ?? null;
  } catch {
    return null;
  }
}

const IncomePresetsProviderInternal: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [presets, setPresets] = useState<IncomePreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = await getCurrentUserId();
      if (!cancelled) setUserId(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setPresets([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeIncomePresetSettings(
      userId,
      (settings) => {
        setPresets(settings.presets ?? []);
        setIsLoading(false);
      },
      () => {
        // Giữ state cũ nếu lỗi.
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [userId]);

  // reload là no-op vì onSnapshot luôn giữ presets đồng bộ. Giữ API để caller cũ không phải đổi.
  const reload = useCallback(async () => {}, []);

  const savePresets = useCallback(
    async (next: IncomePreset[]) => {
      setPresets(next);
      if (!userId) return;
      await saveIncomePresetSettings(userId, { presets: next });
    },
    [userId],
  );

  const value: IncomePresetsContextValue = {
    presets,
    isLoading,
    reload,
    savePresets,
  };

  return (
    <IncomePresetsContext.Provider value={value}>
      {children}
    </IncomePresetsContext.Provider>
  );
};

export const IncomePresetsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  return <IncomePresetsProviderInternal>{children}</IncomePresetsProviderInternal>;
};

export function useIncomePresets(): IncomePresetsContextValue {
  const ctx = useContext(IncomePresetsContext);
  if (!ctx) {
    // Fallback: still usable outside provider (tests, etc.)
    return {
      presets: [],
      isLoading: false,
      reload: async () => {},
      savePresets: async () => {},
    };
  }
  return ctx;
}

