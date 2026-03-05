import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { TRANSACTION_TYPES, TransactionType } from '../../../../../constants';
import { getStoredUser } from '../../../../../services';
import { confirm } from '../../../../../utils/confirm';
import { showSnackbar } from '../../../../../utils/snackbar';

export interface FixedItem {
  id?: string;
  userId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  note?: string;
  /**
   * Tháng bắt đầu áp dụng khoản cố định, dạng 'YYYY-MM'.
   * Dùng để tránh việc thay đổi mức cố định ở tháng sau làm sai dữ liệu tháng trước.
   */
  effectiveFromMonth?: string;
  /**
   * Thời điểm tạo bản ghi, lấy từ Firestore.
   * Dùng làm fallback để suy ra tháng hiệu lực nếu chưa có effectiveFromMonth.
   */
  createdAt?: FirebaseFirestoreTypes.Timestamp | Date;
  /**
   * Đánh dấu bản ghi là "mốc kết thúc" cho khoản cố định này
   * (từ tháng effectiveFromMonth trở đi không còn khoản này nữa).
   * Dùng khi người dùng xóa khoản mới tạo để không cho bản cũ hiện lại
   * ở những tháng sau.
   */
  isDeleted?: boolean;
  /**
   * Thời điểm xóa (chỉ có khi soft-delete item tháng cũ, isDeleted = true).
   */
  deleteAt?: FirebaseFirestoreTypes.Timestamp | Date;
}

const COLLECTION_NAME = 'fixedItems';

const firestoreInstance = getFirestore(getApp());
const fixedItemsCollection = collection(firestoreInstance, COLLECTION_NAME);

function getMonthKeyFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentMonthKey(): string {
  return getMonthKeyFromDate(new Date());
}

function getEffectiveMonthKey(
  item: FixedItem,
  fallbackMonthKey: string,
): string {
  if (item.effectiveFromMonth) {
    return item.effectiveFromMonth;
  }

  const created = item.createdAt;
  if (created instanceof Date) {
    return getMonthKeyFromDate(created);
  }

  if (
    created &&
    typeof (created as FirebaseFirestoreTypes.Timestamp).toDate === 'function'
  ) {
    return getMonthKeyFromDate(
      (created as FirebaseFirestoreTypes.Timestamp).toDate(),
    );
  }

  return fallbackMonthKey;
}

/** Tháng mà bản ghi bị đánh dấu xóa (từ tháng này trở đi không hiển thị). Dùng deleteAt nếu có, không thì fallback effectiveFromMonth. */
function getDeletedMonthKey(
  item: FixedItem,
  fallbackMonthKey: string,
): string | null {
  if (!item.isDeleted) return null;
  const d = item.deleteAt;
  if (d instanceof Date) {
    return getMonthKeyFromDate(d);
  }
  if (
    d &&
    typeof (d as FirebaseFirestoreTypes.Timestamp).toDate === 'function'
  ) {
    return getMonthKeyFromDate(
      (d as FirebaseFirestoreTypes.Timestamp).toDate(),
    );
  }
  return getEffectiveMonthKey(item, fallbackMonthKey);
}

