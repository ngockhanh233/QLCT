import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'home_hide_balance';
const MASKED_VALUE = '••••••';

type BalanceVisibilityContextValue = {
  hideBalance: boolean;
  toggle: () => void;
  setHideBalance: (next: boolean) => void;
  /** Trả mask string nếu hidden, ngược lại format số có `đ`. */
  maskAmount: (amount: number) => string;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

export const BalanceVisibilityProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [hideBalance, setHideBalanceState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!cancelled && v === 'true') setHideBalanceState(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: boolean) => {
    AsyncStorage.setItem(STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
  }, []);

  const setHideBalance = useCallback(
    (next: boolean) => {
      setHideBalanceState(next);
      persist(next);
    },
    [persist],
  );

  const toggle = useCallback(() => {
    setHideBalanceState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  const maskAmount = useCallback(
    (amount: number) =>
      hideBalance ? MASKED_VALUE : `${amount.toLocaleString('vi-VN')}đ`,
    [hideBalance],
  );

  const value = useMemo<BalanceVisibilityContextValue>(
    () => ({ hideBalance, toggle, setHideBalance, maskAmount }),
    [hideBalance, toggle, setHideBalance, maskAmount],
  );

  return (
    <BalanceVisibilityContext.Provider value={value}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
};

export function useBalanceVisibility(): BalanceVisibilityContextValue {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) {
    // Fallback ngoài provider.
    return {
      hideBalance: false,
      toggle: () => {},
      setHideBalance: () => {},
      maskAmount: (amount: number) => `${amount.toLocaleString('vi-VN')}đ`,
    };
  }
  return ctx;
}

export const BALANCE_MASKED_VALUE = MASKED_VALUE;
