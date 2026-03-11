import { getApp } from '@react-native-firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export type BalanceNotificationKind =
  | 'fund_transfer'
  | 'fund_topup'
  | 'fund_balance_set'
  | 'fund_created'
  | 'fund_deleted'
  | 'transaction_added'
  | 'transaction_updated'
  | 'transaction_deleted';

export type BalanceNotificationRecord = {
  id: string;
  userId: string;
  kind: BalanceNotificationKind;
  title: string;
  message: string;
  isRead: boolean;
  readAtMs?: number;
  createdAtMs: number;
  createdAt?: Date;
};

const firestoreInstance = getFirestore(getApp());

const UNREAD_KEY_PREFIX = 'balance_notifications_unread_count__';
const LAST_SEEN_KEY_PREFIX = 'balance_notifications_last_seen_ms__';

function unreadKey(userId: string) {
  return `${UNREAD_KEY_PREFIX}${userId}`;
}

function lastSeenKey(userId: string) {
  return `${LAST_SEEN_KEY_PREFIX}${userId}`;
}

function notificationsCollection(userId: string) {
  // Store under user subcollection to avoid composite indexes.
  return collection(firestoreInstance, 'users', userId, 'balanceNotifications');
}

function mapDocToRecord(
  userId: string,
  docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
): BalanceNotificationRecord {
  const data = docSnap.data() as Record<string, unknown>;
  const createdAt = data.createdAt as FirebaseFirestoreTypes.Timestamp | undefined;
  return {
    id: docSnap.id,
    userId,
    kind: data.kind as BalanceNotificationKind,
    title: (data.title as string) ?? '',
    message: (data.message as string) ?? '',
    isRead: (data.isRead as boolean) ?? false,
    readAtMs: (data.readAtMs as number) ?? undefined,
    createdAtMs: (data.createdAtMs as number) ?? 0,
    createdAt: createdAt?.toDate?.() ?? undefined,
  };
}

export async function pushBalanceNotification(
  userId: string,
  payload: {
    kind: BalanceNotificationKind;
    title: string;
    message: string;
  },
  keepLatest: number = 20,
): Promise<void> {
  const createdAtMs = Date.now();

  const colRef = notificationsCollection(userId);

  await addDoc(colRef, {
    kind: payload.kind,
    title: payload.title,
    message: payload.message,
    isRead: false,
    readAtMs: null,
    createdAtMs,
    createdAt: serverTimestamp(),
  });

  // Cache unread count locally (per user) for badge.
  // We intentionally keep this local-only to avoid extra backend complexity.
  try {
    const raw = await AsyncStorage.getItem(unreadKey(userId));
    const current = raw ? Number(raw) : 0;
    const next = Number.isFinite(current) && current > 0 ? current + 1 : 1;
    await AsyncStorage.setItem(unreadKey(userId), String(next));
  } catch {
    // ignore cache errors
  }

  // Keep only latest N notifications per user.
  const q = query(
    colRef,
    orderBy('createdAtMs', 'desc'),
    limit(Math.max(keepLatest + 5, keepLatest)),
  );

  const snap = await getDocs(q);
  if (snap.size <= keepLatest) return;

  const batch = writeBatch(firestoreInstance);
  snap.docs.slice(keepLatest).forEach((d:any) => batch.delete(d.ref));
  await batch.commit();
}

export function subscribeBalanceNotifications(
  userId: string,
  onChange: (items: BalanceNotificationRecord[]) => void,
  keepLatest: number = 20,
): () => void {
  const colRef = notificationsCollection(userId);
  const q = query(
    colRef,
    orderBy('createdAtMs', 'desc'),
    limit(keepLatest),
  );

  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d:any) => mapDocToRecord(userId, d)));
  });
}

export async function getBalanceNotificationsUnreadCount(userId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(unreadKey(userId));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function setBalanceNotificationsUnreadCount(userId: string, count: number): Promise<void> {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  await AsyncStorage.setItem(unreadKey(userId), String(safe));
}

export async function getBalanceNotificationsLastSeenMs(userId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(lastSeenKey(userId));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function setBalanceNotificationsLastSeenMs(userId: string, ms: number): Promise<void> {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  await AsyncStorage.setItem(lastSeenKey(userId), String(safe));
}

export async function markBalanceNotificationsRead(userId: string, latestCreatedAtMs: number): Promise<void> {
  await Promise.all([
    setBalanceNotificationsLastSeenMs(userId, latestCreatedAtMs),
    setBalanceNotificationsUnreadCount(userId, 0),
  ]);
}

export async function markBalanceNotificationsReadByIds(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(firestoreInstance);
  const now = Date.now();
  ids.forEach((id) => {
    batch.update(doc(firestoreInstance, 'users', userId, 'balanceNotifications', id), {
      isRead: true,
      readAtMs: now,
    });
  });
  await batch.commit();
}

export async function deleteBalanceNotification(userId: string, id: string): Promise<void> {
  await deleteDoc(doc(firestoreInstance, 'users', userId, 'balanceNotifications', id));
}

