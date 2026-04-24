import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStoredUser } from '../services';
import {
  fetchDebts,
  createDebt,
  addDebtRepayment,
  deleteDebt,
  deleteDebtRepayment,
  debtRemaining,
  type DebtRecord,
  type DebtDirection,
} from '../services/debts';
import { useFunds } from '../applications/Main/screens/FundManagement/hooks/useFunds';
import { useHomeDataChanged } from './HomeDataChangedContext';

type CreateDebtInput = Parameters<typeof createDebt>[1];
type AddRepaymentInput = Parameters<typeof addDebtRepayment>[2];
type DeleteRepaymentOpts = Parameters<typeof deleteDebtRepayment>[3];
type DeleteDebtOpts = Parameters<typeof deleteDebt>[2];

type DebtsContextValue = {
  debts: DebtRecord[];
  isLoading: boolean;
  reload: () => Promise<void>;
  createDebt: (input: CreateDebtInput) => Promise<string | null>;
  addRepayment: (debtId: string, input: AddRepaymentInput) => Promise<boolean>;
  deleteRepayment: (
    debtId: string,
    repaymentId: string,
    opts?: DeleteRepaymentOpts,
  ) => Promise<boolean>;
  deleteDebt: (debtId: string, opts?: DeleteDebtOpts) => Promise<boolean>;
  totalsByDirection: { lent: number; borrowed: number };
};

const DebtsContext = createContext<DebtsContextValue | null>(null);

const DebtsProviderInternal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { refresh: refreshFunds } = useFunds();
  const { markHomeDataChanged, markTransactionListNeedsRefresh } = useHomeDataChanged();

  const load = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const items = await fetchDebts(uid);
      setDebts(items);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (cancelled) return;
        const uid = stored?.uid ?? null;
        setUserId(uid);
        if (uid) await load(uid);
      } catch (error) {
        if (!cancelled) console.error('Error init debts context:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    if (!userId) return;
    await load(userId);
  }, [userId, load]);

  const afterMutation = useCallback(async () => {
    await Promise.all([
      userId ? load(userId) : Promise.resolve(),
      refreshFunds(),
    ]);
    markHomeDataChanged();
    markTransactionListNeedsRefresh();
  }, [userId, load, refreshFunds, markHomeDataChanged, markTransactionListNeedsRefresh]);

  const createDebtCb = useCallback(
    async (input: CreateDebtInput): Promise<string | null> => {
      if (!userId) return null;
      try {
        const id = await createDebt(userId, input);
        await afterMutation();
        return id;
      } catch (error) {
        console.error('Error creating debt:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const addRepaymentCb = useCallback(
    async (debtId: string, input: AddRepaymentInput): Promise<boolean> => {
      if (!userId) return false;
      try {
        await addDebtRepayment(userId, debtId, input);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error adding debt repayment:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const deleteDebtCb = useCallback(
    async (debtId: string, opts?: DeleteDebtOpts): Promise<boolean> => {
      if (!userId) return false;
      try {
        await deleteDebt(userId, debtId, opts);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error deleting debt:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const deleteRepaymentCb = useCallback(
    async (
      debtId: string,
      repaymentId: string,
      opts?: DeleteRepaymentOpts,
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await deleteDebtRepayment(userId, debtId, repaymentId, opts);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error deleting debt repayment:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const totalsByDirection = useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    for (const d of debts) {
      if (d.status !== 'open') continue;
      const remaining = debtRemaining(d);
      if (remaining <= 0) continue;
      if (d.direction === 'lent') lent += remaining;
      else borrowed += remaining;
    }
    return { lent, borrowed };
  }, [debts]);

  const value: DebtsContextValue = {
    debts,
    isLoading,
    reload,
    createDebt: createDebtCb,
    addRepayment: addRepaymentCb,
    deleteRepayment: deleteRepaymentCb,
    deleteDebt: deleteDebtCb,
    totalsByDirection,
  };

  return <DebtsContext.Provider value={value}>{children}</DebtsContext.Provider>;
};

export const DebtsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <DebtsProviderInternal>{children}</DebtsProviderInternal>;
};

export function useDebts(): DebtsContextValue {
  const ctx = useContext(DebtsContext);
  if (!ctx) {
    return {
      debts: [],
      isLoading: false,
      reload: async () => {},
      createDebt: async () => null,
      addRepayment: async () => false,
      deleteRepayment: async () => false,
      deleteDebt: async () => false,
      totalsByDirection: { lent: 0, borrowed: 0 },
    };
  }
  return ctx;
}

export type { DebtDirection, DebtRecord } from '../services/debts';
