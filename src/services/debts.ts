import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
  increment,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { pushBalanceNotification } from './balanceNotifications';

const firestoreInstance = getFirestore(getApp());
const DEBTS_COLLECTION = 'debts';
const TRANSACTIONS_COLLECTION = 'transactions';
const FUNDS_COLLECTION = 'funds';

const MINUS = '−';

/** Lấy tổng balance + balance/name của các quỹ cần chi tiết, đọc sau khi mutation xong. */
async function fetchFundsSummary(
  userId: string,
  fundIdsOfInterest: (string | null | undefined)[],
): Promise<{
  totalAfter: number;
  byId: Map<string, { name: string; balance: number }>;
}> {
  const byId = new Map<string, { name: string; balance: number }>();
  const interestSet = new Set(fundIdsOfInterest.filter((x): x is string => !!x));
  let totalAfter = 0;
  try {
    const snap = await getDocs(
      query(
        collection(firestoreInstance, FUNDS_COLLECTION),
        where('userId', '==', userId),
      ),
    );
    snap.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
      const data = d.data() as Record<string, unknown>;
      const balance = Number(data?.balance ?? 0) || 0;
      totalAfter += balance;
      if (interestSet.has(d.id)) {
        byId.set(d.id, {
          name: (data?.name as string | undefined) ?? 'Quỹ',
          balance,
        });
      }
    });
  } catch {
    // ignore — caller dùng fallback
  }
  return { totalAfter, byId };
}

function formatAmount(n: number): string {
  return `${n.toLocaleString('vi-VN')}đ`;
}

function formatSigned(delta: number): string {
  const abs = formatAmount(Math.abs(delta));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `${MINUS}${abs}`;
  return abs;
}

/** Best-effort: nếu push notification lỗi thì swallow. */
async function safePushNotification(
  userId: string,
  payload: Parameters<typeof pushBalanceNotification>[1],
): Promise<void> {
  try {
    await pushBalanceNotification(userId, payload);
  } catch {
    // ignore
  }
}

export type DebtDirection = 'lent' | 'borrowed' | 'installment';
export type DebtStatus = 'open' | 'settled';

/** CategoryId đặc biệt dùng cho các transaction liên kết với nợ (isLoanMovement=true). */
export const LOAN_CATEGORY_IDS = {
  lent: 'loan_lent',
  borrowed: 'loan_borrowed',
  repayReceived: 'loan_repay_received',
  repayPaid: 'loan_repay_paid',
} as const;

export type DebtRepayment = {
  id: string;
  amount: number;
  date: Date;
  fundId: string;
  note?: string;
  transactionId?: string;
};

/** Lần vay/cho vay phát sinh thêm sau khi tạo debt ban đầu. */
export type DebtBorrow = {
  id: string;
  amount: number;
  date: Date;
  fundId: string;
  note?: string;
  transactionId?: string;
};

/**
 * Khoản lãi ghi nhận thủ công. Không đụng quỹ, không tạo transaction —
 * chỉ cộng vào tổng cần trả để hiển thị gốc vs lãi rõ ràng.
 */
export type DebtInterest = {
  id: string;
  amount: number;
  date: Date;
  note?: string;
};

