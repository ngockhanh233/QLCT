import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { getStoredUser } from '../../../../../services';
import { showSnackbar } from '../../../../../utils/snackbar';

const COLLECTION_NAME = 'transactions';

type QueryDoc = FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

interface TransactionRecord {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  type: 'income' | 'expense';
  transactionDate: Date;
  isLoanMovement?: boolean;
}

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, COLLECTION_NAME);

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export interface ExpenseByCategory {
  categoryId: string;
  amount: number;
  percentage: number;
}

export interface MonthSummary {
  totalIncome: number;
  totalExpense: number;
  /** Tổng chi không bao gồm vay/nợ — dùng cho phần phân bố chi tiêu. */
  expenseExcludingLoan: number;
  balance: number;
  expenseByCategory: ExpenseByCategory[];
}

const EMPTY_SUMMARY: MonthSummary = {
  totalIncome: 0,
  totalExpense: 0,
  expenseExcludingLoan: 0,
  balance: 0,
  expenseByCategory: [],
};

async function fetchMonthItems(userId: string): Promise<TransactionRecord[]> {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const q = query(
    transactionsCollection,
    where('userId', '==', userId),
    where('transactionDate', '>=', start),
    where('transactionDate', '<=', end),
    orderBy('transactionDate', 'desc'),
  );

  const snapshot = await getDocs(q);
  console.log('[Firestore] Home.fetchMonthItems size=', snapshot.size);

  return snapshot.docs.map((docSnap: QueryDoc) => {
    const data = docSnap.data() as Record<string, unknown>;
    const ts = data.transactionDate as
      | FirebaseFirestoreTypes.Timestamp
      | Date
      | undefined;
    const date =
      ts instanceof Date
        ? ts
        : ts && typeof (ts as FirebaseFirestoreTypes.Timestamp).toDate === 'function'
        ? (ts as FirebaseFirestoreTypes.Timestamp).toDate()
        : new Date();

    return {
      id: docSnap.id,
      userId: data.userId as string,
      categoryId: data.categoryId as string,
      amount: (data.amount as number) ?? 0,
      type: data.type as 'income' | 'expense',
      transactionDate: date,
      isLoanMovement: data.isLoanMovement === true,
    };
  });
}

function computeSummary(
  items: TransactionRecord[],
  includeLoan: boolean,
): MonthSummary {
  // Totals trên card có thể tính cả vay/nợ tùy toggle.
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of items) {
    if (!includeLoan && t.isLoanMovement === true) continue;
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  }

  // Phân bố chi tiêu theo danh mục: luôn loại vay/nợ.
  const categoryAmounts: Record<string, number> = {};
  let categoryTotal = 0;
  for (const t of items) {
    if (t.isLoanMovement === true) continue;
    if (t.type !== 'expense') continue;
    categoryAmounts[t.categoryId] = (categoryAmounts[t.categoryId] ?? 0) + t.amount;
    categoryTotal += t.amount;
  }

  const totalForPercent = categoryTotal || 1;
  const expenseByCategory: ExpenseByCategory[] = Object.entries(categoryAmounts)
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      percentage: Math.round((amount / totalForPercent) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome,
    totalExpense,
    expenseExcludingLoan: categoryTotal,
    balance: totalIncome - totalExpense,
    expenseByCategory,
  };
}

export function useMonthTransactions(includeLoan = false) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const data = await fetchMonthItems(uid);
      setItems(data);
    } catch (error) {
      console.error('Error loading month summary:', error);
      showSnackbar({
        message: 'Không thể tải tóm tắt tháng. Vui lòng thử lại',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled && stored?.uid) {
          setUserId(stored.uid);
        } else if (!cancelled) {
          setUserId(null);
        }
      } catch {
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    load(userId);
  }, [userId, load]);

  const refresh = useCallback(() => {
    if (userId) load(userId);
  }, [userId, load]);

  // Toggle includeLoan chỉ tính lại tại JS, không refetch Firestore → tránh lag animation.
  const summary = useMemo<MonthSummary>(() => {
    if (items.length === 0) return EMPTY_SUMMARY;
    return computeSummary(items, includeLoan);
  }, [items, includeLoan]);

  return { ...summary, isLoading, refresh };
}
