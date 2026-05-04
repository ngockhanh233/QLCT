import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

const firestoreInstance = getFirestore(getApp());
const TRANSACTIONS_COLLECTION = 'transactions';

export type YearTransactionStats = {
  year: number;
  /** Tổng số doc thuộc năm này (bao gồm cả vay/nợ). */
  totalCount: number;
  /** Số doc isLoanMovement=true — sẽ được giữ lại khi xóa. */
  loanCount: number;
  /** Tổng thu, KHÔNG tính vay/nợ. */
  totalIncome: number;
  /** Tổng chi, KHÔNG tính vay/nợ. */
  totalExpense: number;
};

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const maybeTs = ts as FirebaseFirestoreTypes.Timestamp;
  if (typeof maybeTs?.toDate === 'function') {
    try {
      return maybeTs.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

/** Thống kê số giao dịch + tổng thu/chi (loại vay/nợ) theo từng năm. Sort năm DESC. */
export async function fetchTransactionYearStats(
  userId: string,
): Promise<YearTransactionStats[]> {
  const colRef = collection(firestoreInstance, TRANSACTIONS_COLLECTION);
  const q = query(colRef, where('userId', '==', userId));
  const snap = await getDocs(q);

  const byYear = new Map<number, YearTransactionStats>();
  snap.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = d.data() as Record<string, unknown>;
    const date = tsToDate(data.transactionDate);
    if (!date) return;
    const year = date.getFullYear();
    const isLoan = data.isLoanMovement === true;
    const amount = (data.amount as number) ?? 0;
    const type = data.type as 'income' | 'expense' | undefined;

    const stat = byYear.get(year) ?? {
      year,
      totalCount: 0,
      loanCount: 0,
      totalIncome: 0,
      totalExpense: 0,
    };
    stat.totalCount += 1;
    if (isLoan) {
      stat.loanCount += 1;
    } else if (type === 'income') {
      stat.totalIncome += amount;
    } else if (type === 'expense') {
      stat.totalExpense += amount;
    }
    byYear.set(year, stat);
  });

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year);
}

/**
 * Xóa các giao dịch của user có `transactionDate` ≤ 23:59:59.999 ngày 31/12 của
 * `cutoffYear`. KHÔNG xóa các doc có `isLoanMovement = true` (giữ lịch sử vay/nợ).
 * Trả về số doc đã xóa.
 */
export async function deleteTransactionsUpToYear(
  userId: string,
  cutoffYear: number,
): Promise<number> {
  const colRef = collection(firestoreInstance, TRANSACTIONS_COLLECTION);
  const q = query(colRef, where('userId', '==', userId));
  const snap = await getDocs(q);

  const cutoffEnd = new Date(cutoffYear, 11, 31, 23, 59, 59, 999);
  const toDelete: string[] = [];
  snap.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = d.data() as Record<string, unknown>;
    if (data.isLoanMovement === true) return;
    const date = tsToDate(data.transactionDate);
    if (!date) return;
    if (date <= cutoffEnd) {
      toDelete.push(d.id);
    }
  });

  if (!toDelete.length) return 0;

  await Promise.all(
    toDelete.map((id) =>
      deleteDoc(doc(firestoreInstance, TRANSACTIONS_COLLECTION, id)),
    ),
  );

  return toDelete.length;
}
