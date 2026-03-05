import { useCallback, useEffect, useState } from 'react';
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
  balance: number;
  expenseByCategory: ExpenseByCategory[];
}

async function fetchMonthSummary(userId: string): Promise<MonthSummary> {
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
  console.log('[Firestore] Home.fetchMonthSummary size=', snapshot.size);

  const items: TransactionRecord[] = snapshot.docs.map((docSnap: QueryDoc) => {
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
    };
  });

  // snapshot đã được filter theo tháng trên server, nên items chính là tập giao dịch của tháng hiện tại
  const thisMonth = items;

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryAmounts: Record<string, number> = {};

  for (const t of thisMonth) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      categoryAmounts[t.categoryId] = (categoryAmounts[t.categoryId] ?? 0) + t.amount;
    }
  }

  const totalForPercent = totalExpense || 1;
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
    balance: totalIncome - totalExpense,
    expenseByCategory,
  };
}

export function useMonthTransactions() {
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonthSummary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    expenseByCategory: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const data = await fetchMonthSummary(uid);
      setSummary(data);
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
      setSummary({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        expenseByCategory: [],
      });
      return;
    }
    load(userId);
  }, [userId, load]);

  const refresh = useCallback(() => {
    if (userId) load(userId);
  }, [userId, load]);

  return { ...summary, isLoading, refresh };
}
