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
  doc,
  deleteDoc,
} from '@react-native-firebase/firestore';
import { getStoredUser } from '../../../../../services';
import { showSnackbar } from '../../../../../utils/snackbar';

const COLLECTION_NAME = 'transactions';
type QueryDoc =
  FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

export interface TransactionRecord {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  type: 'income' | 'expense';
  note?: string | null;
  transactionDate: Date;
}

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, COLLECTION_NAME);

export type TransactionTimeFilter = 'day' | 'week' | 'month' | 'year';

type DateFilterMode = 'none' | 'single' | 'range';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getRangeForTimeFilter(
  filter: TransactionTimeFilter,
  baseDate: Date,
): { start: Date; end: Date } {
  if (filter === 'day') {
    return { start: startOfDay(baseDate), end: endOfDay(baseDate) };
  }

  if (filter === 'week') {
    const end = endOfDay(baseDate);
    const start = startOfDay(
      new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6),
    );
    return { start, end };
  }

  if (filter === 'month') {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const end = endOfDay(
      new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0),
    );
    return { start, end };
  }

  // year
  const start = new Date(baseDate.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

async function fetchAllTransactions(
  userId: string,
  timeFilter: TransactionTimeFilter,
  dateFilterMode: DateFilterMode,
  fromDate: Date | null,
  toDate: Date | null,
): Promise<{ items: TransactionRecord[] }> {
  let start: Date;
  let end: Date;

  if (dateFilterMode === 'single' && fromDate) {
    start = startOfDay(fromDate);
    end = endOfDay(fromDate);
  } else if (dateFilterMode === 'range' && fromDate && toDate) {
    const from = fromDate < toDate ? fromDate : toDate;
    const to = toDate > fromDate ? toDate : fromDate;
    start = startOfDay(from);
    end = endOfDay(to);
  } else {
    // Không có filter ngày tùy chọn → dùng timeFilter + ngày hiện tại
    const now = new Date();
    const range = getRangeForTimeFilter(timeFilter, now);
    start = range.start;
    end = range.end;
  }

  const q = query(
    transactionsCollection,
    where('userId', '==', userId),
    where('transactionDate', '>=', start),
    where('transactionDate', '<=', end),
    orderBy('transactionDate', 'desc'),
  );

  const snapshot = await getDocs(q);
  console.log(
    '[Firestore] Transaction.fetchAllTransactions size=',
    snapshot.size,
    'mode=',
    dateFilterMode,
    'timeFilter=',
    timeFilter,
  );

  const items: TransactionRecord[] = snapshot.docs.map((docSnap: QueryDoc) => {
    const data = docSnap.data() as any;
    const ts = data.transactionDate as
      | FirebaseFirestoreTypes.Timestamp
      | Date
      | undefined;

    const date =
      ts instanceof Date
        ? ts
        : ts && 'toDate' in ts
        ? (ts as FirebaseFirestoreTypes.Timestamp).toDate()
        : new Date();

    return {
      id: docSnap.id,
      userId: data.userId,
      categoryId: data.categoryId,
      amount: data.amount,
      type: data.type,
      note: data.note ?? undefined,
      transactionDate: date,
    };
  });

  return { items };
}

export const useTransactions = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] =
    useState<TransactionTimeFilter>('month');
  const [dateFilterMode, setDateFilterMode] =
    useState<DateFilterMode>('none');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const reloadForUser = useCallback(
    async (uid: string) => {
      setIsRefreshing(true);
      try {
        const res = await fetchAllTransactions(
          uid,
          timeFilter,
          dateFilterMode,
          fromDate,
          toDate,
        );
        setTransactions(res.items);
      } catch (error) {
        console.error('Error loading transactions:', error);
        showSnackbar({
          message: 'Không thể tải giao dịch. Vui lòng thử lại',
          type: 'error',
        });
      } finally {
        setIsRefreshing(false);
        setIsInitialized(true);
      }
    },
    [timeFilter, dateFilterMode, fromDate, toDate],
  );

  // Load userId from AsyncStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) {
          setUserId(stored?.uid ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading stored user for transactions:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initial load & when userId changes
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      return;
    }

    reloadForUser(userId);
  }, [userId, reloadForUser]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await reloadForUser(userId);
  }, [userId, reloadForUser]);

  const deleteTransaction = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        await deleteDoc(ref);

        // Cập nhật state cục bộ, không reload toàn bộ list
        setTransactions(prev => prev.filter(tx => tx.id !== id));

        showSnackbar({
          message: 'Đã xóa giao dịch',
          type: 'success',
        });

        return true;
      } catch (error) {
        console.error('Error deleting transaction:', error);
        showSnackbar({
          message: 'Không thể xóa giao dịch. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId],
  );

  return {
    transactions,
    isRefreshing,
    refresh,
    deleteTransaction,
    isInitialized,
    timeFilter,
    setTimeFilter,
    dateFilterMode,
    setDateFilterMode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
  };
};

export default useTransactions;

