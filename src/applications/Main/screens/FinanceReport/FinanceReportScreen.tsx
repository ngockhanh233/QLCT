import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { colors } from '../../../../utils/color';
import { getStoredUser } from '../../../../services';
import type { MonthSummary } from '../Home/hooks';
import { useFixedItems } from '../Budget/hooks';
import { SpendingDistributionSection } from '../Home/components';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import IncomeIcon from '../../../../assets/icons/IncomeIcon';
import ExpenseIcon from '../../../../assets/icons/ExpenseIcon';
import { getFixedIncomeCategory, getFixedExpenseCategory } from '../../../../utils/categoryUtils';
import { TRANSACTION_TYPES } from '../../../../constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../MainScreen';

const COLLECTION_NAME = 'transactions';
const MAX_ITEMS = 1000;

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, COLLECTION_NAME);

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getMonthKeyFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const y = d.getFullYear();
  return `${m}/${y}`;
}

type YearMonthPoint = {
  month: number; // 0-11
  income: number;
  expense: number;
};

function formatAmountShort(amount: number): string {
  if (!amount) return '0đ';
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}t`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}tr`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${amount}đ`;
}

async function fetchMonthSummaryForDate(
  userId: string,
  baseDate: Date,
): Promise<MonthSummary> {
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);

  const q = query(
    transactionsCollection,
    where('userId', '==', userId),
    where('transactionDate', '>=', start),
    where('transactionDate', '<=', end),
    orderBy('transactionDate', 'desc'),
  );

  const snapshot = await getDocs(q);
  console.log(
    '[Firestore] FinanceReport.fetchMonthSummaryForDate size=',
    snapshot.size,
  );

  const items = snapshot.docs.map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>) => {
    const data = docSnap.data() as Record<string, unknown>;
    const ts = data.transactionDate as
      | FirebaseFirestoreTypes.Timestamp
      | Date
      | undefined;
    const date =
      ts instanceof Date
        ? ts
        : ts &&
          typeof (ts as FirebaseFirestoreTypes.Timestamp).toDate === 'function'
        ? (ts as FirebaseFirestoreTypes.Timestamp).toDate()
        : new Date();

    return {
      id: docSnap.id,
      userId: data.userId as string,
      categoryId: data.categoryId as string,
      amount: (data.amount as number) ?? 0,
      type: data.type as 'income' | 'expense',
      transactionDate: date,
    };
  });

  const thisMonth = items.filter(
    (t: { transactionDate: Date }) =>
      t.transactionDate >= start && t.transactionDate <= end,
  );

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryAmounts: Record<string, number> = {};

  for (const t of thisMonth) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      categoryAmounts[t.categoryId] =
        (categoryAmounts[t.categoryId] ?? 0) + t.amount;
    }
  }

  const totalForPercent = totalExpense || 1;
  const expenseByCategory = Object.entries(categoryAmounts)
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      percentage: Math.round((amount / totalForPercent) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    expenseByCategory,
  };
}

async function fetchYearPoints(
  userId: string,
  year: number,
): Promise<YearMonthPoint[]> {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  const q = query(
    transactionsCollection,
    where('userId', '==', userId),
    where('transactionDate', '>=', start),
    where('transactionDate', '<=', end),
    orderBy('transactionDate', 'desc'),
  );

  const snapshot = await getDocs(q);
  console.log(
    '[Firestore] FinanceReport.fetchYearPoints size=',
    snapshot.size,
  );

  const months: YearMonthPoint[] = Array.from({ length: 12 }, (_, idx) => ({
    month: idx,
    income: 0,
    expense: 0,
  }));

  snapshot.forEach((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>) => {
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

    if (!date || date.getFullYear() !== year) {
      return;
    }

    const monthIndex = date.getMonth();
    const amount = (data.amount as number) ?? 0;
    const type = data.type as 'income' | 'expense' | undefined;

    if (type === 'income') {
      months[monthIndex].income += amount;
    } else if (type === 'expense') {
      months[monthIndex].expense += amount;
    }
  });

  return months;
}

const FinanceReportScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    getTotalFixedIncomeByMonth,
    getTotalFixedExpenseByMonth,
    fetchFixedTotalsForMonth,
    getFixedItemsByMonth,
  } = useFixedItems();

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(
    () => new Date(),
  );
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    expenseByCategory: [],
  });
  const [isMonthLoading, setIsMonthLoading] = useState(false);

  const [prevMonthSummary, setPrevMonthSummary] = useState<MonthSummary | null>(
    null,
  );
  const [isPrevLoading, setIsPrevLoading] = useState(false);

  const [yearPoints, setYearPoints] = useState<YearMonthPoint[]>([]);
  const [isYearLoading, setIsYearLoading] = useState(false);

  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  const [exportedFileName, setExportedFileName] = useState<string | null>(null);

  // Cache thu/chi cố định theo tháng (chỉ fetch từ Firestore khi xem tháng khác tháng hiện tại)
  const [fixedTotalsCache, setFixedTotalsCache] = useState<
    Record<string, { income: number; expense: number }>
  >({});

  const [fixedDetailVisible, setFixedDetailVisible] = useState(false);
  const [fixedDetailType, setFixedDetailType] = useState<'income' | 'expense'>(
    'expense',
  );
  const fixedModalScrollRef = useRef<ScrollView | null>(null);
  const [fixedModalScrollOffset, setFixedModalScrollOffset] = useState(0);
  const [fixedModalContentHeight, setFixedModalContentHeight] = useState(0);
  const [fixedModalLayoutHeight, setFixedModalLayoutHeight] = useState(0);

  const handleCategoryDetail = useCallback(
    (categoryId: string) => {
      navigation.navigate('SpendingCategoryDetail', { categoryId });
    },
    [navigation],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) setUserId(stored?.uid ?? null);
      } catch {
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSelectedMonth = useCallback(async () => {
    if (!userId) {
      setMonthSummary({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        expenseByCategory: [],
      });
      return;
    }

    try {
      setIsMonthLoading(true);
      const summary = await fetchMonthSummaryForDate(userId, selectedMonthDate);
      setMonthSummary(summary);
    } catch (error) {
      console.error('Error loading selected month summary:', error);
      setMonthSummary({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        expenseByCategory: [],
      });
    } finally {
      setIsMonthLoading(false);
    }
  }, [userId, selectedMonthDate]);

  const loadPrevMonth = useCallback(async () => {
    try {
      setIsPrevLoading(true);
      if (!userId) {
        setPrevMonthSummary(null);
        return;
      }

      const prevMonthDate = new Date(
        selectedMonthDate.getFullYear(),
        selectedMonthDate.getMonth() - 1,
        15,
      );

      const summary = await fetchMonthSummaryForDate(
        userId,
        prevMonthDate,
      );
      setPrevMonthSummary(summary);
    } catch (error) {
      console.error('Error loading previous month summary:', error);
      setPrevMonthSummary(null);
    } finally {
      setIsPrevLoading(false);
    }
  }, [userId, selectedMonthDate]);

  const loadYearSummary = useCallback(async () => {
    try {
      setIsYearLoading(true);
      if (!userId) {
        setYearPoints([]);
        return;
      }

      const year = selectedMonthDate.getFullYear();
      const points = await fetchYearPoints(userId, year);
      setYearPoints(points);
    } catch (error) {
      console.error('Error loading yearly summary:', error);
      setYearPoints([]);
    } finally {
      setIsYearLoading(false);
    }
  }, [userId, selectedMonthDate]);

  useEffect(() => {
    loadSelectedMonth();
    loadPrevMonth();
    loadYearSummary();
  }, [loadSelectedMonth, loadPrevMonth, loadYearSummary]);

  const monthKey = useMemo(
    () => getMonthKeyFromDate(selectedMonthDate),
    [selectedMonthDate],
  );
  const currentMonthKey = getMonthKeyFromDate(new Date());
  const prevMonthKey = useMemo(() => {
    const d = new Date(
      selectedMonthDate.getFullYear(),
      selectedMonthDate.getMonth() - 1,
      1,
    );
    return getMonthKeyFromDate(d);
  }, [selectedMonthDate]);

  // Fetch thu/chi cố định từ Firestore khi xem tháng khác tháng hiện tại
  useEffect(() => {
    if (!userId) return;
    const keysToLoad: string[] = [];
    if (monthKey !== currentMonthKey && !fixedTotalsCache[monthKey]) {
      keysToLoad.push(monthKey);
    }
    if (
      prevMonthKey !== currentMonthKey &&
      prevMonthKey !== monthKey &&
      !fixedTotalsCache[prevMonthKey]
    ) {
      keysToLoad.push(prevMonthKey);
    }
    if (keysToLoad.length === 0) return;
    let cancelled = false;
    keysToLoad.forEach(async key => {
      const result = await fetchFixedTotalsForMonth(key);
      if (!cancelled) {
        setFixedTotalsCache(prev => ({ ...prev, [key]: result }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    userId,
    monthKey,
    prevMonthKey,
    currentMonthKey,
    fetchFixedTotalsForMonth,
    fixedTotalsCache,
  ]);

  const fixedIncomeTotal =
    monthKey === currentMonthKey
      ? getTotalFixedIncomeByMonth(monthKey)
      : (fixedTotalsCache[monthKey]?.income ?? 0);
  const fixedExpenseTotal =
    monthKey === currentMonthKey
      ? getTotalFixedExpenseByMonth(monthKey)
      : (fixedTotalsCache[monthKey]?.expense ?? 0);

  const totalIncome = monthSummary.totalIncome;
  const totalExpense = monthSummary.totalExpense;
  const expenseByCategory = monthSummary.expenseByCategory;

  const totalIncomeWithFixed = totalIncome + fixedIncomeTotal;
  const totalExpenseWithFixed = totalExpense + fixedExpenseTotal;
  const balance = totalIncomeWithFixed - totalExpenseWithFixed;

  const prevIncome = prevMonthSummary?.totalIncome ?? 0;
  const prevExpense = prevMonthSummary?.totalExpense ?? 0;

  const prevFixedIncomeTotal =
    prevMonthKey === currentMonthKey
      ? getTotalFixedIncomeByMonth(prevMonthKey)
      : (fixedTotalsCache[prevMonthKey]?.income ?? 0);
  const prevFixedExpenseTotal =
    prevMonthKey === currentMonthKey
      ? getTotalFixedExpenseByMonth(prevMonthKey)
      : (fixedTotalsCache[prevMonthKey]?.expense ?? 0);

  const fixedItemsForSelectedMonth = useMemo(() => {
    const items =
      fixedDetailType === 'income'
        ? getFixedItemsByMonth(monthKey, TRANSACTION_TYPES.INCOME)
        : getFixedItemsByMonth(monthKey, TRANSACTION_TYPES.EXPENSE);
    return items;
  }, [fixedDetailType, getFixedItemsByMonth, monthKey]);

  const totalIncomeWithFixedPrev = prevIncome + prevFixedIncomeTotal;
  const totalExpenseWithFixedPrev = prevExpense + prevFixedExpenseTotal;

  const {
    incomeCurrentPct,
    incomePrevPct,
    expenseCurrentPct,
    expensePrevPct,
  } = useMemo(() => {
    const maxIncome = Math.max(
      totalIncomeWithFixed,
      totalIncomeWithFixedPrev,
      1,
    );
    const maxExpense = Math.max(
      totalExpenseWithFixed,
      totalExpenseWithFixedPrev,
      1,
    );

    const clamp = (v: number) => Math.max(4, Math.min(100, v || 0));

    return {
      incomeCurrentPct: clamp(
        (totalIncomeWithFixed / maxIncome) * 100,
      ),
      incomePrevPct: clamp(
        (totalIncomeWithFixedPrev / maxIncome) * 100,
      ),
      expenseCurrentPct: clamp(
        (totalExpenseWithFixed / maxExpense) * 100,
      ),
      expensePrevPct: clamp(
        (totalExpenseWithFixedPrev / maxExpense) * 100,
      ),
    };
  }, [
    totalIncomeWithFixed,
    totalIncomeWithFixedPrev,
    totalExpenseWithFixed,
    totalExpenseWithFixedPrev,
  ]);

  const maxYearExpense = useMemo(
    () => Math.max(...yearPoints.map((p) => p.expense), 1),
    [yearPoints],
  );

  const handleExportExcel = useCallback(async () => {
    try {
      const year = selectedMonthDate.getFullYear();
      const month = selectedMonthDate.getMonth() + 1;
      const monthLabel = formatMonthLabel(selectedMonthDate);

      const sheetData: (string | number)[][] = [];

      const addRow = (cols: (string | number)[]) => {
        sheetData.push(cols);
      };

      addRow(['BÁO CÁO TÀI CHÍNH', monthLabel]);
      addRow([]);

      addRow(['Tổng quan tháng', monthLabel]);
      addRow(['Thu nhập (bao gồm cố định)', totalIncomeWithFixed]);
      addRow(['Chi tiêu (bao gồm cố định)', totalExpenseWithFixed]);
      addRow(['Còn lại', balance]);
      addRow([]);

      addRow(['So sánh với tháng trước']);
      addRow(['Thu nhập tháng này (bao gồm cố định)', totalIncomeWithFixed]);
      addRow([
        'Thu nhập tháng trước (bao gồm cố định)',
        totalIncomeWithFixedPrev,
      ]);
      addRow(['Chi tiêu tháng này (bao gồm cố định)', totalExpenseWithFixed]);
      addRow([
        'Chi tiêu tháng trước (bao gồm cố định)',
        totalExpenseWithFixedPrev,
      ]);
      addRow([]);

      addRow([`Chi tiêu theo tháng (${year})`]);
      addRow(['Tháng', 'Thu nhập', 'Chi tiêu']);
      yearPoints.forEach((p) => {
        addRow([`T${p.month + 1}`, p.income, p.expense]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'BaoCao');

      const wbout = XLSX.write(wb, {
        type: 'base64',
        bookType: 'xlsx',
      });

      const fileName = `bao_cao_tai_chinh_${year}_${month
        .toString()
        .padStart(2, '0')}.xlsx`;

      // Ưu tiên lưu vào thư mục Download trên Android để dễ tìm,
      // fallback về DocumentDirectory nếu không có.
      const baseDir =
        (RNFS as any).DownloadDirectoryPath ?? RNFS.DocumentDirectoryPath;
      const filePath = `${baseDir}/${fileName}`;

      await RNFS.writeFile(filePath, wbout, 'base64');

      setExportedFilePath(filePath);
      setExportedFileName(fileName);
      setExportModalVisible(true);
    } catch (error) {
      console.error('Error exporting report:', error);
      Alert.alert(
        'Xuất báo cáo thất bại',
        'Không thể xuất file báo cáo. Vui lòng thử lại.',
      );
    }
  }, [
    totalIncomeWithFixed,
    totalExpenseWithFixed,
    balance,
    totalIncome,
    totalExpense,
    prevIncome,
    prevExpense,
    yearPoints,
  ]);

  const handleCloseExportModal = useCallback(() => {
    setExportModalVisible(false);
  }, []);

  const onRefresh = () => {
    loadSelectedMonth();
    loadPrevMonth();
    loadYearSummary();
  };

  const canGoNextMonth = useMemo(() => {
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const b = new Date(
      selectedMonthDate.getFullYear(),
      selectedMonthDate.getMonth(),
      1,
    ).getTime();
    return b < a;
  }, [selectedMonthDate]);

  const goPrevMonth = () => {
    setSelectedMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setSelectedMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const expenseDiff = useMemo(
    () => totalExpenseWithFixed - totalExpenseWithFixedPrev,
    [totalExpenseWithFixed, totalExpenseWithFixedPrev],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isMonthLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.headerBackButton}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.headerBackText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Báo cáo tài chính</Text>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            activeOpacity={0.8}
            onPress={handleExportExcel}
          >
            <Text style={styles.exportButtonText}>Xuất Excel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.monthSwitcherRow}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            activeOpacity={0.8}
            onPress={goPrevMonth}
          >
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {formatMonthLabel(selectedMonthDate)}
          </Text>
          <TouchableOpacity
            style={[
              styles.monthNavBtn,
              !canGoNextMonth && styles.monthNavBtnDisabled,
            ]}
            activeOpacity={0.8}
            onPress={goNextMonth}
            disabled={!canGoNextMonth}
          >
            <Text
              style={[
                styles.monthNavText,
                !canGoNextMonth && styles.monthNavTextDisabled,
              ]}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <View style={styles.summaryHeaderLeft}>
              <View style={styles.summaryIconWallet}>
                <WalletIcon width={20} height={20} color={colors.white} />
              </View>
              <Text style={styles.sectionTitle}>Tổng quan</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryLabelRow}>
                <IncomeIcon width={16} height={16} color={colors.success} />
                <Text style={[styles.summaryLabel, { marginLeft: 6 }]}>
                  Thu nhập
                </Text>
              </View>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {totalIncomeWithFixed.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.summaryLabelRow}>
                <ExpenseIcon width={16} height={16} color={colors.error} />
                <Text style={[styles.summaryLabel, { marginLeft: 6 }]}>
                  Chi tiêu
                </Text>
              </View>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {totalExpenseWithFixed.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.summaryLabel}>Còn lại</Text>
            <Text
              style={[
                styles.balanceValue,
                { color: balance >= 0 ? colors.success : colors.error },
              ]}
            >
              {balance.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thu / Chi cố định</Text>
          <View style={styles.fixedRow}>
            <TouchableOpacity
              style={styles.fixedItem}
              activeOpacity={0.7}
              onPress={() => {
                setFixedDetailType('income');
                setFixedDetailVisible(true);
              }}
            >
              <Text style={styles.fixedLabel}>Thu cố định</Text>
              <Text
                style={[styles.fixedValue, { color: colors.success }]}
              >{`+${fixedIncomeTotal.toLocaleString('vi-VN')}đ`}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fixedItem}
              activeOpacity={0.7}
              onPress={() => {
                setFixedDetailType('expense');
                setFixedDetailVisible(true);
              }}
            >
              <Text style={styles.fixedLabel}>Chi cố định</Text>
              <Text
                style={[styles.fixedValue, { color: colors.error }]}
              >{`-${fixedExpenseTotal.toLocaleString('vi-VN')}đ`}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SpendingDistributionSection
            expenseByCategory={expenseByCategory}
            showDetailButton={false}
            onPressCategory={handleCategoryDetail}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>So sánh với tháng trước</Text>

          <View style={styles.compareRow}>
            <View style={styles.compareLabels}>
              <Text style={styles.compareLabel}>Thu nhập</Text>
            </View>
            <View style={styles.compareBars}>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarText}>Tháng này</Text>
                <View style={styles.compareBarTrack}>
                  <View
                    style={[
                      styles.compareBarFill,
                      styles.compareBarThisMonth,
                      { width: `${incomeCurrentPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compareBarValue}>
                  {totalIncome.toLocaleString('vi-VN')}đ
                </Text>
              </View>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarText}>Tháng trước</Text>
                <View style={styles.compareBarTrack}>
                  <View
                    style={[
                      styles.compareBarFill,
                      styles.compareBarPrevMonth,
                      { width: `${incomePrevPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compareBarValue}>
                  {prevIncome.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.expenseDiffRow}>
            <Text style={styles.expenseDiffLabel}>Tổng chi tiêu</Text>
            <Text
              style={[
                styles.expenseDiffValue,
                {
                  color:
                    expenseDiff <= 0 ? colors.success : colors.error,
                },
              ]}
            >
              {expenseDiff === 0
                ? 'Bằng tháng trước'
                : expenseDiff < 0
                ? `Ít hơn ${Math.abs(expenseDiff).toLocaleString('vi-VN')}đ so với tháng trước`
                : `Nhiều hơn ${expenseDiff.toLocaleString('vi-VN')}đ so với tháng trước`}
            </Text>
          </View>

          <View style={[styles.compareRow, { marginTop: 16 }]}>
            <View style={styles.compareLabels}>
              <Text style={styles.compareLabel}>Chi tiêu</Text>
            </View>
            <View style={styles.compareBars}>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarText}>Tháng này</Text>
                <View style={styles.compareBarTrack}>
                  <View
                    style={[
                      styles.compareBarFill,
                      styles.compareBarThisMonthExpense,
                      { width: `${expenseCurrentPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compareBarValue}>
                  {totalExpense.toLocaleString('vi-VN')}đ
                </Text>
              </View>
              <View style={styles.compareBarRow}>
                <Text style={styles.compareBarText}>Tháng trước</Text>
                <View style={styles.compareBarTrack}>
                  <View
                    style={[
                      styles.compareBarFill,
                      styles.compareBarPrevMonthExpense,
                      { width: `${expensePrevPct}%` },
                    ]}
                  />
                </View>
                <Text style={styles.compareBarValue}>
                  {prevExpense.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>
          </View>

          {isPrevLoading && (
            <Text style={styles.compareHint}>Đang tải số liệu tháng trước...</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Chi tiêu theo tháng ({selectedMonthDate.getFullYear()})
          </Text>
          <View style={styles.yearChart}>
            {yearPoints.map((p) => {
              const BAR_MAX_HEIGHT = 90;
              const hRaw = (p.expense / maxYearExpense) * BAR_MAX_HEIGHT;
              const barHeight = Math.max(4, hRaw || 0);

              return (
                <View key={p.month} style={styles.yearBarColumn}>
                  <Text style={styles.yearBarAmount}>
                    {formatAmountShort(p.expense)}
                  </Text>
                  <View style={styles.yearBarTrack}>
                    <View
                      style={[styles.yearBarFill, { height: barHeight }]}
                    />
                  </View>
                  <Text style={styles.yearBarMonth}>T{p.month + 1}</Text>
                </View>
              );
            })}
          </View>
          {isYearLoading && (
            <Text style={styles.compareHint}>Đang tải biểu đồ năm...</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        isVisible={fixedDetailVisible}
        onBackdropPress={() => setFixedDetailVisible(false)}
        onBackButtonPress={() => setFixedDetailVisible(false)}
        onSwipeComplete={() => setFixedDetailVisible(false)}
        swipeDirection={['down']}
        scrollTo={(p: { x?: number; y: number; animated?: boolean }) =>
          fixedModalScrollRef.current?.scrollTo(p)
        }
        scrollOffset={fixedModalScrollOffset}
        scrollOffsetMax={Math.max(0, fixedModalContentHeight - fixedModalLayoutHeight)}
        propagateSwipe
        backdropOpacity={0.5}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropTransitionOutTiming={0}
        style={styles.fixedModal}
      >
        <View style={styles.fixedModalContent}>
          <View style={styles.fixedModalIndicator} />

          <Text style={styles.fixedModalTitle}>
            {fixedDetailType === 'income' ? 'Thu cố định' : 'Chi cố định'}{' '}
            {formatMonthLabel(selectedMonthDate)}
          </Text>

          {fixedItemsForSelectedMonth.length === 0 ? (
            <Text style={styles.fixedModalEmpty}>
              Không có khoản cố định nào trong tháng này
            </Text>
          ) : (
            <ScrollView
              ref={ref => {
                fixedModalScrollRef.current = ref;
              }}
              style={styles.fixedModalList}
              contentContainerStyle={styles.fixedModalListContent}
              showsVerticalScrollIndicator={false}
              onLayout={e => setFixedModalLayoutHeight(e.nativeEvent.layout.height)}
              onContentSizeChange={(_, h) => setFixedModalContentHeight(h)}
              scrollEventThrottle={16}
              onScroll={e => {
                setFixedModalScrollOffset(e.nativeEvent.contentOffset.y);
              }}
            >
              {fixedItemsForSelectedMonth.map(item => {
                const category =
                  fixedDetailType === 'income'
                    ? getFixedIncomeCategory(item.categoryId)
                    : getFixedExpenseCategory(item.categoryId);
                if (!category) {
                  return null;
                }
                const IconComponent = category.icon;
                const amountLabel = `${item.amount.toLocaleString(
                  'vi-VN',
                )}đ`;

                return (
                  <View key={item.id} style={styles.fixedModalRow}>
                    <View style={styles.fixedModalLeft}>
                      <View
                        style={[
                          styles.fixedModalIcon,
                          { backgroundColor: category.color + '15' },
                        ]}
                      >
                        <IconComponent
                          width={20}
                          height={20}
                          color={category.color}
                        />
                      </View>
                      <View style={styles.fixedModalInfo}>
                        <Text style={styles.fixedModalName}>
                          {category.name}
                        </Text>
                        {item.note ? (
                          <Text style={styles.fixedModalNote} numberOfLines={1}>
                            {item.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.fixedModalAmount,
                        {
                          color:
                            fixedDetailType === 'income'
                              ? colors.success
                              : colors.error,
                        },
                      ]}
                    >
                      {fixedDetailType === 'income' ? '+' : '-'}
                      {amountLabel}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.fixedModalCloseButton}
            activeOpacity={0.7}
            onPress={() => setFixedDetailVisible(false)}
          >
            <Text style={styles.fixedModalCloseText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={exportModalVisible}
        onBackdropPress={handleCloseExportModal}
        onBackButtonPress={handleCloseExportModal}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.exportModalCard}>
          <View style={styles.exportIconCircle}>
            <Text style={styles.exportIconText}>✓</Text>
          </View>
          <Text style={styles.exportModalTitle}>Xuất Excel thành công</Text>
          <Text style={styles.exportModalMessage}>
            File đã được lưu vào thư mục Download.
          </Text>
          {!!exportedFileName && (
            <View style={styles.exportFilePill}>
              <Text style={styles.exportFileName} numberOfLines={1}>
                {exportedFileName}
              </Text>
            </View>
          )}

          <View style={styles.exportModalActions}>
            <TouchableOpacity
              style={[styles.exportActionBtn, styles.exportActionSecondary]}
              activeOpacity={0.85}
              onPress={handleCloseExportModal}
            >
              <Text style={[styles.exportActionText, styles.exportActionTextSecondary]}>
                Đóng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerBackText: {
    fontSize: 40,
    lineHeight: 30,
    marginRight: 8,
    // fontWeight: '700',
    color: colors.text,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  monthSwitcherRow: {
    marginTop: 4,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.5,
  },
  monthNavText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: -2,
  },
  monthNavTextDisabled: {
    color: colors.textLight,
  },
  monthLabel: {
    marginHorizontal: 10,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  exportButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  exportModalCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  exportIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  exportIconText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.success,
    marginTop: -1,
  },
  exportModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  exportModalMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  exportFilePill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    width: '100%',
  },
  exportFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  exportModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    width: '100%',
  },
  exportActionBtn: {
    minWidth: 110,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginLeft: 10,
  },
  exportActionSecondary: {
    backgroundColor: colors.backgroundSecondary,
  },
  exportActionPrimary: {
    backgroundColor: colors.primary,
  },
  exportActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  exportActionTextSecondary: {
    color: colors.text,
  },
  exportActionTextPrimary: {
    color: colors.white,
  },
  summaryCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconWallet: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceRow: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
  },
  fixedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fixedItem: {
    flex: 1,
  },
  fixedLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fixedValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  fixedModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  fixedModalContent: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '100%',
  },
  fixedModalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: colors.textLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  fixedModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  fixedModalEmpty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  fixedModalList: {
    flex: 1,
    marginTop: 4,
  },
  fixedModalListContent: {
    paddingBottom: 12,
  },
  fixedModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  fixedModalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fixedModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fixedModalInfo: {
    flex: 1,
  },
  fixedModalName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  fixedModalNote: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  fixedModalAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  fixedModalCloseButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fixedModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  sectionBlock: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  compareLabels: {
    width: 80,
    paddingTop: 8,
  },
  compareLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  compareBars: {
    flex: 1,
    gap: 8,
  },
  compareBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compareBarText: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 70,
  },
  compareBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  compareBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  compareBarThisMonth: {
    backgroundColor: colors.success,
  },
  compareBarPrevMonth: {
    backgroundColor: colors.success + '60',
  },
  compareBarThisMonthExpense: {
    backgroundColor: colors.error,
  },
  compareBarPrevMonthExpense: {
    backgroundColor: colors.error + '60',
  },
  compareBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    minWidth: 80,
    textAlign: 'right',
  },
  compareHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  expenseDiffRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  expenseDiffLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  expenseDiffValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  yearChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  yearBarColumn: {
    alignItems: 'center',
    flex: 1,
  },
  yearBarAmount: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  yearBarTrack: {
    width: 10,
    height: 100,
    borderRadius: 6,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  yearBarFill: {
    width: '100%',
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  yearBarMonth: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },
});

export default FinanceReportScreen;

