import React, { useCallback, useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { getStoredUser, pushBalanceNotification } from '../../../../../services';
import { showSnackbar } from '../../../../../utils/snackbar';
import type { FundRecord } from '../../../../../types/fund';
import { DEFAULT_FUND_ICON_ID } from '../../../../../constants/FundIconConstants';

const COLLECTION_NAME = 'funds';
type QueryDoc =
  FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

const firestoreInstance = getFirestore(getApp());
const fundsCollection = collection(firestoreInstance, COLLECTION_NAME);

async function fetchFunds(userId: string): Promise<FundRecord[]> {
  const q = query(
    fundsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap: QueryDoc) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      userId: data.userId as string,
      name: data.name as string,
      balance: (data.balance as number) ?? 0,
      color: data.color as string | undefined,
      icon: (data.icon as string | null | undefined) ?? undefined,
      isDefault: data.isDefault as boolean | undefined,
      createdAt: (data.createdAt as FirebaseFirestoreTypes.Timestamp)?.toDate?.() ?? undefined,
      updatedAt: (data.updatedAt as FirebaseFirestoreTypes.Timestamp)?.toDate?.() ?? undefined,
    };
  });
}

const DEFAULT_FUND_NAME = 'Quỹ mặc định';
const DEFAULT_FUND_COLOR = '#FF6B35';