function calculateTotalForMonth(
  items: FixedItem[],
  targetMonthKey: string,
): number {
  // Gom nhóm theo (type + categoryId) để đổi ghi chú không tạo "khoản mới".
  // Lưu ý: nếu sau này cần nhiều khoản cùng categoryId thì nên bổ sung seriesId/groupId.
  const groups = new Map<string, FixedItem[]>();

  for (const item of items) {
    const groupKey = `${item.type}||${item.categoryId}`;
    const list = groups.get(groupKey);
    if (list) {
      list.push(item);
    } else {
      groups.set(groupKey, [item]);
    }
  }

  let total = 0;

  for (const [, groupItems] of groups) {
    // Bước 1: mốc xóa = tháng deleteAt (từ tháng đó trở đi ẩn). Chỉ lấy bản isDeleted có tháng xóa <= targetMonthKey
    let latestDeletedMonthKey: string | null = null;
    for (const item of groupItems) {
      if (!item.isDeleted) continue;
      const deletedKey = getDeletedMonthKey(item, targetMonthKey);
      if (!deletedKey || deletedKey > targetMonthKey) continue;
      if (!latestDeletedMonthKey || deletedKey > latestDeletedMonthKey) {
        latestDeletedMonthKey = deletedKey;
      }
    }

    // Bước 2: chọn bản hiệu lực cho targetMonthKey. Tính cả bản isDeleted nếu deleteAt > targetMonthKey (chưa bị xóa trong tháng đó)
    let best: { monthKey: string; amount: number } | null = null;
    for (const item of groupItems) {
      const effMonthKey = getEffectiveMonthKey(item, targetMonthKey);
      if (effMonthKey > targetMonthKey) continue;
      if (item.isDeleted) {
        const deletedKey = getDeletedMonthKey(item, targetMonthKey);
        if (deletedKey !== null && deletedKey <= targetMonthKey) continue; // đã xóa trong hoặc trước targetMonthKey
      }
      if (latestDeletedMonthKey && effMonthKey <= latestDeletedMonthKey) continue;
      if (!best || effMonthKey > best.monthKey) {
        best = { monthKey: effMonthKey, amount: item.amount };
      }
    }

    if (best) {
      total += best.amount;
    }
  }

  return total;
}

function selectEffectiveItemsForMonth(
  items: FixedItem[],
  targetMonthKey: string,
): FixedItem[] {
  const groups = new Map<string, FixedItem[]>();

  for (const item of items) {
    const groupKey = `${item.type}||${item.categoryId}`;
    const list = groups.get(groupKey);
    if (list) {
      list.push(item);
    } else {
      groups.set(groupKey, [item]);
    }
  }

  const picked: FixedItem[] = [];

  for (const [, groupItems] of groups) {
    // Bước 1: mốc xóa = tháng deleteAt
    let latestDeletedMonthKey: string | null = null;
    for (const item of groupItems) {
      if (!item.isDeleted) continue;
      const deletedKey = getDeletedMonthKey(item, targetMonthKey);
      if (!deletedKey || deletedKey > targetMonthKey) continue;
      if (!latestDeletedMonthKey || deletedKey > latestDeletedMonthKey) {
        latestDeletedMonthKey = deletedKey;
      }
    }

    // Bước 2: chọn bản hiệu lực; tính cả bản isDeleted nếu deleteAt > targetMonthKey
    let best: { monthKey: string; item: FixedItem } | null = null;
    for (const item of groupItems) {
      const effMonthKey = getEffectiveMonthKey(item, targetMonthKey);
      if (effMonthKey > targetMonthKey) continue;
      if (item.isDeleted) {
        const deletedKey = getDeletedMonthKey(item, targetMonthKey);
        if (deletedKey !== null && deletedKey <= targetMonthKey) continue;
      }
      if (latestDeletedMonthKey && effMonthKey <= latestDeletedMonthKey) continue;
      if (!best || effMonthKey > best.monthKey) {
        best = { monthKey: effMonthKey, item };
      }
    }

    if (best) {
      picked.push(best.item);
    }
  }

  // Sort newest-looking first (optional but helps UI feel stable)
  picked.sort((a, b) => {
    const ma = getEffectiveMonthKey(a, targetMonthKey);
    const mb = getEffectiveMonthKey(b, targetMonthKey);
    if (ma !== mb) return mb.localeCompare(ma);
    return `${b.categoryId}`.localeCompare(`${a.categoryId}`);
  });

  return picked;
}

