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
  subscribeDebts,
  createDebt,
  addDebtRepayment,
  addDebtBorrow,
  deleteDebt,
  deleteDebtRepayment,
  deleteDebtBorrow,
  updateDebtNoteAndStartDate,
  updateDebtRepayment,
  updateDebtBorrow,
  debtRemaining,
  type DebtRecord,
  type DebtDirection,
} from '../services/debts';
import { useHomeDataChanged } from './HomeDataChangedContext';

type CreateDebtInput = Parameters<typeof createDebt>[1];
type AddRepaymentInput = Parameters<typeof addDebtRepayment>[2];
type AddBorrowInput = Parameters<typeof addDebtBorrow>[2];
type DeleteRepaymentOpts = Parameters<typeof deleteDebtRepayment>[3];
type DeleteBorrowOpts = Parameters<typeof deleteDebtBorrow>[3];
type DeleteDebtOpts = Parameters<typeof deleteDebt>[2];
type UpdateDebtNoteAndDateInput = Parameters<typeof updateDebtNoteAndStartDate>[2];
type UpdateRepaymentNoteAndDateInput = Parameters<typeof updateDebtRepayment>[3];
type UpdateBorrowNoteAndDateInput = Parameters<typeof updateDebtBorrow>[3];

type DebtsContextValue = {
  debts: DebtRecord[];
  isLoading: boolean;
  reload: () => Promise<void>;
  createDebt: (input: CreateDebtInput) => Promise<string | null>;
  addRepayment: (debtId: string, input: AddRepaymentInput) => Promise<boolean>;
  addBorrow: (debtId: string, input: AddBorrowInput) => Promise<boolean>;
  deleteRepayment: (
    debtId: string,
    repaymentId: string,
    opts?: DeleteRepaymentOpts,
  ) => Promise<boolean>;
  deleteBorrow: (
    debtId: string,
    borrowId: string,
    opts?: DeleteBorrowOpts,
  ) => Promise<boolean>;
  deleteDebt: (debtId: string, opts?: DeleteDebtOpts) => Promise<boolean>;
  updateDebtNoteAndDate: (
    debtId: string,
    input: UpdateDebtNoteAndDateInput,
  ) => Promise<boolean>;
  updateRepaymentNoteAndDate: (
    debtId: string,
    repaymentId: string,
    input: UpdateRepaymentNoteAndDateInput,
  ) => Promise<boolean>;
  updateBorrowNoteAndDate: (
    debtId: string,
    borrowId: string,
    input: UpdateBorrowNoteAndDateInput,
  ) => Promise<boolean>;
  totalsByDirection: { lent: number; borrowed: number };
};

const DebtsContext = createContext<DebtsContextValue | null>(null);

const DebtsProviderInternal: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { markHomeDataChanged, markTransactionListNeedsRefresh } = useHomeDataChanged();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) setUserId(stored?.uid ?? null);
      } catch (error) {
        if (!cancelled) console.error('Error init debts context:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setDebts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeDebts(
      userId,
      (items) => {
        setDebts(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Debts snapshot error:', error);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [userId]);

  // reload là no-op vì onSnapshot luôn giữ debts đồng bộ. Giữ API để caller cũ không phải đổi.
  const reload = useCallback(async () => {}, []);

  const afterMutation = useCallback(async () => {
    markHomeDataChanged();
    markTransactionListNeedsRefresh();
  }, [markHomeDataChanged, markTransactionListNeedsRefresh]);

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

  const addBorrowCb = useCallback(
    async (debtId: string, input: AddBorrowInput): Promise<boolean> => {
      if (!userId) return false;
      try {
        await addDebtBorrow(userId, debtId, input);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error adding debt borrow:', error);
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

  const updateDebtNoteAndDateCb = useCallback(
    async (
      debtId: string,
      input: UpdateDebtNoteAndDateInput,
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await updateDebtNoteAndStartDate(userId, debtId, input);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error updating debt note/date:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const updateRepaymentNoteAndDateCb = useCallback(
    async (
      debtId: string,
      repaymentId: string,
      input: UpdateRepaymentNoteAndDateInput,
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await updateDebtRepayment(userId, debtId, repaymentId, input);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error updating repayment note/date:', error);
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

  const deleteBorrowCb = useCallback(
    async (
      debtId: string,
      borrowId: string,
      opts?: DeleteBorrowOpts,
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await deleteDebtBorrow(userId, debtId, borrowId, opts);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error deleting debt borrow:', error);
        throw error;
      }
    },
    [userId, afterMutation],
  );

  const updateBorrowNoteAndDateCb = useCallback(
    async (
      debtId: string,
      borrowId: string,
      input: UpdateBorrowNoteAndDateInput,
    ): Promise<boolean> => {
      if (!userId) return false;
      try {
        await updateDebtBorrow(userId, debtId, borrowId, input);
        await afterMutation();
        return true;
      } catch (error) {
        console.error('Error updating debt borrow:', error);
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
    addBorrow: addBorrowCb,
    deleteRepayment: deleteRepaymentCb,
    deleteBorrow: deleteBorrowCb,
    deleteDebt: deleteDebtCb,
    updateDebtNoteAndDate: updateDebtNoteAndDateCb,
    updateRepaymentNoteAndDate: updateRepaymentNoteAndDateCb,
    updateBorrowNoteAndDate: updateBorrowNoteAndDateCb,
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
      addBorrow: async () => false,
      deleteRepayment: async () => false,
      deleteBorrow: async () => false,
      deleteDebt: async () => false,
      updateDebtNoteAndDate: async () => false,
      updateRepaymentNoteAndDate: async () => false,
      updateBorrowNoteAndDate: async () => false,
      totalsByDirection: { lent: 0, borrowed: 0 },
    };
  }
  return ctx;
}

export type { DebtDirection, DebtRecord } from '../services/debts';