export async function ensureDefaultFund(userId: string): Promise<string> {
  const items = await fetchFunds(userId);
  const defaultFund = items.find(f => f.isDefault);
  if (defaultFund) return defaultFund.id;

  const docRef = await addDoc(fundsCollection, {
    userId,
    name: DEFAULT_FUND_NAME,
    balance: 0,
    color: DEFAULT_FUND_COLOR,
    icon: DEFAULT_FUND_ICON_ID,
    isDefault: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getDefaultFundIfExists(userId: string): Promise<FundRecord | undefined> {
  const items = await fetchFunds(userId);
  if (!items.length) return undefined;
  const defaultFund = items.find(f => f.isDefault);
  // Nếu chưa có cờ isDefault (user cũ) thì coi quỹ đầu tiên là quỹ mặc định hiện tại.
  return defaultFund ?? items[0];
}

export async function createDefaultFundWithInitialBalance(userId: string, initialBalance: number): Promise<string> {
  // Chỉ tạo khi thật sự chưa có quỹ nào (user mới hoàn toàn).
  const items = await fetchFunds(userId);
  if (items.length > 0) {
    const existingDefault = items.find(f => f.isDefault) ?? items[0];
    return existingDefault.id;
  }

  const safeBalance = Number.isFinite(initialBalance) && initialBalance > 0 ? initialBalance : 0;
  const docRef = await addDoc(fundsCollection, {
    userId,
    name: DEFAULT_FUND_NAME,
    balance: safeBalance,
    color: DEFAULT_FUND_COLOR,
    icon: DEFAULT_FUND_ICON_ID,
    isDefault: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Hoàn ngược tác động thu/chi cố định lên quỹ (gọi khi xóa fixed item trong tháng đã settlement). Thu = quỹ chung; chi = quỹ đã chọn (fundId) hoặc quỹ chung. */
export async function reverseFixedItemImpact(
  userId: string,
  type: 'income' | 'expense',
  amount: number,
  fundId?: string | null,
): Promise<void> {
  if (amount <= 0) return;
  const targetFundId = fundId || (await ensureDefaultFund(userId));
  const fundRef = doc(firestoreInstance, COLLECTION_NAME, targetFundId);
  const delta = type === 'income' ? -amount : amount;
  await updateDoc(fundRef, {
    balance: increment(delta),
    updatedAt: serverTimestamp(),
  });
}

type FundsContextValue = {
  funds: FundRecord[];
  defaultFund: FundRecord | undefined;
  isLoading: boolean;
  refresh: () => Promise<void> | void;
  ensureDefaultFundAndReload: () => Promise<string | null>;
  createFund: (
    name: string,
    initialBalance?: number,
    color?: string,
    isDefault?: boolean,
    icon?: string | null,
  ) => Promise<string | null>;
  updateFund: (
    id: string,
    updates: { name?: string; color?: string; isDefault?: boolean; icon?: string | null },
  ) => Promise<boolean>;
  setFundBalance: (id: string, newBalance: number) => Promise<boolean>;
  topUpFund: (id: string, amount: number) => Promise<boolean>;
  transferToFund: (targetFundId: string, amount: number, sourceFundId: string) => Promise<boolean>;
  deductFromFund: (fundId: string, amount: number) => Promise<boolean>;
  addToFund: (fundId: string, amount: number) => Promise<boolean>;
  deleteFund: (
    id: string,
    options?: {
      /** Bỏ qua bước tự động chuyển số dư sang quỹ khác (xóa luôn số dư còn lại). */
      skipTransfer?: boolean;
      /** Quỹ nhận tiền khi xóa (nếu không truyền, sẽ dùng quỹ mặc định/đầu tiên như logic cũ). */
      targetFundId?: string | null;
    },
  ) => Promise<boolean>;
  setDefaultFund: (id: string) => Promise<boolean>;
};

const FundsContext = createContext<FundsContextValue | null>(null);

function useFundsInternal(): FundsContextValue {
  const [userId, setUserId] = useState<string | null>(null);
  const [funds, setFunds] = useState<FundRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getFundName = useCallback(
    (id: string) => funds.find(f => f.id === id)?.name ?? 'Quỹ',
    [funds],
  );

  const loadFunds = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const items = await fetchFunds(uid);
      setFunds(items);
    } catch (error) {
      console.error('Error loading funds:', error);
      showSnackbar({
        message: 'Không thể tải danh sách quỹ. Vui lòng thử lại',
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
        if (!cancelled) setUserId(stored?.uid ?? null);
      } catch (error) {
        if (!cancelled) console.error('Error loading user for funds:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setFunds([]);
      return;
    }
    loadFunds(userId);
  }, [userId, loadFunds]);

  const createFund = useCallback(
    async (
      name: string,
      initialBalance: number = 0,
      color?: string,
      isDefault: boolean = false,
      icon?: string | null,
    ): Promise<string | null> => {
      if (!userId) return null;

      try {
        const docRef = await addDoc(fundsCollection, {
          userId,
          name: name.trim(),
          balance: initialBalance,
          color: color ?? null,
          icon: icon ?? null,
          isDefault: isDefault || false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        showSnackbar({ message: 'Đã tạo quỹ thành công', type: 'success' });
        try {
          const amountLabel = `${initialBalance.toLocaleString('vi-VN')}đ`;
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const totalAfter = totalBefore + (initialBalance > 0 ? initialBalance : 0);
          const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;
          const signedDelta = `+${initialBalance.toLocaleString('vi-VN')}đ`;
          await pushBalanceNotification(userId, {
            kind: 'fund_created',
            title: 'Tạo quỹ',
            message: `"${name.trim()}"\n${signedDelta} - Số dư: ${amountLabel}\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
        await loadFunds(userId);

        return docRef.id;
      } catch (error) {
        console.error('Error creating fund:', error);
        showSnackbar({
          message: 'Không thể tạo quỹ. Vui lòng thử lại',
          type: 'error',
        });
        return null;
      }
    },
    [userId, loadFunds],
  );

  const updateFund = useCallback(
    async (
      id: string,
      updates: { name?: string; color?: string; isDefault?: boolean; icon?: string | null },
    ): Promise<boolean> => {
      if (!userId) return false;

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        await updateDoc(ref, {
          ...updates,
          updatedAt: serverTimestamp(),
        });

        showSnackbar({ message: 'Đã cập nhật quỹ', type: 'success' });
        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error updating fund:', error);
        showSnackbar({
          message: 'Không thể cập nhật quỹ. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, loadFunds],
  );

  const setFundBalance = useCallback(
    async (id: string, newBalance: number): Promise<boolean> => {
      if (!userId) return false;
      if (!Number.isFinite(newBalance) || newBalance < 0) return false;

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        const snap = await getDoc(ref);
        const oldBalance = snap.exists() ? (((snap.data()?.balance as number) ?? 0)) : undefined;
        await updateDoc(ref, {
          balance: newBalance,
          updatedAt: serverTimestamp(),
        });
        showSnackbar({ message: 'Đã cập nhật số dư quỹ', type: 'success' });
        try {
          const name = getFundName(id);
          const oldLabel = typeof oldBalance === 'number' ? `${oldBalance.toLocaleString('vi-VN')}đ` : '—';
          const newLabel = `${newBalance.toLocaleString('vi-VN')}đ`;
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const oldFromState = funds.find(f => f.id === id)?.balance;
          const totalAfter =
            typeof oldFromState === 'number'
              ? totalBefore - oldFromState + newBalance
              : typeof oldBalance === 'number'
              ? totalBefore - oldBalance + newBalance
              : totalBefore;
          const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;
          const minus = '\u2212';
          const oldNum = typeof oldBalance === 'number' ? oldBalance : 0;
          const delta = newBalance - oldNum;
          const deltaAbs = Math.abs(delta).toLocaleString('vi-VN');
          const signedDelta = delta >= 0 ? `+${deltaAbs}đ` : `${minus}${deltaAbs}đ`;
          await pushBalanceNotification(userId, {
            kind: 'fund_balance_set',
            title: 'Chỉnh số dư quỹ',
            message: `"${name}"\n${signedDelta} - Số dư: ${newLabel}\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error setting fund balance:', error);
        showSnackbar({
          message: 'Không thể cập nhật số dư. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, loadFunds],
  );

  const topUpFund = useCallback(
    async (id: string, amount: number): Promise<boolean> => {
      if (!userId || amount <= 0) return false;

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        const fundSnap = await getDoc(ref);
        if (!fundSnap.exists) return false;

        const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
        await updateDoc(ref, {
          balance: currentBalance + amount,
          updatedAt: serverTimestamp(),
        });

        showSnackbar({ message: 'Đã nạp tiền vào quỹ', type: 'success' });
        try {
          const name = getFundName(id);
          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const newBalanceLabel = `${(currentBalance + amount).toLocaleString('vi-VN')}đ`;
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const totalAfter = totalBefore + amount;
          const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;
          const signedDelta = `+${amount.toLocaleString('vi-VN')}đ`;
          await pushBalanceNotification(userId, {
            kind: 'fund_topup',
            title: 'Nạp tiền',
            message: `"${name}"\n${signedDelta} - Số dư: ${newBalanceLabel}\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error topping up fund:', error);
        showSnackbar({
          message: 'Không thể nạp tiền. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, loadFunds],
  );

  /** Chuyển tiền từ quỹ nguồn sang quỹ đích (nạp tiền có chọn nguồn) */
  const transferToFund = useCallback(
    async (targetFundId: string, amount: number, sourceFundId: string): Promise<boolean> => {
      if (!userId || amount <= 0 || targetFundId === sourceFundId) return false;

      try {
        let sourceName: string | undefined;
        let targetName: string | undefined;
        let sourceNewBalance: number | undefined;
        let targetNewBalance: number | undefined;

        await runTransaction(firestoreInstance, async (transaction) => {
          const sourceRef = doc(firestoreInstance, COLLECTION_NAME, sourceFundId);
          const targetRef = doc(firestoreInstance, COLLECTION_NAME, targetFundId);

          const [sourceSnap, targetSnap] = await Promise.all([
            transaction.get(sourceRef),
            transaction.get(targetRef),
          ]);

          if (!sourceSnap.exists || !targetSnap.exists) {
            throw new Error('Quỹ không tồn tại');
          }

          sourceName = (sourceSnap.data()?.name as string | undefined) ?? sourceName;
          targetName = (targetSnap.data()?.name as string | undefined) ?? targetName;

          const sourceBalance = (sourceSnap.data()?.balance as number) ?? 0;
          if (sourceBalance < amount) {
            throw new Error('Số dư quỹ nguồn không đủ');
          }

          const targetBalance = (targetSnap.data()?.balance as number) ?? 0;
          sourceNewBalance = sourceBalance - amount;
          targetNewBalance = targetBalance + amount;

          transaction.update(sourceRef, {
            balance: increment(-amount),
            updatedAt: serverTimestamp(),
          });
          transaction.update(targetRef, {
            balance: increment(amount),
            updatedAt: serverTimestamp(),
          });
        });

        showSnackbar({ message: 'Đã nạp tiền vào quỹ', type: 'success' });
        try {
          const srcName = sourceName ?? getFundName(sourceFundId);
          const dstName = targetName ?? getFundName(targetFundId);
          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const srcBalLabel =
            typeof sourceNewBalance === 'number'
              ? `${sourceNewBalance.toLocaleString('vi-VN')}đ`
              : '';
          const dstBalLabel =
            typeof targetNewBalance === 'number'
              ? `${targetNewBalance.toLocaleString('vi-VN')}đ`
              : '';

          // Đọc tổng số dư mới nhất từ Firestore để tránh lệch do state chưa kịp đồng bộ.
          let totalAfter: number | undefined;
          try {
            const fundsSnap = await getDocs(
              query(
                collection(firestoreInstance, COLLECTION_NAME),
                where('userId', '==', userId),
              ),
            );
            totalAfter = fundsSnap.docs.reduce(
              (sum: number, d: QueryDoc) =>
                sum + (((d.data() as any)?.balance as number) ?? 0),
              0,
            );
          } catch {
            // ignore and fallback to local state below
          }

          const totalLabel = `${(
            typeof totalAfter === 'number'
              ? totalAfter
              : funds.reduce((sum, f) => sum + (f.balance ?? 0), 0)
          ).toLocaleString('vi-VN')}đ`;
          const minus = '\u2212';
          const fmtSigned = (n: number) => {
            const abs = Math.abs(n).toLocaleString('vi-VN');
            return n >= 0 ? `+${abs}đ` : `${minus}${abs}đ`;
          };
          const safeSrcBal = typeof sourceNewBalance === 'number' ? `${sourceNewBalance.toLocaleString('vi-VN')}đ` : '0đ';
          const safeDstBal = typeof targetNewBalance === 'number' ? `${targetNewBalance.toLocaleString('vi-VN')}đ` : '0đ';
          await pushBalanceNotification(userId, {
            kind: 'fund_transfer',
            title: 'Chuyển tiền giữa quỹ',
            message:
              `"${srcName}"\n${fmtSigned(-amount)} - Số dư: ${safeSrcBal}\n\n` +
              `"${dstName}"\n${fmtSigned(amount)} - Số dư: ${safeDstBal}\n\n` +
              `Tổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error transferring to fund:', error);
        showSnackbar({
          message: error instanceof Error ? error.message : 'Không thể chuyển tiền. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, loadFunds],
  );

  const deductFromFund = useCallback(
    async (fundId: string, amount: number): Promise<boolean> => {
      if (!userId || amount <= 0) return false;

      try {
        // Lưu lại số dư cũ/mới để tạo notification + message chính xác.
        let oldBalance: number | undefined;
        let newBalance: number | undefined;

        await runTransaction(firestoreInstance, async (transaction) => {
          const fundRef = doc(firestoreInstance, COLLECTION_NAME, fundId);
          const fundSnap = await transaction.get(fundRef);
          if (!fundSnap.exists) {
            throw new Error('Quỹ không tồn tại');
          }

          const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
          const newBalanceValue = currentBalance - amount;
          oldBalance = currentBalance;
          newBalance = newBalanceValue;

          transaction.update(fundRef, {
            balance: newBalanceValue,
            updatedAt: serverTimestamp(),
          });
        });

        showSnackbar({
          message: `Đã rút ${amount.toLocaleString('vi-VN')}đ khỏi quỹ`,
          type: 'success',
        });

        // NotificationsScreen đang render màu theo kind có sẵn,
        // nên dùng `fund_transfer` để hiển thị điểm màu + lưu record.
        try {
          const fundName = getFundName(fundId);
          const minus = '\u2212';
          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const newLabel =
            typeof newBalance === 'number' ? `${newBalance.toLocaleString('vi-VN')}đ` : '—';

          // Tính lại tổng số dư sau khi trừ để hiển thị chính xác trên Notifications.
          let totalAfter: number | undefined;
          try {
            const fundsSnap = await getDocs(
              query(
                collection(firestoreInstance, COLLECTION_NAME),
                where('userId', '==', userId),
              ),
            );
            totalAfter = fundsSnap.docs.reduce(
              (sum: number, d: QueryDoc) =>
                sum + (((d.data() as any)?.balance as number) ?? 0),
              0,
            );
          } catch {
            // ignore and fallback below
          }

          const totalLabel = `${(
            typeof totalAfter === 'number'
              ? totalAfter
              : funds.reduce((sum, f) => sum + (f.balance ?? 0), 0)
          ).toLocaleString('vi-VN')}đ`;

          await pushBalanceNotification(userId, {
            kind: 'fund_transfer',
            title: 'Rút tiền khỏi quỹ',
            message: `"${fundName}"\n${minus}${amountLabel} - Số dư: ${newLabel}\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // notification errors không làm hỏng luồng rút
        }

        return true;
      } catch (error) {
        console.error('Error deducting from fund:', error);
        throw error;
      }
    },
    [userId, funds, getFundName],
  );

  const addToFund = useCallback(
    async (fundId: string, amount: number): Promise<boolean> => {
      if (!userId || amount <= 0) return false;

      try {
        const ref = doc(firestoreInstance, COLLECTION_NAME, fundId);
        const fundSnap = await getDoc(ref);
        if (!fundSnap.exists) return false;

        const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
        await updateDoc(ref, {
          balance: currentBalance + amount,
          updatedAt: serverTimestamp(),
        });

        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error adding to fund:', error);
        throw error;
      }
    },
    [userId, loadFunds],
  );

  const deleteFund = useCallback(
    async (
      id: string,
      options?: {
        skipTransfer?: boolean;
        targetFundId?: string | null;
      },
    ): Promise<boolean> => {
      if (!userId) return false;

      const fund = funds.find(f => f.id === id);
      if (fund?.isDefault) {
        showSnackbar({
          message: 'Không thể xóa quỹ mặc định',
          type: 'error',
        });
        return false;
      }

      const balance = fund?.balance ?? 0;
      const otherFunds = funds.filter(f => f.id !== id);
      let targetFund: FundRecord | undefined;

      if (!options?.skipTransfer && balance > 0) {
        if (options?.targetFundId) {
          targetFund = otherFunds.find(f => f.id === options.targetFundId) ?? undefined;
        }
        if (!targetFund) {
          targetFund = otherFunds.find(f => f.isDefault) ?? otherFunds[0];
        }
      }

      try {
        if (balance > 0 && targetFund && !options?.skipTransfer) {
          await transferToFund(targetFund.id, balance, id);
        }

        const ref = doc(firestoreInstance, COLLECTION_NAME, id);
        await deleteDoc(ref);

        showSnackbar({
          message:
            balance > 0 && targetFund && !options?.skipTransfer
              ? `Đã xóa quỹ. Số dư đã chuyển vào "${targetFund.name}".`
              : 'Đã xóa quỹ',
          type: 'success',
        });
        try {
          const fundName = fund?.name ?? 'Quỹ';
          const amountLabel = `${balance.toLocaleString('vi-VN')}đ`;
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const totalAfter = totalBefore - balance; // nếu có transfer thì tổng sau vẫn giữ nguyên (transferToFund đã xử lý)
          const totalLabel = `${Math.max(0, totalAfter).toLocaleString('vi-VN')}đ`;
          const minus = '\u2212';
          await pushBalanceNotification(userId, {
            kind: 'fund_deleted',
            title: 'Xóa quỹ',
            message:
              balance > 0
                ? `"${fundName}"\n${minus}${balance.toLocaleString('vi-VN')}đ - Số dư: 0đ\nTổng số dư: ${totalLabel}`
                : `"${fundName}"\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error deleting fund:', error);
        showSnackbar({
          message: 'Không thể xóa quỹ. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, loadFunds, funds, transferToFund],
  );

  const setDefaultFund = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const currentDefault = funds.find(f => f.isDefault);
        if (currentDefault?.id === id) {
          return true;
        }

        const targetRef = doc(firestoreInstance, COLLECTION_NAME, id);
        const updates: Promise<unknown>[] = [
          updateDoc(targetRef, {
            isDefault: true,
            updatedAt: serverTimestamp(),
          }),
        ];

        if (currentDefault && currentDefault.id !== id) {
          const currentRef = doc(firestoreInstance, COLLECTION_NAME, currentDefault.id);
          updates.push(
            updateDoc(currentRef, {
              isDefault: false,
              updatedAt: serverTimestamp(),
            }),
          );
        }

        await Promise.all(updates);

        showSnackbar({
          message: 'Đã chuyển quỹ mặc định',
          type: 'success',
        });

        await loadFunds(userId);
        return true;
      } catch (error) {
        console.error('Error setting default fund:', error);
        showSnackbar({
          message: 'Không thể chuyển quỹ mặc định. Vui lòng thử lại',
          type: 'error',
        });
        return false;
      }
    },
    [userId, funds, loadFunds],
  );

  const refresh = useCallback(async () => {
    if (userId) await loadFunds(userId);
  }, [userId, loadFunds]);

  const ensureDefaultFundAndReload = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    const id = await ensureDefaultFund(userId);
    await loadFunds(userId);
    return id;
  }, [userId, loadFunds]);

  const defaultFund = funds.find(f => f.isDefault);

  return {
    funds,
    defaultFund,
    isLoading,
    refresh,
    ensureDefaultFundAndReload,
    createFund,
    updateFund,
    setFundBalance,
    topUpFund,
    transferToFund,
    deductFromFund,
    addToFund,
    deleteFund,
    setDefaultFund,
  };
}

export const FundsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value = useFundsInternal();
  return React.createElement(FundsContext.Provider, { value }, children);
};

export function useFunds(): FundsContextValue {
  const ctx = useContext(FundsContext);
  if (ctx) return ctx;
  // Fallback: vẫn hoạt động nếu dùng ngoài Provider (ví dụ trong test hoặc script riêng).
  return useFundsInternal();
}