async function fetchFixedItemsPage(
  userId: string,
  type: TransactionType,
) {
  let q = query(
    fixedItemsCollection,
    where('userId', '==', userId),
    where('type', '==', type),
    orderBy('createdAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  console.log(
    '[Firestore] FixedItems.fetchFixedItemsPage size=',
    snapshot.size,
    'type=',
    type,
  );
  const items = snapshot.docs.map(
    (docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>) => ({
    id: docSnap.id,
    ...docSnap.data(),
    }),
  ) as FixedItem[];
  return { items };
}

type FixedItemsContextValue = {
  // Danh sách đầy đủ dùng cho list (Budget tab, v.v.)
  fixedIncomeList: FixedItem[];
  fixedExpenseList: FixedItem[];
  // Danh sách đã xử lý hiệu lực theo tháng, dùng cho tính toán nếu cần
  fixedIncomeData: FixedItem[];
  fixedExpenseData: FixedItem[];
  isLoading: boolean;
  isSaving: boolean;
  addFixedItem: (
    item: Omit<FixedItem, 'id' | 'userId'>,
  ) => Promise<boolean>;
  updateFixedItem: (
    id: string,
    updates: Partial<Omit<FixedItem, 'id' | 'type'>>,
  ) => Promise<boolean>;
  deleteFixedItem: (item: FixedItem) => Promise<boolean>;
  getTotalFixedIncome: () => number;
  getTotalFixedExpense: () => number;
  getTotalFixedIncomeByMonth: (monthKey: string) => number;
  getTotalFixedExpenseByMonth: (monthKey: string) => number;
  /** Fetch từ Firestore và tính tổng thu/chi cố định cho tháng (dùng khi xem tháng khác tháng hiện tại) */
  fetchFixedTotalsForMonth: (
    monthKey: string,
  ) => Promise<{ income: number; expense: number }>;
  /** Lấy danh sách khoản cố định đang hiệu lực cho 1 tháng theo type */
  getFixedItemsByMonth: (
    monthKey: string,
    type: TransactionType,
  ) => FixedItem[];
  refresh: () => Promise<void>;
};

const FixedItemsContext = createContext<FixedItemsContextValue | undefined>(
  undefined,
);

export const FixedItemsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [fixedIncomeAll, setFixedIncomeAll] = useState<FixedItem[]>([]);
  const [fixedExpenseAll, setFixedExpenseAll] = useState<FixedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const reloadForUser = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      try {
        const [incomeRes, expenseRes] = await Promise.all([
          fetchFixedItemsPage(uid, TRANSACTION_TYPES.INCOME),
          fetchFixedItemsPage(uid, TRANSACTION_TYPES.EXPENSE),
        ]);
        setFixedIncomeAll(incomeRes.items);
        setFixedExpenseAll(expenseRes.items);
      } catch (error) {
        console.error('Error loading fixed items:', error);
        showSnackbar({
          message: 'Không thể tải khoản cố định. Vui lòng thử lại',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Load userId from AsyncStorage via authStorage service
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
          console.error('Error loading stored user for fixed items:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFixedIncomeAll([]);
    setFixedExpenseAll([]);

    if (!userId) {
      setIsLoading(false);
      return;
    }

    reloadForUser(userId);
  }, [userId, reloadForUser]);

  const monthKey = getCurrentMonthKey();
  const fixedIncomeData = useCallback(
    () => selectEffectiveItemsForMonth(fixedIncomeAll, monthKey),
    [fixedIncomeAll, monthKey],
  )();
  const fixedExpenseData = useCallback(
    () => selectEffectiveItemsForMonth(fixedExpenseAll, monthKey),
    [fixedExpenseAll, monthKey],
  )();

  // Thêm khoản thu/chi cố định
  const addFixedItem = useCallback(async (
    item: Omit<FixedItem, 'id' | 'userId'>
  ): Promise<boolean> => {
    setIsSaving(true);

    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const stored = await getStoredUser();
        effectiveUserId = stored?.uid ?? null;
      }

      if (!effectiveUserId) {
        showSnackbar({
          message: 'Không xác định được người dùng',
          type: 'error',
        });
        return false;
      }

      const data: Record<string, any> = {
        userId: effectiveUserId,
        categoryId: item.categoryId,
        amount: item.amount,
        type: item.type,
        effectiveFromMonth:
          item.effectiveFromMonth ?? getCurrentMonthKey(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (item.note) {
        data.note = item.note;
      }

      await addDoc(fixedItemsCollection, data);

      if (!userId) {
        setUserId(effectiveUserId);
      }

      await reloadForUser(effectiveUserId);

      showSnackbar({
        message: `Đã thêm khoản ${item.type === TRANSACTION_TYPES.INCOME ? 'thu' : 'chi'} cố định`,
        type: 'success',
      });
      return true;
    } catch (error) {
      console.error('Error adding fixed item:', error);
      showSnackbar({
        message: 'Không thể thêm. Vui lòng thử lại',
        type: 'error',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [userId, reloadForUser]);

  // Cập nhật khoản thu/chi cố định
  const updateFixedItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<FixedItem, 'id' | 'type'>>,
    ): Promise<boolean> => {
      setIsSaving(true);

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        const snap = await getDoc(ref);

        if (!snap.exists) {
          showSnackbar({
            message: 'Khoản cố định không tồn tại',
            type: 'error',
          });
          return false;
        }

        const raw = snap.data() as FixedItem;
        const targetMonthKey = getCurrentMonthKey();

        // Luôn tạo bản ghi mới cho tháng hiện tại và set bản cũ isDeleted = true để không hiện lại
        const newData: Record<string, any> = {
          userId: raw.userId,
          categoryId: updates.categoryId ?? raw.categoryId,
          amount: updates.amount ?? raw.amount,
          type: raw.type,
          effectiveFromMonth: targetMonthKey,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const noteValue =
          updates.note !== undefined ? updates.note : raw.note;
        if (noteValue !== undefined) {
          newData.note = noteValue;
        }

        const docRef = await addDoc(fixedItemsCollection, newData);
        await updateDoc(ref, {
          isDeleted: true,
          updatedAt: serverTimestamp(),
        });

        const newItem: FixedItem = {
          id: docRef.id,
          userId: raw.userId,
          categoryId: updates.categoryId ?? raw.categoryId,
          amount: updates.amount ?? raw.amount,
          type: raw.type,
          note: noteValue,
          effectiveFromMonth: targetMonthKey,
          createdAt: new Date(),
        };

        if (raw.type === TRANSACTION_TYPES.INCOME) {
          setFixedIncomeAll(prev =>
            prev
              .map(x => (x.id === id ? { ...x, isDeleted: true } : x))
              .concat(newItem),
          );
        } else {
          setFixedExpenseAll(prev =>
            prev
              .map(x => (x.id === id ? { ...x, isDeleted: true } : x))
              .concat(newItem),
          );
        }

        if (userId) {
          await reloadForUser(userId);
        }

        showSnackbar({
          message: 'Đã cập nhật thành công',
          type: 'success',
        });
        return true;
      } catch (error) {
        console.error('Error updating fixed item:', error);
        showSnackbar({
          message: 'Không thể cập nhật. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [userId, reloadForUser],
  );

  // Xóa khoản thu/chi cố định
  // Tháng hiện tại: xóa hẳn. Không phải tháng hiện tại: chỉ set isDeleted = true
  const deleteFixedItem = useCallback(
    async (item: FixedItem): Promise<boolean> => {
      const ok = await confirm({
        title: 'Xác nhận xóa',
        message: 'Bạn có chắc muốn xóa khoản này?',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      });

      if (!ok) {
        return false;
      }

      try {
        if (!item.id) {
          return false;
        }

        const currentMonthKey = getCurrentMonthKey();
        const itemMonthKey = getEffectiveMonthKey(item, currentMonthKey);
        const ref = doc(firestoreInstance, COLLECTION_NAME, item.id);

        if (itemMonthKey === currentMonthKey) {
          await deleteDoc(ref);
          if (item.type === TRANSACTION_TYPES.INCOME) {
            setFixedIncomeAll(prev => prev.filter(x => x.id !== item.id));
          } else {
            setFixedExpenseAll(prev => prev.filter(x => x.id !== item.id));
          }
        } else {
          const deletedAt = new Date();
          await updateDoc(ref, {
            isDeleted: true,
            deleteAt: deletedAt,
            updatedAt: serverTimestamp(),
          });
          if (item.type === TRANSACTION_TYPES.INCOME) {
            setFixedIncomeAll(prev =>
              prev.map(x =>
                x.id === item.id
                  ? { ...x, isDeleted: true, deleteAt: deletedAt }
                  : x,
              ),
            );
          } else {
            setFixedExpenseAll(prev =>
              prev.map(x =>
                x.id === item.id
                  ? { ...x, isDeleted: true, deleteAt: deletedAt }
                  : x,
              ),
            );
          }
        }

        showSnackbar({
          message: 'Đã xóa thành công',
          type: 'success',
        });
        return true;
      } catch (error) {
        console.error('Error deleting fixed item:', error);
        showSnackbar({
          message: 'Không thể xóa. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId],
  );

  // Tính tổng thu cố định
  const getTotalFixedIncome = useCallback(() => {
    return calculateTotalForMonth(fixedIncomeAll, getCurrentMonthKey());
  }, [fixedIncomeAll]);

  // Tính tổng chi cố định
  const getTotalFixedExpense = useCallback(() => {
    return calculateTotalForMonth(fixedExpenseAll, getCurrentMonthKey());
  }, [fixedExpenseAll]);

  // Tính tổng thu cố định theo tháng bất kỳ (monthKey dạng 'YYYY-MM')
  const getTotalFixedIncomeByMonth = useCallback(
    (monthKey: string) => {
      return calculateTotalForMonth(fixedIncomeAll, monthKey);
    },
    [fixedIncomeAll],
  );

  // Tính tổng chi cố định theo tháng bất kỳ (monthKey dạng 'YYYY-MM')
  const getTotalFixedExpenseByMonth = useCallback(
    (monthKey: string) => {
      return calculateTotalForMonth(fixedExpenseAll, monthKey);
    },
    [fixedExpenseAll],
  );

  // Fetch từ Firestore và tính tổng thu/chi cố định cho tháng (cho các tháng khác tháng hiện tại)
  const fetchFixedTotalsForMonth = useCallback(
    async (
      monthKey: string,
    ): Promise<{ income: number; expense: number }> => {
      let uid = userId;
      if (!uid) {
        const stored = await getStoredUser();
        uid = stored?.uid ?? null;
      }
      if (!uid) {
        return { income: 0, expense: 0 };
      }
      const [incomeRes, expenseRes] = await Promise.all([
        fetchFixedItemsPage(uid, TRANSACTION_TYPES.INCOME),
        fetchFixedItemsPage(uid, TRANSACTION_TYPES.EXPENSE),
      ]);
      const income = calculateTotalForMonth(incomeRes.items, monthKey);
      const expense = calculateTotalForMonth(expenseRes.items, monthKey);
      return { income, expense };
    },
    [userId],
  );

  const getFixedItemsByMonth = useCallback(
    (monthKey: string, type: TransactionType): FixedItem[] => {
      const source =
        type === TRANSACTION_TYPES.INCOME ? fixedIncomeAll : fixedExpenseAll;
      return selectEffectiveItemsForMonth(source, monthKey);
    },
    [fixedIncomeAll, fixedExpenseAll],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    await reloadForUser(userId);
  }, [userId, reloadForUser]);

  const value: FixedItemsContextValue = {
    fixedIncomeList: fixedIncomeAll,
    fixedExpenseList: fixedExpenseAll,
    fixedIncomeData,
    fixedExpenseData,
    isLoading,
    isSaving,
    addFixedItem,
    updateFixedItem,
    deleteFixedItem,
    getTotalFixedIncome,
    getTotalFixedExpense,
    getTotalFixedIncomeByMonth,
    getTotalFixedExpenseByMonth,
    fetchFixedTotalsForMonth,
    getFixedItemsByMonth,
    refresh,
  };

  return React.createElement(
    FixedItemsContext.Provider,
    { value },
    children,
  );
};

export const useFixedItems = (): FixedItemsContextValue => {
  const ctx = useContext(FixedItemsContext);
  if (!ctx) {
    throw new Error('useFixedItems must be used within a FixedItemsProvider');
  }
  return ctx;
};

export default useFixedItems;
