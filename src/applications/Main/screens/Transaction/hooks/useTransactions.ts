import { useCallback, useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  FirebaseFirestoreTypes,
  doc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
} from '@react-native-firebase/firestore';
import { getStoredUser } from '../../../../../services';
import { pushBalanceNotification } from '../../../../../services/balanceNotifications';
import { showSnackbar } from '../../../../../utils/snackbar';
import { getCategoryInfo } from '../../../../../utils/categoryUtils';

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
  fundId?: string | null;
  transactionDate: Date;
  isSplitIncome?: boolean;
  incomeSplits?: { fundId: string; amount: number }[] | null;
}

type DeleteTransactionResult = {
  ok: boolean;
  message?: string;
};

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
      fundId: data.fundId ?? undefined,
      transactionDate: date,
      isSplitIncome: data.isSplitIncome === true,
      incomeSplits:
        (data.incomeSplits as { fundId: string; amount: number }[] | undefined) ??
        null,
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
    async (
      id: string,
      opts?: { refundFundId?: string | null; skipFundChange?: boolean },
    ): Promise<DeleteTransactionResult> => {
      if (!userId) return { ok: false, message: 'Không xác định được người dùng' };

      try {
        const txRef = doc(firestoreInstance, COLLECTION_NAME, id);
        const txSnap = await getDoc(txRef);
        if (!txSnap.exists) return { ok: false, message: 'Giao dịch không tồn tại' };

        const data = txSnap.data() as Record<string, unknown>;
        const originalFundId = data.fundId as string | undefined | null;
        const amount = (data.amount as number) ?? 0;
        const type = data.type as string;
        const categoryId = (data.categoryId as string) ?? '';
        const isSplitIncome = !!(data.isSplitIncome && type === 'income');
        const incomeSplits = (data.incomeSplits as Array<{ fundId: string; amount: number }> | undefined) ?? [];

        let fundName: string | undefined;
        let newBalanceAfter: number | undefined;
        const fundChangeSummaries: {
          name: string;
          delta: number;
          newBalance: number;
        }[] = [];

        await runTransaction(firestoreInstance, async (transaction) => {
          const skipFundChange = opts?.skipFundChange === true;

          if (skipFundChange) {
            // Chỉ xóa giao dịch, không hoàn tiền / trừ tiền vào quỹ.
            transaction.delete(txRef);
            return;
          }

          if (isSplitIncome && incomeSplits.length > 0) {
            // Xóa khoản thu đã chia quỹ:
            // - Quỹ nào đủ tiền: trừ đúng số đã nhận.
            // - Quỹ nào không đủ: trừ hết (về 0), phần thiếu dồn về quỹ bù (refundFundId).
            const refundFundId = (opts?.refundFundId ?? undefined) || undefined;

            // Tính tổng phần thiếu cần trừ thêm ở quỹ bù.
            let totalDeficit = 0;
            const fundRefs: { [id: string]: FirebaseFirestoreTypes.DocumentReference } = {};
            const fundBalances: { [id: string]: number } = {};
            const fundNames: { [id: string]: string } = {};

            for (const s of incomeSplits) {
              if (!s.fundId || !s.amount) continue;
              const fundRef = doc(firestoreInstance, 'funds', s.fundId);
              fundRefs[s.fundId] = fundRef;
              const fundSnap = await transaction.get(fundRef);
              if (!fundSnap.exists) continue;
              const fundData = fundSnap.data() as any;
              const currentBalance = (fundData?.balance as number) ?? 0;
              fundBalances[s.fundId] = currentBalance;
              fundNames[s.fundId] =
                (fundData?.name as string | undefined) ?? fundNames[s.fundId] ?? 'Quỹ';

              if (currentBalance < s.amount) {
                if (!refundFundId) {
                  throw new Error('Số dư quỹ không đủ để xóa khoản thu này');
                }
                totalDeficit += s.amount - currentBalance;
              }
            }

            let refundBalance = 0;
            let refundRef: FirebaseFirestoreTypes.DocumentReference | null = null;
            if (totalDeficit > 0) {
              if (!refundFundId) {
                throw new Error('Số dư quỹ không đủ để xóa khoản thu này');
              }
              refundRef = doc(firestoreInstance, 'funds', refundFundId);
              const refundSnap = await transaction.get(refundRef);
              if (!refundSnap.exists) {
                throw new Error('Quỹ bù tiền không tồn tại');
              }
              refundBalance = (refundSnap.data()?.balance as number) ?? 0;
              if (refundBalance < totalDeficit) {
                throw new Error('Số dư quỹ bù tiền không đủ để xóa khoản thu này');
              }
            }

            // Thực thi trừ tiền khỏi từng quỹ nhận.
            for (const s of incomeSplits) {
              if (!s.fundId || !s.amount) continue;
              const currentBalance = fundBalances[s.fundId] ?? 0;
              if (currentBalance <= 0) continue;

              const amountFromOwnFund = Math.min(currentBalance, s.amount);
              if (amountFromOwnFund <= 0) continue;

              const fundRef = fundRefs[s.fundId];
              transaction.update(fundRef, {
                balance: increment(-amountFromOwnFund),
                updatedAt: serverTimestamp(),
              });

              const nextBalance = currentBalance - amountFromOwnFund;
              newBalanceAfter = nextBalance;
              if (!fundName) {
                fundName = fundNames[s.fundId] ?? fundName;
              }
              fundChangeSummaries.push({
                name: fundNames[s.fundId] ?? 'Quỹ',
                delta: -amountFromOwnFund,
                newBalance: nextBalance,
              });
            }

            // Trừ phần thiếu khỏi quỹ bù (nếu có).
            if (totalDeficit > 0 && refundRef) {
              transaction.update(refundRef, {
                balance: increment(-totalDeficit),
                updatedAt: serverTimestamp(),
              });
              const nextBalance = refundBalance - totalDeficit;
              newBalanceAfter = nextBalance;
              const refundSnap = await transaction.get(refundRef);
              const refundData = refundSnap.data() as any;
              const refundName =
                (refundData?.name as string | undefined) ?? 'Quỹ';
              if (!fundName) {
                fundName = refundName;
              }
              fundChangeSummaries.push({
                name: refundName,
                delta: -totalDeficit,
                newBalance: nextBalance,
              });
            }
          } else {
            const targetFundId =
              (opts?.refundFundId ?? undefined) || originalFundId || undefined;

            if (targetFundId && amount > 0) {
              const fundRef = doc(firestoreInstance, 'funds', targetFundId);
              const fundSnap = await transaction.get(fundRef);
              if (fundSnap.exists) {
                fundName = (fundSnap.data()?.name as string | undefined) ?? fundName;
                const currentBalance = (fundSnap.data()?.balance as number) ?? 0;

                // Xóa giao dịch THU = hoàn tác bằng cách TRỪ tiền khỏi quỹ.
                // Nếu quỹ không đủ thì không cho xóa.
                if (type === 'income' && currentBalance < amount) {
                  throw new Error('Số dư quỹ không đủ để xóa khoản thu này');
                }

                const delta = type === 'expense' ? amount : -amount;
                newBalanceAfter = currentBalance + delta;

                transaction.update(fundRef, {
                  balance: increment(delta),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }

          transaction.delete(txRef);
        });

        setTransactions(prev => prev.filter(tx => tx.id !== id));

        showSnackbar({
          message: 'Đã xóa giao dịch',
          type: 'success',
        });

        try {
          // Tính tổng số dư sau khi xóa (đọc từ Firestore để chính xác).
          let totalAfter: number | undefined;
          try {
            const fundsSnap = await getDocs(
              query(
                collection(firestoreInstance, 'funds'),
                where('userId', '==', userId),
              ),
            );
            totalAfter = fundsSnap.docs.reduce(
              (sum, d) => sum + (((d.data() as any)?.balance as number) ?? 0),
              0,
            );
          } catch {
            // ignore
          }

          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const name = fundName ?? 'Quỹ';
          const categoryName =
            categoryId && (type === 'income' || type === 'expense')
              ? getCategoryInfo(categoryId, type as any).name
              : 'Danh mục';
          const fundBalanceLine =
            typeof newBalanceAfter === 'number' && !isSplitIncome
              ? `Số dư quỹ: ${newBalanceAfter.toLocaleString('vi-VN')}đ`
              : '';
          const totalLine =
            typeof totalAfter === 'number'
              ? `Tổng số dư: ${totalAfter.toLocaleString('vi-VN')}đ`
              : '';
          const baseLines = [fundBalanceLine, totalLine].filter(Boolean).join('\n');

          const skipFundChange = opts?.skipFundChange === true;

          if (skipFundChange) {
            await pushBalanceNotification(userId, {
              kind: 'transaction_deleted',
              title: 'Xóa giao dịch',
              message:
                type === 'expense'
                  ? `Đã xóa khoản chi ${amountLabel} (${categoryName}). Giao dịch này bị xóa nhưng không thay đổi số dư quỹ.${totalLine ? `\n${totalLine}` : ''}`
                  : `Đã xóa khoản thu ${amountLabel} (${categoryName}). Giao dịch này bị xóa nhưng không thay đổi số dư quỹ.${totalLine ? `\n${totalLine}` : ''}`,
            });
          } else if (isSplitIncome && fundChangeSummaries.length > 0) {
            const detailLines = fundChangeSummaries
              .map(fc => {
                const deltaLabel = fc.delta.toLocaleString('vi-VN');
                const sign = fc.delta > 0 ? '+' : '';
                const newBalLabel = fc.newBalance.toLocaleString('vi-VN');
                return `- "${fc.name}": ${sign}${deltaLabel}đ (mới: ${newBalLabel}đ)`;
              })
              .join('\n');

            await pushBalanceNotification(userId, {
              kind: 'transaction_deleted',
              title: 'Xóa giao dịch',
              message:
                `Đã xóa khoản thu ${amountLabel} (${categoryName}) đã chia vào nhiều quỹ.` +
                `\nBiến động số dư quỹ:\n${detailLines}` +
                (baseLines ? `\n${baseLines}` : ''),
            });
          } else {
            await pushBalanceNotification(userId, {
              kind: 'transaction_deleted',
              title: 'Xóa giao dịch',
              message:
                type === 'expense'
                  ? `Đã xóa khoản chi ${amountLabel} (${categoryName}). Đã cộng lại vào "${name}".${baseLines ? `\n${baseLines}` : ''}`
                  : `Đã xóa khoản thu ${amountLabel} (${categoryName}). Đã trừ khỏi "${name}".${baseLines ? `\n${baseLines}` : ''}`,
            });
          }
        } catch {
          // ignore notification errors
        }

        return { ok: true };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Không thể xóa giao dịch. Vui lòng thử lại';

        // Tránh "Console Error" đỏ khi gặp lỗi dự kiến (ví dụ quỹ không đủ để trừ khi xóa khoản thu)
        // Chỉ log ra console với lỗi không nằm trong nhóm dự kiến.
        const expectedMessages = new Set<string>([
          'Số dư quỹ không đủ để xóa khoản thu này',
        ]);
        if (!(error instanceof Error) || !expectedMessages.has(error.message)) {
          console.error('Error deleting transaction:', error);
        }

        showSnackbar({
          message,
          type: 'error',
        });
        return { ok: false, message };
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

