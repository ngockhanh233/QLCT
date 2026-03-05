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
  limit,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

const firestoreInstance = getFirestore(getApp());

const TRANSACTIONS_COLLECTION = 'transactions';
const FIXED_ITEMS_COLLECTION = 'fixedItems';
const BATCH_SIZE = 200;
const YEARLY_RESET_KEY_PREFIX = 'yearly_reset_year_';
const YEARS_TO_KEEP = 3;

function getMonthKeyFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Tính monthKey dạng 'YYYY-MM' cho fixed item dựa trên effectiveFromMonth hoặc createdAt.
 * Nếu không có thông tin thì fallback về '0000-00' để luôn nằm "rất cũ".
 */
function getFixedItemMonthKey(
  data: FirebaseFirestoreTypes.DocumentData,
): string {
  const effectiveFromMonth = data.effectiveFromMonth as string | undefined;
  if (effectiveFromMonth) {
    return effectiveFromMonth;
  }

  const created = data.createdAt as
    | FirebaseFirestoreTypes.Timestamp
    | Date
    | undefined;

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

  return '0000-00';
}

/**
 * Xóa toàn bộ giao dịch của user trước một mốc thời gian cho trước.
 * Để tránh phải tạo index Firestore phức tạp, hàm này chỉ filter theo userId
 * trên server rồi lọc transactionDate ở client.
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
    const data = docSnap.data() as FirebaseFirestoreTypes.DocumentData;
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
 * Xóa các fixedItems của user cũ hơn mốc monthKey cho trước.
 * Giữ lại:
 * - Mọi bản ghi có effectiveFromMonth >= cutoffMonthKey
 * - & các bản sau này.
 */
async function deleteOldFixedItemsForUser(
  userId: string,
  cutoffMonthKey: string,
): Promise<void> {
  const fixedItemsCollection = collection(
    firestoreInstance,
    FIXED_ITEMS_COLLECTION,
  );

  const q = query(fixedItemsCollection, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  console.log(
    '[Firestore] resetData.deleteOldFixedItemsForUser size=',
    snapshot.size,
  );

  if (snapshot.empty) return;

  const deletions: Promise<void>[] = [];

  snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = docSnap.data();
    const monthKey = getFixedItemMonthKey(data);

    if (monthKey < cutoffMonthKey) {
      deletions.push(
        deleteDoc(doc(firestoreInstance, FIXED_ITEMS_COLLECTION, docSnap.id)),
      );
    }
  });

  if (deletions.length > 0) {
    await Promise.all(deletions);
  }
}

/**
 * Reset data cũ của một user nhưng vẫn giữ lại dữ liệu khoảng 3 năm gần nhất
 * (tính từ tháng 12 của năm cách đây `YEARS_TO_KEEP` năm trở lại đây).
 *
 * Logic:
 * - Lấy năm hiện tại N.
 * - Tính baseYear = N - YEARS_TO_KEEP.
 * - Giữ lại:
 *   + Toàn bộ dữ liệu từ tháng 12 của baseYear trở đi.
 *   + Xóa mọi transaction trước ngày 01/12/baseYear.
 *   + Xóa mọi fixedItem có effectiveFromMonth < `${baseYear}-12`.
 *
 * Ví dụ:
 * - Đang năm 2026:
 *   + Giữ lại từ 12/2025 trở đi.
 *   + Xóa mọi thứ trước 12/2025.
 */
export async function resetUserDataKeepLastDecember(
  userId: string,
): Promise<void> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const baseYear = currentYear - YEARS_TO_KEEP;

  // 01/12 của năm baseYear
  const startOfPrevDecember = new Date(baseYear, 11, 1, 0, 0, 0, 0);
  const cutoffMonthKey = `${baseYear}-12`;

  await Promise.all([
    deleteOldTransactionsForUser(userId, startOfPrevDecember),
    deleteOldFixedItemsForUser(userId, cutoffMonthKey),
  ]);
}

/**
 * Thực hiện reset data hàng năm cho user nếu chưa reset trong năm hiện tại.
 *
 * Cách hoạt động:
 * - Chỉ chạy khi đang ở NĂM hiện tại và đã qua 01/01 (tức là bất kỳ lúc nào trong năm đó).
 * - Lưu lại năm đã reset vào AsyncStorage theo từng user.
 * - Nếu đã reset cho năm đó rồi thì không chạy lại.
 *
 * Gọi hàm này ở chỗ khởi động app sau khi xác định được user (ví dụ Splash / Home).
 */
export async function maybeResetUserDataYearly(
  userId: string,
): Promise<void> {
  if (!userId) return;

  const now = new Date();
  const currentYear = now.getFullYear();

  // Đảm bảo chỉ chạy từ 01/01 trở đi (nhưng nếu mở app trễ hơn trong năm thì vẫn chạy).
  // Nếu vì lý do nào đó đồng hồ hệ thống sai ngày/năm thì logic này cũng sẽ lệch theo.
  const key = `${YEARLY_RESET_KEY_PREFIX}${userId}`;
  const stored = await AsyncStorage.getItem(key);
  const lastResetYear = stored ? Number(stored) : NaN;

  if (!Number.isNaN(lastResetYear) && lastResetYear >= currentYear) {
    // Năm nay đã reset rồi.
    return;
  }

  // Tiến hành reset dữ liệu cũ, giữ lại tháng 12 của năm trước.
  await resetUserDataKeepLastDecember(userId);

  // Ghi lại năm đã reset để tránh chạy lại trong năm nay.
  await AsyncStorage.setItem(key, String(currentYear));
}