export type DebtRecord = {
  id: string;
  userId: string;
  direction: DebtDirection;
  counterparty: string;
  principal: number;
  fundId: string;
  startDate: Date;
  dueDate?: Date | null;
  note?: string | null;
  repayments: DebtRepayment[];
  /** Các lần vay/cho vay thêm sau khi tạo debt (nếu có). */
  additionalBorrows: DebtBorrow[];
  /** Các khoản lãi ghi nhận thủ công (không đụng quỹ). */
  interestEntries: DebtInterest[];
  status: DebtStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

type QueryDoc =
  FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>;

function tsToDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in (v as any)) {
    try {
      return (v as FirebaseFirestoreTypes.Timestamp).toDate();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function mapDebtDoc(docSnap: QueryDoc | FirebaseFirestoreTypes.DocumentSnapshot): DebtRecord {
  const data = (docSnap.data() ?? {}) as Record<string, any>;
  const rawRepayments = Array.isArray(data.repayments) ? data.repayments : [];
  const repayments: DebtRepayment[] = rawRepayments
    .map((r: any) => ({
      id: String(r?.id ?? ''),
      amount: Number(r?.amount ?? 0) || 0,
      date: tsToDate(r?.date) ?? new Date(),
      fundId: String(r?.fundId ?? ''),
      note: (r?.note as string | undefined) ?? undefined,
      transactionId: (r?.transactionId as string | undefined) ?? undefined,
    }))
    .filter((r: DebtRepayment) => !!r.id);

  const rawAdditionalBorrows = Array.isArray(data.additionalBorrows)
    ? data.additionalBorrows
    : [];
  const additionalBorrows: DebtBorrow[] = rawAdditionalBorrows
    .map((b: any) => ({
      id: String(b?.id ?? ''),
      amount: Number(b?.amount ?? 0) || 0,
      date: tsToDate(b?.date) ?? new Date(),
      fundId: String(b?.fundId ?? ''),
      note: (b?.note as string | undefined) ?? undefined,
      transactionId: (b?.transactionId as string | undefined) ?? undefined,
    }))
    .filter((b: DebtBorrow) => !!b.id);

  const rawInterestEntries = Array.isArray(data.interestEntries)
    ? data.interestEntries
    : [];
  const interestEntries: DebtInterest[] = rawInterestEntries
    .map((i: any) => ({
      id: String(i?.id ?? ''),
      amount: Number(i?.amount ?? 0) || 0,
      date: tsToDate(i?.date) ?? new Date(),
      note: (i?.note as string | undefined) ?? undefined,
    }))
    .filter((i: DebtInterest) => !!i.id);

  return {
    id: docSnap.id,
    userId: String(data.userId ?? ''),
    direction: (data.direction as DebtDirection) ?? 'lent',
    counterparty: String(data.counterparty ?? ''),
    principal: Number(data.principal ?? 0) || 0,
    fundId: String(data.fundId ?? ''),
    startDate: tsToDate(data.startDate) ?? new Date(),
    dueDate: tsToDate(data.dueDate) ?? null,
    note: (data.note as string | undefined) ?? null,
    repayments,
    additionalBorrows,
    interestEntries,
    status: (data.status as DebtStatus) ?? 'open',
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
  };
}

export async function fetchDebts(userId: string): Promise<DebtRecord[]> {
  const colRef = collection(firestoreInstance, DEBTS_COLLECTION);
  // Chỉ where theo userId để tránh yêu cầu composite index (userId + createdAt).
  // Sort phía client — mỗi user chỉ có ít debts nên không tốn kém.
  const q = query(colRef, where('userId', '==', userId));
  const snap = await getDocs(q);
  const items = snap.docs.map(mapDebtDoc);
  items.sort((a: DebtRecord, b: DebtRecord) => {
    const at = a.createdAt ? a.createdAt.getTime() : 0;
    const bt = b.createdAt ? b.createdAt.getTime() : 0;
    return bt - at;
  });
  return items;
}

/** Lắng nghe realtime danh sách nợ của user. Trả về hàm hủy đăng ký. */
export function subscribeDebts(
  userId: string,
  onChange: (items: DebtRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const colRef = collection(firestoreInstance, DEBTS_COLLECTION);
  const q = query(colRef, where('userId', '==', userId));
  console.log('[Debts] subscribing for', userId);
  return onSnapshot(
    q,
    (snapshot) => {
      console.log('[Debts] snapshot fired, size=', snapshot.size, 'fromCache=', snapshot.metadata?.fromCache);
      const items = snapshot.docs.map(mapDebtDoc);
      items.sort((a: DebtRecord, b: DebtRecord) => {
        const at = a.createdAt ? a.createdAt.getTime() : 0;
        const bt = b.createdAt ? b.createdAt.getTime() : 0;
        return bt - at;
      });
      onChange(items);
    },
    (error) => {
      console.error('[Debts] snapshot error:', error);
      onError?.(error);
    },
  );
}

/** Tổng số đã vay (principal + các lần vay thêm). KHÔNG bao gồm lãi. */
export function debtTotalBorrowed(debt: DebtRecord): number {
  const extra = (debt.additionalBorrows ?? []).reduce(
    (s, b) => s + (b.amount || 0),
    0,
  );
  return (debt.principal || 0) + extra;
}

/** Tổng tiền lãi đã ghi nhận thủ công. */
export function debtTotalInterest(debt: DebtRecord): number {
  return (debt.interestEntries ?? []).reduce(
    (s, i) => s + (i.amount || 0),
    0,
  );
}

/** Tổng cần trả = gốc vay + lãi (không trừ đã trả). */
export function debtTotalDue(debt: DebtRecord): number {
  return debtTotalBorrowed(debt) + debtTotalInterest(debt);
}

/** Tổng đã trả/đã thu. */
export function debtTotalPaid(debt: DebtRecord): number {
  return (debt.repayments ?? []).reduce((s, r) => s + (r.amount || 0), 0);
}

/** Tính số tiền còn lại (tổng cần trả - đã trả). */
export function debtRemaining(debt: DebtRecord): number {
  return Math.max(0, debtTotalDue(debt) - debtTotalPaid(debt));
}

function genId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Tạo khoản nợ mới — atomic:
 *  - Tạo doc `debts/<id>`
 *  - lent/borrowed: tạo transaction + cập nhật fund balance
 *  - installment (trả góp): KHÔNG tạo transaction, KHÔNG đụng quỹ; fundId có thể null.
 */
export async function createDebt(
  userId: string,
  input: {
    direction: DebtDirection;
    counterparty: string;
    principal: number;
    /** Optional cho 'installment'. Required cho 'lent'/'borrowed'. */
    fundId: string | null;
    startDate: Date;
    dueDate?: Date | null;
    note?: string | null;
    /** Lãi ban đầu (chỉ dùng cho 'installment'). Cộng vào tổng cần trả, không đụng quỹ. */
    initialInterest?: number | null;
    initialInterestNote?: string | null;
  },
): Promise<string> {
  const debtsCol = collection(firestoreInstance, DEBTS_COLLECTION);
  const txCol = collection(firestoreInstance, TRANSACTIONS_COLLECTION);

  const debtRef = doc(debtsCol);
  const isInstallment = input.direction === 'installment';

  await runTransaction(firestoreInstance, async (trx) => {
    if (isInstallment) {
      // Trả góp: chỉ ghi nhận debt doc, không đụng quỹ, không tạo tx.
      const seedInterest =
        input.initialInterest && input.initialInterest > 0
          ? [
              {
                id: genId(),
                amount: Math.round(input.initialInterest),
                date: input.startDate,
                note: input.initialInterestNote?.trim()
                  ? input.initialInterestNote.trim()
                  : null,
              },
            ]
          : [];
      trx.set(debtRef, {
        userId,
        direction: input.direction,
        counterparty: input.counterparty.trim(),
        principal: Math.round(input.principal),
        fundId: input.fundId ?? null,
        startDate: input.startDate,
        dueDate: input.dueDate ?? null,
        note: input.note?.trim() ? input.note.trim() : null,
        repayments: [],
        additionalBorrows: [],
        interestEntries: seedInterest,
        status: 'open' as DebtStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (!input.fundId) {
      throw new Error('Vui lòng chọn quỹ');
    }
    const fundRef = doc(firestoreInstance, FUNDS_COLLECTION, input.fundId);
    const fundSnap = await trx.get(fundRef);
    if (!fundSnap.exists) {
      throw new Error('Quỹ không tồn tại');
    }
    const currentBalance = (fundSnap.data()?.balance as number) ?? 0;

    if (input.direction === 'lent' && currentBalance < input.principal) {
      throw new Error('Số dư quỹ không đủ để cho vay');
    }

    const txType: 'income' | 'expense' =
      input.direction === 'lent' ? 'expense' : 'income';
    const balanceDelta =
      input.direction === 'lent' ? -input.principal : input.principal;
    const categoryId =
      input.direction === 'lent'
        ? LOAN_CATEGORY_IDS.lent
        : LOAN_CATEGORY_IDS.borrowed;

    trx.set(debtRef, {
      userId,
      direction: input.direction,
      counterparty: input.counterparty.trim(),
      principal: Math.round(input.principal),
      fundId: input.fundId,
      startDate: input.startDate,
      dueDate: input.dueDate ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
      repayments: [],
      additionalBorrows: [],
      interestEntries: [],
      status: 'open' as DebtStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const txRef = doc(txCol);
    trx.set(txRef, {
      userId,
      type: txType,
      categoryId,
      amount: Math.round(input.principal),
      note: input.note?.trim() ? input.note.trim() : null,
      transactionDate: input.startDate,
      fundId: input.fundId,
      isLoanMovement: true,
      debtId: debtRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(fundRef, {
      balance: increment(balanceDelta),
      updatedAt: serverTimestamp(),
    });
  });

  // Push notification (best-effort)
  const counterparty = input.counterparty.trim();
  const amt = Math.round(input.principal);
  const amtLabel = formatAmount(amt);

  if (isInstallment) {
    await safePushNotification(userId, {
      kind: 'transaction_added',
      title: 'Trả góp',
      message: `Đã ghi nhận khoản trả góp ${amtLabel} với "${counterparty}".`,
    });
    return debtRef.id;
  }

  const isLent = input.direction === 'lent';
  const { totalAfter, byId } = await fetchFundsSummary(userId, [
    input.fundId as string,
  ]);
  const fundInfo = byId.get(input.fundId as string);
  const fundName = fundInfo?.name ?? 'Quỹ';
  const fundBalance = fundInfo?.balance ?? 0;
  const fundBalLabel = formatAmount(fundBalance);
  const totalLabel = formatAmount(totalAfter);
  const delta = isLent ? -amt : amt;
  const signedDeltaLabel = formatSigned(delta);
  const msg = isLent
    ? `Đã ghi nhận khoản cho vay ${amtLabel} tới "${counterparty}" từ "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}`
    : `Đã ghi nhận khoản vay ${amtLabel} từ "${counterparty}" vào "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}`;
  await safePushNotification(userId, {
    kind: 'transaction_added',
    title: isLent ? 'Cho vay' : 'Đi vay',
    message: msg,
  });

  return debtRef.id;
}

/**
 * Cập nhật ghi chú + ngày bắt đầu của khoản nợ và đồng bộ với transaction gốc
 * (Cho vay / Đi vay). Không đụng tới amount, fund hay repayments.
 */
export async function updateDebtNoteAndStartDate(
  userId: string,
  debtId: string,
  input: { note: string | null; startDate: Date },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);

  // Tìm transaction gốc (Cho vay / Đi vay) trước khi vào runTransaction
  // vì Firestore transactions không hỗ trợ query.
  const principalTxSnap = await getDocs(
    query(
      collection(firestoreInstance, TRANSACTIONS_COLLECTION),
      where('debtId', '==', debtId),
      where('categoryId', 'in', [
        LOAN_CATEGORY_IDS.lent,
        LOAN_CATEGORY_IDS.borrowed,
      ]),
    ),
  );

  const noteValue = input.note?.trim() ? input.note.trim() : null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    if (debtSnap.data()?.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    trx.update(debtRef, {
      note: noteValue,
      startDate: input.startDate,
      updatedAt: serverTimestamp(),
    });

    principalTxSnap.docs.forEach((d: QueryDoc) => {
      trx.update(d.ref, {
        note: noteValue,
        transactionDate: input.startDate,
        updatedAt: serverTimestamp(),
      });
    });
  });
}

/**
 * Cập nhật ghi chú + ngày của 1 lần trả/thu nợ và đồng bộ với transaction
 * tương ứng (nếu repayment có transactionId). Không đụng amount/fund.
 */
export async function updateDebtRepayment(
  userId: string,
  debtId: string,
  repaymentId: string,
  input: { note: string | null; date: Date },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const noteValue = input.note?.trim() ? input.note.trim() : null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existingRepayments = Array.isArray(debtData.repayments)
      ? debtData.repayments
      : [];
    const targetIndex = existingRepayments.findIndex(
      (r: any) => String(r?.id ?? '') === repaymentId,
    );
    if (targetIndex < 0) {
      throw new Error('Không tìm thấy giao dịch trả/thu này');
    }

    const target = existingRepayments[targetIndex];
    const linkedTxId = (target?.transactionId as string | undefined) ?? '';
    const txRef = linkedTxId
      ? doc(firestoreInstance, TRANSACTIONS_COLLECTION, linkedTxId)
      : null;

    // Đọc transaction tương ứng (nếu có) để runTransaction hợp lệ về thứ tự
    // read-before-write — không bắt buộc dùng dữ liệu nhưng giữ tính atomic.
    if (txRef) {
      await trx.get(txRef);
    }

    const nextRepayments = existingRepayments.slice();
    nextRepayments[targetIndex] = {
      ...target,
      note: noteValue,
      date: input.date,
    };

    trx.update(debtRef, {
      repayments: nextRepayments,
      updatedAt: serverTimestamp(),
    });

    if (txRef) {
      trx.update(txRef, {
        note: noteValue,
        transactionDate: input.date,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/**
 * Ghi nhận trả/thu một phần cho khoản nợ — atomic:
 *  - Push 1 repayment vào mảng debts.repayments
 *  - Tạo doc transaction ngược chiều (isLoanMovement=true)
 *  - Cập nhật fund balance:
 *      - lent (cho vay) → thu về: quỹ +amount (income)
 *      - borrowed (đi vay) → trả ra: quỹ -amount (expense)
 *  - Nếu tổng đã trả >= tổng cần trả (gốc + vay thêm + lãi) → status='settled'
 */
export async function addDebtRepayment(
  userId: string,
  debtId: string,
  input: {
    amount: number;
    fundId: string;
    date: Date;
    note?: string | null;
    /** Lãi ghi nhận kèm (optional). Cộng vào tổng cần trả, không đụng quỹ. */
    interestAmount?: number;
    interestNote?: string | null;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const txRef = doc(collection(firestoreInstance, TRANSACTIONS_COLLECTION));
  const fundRef = doc(firestoreInstance, FUNDS_COLLECTION, input.fundId);

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const fundSnap = await trx.get(fundRef);
    if (!fundSnap.exists) {
      throw new Error('Quỹ không tồn tại');
    }
    const currentBalance = (fundSnap.data()?.balance as number) ?? 0;

    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const principal = Number(debtData.principal ?? 0) || 0;
    const existingRepayments = Array.isArray(debtData.repayments)
      ? debtData.repayments
      : [];
    const existingBorrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const existingInterests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const extraBorrowed = existingBorrows.reduce(
      (s: number, b: any) => s + (Number(b?.amount) || 0),
      0,
    );
    const totalInterest = existingInterests.reduce(
      (s: number, i: any) => s + (Number(i?.amount) || 0),
      0,
    );
    const totalPaid = existingRepayments.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );

    // Lãi ghi nhận kèm (nếu có) — cộng vào tổng cần trả trước khi validate.
    const addedInterest =
      input.interestAmount && input.interestAmount > 0
        ? Math.round(input.interestAmount)
        : 0;
    const totalDue = principal + extraBorrowed + totalInterest + addedInterest;
    const remaining = Math.max(0, totalDue - totalPaid);

    const amt = Math.round(input.amount);
    if (amt <= 0) {
      throw new Error('Số tiền không hợp lệ');
    }
    if (amt > remaining) {
      throw new Error(
        `Số tiền trả (${amt.toLocaleString('vi-VN')}đ) vượt quá số còn lại (${remaining.toLocaleString('vi-VN')}đ)`,
      );
    }

    // borrowed → user trả tiền → quỹ phải đủ.
    if (direction === 'borrowed' && currentBalance < amt) {
      throw new Error('Số dư quỹ không đủ để trả nợ');
    }

    const txType: 'income' | 'expense' =
      direction === 'lent' ? 'income' : 'expense';
    const balanceDelta = direction === 'lent' ? amt : -amt;
    const categoryId =
      direction === 'lent'
        ? LOAN_CATEGORY_IDS.repayReceived
        : LOAN_CATEGORY_IDS.repayPaid;

    const newRepayment = {
      id: genId(),
      amount: amt,
      date: input.date,
      fundId: input.fundId,
      note: input.note?.trim() ? input.note.trim() : null,
      transactionId: txRef.id,
    };

    const nextTotalPaid = totalPaid + amt;
    const nextStatus: DebtStatus = nextTotalPaid >= totalDue ? 'settled' : 'open';

    const debtUpdate: Record<string, unknown> = {
      repayments: [...existingRepayments, newRepayment],
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (addedInterest > 0) {
      const newInterest = {
        id: genId(),
        amount: addedInterest,
        date: input.date,
        note: input.interestNote?.trim() ? input.interestNote.trim() : null,
      };
      debtUpdate.interestEntries = [...existingInterests, newInterest];
    }
    trx.update(debtRef, debtUpdate);

    trx.set(txRef, {
      userId,
      type: txType,
      categoryId,
      amount: amt,
      note: input.note?.trim() ? input.note.trim() : null,
      transactionDate: input.date,
      fundId: input.fundId,
      isLoanMovement: true,
      debtId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(fundRef, {
      balance: increment(balanceDelta),
      updatedAt: serverTimestamp(),
    });
  });

  // Push notification (best-effort). Đọc lại debt để lấy counterparty + remaining mới.
  try {
    const debtSnap = await getDoc(debtRef);
    const debtData = debtSnap.data() ?? {};
    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const counterparty = String(debtData.counterparty ?? 'Người vay');
    const principal = Number(debtData.principal ?? 0) || 0;
    const reps = Array.isArray(debtData.repayments) ? debtData.repayments : [];
    const borrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const interests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const paid = reps.reduce((s: number, r: any) => s + (Number(r?.amount) || 0), 0);
    const totalDueNow =
      principal +
      borrows.reduce((s: number, b: any) => s + (Number(b?.amount) || 0), 0) +
      interests.reduce((s: number, i: any) => s + (Number(i?.amount) || 0), 0);
    const remaining = Math.max(0, totalDueNow - paid);
    const isSettledNow = (debtData.status as DebtStatus) === 'settled';

    const isLent = direction === 'lent';
    const amt = Math.round(input.amount);
    const { totalAfter, byId } = await fetchFundsSummary(userId, [input.fundId]);
    const fundInfo = byId.get(input.fundId);
    const fundName = fundInfo?.name ?? 'Quỹ';
    const fundBalance = fundInfo?.balance ?? 0;
    const delta = isLent ? amt : -amt;
    const amtLabel = formatAmount(amt);
    const signedDeltaLabel = formatSigned(delta);
    const fundBalLabel = formatAmount(fundBalance);
    const totalLabel = formatAmount(totalAfter);
    const remainingLabel = formatAmount(remaining);
    const settledLine = isSettledNow ? '\nKhoản nợ đã tất toán.' : `\nCòn lại: ${remainingLabel}`;
    const msg = isLent
      ? `Đã ghi nhận thu nợ ${amtLabel} từ "${counterparty}" vào "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}${settledLine}`
      : `Đã ghi nhận trả nợ ${amtLabel} cho "${counterparty}" từ "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}${settledLine}`;
    await safePushNotification(userId, {
      kind: 'transaction_added',
      title: isLent ? 'Thu nợ' : 'Trả nợ',
      message: msg,
    });
  } catch {
    // ignore notification errors
  }
}

/**
 * Ghi nhận vay/cho vay thêm cho khoản nợ đã tồn tại — atomic:
 *  - Push 1 borrow vào mảng debts.additionalBorrows
 *  - lent/borrowed: tạo transaction cùng chiều + cập nhật fund balance
 *      - lent (cho vay thêm) → quỹ -amount (expense)
 *      - borrowed (đi vay thêm) → quỹ +amount (income)
 *  - installment ('Mua thêm'): KHÔNG tạo transaction, KHÔNG đụng quỹ; fundId có thể null.
 *  - Settle status quay lại 'open' nếu trước đó đã tất toán mà giờ totalBorrowed > paid.
 */
export async function addDebtBorrow(
  userId: string,
  debtId: string,
  input: {
    amount: number;
    /** Optional cho 'installment'. Required cho 'lent'/'borrowed'. */
    fundId: string | null;
    date: Date;
    note?: string | null;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const txRef = doc(collection(firestoreInstance, TRANSACTIONS_COLLECTION));
  const fundRef = input.fundId
    ? doc(firestoreInstance, FUNDS_COLLECTION, input.fundId)
    : null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const isInstallment = direction === 'installment';
    const principal = Number(debtData.principal ?? 0) || 0;
    const existingBorrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const existingRepayments = Array.isArray(debtData.repayments)
      ? debtData.repayments
      : [];
    const existingInterests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];

    const amt = Math.round(input.amount);
    if (amt <= 0) {
      throw new Error('Số tiền không hợp lệ');
    }

    const extraBefore = existingBorrows.reduce(
      (s: number, b: any) => s + (Number(b?.amount) || 0),
      0,
    );
    const totalPaid = existingRepayments.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );
    const totalInterest = existingInterests.reduce(
      (s: number, i: any) => s + (Number(i?.amount) || 0),
      0,
    );
    const nextTotalDue = principal + extraBefore + amt + totalInterest;
    const nextStatus: DebtStatus =
      totalPaid >= nextTotalDue ? 'settled' : 'open';

    if (isInstallment) {
      const newBorrow = {
        id: genId(),
        amount: amt,
        date: input.date,
        fundId: input.fundId ?? null,
        note: input.note?.trim() ? input.note.trim() : null,
        transactionId: null,
      };
      trx.update(debtRef, {
        additionalBorrows: [...existingBorrows, newBorrow],
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (!fundRef) {
      throw new Error('Vui lòng chọn quỹ');
    }
    const fundSnap = await trx.get(fundRef);
    if (!fundSnap.exists) {
      throw new Error('Quỹ không tồn tại');
    }
    const currentBalance = (fundSnap.data()?.balance as number) ?? 0;

    // lent (cho vay thêm) → quỹ phải đủ để trừ.
    if (direction === 'lent' && currentBalance < amt) {
      throw new Error('Số dư quỹ không đủ để cho vay thêm');
    }

    const txType: 'income' | 'expense' =
      direction === 'lent' ? 'expense' : 'income';
    const balanceDelta = direction === 'lent' ? -amt : amt;
    const categoryId =
      direction === 'lent'
        ? LOAN_CATEGORY_IDS.lent
        : LOAN_CATEGORY_IDS.borrowed;

    const newBorrow = {
      id: genId(),
      amount: amt,
      date: input.date,
      fundId: input.fundId,
      note: input.note?.trim() ? input.note.trim() : null,
      transactionId: txRef.id,
    };

    trx.update(debtRef, {
      additionalBorrows: [...existingBorrows, newBorrow],
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    trx.set(txRef, {
      userId,
      type: txType,
      categoryId,
      amount: amt,
      note: input.note?.trim() ? input.note.trim() : null,
      transactionDate: input.date,
      fundId: input.fundId,
      isLoanMovement: true,
      debtId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    trx.update(fundRef, {
      balance: increment(balanceDelta),
      updatedAt: serverTimestamp(),
    });
  });

  // Push notification (best-effort).
  try {
    const debtSnap = await getDoc(debtRef);
    const debtData = debtSnap.data() ?? {};
    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const counterparty = String(debtData.counterparty ?? 'Đối tác');
    const amt = Math.round(input.amount);
    const amtLabel = formatAmount(amt);

    if (direction === 'installment') {
      await safePushNotification(userId, {
        kind: 'transaction_added',
        title: 'Mua thêm',
        message: `Đã ghi nhận mua thêm ${amtLabel} với "${counterparty}".`,
      });
      return;
    }

    const isLent = direction === 'lent';
    const fundIdForSummary = input.fundId as string;
    const { totalAfter, byId } = await fetchFundsSummary(userId, [fundIdForSummary]);
    const fundInfo = byId.get(fundIdForSummary);
    const fundName = fundInfo?.name ?? 'Quỹ';
    const fundBalance = fundInfo?.balance ?? 0;
    const delta = isLent ? -amt : amt;
    const signedDeltaLabel = formatSigned(delta);
    const fundBalLabel = formatAmount(fundBalance);
    const totalLabel = formatAmount(totalAfter);
    const msg = isLent
      ? `Đã cho vay thêm ${amtLabel} cho "${counterparty}" từ "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}`
      : `Đã vay thêm ${amtLabel} từ "${counterparty}" vào "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalLabel}\nTổng số dư: ${totalLabel}`;
    await safePushNotification(userId, {
      kind: 'transaction_added',
      title: isLent ? 'Cho vay thêm' : 'Vay thêm',
      message: msg,
    });
  } catch {
    // ignore notification errors
  }
}

/**
 * Cập nhật ghi chú + ngày của 1 lần vay thêm — đồng bộ với transaction nếu có.
 * `amount` chỉ được phép thay đổi với borrow không có linked transaction (trả góp "Mua thêm").
 */
export async function updateDebtBorrow(
  userId: string,
  debtId: string,
  borrowId: string,
  input: { amount?: number; note: string | null; date: Date },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const noteValue = input.note?.trim() ? input.note.trim() : null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existingBorrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const targetIndex = existingBorrows.findIndex(
      (b: any) => String(b?.id ?? '') === borrowId,
    );
    if (targetIndex < 0) {
      throw new Error('Không tìm thấy lần vay thêm này');
    }

    const target = existingBorrows[targetIndex];
    const linkedTxId = (target?.transactionId as string | undefined) ?? '';
    const txRef = linkedTxId
      ? doc(firestoreInstance, TRANSACTIONS_COLLECTION, linkedTxId)
      : null;

    if (txRef) {
      await trx.get(txRef);
    }

    // Cho phép chỉnh amount chỉ khi không có linked tx (= trả góp "Mua thêm").
    let nextAmount = Number(target?.amount ?? 0) || 0;
    if (input.amount !== undefined) {
      if (linkedTxId) {
        throw new Error(
          'Không thể đổi số tiền của lần vay thêm có giao dịch liên kết',
        );
      }
      const amt = Math.round(input.amount);
      if (amt <= 0) {
        throw new Error('Số tiền không hợp lệ');
      }
      nextAmount = amt;
    }

    const nextBorrows = existingBorrows.slice();
    nextBorrows[targetIndex] = {
      ...target,
      amount: nextAmount,
      note: noteValue,
      date: input.date,
    };

    // Nếu amount đổi → recompute settled status.
    let nextStatus: DebtStatus | undefined;
    if (input.amount !== undefined) {
      const principal = Number(debtData.principal ?? 0) || 0;
      const interests = Array.isArray(debtData.interestEntries)
        ? debtData.interestEntries
        : [];
      const repays = Array.isArray(debtData.repayments)
        ? debtData.repayments
        : [];
      const totalInterest = interests.reduce(
        (s: number, i: any) => s + (Number(i?.amount) || 0),
        0,
      );
      const extraTotal = nextBorrows.reduce(
        (s: number, b: any) => s + (Number(b?.amount) || 0),
        0,
      );
      const totalPaid = repays.reduce(
        (s: number, r: any) => s + (Number(r?.amount) || 0),
        0,
      );
      const totalDue = principal + extraTotal + totalInterest;
      nextStatus = totalDue > 0 && totalPaid >= totalDue ? 'settled' : 'open';
    }

    const debtUpdate: Record<string, unknown> = {
      additionalBorrows: nextBorrows,
      updatedAt: serverTimestamp(),
    };
    if (nextStatus) debtUpdate.status = nextStatus;
    trx.update(debtRef, debtUpdate);

    if (txRef) {
      trx.update(txRef, {
        note: noteValue,
        transactionDate: input.date,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/**
 * Ghi nhận 1 khoản lãi thủ công cho khoản nợ — atomic:
 *  - Push 1 entry vào mảng debts.interestEntries
 *  - KHÔNG đụng quỹ, KHÔNG tạo transaction
 *  - Cập nhật status dựa trên tổng cần trả mới (gốc + vay thêm + lãi)
 */
export async function addDebtInterest(
  userId: string,
  debtId: string,
  input: {
    amount: number;
    date: Date;
    note?: string | null;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const amt = Math.round(input.amount);
    if (amt <= 0) {
      throw new Error('Số tiền không hợp lệ');
    }

    const principal = Number(debtData.principal ?? 0) || 0;
    const existingBorrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const existingInterests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const existingRepayments = Array.isArray(debtData.repayments)
      ? debtData.repayments
      : [];

    const extraBorrowed = existingBorrows.reduce(
      (s: number, b: any) => s + (Number(b?.amount) || 0),
      0,
    );
    const totalInterestBefore = existingInterests.reduce(
      (s: number, i: any) => s + (Number(i?.amount) || 0),
      0,
    );
    const totalPaid = existingRepayments.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );
    const nextTotalDue = principal + extraBorrowed + totalInterestBefore + amt;
    const nextStatus: DebtStatus =
      nextTotalDue > 0 && totalPaid >= nextTotalDue ? 'settled' : 'open';

    const newInterest = {
      id: genId(),
      amount: amt,
      date: input.date,
      note: input.note?.trim() ? input.note.trim() : null,
    };

    trx.update(debtRef, {
      interestEntries: [...existingInterests, newInterest],
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });

  // Push notification (best-effort).
  try {
    const debtSnap = await getDoc(debtRef);
    const debtData = debtSnap.data() ?? {};
    const counterparty = String(debtData.counterparty ?? 'Đối tác');
    const amt = Math.round(input.amount);
    await safePushNotification(userId, {
      kind: 'transaction_added',
      title: 'Ghi nhận lãi',
      message: `Đã cộng ${formatAmount(amt)} tiền lãi vào khoản nợ với "${counterparty}".`,
    });
  } catch {
    // ignore
  }
}

/**
 * Cập nhật ghi chú + ngày + amount của 1 khoản lãi — atomic.
 * Có thể đổi cả amount vì lãi không ảnh hưởng quỹ.
 */
export async function updateDebtInterest(
  userId: string,
  debtId: string,
  interestId: string,
  input: { amount: number; note: string | null; date: Date },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const noteValue = input.note?.trim() ? input.note.trim() : null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existingInterests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const targetIndex = existingInterests.findIndex(
      (i: any) => String(i?.id ?? '') === interestId,
    );
    if (targetIndex < 0) {
      throw new Error('Không tìm thấy khoản lãi này');
    }

    const amt = Math.round(input.amount);
    if (amt <= 0) {
      throw new Error('Số tiền không hợp lệ');
    }

    const target = existingInterests[targetIndex];
    const nextInterests = existingInterests.slice();
    nextInterests[targetIndex] = {
      ...target,
      amount: amt,
      note: noteValue,
      date: input.date,
    };

    const principal = Number(debtData.principal ?? 0) || 0;
    const borrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const repays = Array.isArray(debtData.repayments) ? debtData.repayments : [];
    const totalInterestNew = nextInterests.reduce(
      (s: number, i: any) => s + (Number(i?.amount) || 0),
      0,
    );
    const totalDue =
      principal +
      borrows.reduce((s: number, b: any) => s + (Number(b?.amount) || 0), 0) +
      totalInterestNew;
    const totalPaid = repays.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );
    const nextStatus: DebtStatus =
      totalDue > 0 && totalPaid >= totalDue ? 'settled' : 'open';

    trx.update(debtRef, {
      interestEntries: nextInterests,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Xóa 1 khoản lãi — atomic. Không đụng quỹ. Cập nhật status nếu cần.
 */
export async function deleteDebtInterest(
  userId: string,
  debtId: string,
  interestId: string,
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existingInterests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const nextInterests = existingInterests.filter(
      (i: any) => i?.id !== interestId,
    );
    if (nextInterests.length === existingInterests.length) {
      throw new Error('Không tìm thấy khoản lãi này');
    }

    const principal = Number(debtData.principal ?? 0) || 0;
    const borrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const repays = Array.isArray(debtData.repayments) ? debtData.repayments : [];
    const totalInterestNew = nextInterests.reduce(
      (s: number, i: any) => s + (Number(i?.amount) || 0),
      0,
    );
    const totalDue =
      principal +
      borrows.reduce((s: number, b: any) => s + (Number(b?.amount) || 0), 0) +
      totalInterestNew;
    const totalPaid = repays.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );
    const nextStatus: DebtStatus =
      totalDue > 0 && totalPaid >= totalDue ? 'settled' : 'open';

    trx.update(debtRef, {
      interestEntries: nextInterests,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Xóa 1 lần vay/cho vay thêm khỏi khoản nợ — atomic:
 *  - Hoàn tác tác động quỹ:
 *      - 'lent' (borrow trước là expense) → quỹ +amount (cộng lại số đã chi cho vay thêm)
 *      - 'borrowed' (borrow trước là income) → quỹ -amount (trừ phần đã nhận về)
 *  - Xóa linked transaction doc
 *  - Remove borrow khỏi debts.additionalBorrows array
 *  - Update status dựa trên tổng vay mới
 *
 * Với 'borrowed': nếu quỹ không đủ để trừ, truyền `offsetSourceFundId` để cấn trừ.
 *
 * `refundFundId` (optional) override quỹ áp dụng; nếu không truyền dùng quỹ gốc của borrow.
 */
export async function deleteDebtBorrow(
  userId: string,
  debtId: string,
  borrowId: string,
  opts?: {
    refundFundId?: string;
    offsetSourceFundId?: string;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existing = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const target = existing.find((b: any) => b?.id === borrowId);
    if (!target) {
      throw new Error('Không tìm thấy lần vay thêm này');
    }

    const amount = Number(target.amount ?? 0) || 0;
    const originalFundId = target.fundId as string | undefined;
    const txId = target.transactionId as string | undefined;
    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const isLent = direction === 'lent';
    const isInstallment = direction === 'installment';

    // Recompute totals + status (chia sẻ giữa cả 2 path).
    const computeStatus = () => {
      const nextBorrows = existing.filter((b: any) => b?.id !== borrowId);
      const principal = Number(debtData.principal ?? 0) || 0;
      const extraTotal = nextBorrows.reduce(
        (s: number, b: any) => s + (Number(b?.amount) || 0),
        0,
      );
      const interests = Array.isArray(debtData.interestEntries)
        ? debtData.interestEntries
        : [];
      const totalInterest = interests.reduce(
        (s: number, i: any) => s + (Number(i?.amount) || 0),
        0,
      );
      const totalDue = principal + extraTotal + totalInterest;
      const repays = Array.isArray(debtData.repayments) ? debtData.repayments : [];
      const totalPaid = repays.reduce(
        (s: number, r: any) => s + (Number(r?.amount) || 0),
        0,
      );
      const nextStatus: DebtStatus =
        totalDue > 0 && totalPaid >= totalDue ? 'settled' : 'open';
      return { nextBorrows, nextStatus };
    };

    if (isInstallment) {
      // Trả góp: không đụng quỹ, không có tx liên kết. Chỉ remove borrow.
      const { nextBorrows, nextStatus } = computeStatus();
      trx.update(debtRef, {
        additionalBorrows: nextBorrows,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const primaryFundId = opts?.refundFundId || originalFundId;
    if (!primaryFundId) {
      throw new Error('Chưa chọn quỹ để hoàn tác');
    }

    // READS
    const primaryRef = doc(firestoreInstance, FUNDS_COLLECTION, primaryFundId);
    const primarySnap = await trx.get(primaryRef);

    let offsetRef: FirebaseFirestoreTypes.DocumentReference | undefined;
    let offsetSnap: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
    if (opts?.offsetSourceFundId) {
      if (opts.offsetSourceFundId === primaryFundId) {
        throw new Error('Quỹ cấn trừ phải khác quỹ chính');
      }
      offsetRef = doc(firestoreInstance, FUNDS_COLLECTION, opts.offsetSourceFundId);
      offsetSnap = await trx.get(offsetRef);
    }

    let txSnap: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
    if (txId) {
      const txRef = doc(firestoreInstance, TRANSACTIONS_COLLECTION, txId);
      txSnap = await trx.get(txRef);
    }

    // WRITES
    if (isLent) {
      // 'lent' borrow: trước là expense (-amount). Reverse: +amount. Luôn an toàn.
      if (amount > 0 && !!primarySnap.exists) {
        trx.update(primaryRef, {
          balance: increment(amount),
          updatedAt: serverTimestamp(),
        });
      }
    } else if (amount > 0) {
      // 'borrowed' borrow: trước là income (+amount). Reverse: -amount. Cần đủ.
      if (!primarySnap.exists) {
        throw new Error('Quỹ chính không tồn tại');
      }
      const currentBalance = Number(primarySnap.data()?.balance ?? 0) || 0;

      if (currentBalance >= amount) {
        trx.update(primaryRef, {
          balance: increment(-amount),
          updatedAt: serverTimestamp(),
        });
      } else {
        const deficit = amount - currentBalance;
        if (!offsetRef || !offsetSnap) {
          const name = (primarySnap.data()?.name as string | undefined) ?? 'Quỹ';
          throw new Error(
            `"${name}" không đủ, thiếu ${deficit.toLocaleString('vi-VN')}đ. Chọn quỹ khác để cấn trừ.`,
          );
        }
        if (!offsetSnap.exists) {
          throw new Error('Quỹ cấn trừ không tồn tại');
        }
        const offsetBalance = Number(offsetSnap.data()?.balance ?? 0) || 0;
        if (offsetBalance < deficit) {
          throw new Error(
            `Quỹ cấn trừ không đủ để bù ${deficit.toLocaleString('vi-VN')}đ`,
          );
        }
        trx.update(primaryRef, {
          balance: increment(-currentBalance),
          updatedAt: serverTimestamp(),
        });
        trx.update(offsetRef, {
          balance: increment(-deficit),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Xóa linked transaction.
    if (txSnap?.exists) {
      trx.delete(txSnap.ref);
    }

    // Update debt array + status.
    const { nextBorrows, nextStatus } = computeStatus();
    trx.update(debtRef, {
      additionalBorrows: nextBorrows,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Xóa 1 lần trả/thu khỏi khoản nợ — atomic:
 *  - Hoàn tác tác động quỹ:
 *      - 'lent' (repayment trước là income) → quỹ -amount (trả lại số đã thu)
 *      - 'borrowed' (repayment trước là expense) → quỹ +amount (cộng lại số đã trả)
 *  - Xóa linked transaction doc
 *  - Remove repayment khỏi debts.repayments array
 *  - Update status (settled / open) dựa trên tổng mới
 *
 * Với 'lent': nếu quỹ không đủ để trừ, truyền `offsetSourceFundId` để cấn trừ từ quỹ khác:
 *  - Rút cạn quỹ chính về 0.
 *  - Trừ phần thiếu (deficit = amount - currentBalance) từ quỹ cấn trừ.
 *
 * `refundFundId` (optional) override quỹ áp dụng; nếu không truyền dùng quỹ gốc của repayment.
 */
export async function deleteDebtRepayment(
  userId: string,
  debtId: string,
  repaymentId: string,
  opts?: {
    refundFundId?: string;
    offsetSourceFundId?: string;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);

  // Dùng để build notification sau khi commit.
  let notifyContext: {
    amount: number;
    direction: DebtDirection;
    counterparty: string;
    primaryFundId: string;
    offsetFundId?: string;
    deficit: number;
  } | null = null;

  await runTransaction(firestoreInstance, async (trx) => {
    const debtSnap = await trx.get(debtRef);
    if (!debtSnap.exists) {
      throw new Error('Khoản nợ không tồn tại');
    }
    const debtData = debtSnap.data() ?? {};
    if (debtData.userId !== userId) {
      throw new Error('Khoản nợ không thuộc về người dùng này');
    }

    const existing = Array.isArray(debtData.repayments) ? debtData.repayments : [];
    const target = existing.find((r: any) => r?.id === repaymentId);
    if (!target) {
      throw new Error('Không tìm thấy lần trả/thu này');
    }

    const amount = Number(target.amount ?? 0) || 0;
    const originalFundId = target.fundId as string | undefined;
    const txId = target.transactionId as string | undefined;
    const direction = (debtData.direction as DebtDirection) ?? 'lent';
    const isLent = direction === 'lent';

    const primaryFundId = opts?.refundFundId || originalFundId;
    if (!primaryFundId) {
      throw new Error('Chưa chọn quỹ để hoàn tác');
    }

    // READS
    const primaryRef = doc(firestoreInstance, FUNDS_COLLECTION, primaryFundId);
    const primarySnap = await trx.get(primaryRef);

    let offsetRef: FirebaseFirestoreTypes.DocumentReference | undefined;
    let offsetSnap: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
    if (opts?.offsetSourceFundId) {
      if (opts.offsetSourceFundId === primaryFundId) {
        throw new Error('Quỹ cấn trừ phải khác quỹ chính');
      }
      offsetRef = doc(firestoreInstance, FUNDS_COLLECTION, opts.offsetSourceFundId);
      offsetSnap = await trx.get(offsetRef);
    }

    let txSnap: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
    if (txId) {
      const txRef = doc(firestoreInstance, TRANSACTIONS_COLLECTION, txId);
      txSnap = await trx.get(txRef);
    }

    // WRITES
    if (!isLent) {
      // 'borrowed': cộng tiền về quỹ chính. Không cần check insufficient.
      if (amount > 0 && !!primarySnap.exists) {
        trx.update(primaryRef, {
          balance: increment(amount),
          updatedAt: serverTimestamp(),
        });
      }
    } else if (amount > 0) {
      // 'lent': trừ amount khỏi quỹ chính, cần check đủ.
      if (!primarySnap.exists) {
        throw new Error('Quỹ chính không tồn tại');
      }
      const currentBalance = Number(primarySnap.data()?.balance ?? 0) || 0;

      if (currentBalance >= amount) {
        trx.update(primaryRef, {
          balance: increment(-amount),
          updatedAt: serverTimestamp(),
        });
        notifyContext = {
          amount,
          direction,
          counterparty: String(debtData.counterparty ?? ''),
          primaryFundId,
          deficit: 0,
        };
      } else {
        // Cần cấn trừ từ quỹ khác.
        const deficit = amount - currentBalance;
        if (!offsetRef || !offsetSnap) {
          const name = (primarySnap.data()?.name as string | undefined) ?? 'Quỹ';
          throw new Error(
            `"${name}" không đủ, thiếu ${deficit.toLocaleString('vi-VN')}đ. Chọn quỹ khác để cấn trừ.`,
          );
        }
        if (!offsetSnap.exists) {
          throw new Error('Quỹ cấn trừ không tồn tại');
        }
        const offsetBalance = Number(offsetSnap.data()?.balance ?? 0) || 0;
        if (offsetBalance < deficit) {
          throw new Error(
            `Quỹ cấn trừ không đủ để bù ${deficit.toLocaleString('vi-VN')}đ`,
          );
        }

        // Rút cạn quỹ chính + trừ deficit từ quỹ cấn trừ.
        trx.update(primaryRef, {
          balance: increment(-currentBalance),
          updatedAt: serverTimestamp(),
        });
        trx.update(offsetRef, {
          balance: increment(-deficit),
          updatedAt: serverTimestamp(),
        });
        notifyContext = {
          amount,
          direction,
          counterparty: String(debtData.counterparty ?? ''),
          primaryFundId,
          offsetFundId: opts?.offsetSourceFundId,
          deficit,
        };
      }
    }

    // 'borrowed' path cũng cần set notifyContext
    if (!isLent) {
      notifyContext = {
        amount,
        direction,
        counterparty: String(debtData.counterparty ?? ''),
        primaryFundId,
        deficit: 0,
      };
    }

    // Xóa linked transaction.
    if (txSnap?.exists) {
      trx.delete(txSnap.ref);
    }

    // Update debt repayments + status.
    const nextRepayments = existing.filter((r: any) => r?.id !== repaymentId);
    const totalPaid = nextRepayments.reduce(
      (s: number, r: any) => s + (Number(r?.amount) || 0),
      0,
    );
    const principal = Number(debtData.principal ?? 0) || 0;
    const borrows = Array.isArray(debtData.additionalBorrows)
      ? debtData.additionalBorrows
      : [];
    const interests = Array.isArray(debtData.interestEntries)
      ? debtData.interestEntries
      : [];
    const totalDue =
      principal +
      borrows.reduce((s: number, b: any) => s + (Number(b?.amount) || 0), 0) +
      interests.reduce((s: number, i: any) => s + (Number(i?.amount) || 0), 0);
    const nextStatus: DebtStatus =
      totalDue > 0 && totalPaid >= totalDue ? 'settled' : 'open';

    trx.update(debtRef, {
      repayments: nextRepayments,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });

  // Push notification (best-effort)
  if (notifyContext) {
    try {
      // TS không narrow được kiểu trong closure — cast.
      const ctx = notifyContext as {
        amount: number;
        direction: DebtDirection;
        counterparty: string;
        primaryFundId: string;
        offsetFundId?: string;
        deficit: number;
      };
      const isLent = ctx.direction === 'lent';
      const { totalAfter, byId } = await fetchFundsSummary(
        userId,
        [ctx.primaryFundId, ctx.offsetFundId].filter(Boolean) as string[],
      );
      const primaryInfo = byId.get(ctx.primaryFundId);
      const primaryName = primaryInfo?.name ?? 'Quỹ';
      const primaryBalance = primaryInfo?.balance ?? 0;
      // Hành động hoàn tác: 'lent' -> trừ khỏi quỹ, 'borrowed' -> cộng vào quỹ.
      const primaryDelta = isLent
        ? -Math.min(ctx.amount, ctx.amount - ctx.deficit) // phần trừ khỏi quỹ chính
        : ctx.amount;
      const amtLabel = formatAmount(ctx.amount);
      const primaryBalLabel = formatAmount(primaryBalance);
      const primaryDeltaLabel = formatSigned(primaryDelta);
      const totalLabel = formatAmount(totalAfter);
      let extra = '';
      if (ctx.deficit > 0 && ctx.offsetFundId) {
        const offsetInfo = byId.get(ctx.offsetFundId);
        const offsetName = offsetInfo?.name ?? 'Quỹ';
        const offsetBalance = offsetInfo?.balance ?? 0;
        extra = `\n"${offsetName}"\n${formatSigned(-ctx.deficit)} - Số dư: ${formatAmount(offsetBalance)}`;
      }
      const actionText = isLent ? 'thu' : 'trả';
      const msg = `Đã xóa lần ${actionText} ${amtLabel} của "${ctx.counterparty}".\n"${primaryName}"\n${primaryDeltaLabel} - Số dư: ${primaryBalLabel}${extra}\nTổng số dư: ${totalLabel}`;
      await safePushNotification(userId, {
        kind: 'transaction_deleted',
        title: isLent ? 'Xóa lần thu nợ' : 'Xóa lần trả nợ',
        message: msg,
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Xóa khoản nợ — atomic:
 *  - Xóa tất cả transaction liên kết (chỉ xóa doc, KHÔNG reverse từng fund theo tx).
 *  - Áp dụng delta = +/- remaining vào quỹ do user chọn (refundFundId):
 *      - 'lent': remaining > 0 → quỹ +remaining (user nhận lại phần chưa thu).
 *      - 'borrowed': remaining > 0 → quỹ -remaining (user trả nốt phần còn nợ).
 *          Nếu quỹ không đủ → cần offsetSourceFundId để cấn trừ.
 *  - Nếu remaining = 0 (đã settled) → chỉ xóa, không đụng quỹ.
 *  - Xóa doc debt.
 *
 * Lưu ý: các repayment đã làm quỹ +/- trong quá khứ vẫn GIỮ nguyên ở quỹ đó
 * (tiền thật đã di chuyển, không reverse). Chỉ phần outstanding mới được "refund".
 */
export async function deleteDebt(
  userId: string,
  debtId: string,
  opts?: {
    refundFundId?: string;
    offsetSourceFundId?: string;
  },
): Promise<void> {
  const debtRef = doc(firestoreInstance, DEBTS_COLLECTION, debtId);
  const debtSnap = await getDoc(debtRef);
  if (!debtSnap.exists) return;
  const data = debtSnap.data() ?? {};
  if (data.userId !== userId) {
    throw new Error('Khoản nợ không thuộc về người dùng này');
  }

  const direction = (data.direction as DebtDirection) ?? 'lent';
  const principal = Number(data.principal ?? 0) || 0;
  const existingRepayments = Array.isArray(data.repayments) ? data.repayments : [];
  const existingBorrows = Array.isArray(data.additionalBorrows)
    ? data.additionalBorrows
    : [];
  const existingInterests = Array.isArray(data.interestEntries)
    ? data.interestEntries
    : [];
  const totalPaid = existingRepayments.reduce(
    (s: number, r: any) => s + (Number(r?.amount) || 0),
    0,
  );
  const totalExtraBorrowed = existingBorrows.reduce(
    (s: number, b: any) => s + (Number(b?.amount) || 0),
    0,
  );
  const totalInterest = existingInterests.reduce(
    (s: number, i: any) => s + (Number(i?.amount) || 0),
    0,
  );
  // Tổng cần trả = gốc + các lần vay thêm + lãi; còn lại = tổng cần trả − đã trả.
  const totalDue = principal + totalExtraBorrowed + totalInterest;
  const remaining = Math.max(0, totalDue - totalPaid);
  const isLent = direction === 'lent';
  const isInstallment = direction === 'installment';

  // Lấy tất cả transaction liên kết (pre-fetch outside trx).
  const txQ = query(
    collection(firestoreInstance, TRANSACTIONS_COLLECTION),
    where('debtId', '==', debtId),
  );
  const txSnap = await getDocs(txQ);
  const txDocs = txSnap.docs.filter(
    (d: QueryDoc) => (d.data()?.userId as string) === userId,
  );

  await runTransaction(firestoreInstance, async (trx) => {
    // Trả góp: không đụng quỹ bất kể remaining. Chỉ xóa debt + tx (nếu có).
    // Nếu còn remaining > 0 và không phải installment → áp dụng delta lên quỹ user chọn.
    if (remaining > 0 && !isInstallment) {
      const refundFundId = opts?.refundFundId;
      if (!refundFundId) {
        throw new Error('Chưa chọn quỹ để hoàn tác');
      }
      const primaryRef = doc(firestoreInstance, FUNDS_COLLECTION, refundFundId);
      const primarySnap = await trx.get(primaryRef);

      let offsetRef: FirebaseFirestoreTypes.DocumentReference | undefined;
      let offsetSnap: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
      if (opts?.offsetSourceFundId) {
        if (opts.offsetSourceFundId === refundFundId) {
          throw new Error('Quỹ cấn trừ phải khác quỹ chính');
        }
        offsetRef = doc(firestoreInstance, FUNDS_COLLECTION, opts.offsetSourceFundId);
        offsetSnap = await trx.get(offsetRef);
      }

      if (isLent) {
        // 'lent': +remaining vào quỹ chính. Không cần check đủ.
        if (!!primarySnap.exists) {
          trx.update(primaryRef, {
            balance: increment(remaining),
            updatedAt: serverTimestamp(),
          });
        } else {
          throw new Error('Quỹ hoàn tiền không tồn tại');
        }
      } else {
        // 'borrowed': -remaining khỏi quỹ chính, có thể cần cấn trừ.
        if (!primarySnap.exists) {
          throw new Error('Quỹ chính không tồn tại');
        }
        const currentBalance = Number(primarySnap.data()?.balance ?? 0) || 0;

        if (currentBalance >= remaining) {
          trx.update(primaryRef, {
            balance: increment(-remaining),
            updatedAt: serverTimestamp(),
          });
        } else {
          const deficit = remaining - currentBalance;
          if (!offsetRef || !offsetSnap) {
            const name =
              (primarySnap.data()?.name as string | undefined) ?? 'Quỹ';
            throw new Error(
              `"${name}" không đủ, thiếu ${deficit.toLocaleString('vi-VN')}đ. Chọn quỹ khác để cấn trừ.`,
            );
          }
          if (!offsetSnap.exists) {
            throw new Error('Quỹ cấn trừ không tồn tại');
          }
          const offsetBalance = Number(offsetSnap.data()?.balance ?? 0) || 0;
          if (offsetBalance < deficit) {
            throw new Error(
              `Quỹ cấn trừ không đủ để bù ${deficit.toLocaleString('vi-VN')}đ`,
            );
          }
          trx.update(primaryRef, {
            balance: increment(-currentBalance),
            updatedAt: serverTimestamp(),
          });
          trx.update(offsetRef, {
            balance: increment(-deficit),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // Xóa tất cả transaction liên kết + debt doc.
    txDocs.forEach((d: QueryDoc) => trx.delete(d.ref));
    trx.delete(debtRef);
  });

  // Push notification (best-effort)
  try {
    const counterparty = String(data.counterparty ?? '');
    if (isInstallment) {
      await safePushNotification(userId, {
        kind: 'transaction_deleted',
        title: 'Xóa khoản trả góp',
        message: `Đã xóa khoản trả góp với "${counterparty}". Số dư các quỹ không đổi.`,
      });
      return;
    }
    if (remaining > 0 && opts?.refundFundId) {
      const { totalAfter, byId } = await fetchFundsSummary(
        userId,
        [opts.refundFundId, opts.offsetSourceFundId].filter(Boolean) as string[],
      );
      const primaryInfo = byId.get(opts.refundFundId);
      const primaryName = primaryInfo?.name ?? 'Quỹ';
      const primaryBalance = primaryInfo?.balance ?? 0;
      const primaryDelta = isLent ? remaining : -remaining;
      const primaryDeltaLabel = formatSigned(primaryDelta);
      const primaryBalLabel = formatAmount(primaryBalance);
      const totalLabel = formatAmount(totalAfter);
      let extra = '';
      if (opts.offsetSourceFundId && !isLent) {
        const offsetInfo = byId.get(opts.offsetSourceFundId);
        const offsetName = offsetInfo?.name ?? 'Quỹ';
        const offsetBalance = offsetInfo?.balance ?? 0;
        extra = `\n"${offsetName}"\n(đã cấn trừ) - Số dư: ${formatAmount(offsetBalance)}`;
      }
      const dirLabel = isLent ? 'cho vay' : 'đi vay';
      const msg =
        `Đã xóa khoản ${dirLabel} với "${counterparty}". ` +
        `Số tiền chưa thanh toán ${formatAmount(remaining)} đã ${
          isLent ? 'cộng vào' : 'trừ khỏi'
        } "${primaryName}".\n` +
        `"${primaryName}"\n${primaryDeltaLabel} - Số dư: ${primaryBalLabel}${extra}\n` +
        `Tổng số dư: ${totalLabel}`;
      await safePushNotification(userId, {
        kind: 'transaction_deleted',
        title: 'Xóa khoản nợ',
        message: msg,
      });
    } else {
      // Đã tất toán hoặc không cần refund → không đụng quỹ.
      const { totalAfter } = await fetchFundsSummary(userId, []);
      const dirLabel = isLent ? 'cho vay' : 'đi vay';
      const msg =
        `Đã xóa khoản ${dirLabel} đã tất toán với "${counterparty}". ` +
        `Số dư các quỹ không đổi.\nTổng số dư: ${formatAmount(totalAfter)}`;
      await safePushNotification(userId, {
        kind: 'transaction_deleted',
        title: 'Xóa khoản nợ',
        message: msg,
      });
    }
  } catch {
    // ignore notification errors
  }
}
