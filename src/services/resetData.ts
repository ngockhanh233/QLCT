import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { LAST_TRANSACTION_RESET_YEAR_FIELD } from './userProfile';

const firestoreInstance = getFirestore(getApp());

const TRANSACTIONS_COLLECTION = 'transactions';
const USERS_COLLECTION = 'users';
const YEARLY_RESET_KEY_PREFIX = 'yearly_reset_year_';
const YEARS_TO_KEEP = 3;

/**
 * Xóa transaction có transactionDate **trước** mốc `deleteIfBefore` (không xóa đúng ngày mốc).
 * Giữ lại các tx vay/nợ (`isLoanMovement === true`) vì chúng gắn với doc `debts/*`
 * trong DebtsContext — xóa sẽ phá vỡ lịch sử khoản nợ.
 */
async function deleteOldTransactionsForUser(
  userId: string,
  deleteIfBefore: Date,
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

    // Bỏ qua giao dịch vay/nợ — lịch sử khoản nợ phải giữ để còn đối chiếu.
    if (data.isLoanMovement === true) return;

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

    if (date && date < deleteIfBefore) {
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
 * Mỗi lần gọi: xóa giao dịch cũ hơn **3 năm** theo năm — giữ từ **00:00 01/01**
 * của năm `(năm hiện tại − YEARS_TO_KEEP)` trở đi.
 */
export async function resetUserTransactionsKeepLastDecember(
  userId: string,
): Promise<void> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const firstYearToKeep = currentYear - YEARS_TO_KEEP;

  const keepFromDate = new Date(firstYearToKeep, 0, 1, 0, 0, 0, 0);

  await deleteOldTransactionsForUser(userId, keepFromDate);
}

function yearKey(userId: string): string {
  return `${YEARLY_RESET_KEY_PREFIX}${userId}`;
}

async function writeLastResetYearToFirestore(
  userId: string,
  year: number,
): Promise<void> {
  const ref = doc(firestoreInstance, USERS_COLLECTION, userId);
  await setDoc(
    ref,
    {
      [LAST_TRANSACTION_RESET_YEAR_FIELD]: year,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Sau khi dọn transaction xong: luôn ghi **cùng một năm** lên Firestore rồi AsyncStorage
 * (Firestore trước — nguồn đúng; cache sau).
 */
async function persistLastTransactionResetYear(
  userId: string,
  year: number,
): Promise<void> {
  await writeLastResetYearToFirestore(userId, year);
  await AsyncStorage.setItem(yearKey(userId), String(year));
}

/** Chỉ parse chuỗi AsyncStorage, không gọi mạng. */
function parseYearFromStorage(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/**
 * Đọc năm đã dọn từ AsyncStorage — **chỉ đọc, không ghi, không Firestore**.
 * Có giá trị hợp lệ → dùng để đối chiếu; không có → trả `null`.
 */
async function readLastResetYearFromCacheOnly(
  userId: string,
): Promise<number | null> {
  return parseYearFromStorage(await AsyncStorage.getItem(yearKey(userId)));
}

/**
 * Chỉ gọi khi **chưa có** năm trong AsyncStorage: đọc / tạo trên Firestore rồi cache local.
 * (Đăng nhập lần đầu, xóa data app, v.v.)
 */
async function hydrateLastResetYearFromFirestore(userId: string): Promise<number> {
  const key = yearKey(userId);
  const currentYear = new Date().getFullYear();

  const userRef = doc(firestoreInstance, USERS_COLLECTION, userId);
  const snap = await getDoc(userRef);
  const rawFs = snap.exists()
    ? snap.data()?.[LAST_TRANSACTION_RESET_YEAR_FIELD]
    : undefined;
  const fromFs =
    typeof rawFs === 'number' && Number.isFinite(rawFs) ? rawFs : null;

  if (fromFs !== null) {
    await AsyncStorage.setItem(key, String(fromFs));
    return fromFs;
  }

  const resolved = !snap.exists() ? currentYear : currentYear - 1;

  await setDoc(
    userRef,
    {
      uid: userId,
      [LAST_TRANSACTION_RESET_YEAR_FIELD]: resolved,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await AsyncStorage.setItem(key, String(resolved));
  return resolved;
}

/**
 * Năm để đối chiếu trong `maybeReset`: **có cache → chỉ lấy số đó, không update gì**.
 * Không có cache → `hydrateLastResetYearFromFirestore`.
 */
async function getLastResetYearForDecision(userId: string): Promise<number> {
  const cached = await readLastResetYearFromCacheOnly(userId);
  if (cached !== null) {
    return cached;
  }
  return hydrateLastResetYearFromFirestore(userId);
}

/**
 * Sau đăng nhập: **chỉ khi chưa có** năm trong AsyncStorage mới lôi Firestore + có thể ghi cache.
 * Đã có cache → **không làm gì** (không đọc Firestore, không ghi).
 */
export async function cacheTransactionResetYearFromFirestoreToAsyncStorage(
  userId: string,
): Promise<void> {
  if (!userId) return;
  const cached = await readLastResetYearFromCacheOnly(userId);
  if (cached !== null) {
    return;
  }
  await hydrateLastResetYearFromFirestore(userId);
}

/**
 * Mỗi lần mở app (Splash): đối chiếu năm đã dọn với **năm hiện tại**.
 * Nếu `năm hiện tại > năm đã lưu` thì xóa transaction cũ (trước 01/01 của năm hiện tại − 3),
 * rồi ghi `lastTransactionResetYear = năm hiện tại` (Firebase + AsyncStorage).
 */
export async function maybeResetUserTransactionsYearly(
  userId: string,
): Promise<void> {
  if (!userId) return;

  const currentYear = new Date().getFullYear();
  const lastYear = await getLastResetYearForDecision(userId);

  if (lastYear >= currentYear) {
    return;
  }

  await resetUserTransactionsKeepLastDecember(userId);
  await persistLastTransactionResetYear(userId, currentYear);
}
