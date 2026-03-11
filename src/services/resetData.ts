import AsyncStorage from '@react-native-async-storage/async-storage';
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
const YEARLY_RESET_KEY_PREFIX = 'yearly_reset_year_';
const YEARS_TO_KEEP = 3;

/**
 * Xóa toàn bộ transaction của user trước mốc thời gian cho trước.
 */
async function deleteOldTransactionsForUser(
  userId: string,
  startOfPrevDecember: Date,
): Promise<void> {
  const transactionsCollection = collection(
    firestoreInstance,
    TRANSACTIONS_COLLECTION,
  );

  const q = query(transactionsCollection, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  console.log(
    '[Firestore] resetData.deleteOldTransactionsForUser size=',
    snapshot.size,
  );

  if (snapshot.empty) return;

  const deletions: Promise<void>[] = [];

  snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = docSnap.data();
    const ts = data.transactionDate as
      | FirebaseFirestoreTypes.Timestamp
      | Date
      | undefined;

    let date: Date | null = null;

    if (ts instanceof Date) {
      date = ts;
    } else if (
      ts &&
      typeof (ts as FirebaseFirestoreTypes.Timestamp).toDate === 'function'
    ) {
      date = (ts as FirebaseFirestoreTypes.Timestamp).toDate();
    }

    if (date && date < startOfPrevDecember) {
      deletions.push(
        deleteDoc(
          doc(firestoreInstance, TRANSACTIONS_COLLECTION, docSnap.id),
        ),
      );
    }
  });

  if (deletions.length > 0) {
    await Promise.all(deletions);
  }
}

/**
 * Reset transactions cũ của user nhưng giữ lại dữ liệu 3 năm gần nhất
 * (tính từ tháng 12 của năm cách đây YEARS_TO_KEEP năm).
 *
 * Ví dụ:
 * - Đang năm 2026
 * - YEARS_TO_KEEP = 3
 * → Giữ lại từ 01/12/2023 trở đi
 */
export async function resetUserTransactionsKeepLastDecember(
  userId: string,
): Promise<void> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const baseYear = currentYear - YEARS_TO_KEEP;

  const startOfPrevDecember = new Date(baseYear, 11, 1, 0, 0, 0, 0);

  await deleteOldTransactionsForUser(userId, startOfPrevDecember);
}

/**
 * Thực hiện reset transaction mỗi năm nếu chưa reset trong năm hiện tại.
 * Gọi ở Splash/Home sau khi có userId.
 */
export async function maybeResetUserTransactionsYearly(
  userId: string,
): Promise<void> {
  if (!userId) return;

  const now = new Date();
  const currentYear = now.getFullYear();

  const key = `${YEARLY_RESET_KEY_PREFIX}${userId}`;
  const stored = await AsyncStorage.getItem(key);
  const lastResetYear = stored ? Number(stored) : NaN;

  if (!Number.isNaN(lastResetYear) && lastResetYear >= currentYear) {
    return; // Năm nay đã reset rồi
  }

  await resetUserTransactionsKeepLastDecember(userId);

  await AsyncStorage.setItem(key, String(currentYear));
}