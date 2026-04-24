import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Switch,
  Animated,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DatePicker, MonthPicker } from '../../../../components';
import Modal from 'react-native-modal';
import { colors } from '../../../../utils/color';
import { getExpenseCategory, getIncomeCategory } from '../../../../utils/categoryUtils';
import {
  useTransactions,
  type TransactionRecord,
  type TransactionTimeFilter,
} from './hooks/useTransactions';
import CalendarIcon from '../../../../assets/icons/CalendarIcon';
import { Skeleton, SwipeableRow, ErrorPopup } from '../../../../components';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import type { RootStackParamList } from '../../MainScreen';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
import Svg, { Path } from 'react-native-svg';
import TransactionFilterPanel from './components/TransactionFilterPanel';
import { useDebts } from '../../../../contexts/DebtsContext';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import CheckIcon from '../../../../assets/icons/CheckIcon';
import { LOAN_CATEGORY_IDS, debtRemaining, type DebtRecord } from '../../../../services/debts';

interface LoanGroupChild {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  fundId: string | null;
  dateLabel: string;
  timeLabel: string;
  rawDate: Date;
  note: string;
}

interface LoanGroupData {
  debtId: string;
  counterparty: string;
  direction: 'lent' | 'borrowed';
  principal: number;
  remaining: number;
  children: LoanGroupChild[];
}

interface TransactionViewItem {
  id: string;
  categoryId: string;
  amount: number;
  type: 'income' | 'expense';
  note: string;
  fundId?: string | null;
  isSplitIncome?: boolean;
  incomeSplits?: { fundId: string; amount: number }[] | null;
  dateLabel: string;
  timeLabel: string;
  rawDate: Date;
  isLoanMovement?: boolean;
  debtId?: string | null;
  /** Khi true, item này là card gộp đại diện cho 1 khoản nợ (không phải tx thật). */
  isLoanGroup?: boolean;
  loanGroupData?: LoanGroupData;
}

type TransactionGroup = {
  date: string;
  transactions: TransactionViewItem[];
  total: number;
};

const FunnelIcon: React.FC<{ width?: number; height?: number; color?: string }> = ({
  width = 16,
  height = 16,
  color = '#000',
}) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
    <Path
      d="M1.75 3.25C1.75 2.83579 2.08579 2.5 2.5 2.5H13.5C13.9142 2.5 14.25 2.83579 14.25 3.25C14.25 3.43093 14.1845 3.60574 14.0655 3.74209L10 8.4V12.5C10 12.7462 9.87938 12.9768 9.67699 13.1173L7.67699 14.5062C7.21564 14.8267 6.58333 14.4967 6.58333 13.9368V8.4L2.18452 3.74209C2.06549 3.60574 2 3.43093 2 3.25H1.75Z"
      fill={color}
    />
  </Svg>
);

const TIME_FILTERS: { key: TransactionTimeFilter; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year', label: 'Năm' },
];

const STORAGE_KEY_SHOW_LOAN_IN_LIST = 'transaction_show_loan_in_list';

type TransactionKindFilter = 'all' | 'income' | 'expense';
type MainTab = 'transactions' | 'debts';
type LoanDirectionFilter = 'all' | 'lent' | 'borrowed';

const TYPE_FILTERS: { key: TransactionKindFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'expense', label: 'Khoản chi' },
  { key: 'income', label: 'Khoản thu' },
];

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'transactions', label: 'Thu chi' },
  { key: 'debts', label: 'Vay nợ' },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<TransactionGroup>);
/** Scroll list 0 → giá trị này: filter mờ dần và trượt lên (không còn snap/hút) */
const FILTER_FADE_SCROLL_END = 120;
const FILTER_EXPAND_THRESHOLD = 8;
const FILTER_TOGGLE_SHOW_OFFSET = 40;
/** Bật/tắt nút phễu (pointerEvents) */
const FILTER_TOGGLE_SHOW_ON = 48;
const FILTER_TOGGLE_SHOW_OFF = 32;
/** Hysteresis: coi filter đã ẩn / hiện lại (pointerEvents) */
const FILTER_HIDDEN_SCROLL_ON = 100;
const FILTER_VISIBLE_SCROLL_OFF = 25;
/** Chiều cao mặc định trước khi onLayout (chỉ ~2 hàng filter) */
const FILTER_PANEL_HEIGHT_FALLBACK = 168;

const TransactionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { markHomeDataChanged, getAndClearTransactionListNeedsRefresh } = useHomeDataChanged();
  const [activeFilter, setActiveFilter] = useState<TransactionTimeFilter>('month');
  const [typeFilter, setTypeFilter] = useState<TransactionKindFilter>('all');
  const [mainTab, setMainTab] = useState<MainTab>('transactions');
  const [showLoanInList, setShowLoanInList] = useState(false);
  const [loanDirectionFilter, setLoanDirectionFilter] = useState<LoanDirectionFilter>('all');

  // Load persisted switch state lúc mount.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY_SHOW_LOAN_IN_LIST)
      .then((v) => {
        if (!cancelled && v === 'true') setShowLoanInList(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setShowLoanInListPersisted = useCallback((next: boolean) => {
    setShowLoanInList(next);
    AsyncStorage.setItem(STORAGE_KEY_SHOW_LOAN_IN_LIST, next ? 'true' : 'false').catch(
      () => {},
    );
  }, []);
  const [deleteDebtTarget, setDeleteDebtTarget] = useState<DebtRecord | null>(null);
  const [deleteDebtFundId, setDeleteDebtFundId] = useState<string>('');
  const [deleteDebtOffsetId, setDeleteDebtOffsetId] = useState<string>('');
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [filterModeModalVisible, setFilterModeModalVisible] = useState(false);
  const {
    transactions,
    isRefreshing,
    refresh,
    isInitialized,
    deleteTransaction,
    timeFilter,
    setTimeFilter,
    dateFilterMode,
    setDateFilterMode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
  } = useTransactions();

  const { funds, refresh: refreshFunds, transferToFund } = useFunds();
  const { debts, deleteDebt: deleteDebtFromCtx } = useDebts();
  const debtById = useMemo(() => {
    const map = new Map<string, typeof debts[number]>();
    debts.forEach((d) => map.set(d.id, d));
    return map;
  }, [debts]);
  const fundNameById = useMemo(() => {
    const m = new Map<string, string>();
    funds.forEach(f => {
      if (f?.id) m.set(f.id, f.name);
    });
    return m;
  }, [funds]);
  const fundBalanceById = useMemo(() => {
    const m = new Map<string, number>();
    funds.forEach(f => {
      if (f?.id) m.set(f.id, f.balance ?? 0);
    });
    return m;
  }, [funds]);

  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(
    () => new Date().getFullYear(),
  );

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('Có lỗi xảy ra');
  const [errorModalMessage, setErrorModalMessage] = useState<string>('');

  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustTxId, setAdjustTxId] = useState<string>('');
  const [adjustTargetFundId, setAdjustTargetFundId] = useState<string>('');
  const [adjustDeficit, setAdjustDeficit] = useState(0);
  const [adjustSourceFundId, setAdjustSourceFundId] = useState<string>('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<TransactionViewItem | null>(null);
  const [deleteRefundFundId, setDeleteRefundFundId] = useState<string>('');
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteAffectFundsEnabled, setDeleteAffectFundsEnabled] =
    useState(true);
  const [splitDeficitModalVisible, setSplitDeficitModalVisible] = useState(false);
  const [splitDeficits, setSplitDeficits] = useState<
    { fundId: string; deficit: number }[]
  >([]);
  const [splitRefundFundId, setSplitRefundFundId] = useState<string>('');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [showFilterToggle, setShowFilterToggle] = useState(false);
  const [floatingFilterVisible, setFloatingFilterVisible] = useState(false);
  /** Chiều cao thật của bộ lọc — tránh khung 340px tạo khoảng trắng lớn */
  const [filterPanelHeight, setFilterPanelHeight] = useState(FILTER_PANEL_HEIGHT_FALLBACK);
  const filterCollapsedRef = useRef<boolean>(false);
  const showFilterToggleRef = useRef<boolean>(false);
  const listRef = useRef<FlatList<TransactionGroup> | null>(null);
  const filterScrollY = useRef(new Animated.Value(0)).current;
  /** Offset list hiện tại — tránh đổi chiều cao filter khi đang lướt (gây giật) */
  const listScrollYRef = useRef(0);
  const deleteFundScrollRef = useRef<ScrollView | null>(null);

  const showErrorModal = useCallback((title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  }, []);

  const closeAdjustModal = useCallback(() => {
    setAdjustModalVisible(false);
    setAdjustTxId('');
    setAdjustTargetFundId('');
    setAdjustDeficit(0);
    setAdjustSourceFundId('');
    setAdjustSaving(false);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalVisible(false);
    setDeleteItem(null);
    setDeleteRefundFundId('');
    setDeleteSaving(false);
    setSplitDeficitModalVisible(false);
    setSplitDeficits([]);
    setSplitRefundFundId('');
    setDeleteAffectFundsEnabled(true);
  }, []);

  const fundsDefaultFirst = useMemo(() => {
    return [...funds].sort((a, b) => {
      const aDefault = a.isDefault ? 1 : 0;
      const bDefault = b.isDefault ? 1 : 0;
      if (aDefault !== bDefault) return bDefault - aDefault;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [funds]);

  useEffect(() => {
    if (!deleteModalVisible || !deleteItem) return;
    if (!deleteFundScrollRef.current) return;
    if (!deleteRefundFundId) return;

    const index = fundsDefaultFirst.findIndex(f => f.id === deleteRefundFundId);
    if (index < 0) return;

    const ITEM_WIDTH = 160;
    const GAP = 10;
    const offsetX = index * (ITEM_WIDTH + GAP);

    // Nhẹ delay để ScrollView mount xong rồi mới scroll.
    const timer = setTimeout(() => {
      deleteFundScrollRef.current?.scrollTo({ x: offsetX, y: 0, animated: true });
    }, 50);

    return () => clearTimeout(timer);
  }, [deleteModalVisible, deleteItem, deleteRefundFundId, fundsDefaultFirst]);

  // Đồng bộ state filter UI với filter trong hook để trigger reload server-side
  const handleChangeFilter = (filter: TransactionTimeFilter) => {
    if (isCustomDate) return;
    setActiveFilter(filter);
    setTimeFilter(filter);
  };
  const isDateFilterActive = dateFilterMode !== 'none';

  const openFilterModeModal = () => {
    setFilterModeModalVisible(true);
  };

  const closeFilterModeModal = () => {
    setFilterModeModalVisible(false);
  };

  const handleSelectFilterMode = (mode: 'none' | 'single' | 'range') => {
    if (mode === 'none') {
      setFromDate(null);
      setToDate(null);
      setDateFilterMode('none');
      setIsCustomDate(false);
    } else if (mode === 'single') {
      const today = new Date();
      setFromDate(today);
      setToDate(null);
      setDateFilterMode('single');
      setIsCustomDate(true);
    } else {
      const today = new Date();
      setFromDate(today);
      setToDate(today);
      setDateFilterMode('range');
      setIsCustomDate(true);
    }
    setFilterModeModalVisible(false);
  };

  const handleFromDateChange = (date: Date) => {
    setFromDate(date);
    setDateFilterMode('range');
    setIsCustomDate(true);
  };

  const handleToDateChange = (date: Date) => {
    setToDate(date);
    setDateFilterMode('range');
    setIsCustomDate(true);
  };

  const handleResetFilters = () => {
    setFromDate(null);
    setToDate(null);
    setDateFilterMode('none');
    setIsCustomDate(false);
  };

  const onFilterPanelLayout = useCallback((e: LayoutChangeEvent) => {
    const y = listScrollYRef.current;
    // Chỉ đo lại khi đầu list hoặc đã kéo qua vùng collapse — tránh vòng onLayout ↔ state khi đang giữ scroll giữa chừng
    if (y > 2 && y < FILTER_FADE_SCROLL_END - 8) return;

    const raw = e.nativeEvent.layout.height;
    if (raw <= 0) return;
    const h = Math.round(raw / 4) * 4;

    setFilterPanelHeight(prev => {
      if (Math.abs(prev - h) < 8) return prev;
      return h;
    });
  }, []);

  /** Khung cố định + translate + opacity (mờ dần) */
  const filterClipLayoutStyle = useMemo(
    () => ({
      height: filterPanelHeight,
      overflow: 'hidden' as const,
    }),
    [filterPanelHeight],
  );

  const filterInnerScrollLiftStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: filterScrollY.interpolate({
            inputRange: [0, FILTER_FADE_SCROLL_END],
            outputRange: [0, -filterPanelHeight],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [filterScrollY, filterPanelHeight],
  );

  /**
   * Summary + list: dùng marginTop âm theo scroll — **không** dùng translateY ở đây.
   * Transform không thu layout nên để lại khoảng trắng lớn phía dưới list (trên tab bar).
   */
  const belowFilterScrollLiftStyle = useMemo(
    () => ({
      marginTop: filterScrollY.interpolate({
        inputRange: [0, FILTER_FADE_SCROLL_END],
        outputRange: [0, -filterPanelHeight],
        extrapolate: 'clamp',
      }),
    }),
    [filterScrollY, filterPanelHeight],
  );

  const filterInnerAnimatedStyle = useMemo(
    () => ({
      opacity: filterScrollY.interpolate({
        inputRange: [0, FILTER_FADE_SCROLL_END],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    }),
    [filterScrollY],
  );

  const handleSelectTimeFilter = useCallback((filter: TransactionTimeFilter) => {
    handleChangeFilter(filter);
    if (floatingFilterVisible) {
      setFloatingFilterVisible(false);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [handleChangeFilter, floatingFilterVisible]);

  useEffect(() => {
    const id = filterScrollY.addListener(({ value }) => {
      listScrollYRef.current = value;

      if (value >= FILTER_HIDDEN_SCROLL_ON && !filterCollapsedRef.current) {
        filterCollapsedRef.current = true;
        setIsFilterCollapsed(true);
      } else if (value <= FILTER_VISIBLE_SCROLL_OFF && filterCollapsedRef.current) {
        filterCollapsedRef.current = false;
        setIsFilterCollapsed(false);
      }

      let nextShowToggle = showFilterToggleRef.current;
      if (value >= FILTER_TOGGLE_SHOW_ON) nextShowToggle = true;
      else if (value <= FILTER_TOGGLE_SHOW_OFF) nextShowToggle = false;
      if (nextShowToggle !== showFilterToggleRef.current) {
        showFilterToggleRef.current = nextShowToggle;
        setShowFilterToggle(nextShowToggle);
      }
    });
    return () => filterScrollY.removeListener(id);
  }, [filterScrollY]);

  useEffect(() => {
    if (!isFilterCollapsed && floatingFilterVisible) {
      setFloatingFilterVisible(false);
    }
  }, [isFilterCollapsed, floatingFilterVisible]);

  useFocusEffect(
    useCallback(() => {
      if (!getAndClearTransactionListNeedsRefresh()) return;
      refresh();
      refreshFunds();
    }, [getAndClearTransactionListNeedsRefresh, refresh, refreshFunds]),
  );

  const getCategoryInfo = (categoryId: string, type: 'income' | 'expense') => {
    return type === 'income'
      ? getIncomeCategory(categoryId)
      : getExpenseCategory(categoryId);
  };

  const formatAmount = (amount: number, type: 'income' | 'expense') => {
    const prefix = type === 'income' ? '+' : '-';
    return `${prefix}${amount.toLocaleString('vi-VN')}đ`;
  };

  const applyTimeFilter = (items: TransactionRecord[]): TransactionRecord[] => {
    // Dữ liệu đã được filter theo timeFilter trên server,
    // ở client chỉ cần dùng trực tiếp (giữ lại để dễ mở rộng nếu cần).
    return items;
  };

  const formatDateLabel = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatTimeLabel = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const viewItems: TransactionViewItem[] = useMemo(() => {
    const byTime = applyTimeFilter(transactions);
    // mainTab 'debts' → chỉ giao dịch vay/nợ.
    // mainTab 'transactions':
    //   - Mặc định: loại tx vay/nợ khỏi list; nếu `showLoanInList` bật mới bao gồm.
    //   - 'all' / 'income' / 'expense' áp dụng theo type trên tập đã lọc vay/nợ ở trên.
    let byKind: TransactionRecord[];
    if (mainTab === 'debts') {
      byKind = byTime.filter(t => {
        if (t.isLoanMovement !== true) return false;
        if (loanDirectionFilter === 'all') return true;
        const debt = t.debtId ? debtById.get(t.debtId) : undefined;
        return debt?.direction === loanDirectionFilter;
      });
    } else {
      const base = showLoanInList
        ? byTime
        : byTime.filter(t => t.isLoanMovement !== true);
      byKind =
        typeFilter === 'all' ? base : base.filter(t => t.type === typeFilter);
    }

    const toViewItem = (t: TransactionRecord): TransactionViewItem => ({
      id: t.id,
      categoryId: t.categoryId,
      amount: t.amount,
      type: t.type,
      note: t.note ?? '',
      fundId: t.fundId,
      isSplitIncome: t.isSplitIncome === true,
      incomeSplits: t.incomeSplits ?? null,
      dateLabel: formatDateLabel(t.transactionDate),
      timeLabel: formatTimeLabel(t.transactionDate),
      rawDate: t.transactionDate,
      isLoanMovement: t.isLoanMovement === true,
      debtId: t.debtId ?? null,
    });

    // Gộp tx vay/nợ thành 1 big card theo debtId.
    const regularTxs = byKind.filter(t => t.isLoanMovement !== true);
    const loanTxs = byKind.filter(t => t.isLoanMovement === true);

    const regularItems: TransactionViewItem[] = regularTxs.map(toViewItem);

    const loanGroupMap = new Map<string, TransactionRecord[]>();
    for (const tx of loanTxs) {
      const key = tx.debtId ?? `__orphan_${tx.id}`;
      const arr = loanGroupMap.get(key);
      if (arr) arr.push(tx);
      else loanGroupMap.set(key, [tx]);
    }

    const loanGroupItems: TransactionViewItem[] = Array.from(
      loanGroupMap.entries(),
    ).map(([groupKey, txs]) => {
      const sortedTxs = [...txs].sort(
        (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime(),
      );
      const latestTx = sortedTxs[0];
      const debtId = groupKey.startsWith('__orphan_') ? '' : groupKey;
      const debt = debtId ? debtById.get(debtId) : undefined;

      const children: LoanGroupChild[] = sortedTxs.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        categoryId: t.categoryId,
        fundId: t.fundId ?? null,
        dateLabel: formatDateLabel(t.transactionDate),
        timeLabel: formatTimeLabel(t.transactionDate),
        rawDate: t.transactionDate,
        note: t.note ?? '',
      }));

      return {
        id: `loan_group_${groupKey}`,
        categoryId: 'loan_group',
        amount: 0,
        type: 'income',
        note: '',
        fundId: null,
        isSplitIncome: false,
        incomeSplits: null,
        dateLabel: formatDateLabel(latestTx.transactionDate),
        timeLabel: formatTimeLabel(latestTx.transactionDate),
        rawDate: latestTx.transactionDate,
        isLoanMovement: false,
        debtId: null,
        isLoanGroup: true,
        loanGroupData: {
          debtId,
          counterparty: debt?.counterparty ?? 'Khoản vay',
          direction: debt?.direction ?? 'lent',
          principal: debt?.principal ?? 0,
          remaining: debt ? debtRemaining(debt) : 0,
          children,
        },
      };
    });

    const all = [...regularItems, ...loanGroupItems];
    all.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
    return all;
  }, [transactions, activeFilter, typeFilter, mainTab, showLoanInList, loanDirectionFilter, debtById]);

  // totalIncome/Expense scope:
  //  - mainTab 'debts': chỉ tx vay/nợ
  //  - mainTab 'transactions':
  //      showLoanInList ON  → bao gồm cả tx vay/nợ vào tổng thu/chi
  //      showLoanInList OFF → chỉ tx thường
  const totalIncome = useMemo(() => {
    let scope: TransactionRecord[];
    if (mainTab === 'debts') {
      scope = transactions.filter(t => t.isLoanMovement === true);
    } else {
      scope = showLoanInList
        ? transactions
        : transactions.filter(t => t.isLoanMovement !== true);
    }
    return scope
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, mainTab, showLoanInList]);

  const totalExpense = useMemo(() => {
    let scope: TransactionRecord[];
    if (mainTab === 'debts') {
      scope = transactions.filter(t => t.isLoanMovement === true);
    } else {
      scope = showLoanInList
        ? transactions
        : transactions.filter(t => t.isLoanMovement !== true);
    }
    return scope
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, mainTab, showLoanInList]);

  const netAmount = useMemo(() => {
    // NET luôn là tổng thu - chi trong scope tab, không bị chip filter tác động.
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  const groupedByDate: TransactionGroup[] = useMemo(() => {
    const groups: { [key: string]: TransactionViewItem[] } = {};

    viewItems.forEach(t => {
      if (!groups[t.dateLabel]) {
        groups[t.dateLabel] = [];
      }
      groups[t.dateLabel].push(t);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      transactions: items,
      // Daily total loại loan group (card gộp không phải luồng tiền thực của ngày).
      total: items.reduce((sum, t) => {
        if (t.isLoanGroup) return sum;
        return sum + (t.type === 'expense' ? -t.amount : t.amount);
      }, 0),
    }));
  }, [viewItems]);


  const renderLoanTransactionItem = (item: TransactionViewItem) => {
    const debt = item.debtId ? debtById.get(item.debtId) : undefined;
    const counterparty = debt?.counterparty ?? 'Khoản vay/nợ';

    let loanLabel = 'Vay/Nợ';
    let accentColor = colors.primary;
    switch (item.categoryId) {
      case LOAN_CATEGORY_IDS.lent:
        loanLabel = 'Cho vay';
        accentColor = colors.error;
        break;
      case LOAN_CATEGORY_IDS.borrowed:
        loanLabel = 'Đi vay';
        accentColor = colors.success;
        break;
      case LOAN_CATEGORY_IDS.repayReceived:
        loanLabel = 'Thu nợ';
        accentColor = colors.success;
        break;
      case LOAN_CATEGORY_IDS.repayPaid:
        loanLabel = 'Trả nợ';
        accentColor = colors.error;
        break;
    }

    const fundLabel = (() => {
      if (item.fundId && fundNameById.has(item.fundId)) {
        return `Quỹ: ${fundNameById.get(item.fundId) ?? 'Quỹ'}`;
      }
      return 'Quỹ: Quỹ đã bị xóa';
    })();

    return (
      <View style={styles.transactionItem}>
        <View style={[styles.transactionIcon, { backgroundColor: accentColor + '15' }]}>
          <WalletIcon width={22} height={22} color={accentColor} />
        </View>
        <View style={styles.transactionInfo}>
          <View style={styles.loanTitleRow}>
            <Text style={styles.transactionCategory} numberOfLines={1}>
              {counterparty}
            </Text>
            <View style={[styles.loanBadge, { backgroundColor: accentColor + '20' }]}>
              <Text style={[styles.loanBadgeText, { color: accentColor }]}>{loanLabel}</Text>
            </View>
          </View>
          {!!item.note && (
            <Text style={styles.transactionNote} numberOfLines={1}>
              {item.note}
            </Text>
          )}
          <Text
            style={[
              styles.transactionFund,
              fundLabel.includes('Quỹ đã bị xóa') && { color: colors.error + '90' },
            ]}
            numberOfLines={1}
          >
            {fundLabel}
          </Text>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: item.type === 'income' ? colors.success : colors.error },
            ]}
          >
            {formatAmount(item.amount, item.type)}
          </Text>
          <Text style={styles.transactionTime}>{item.timeLabel}</Text>
        </View>
      </View>
    );
  };

  const openDeleteDebtModal = (debt: DebtRecord) => {
    setDeleteDebtTarget(debt);
    setDeleteDebtFundId(debt.fundId || fundsDefaultFirst[0]?.id || '');
    setDeleteDebtOffsetId('');
  };

  const closeDeleteDebtModal = useCallback(() => {
    if (isDeletingDebt) return;
    setDeleteDebtTarget(null);
    setDeleteDebtFundId('');
    setDeleteDebtOffsetId('');
  }, [isDeletingDebt]);

  const handleConfirmDeleteDebt = async () => {
    if (!deleteDebtTarget) return;
    const rem = debtRemaining(deleteDebtTarget);
    if (rem > 0 && !deleteDebtFundId) {
      showErrorModal('Lỗi', 'Vui lòng chọn quỹ');
      return;
    }
    setIsDeletingDebt(true);
    try {
      await deleteDebtFromCtx(
        deleteDebtTarget.id,
        rem > 0
          ? {
              refundFundId: deleteDebtFundId,
              offsetSourceFundId: deleteDebtOffsetId || undefined,
            }
          : undefined,
      );
      setDeleteDebtTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa';
      showErrorModal('Lỗi', msg);
    } finally {
      setIsDeletingDebt(false);
    }
  };

  const renderLoanGroupItem = (item: TransactionViewItem) => {
    const data = item.loanGroupData;
    if (!data) return null;
    const isLent = data.direction === 'lent';
    const accentColor = isLent ? colors.success : colors.error;
    const paid = data.principal - data.remaining;
    const pct = data.principal > 0 ? Math.min(100, (paid / data.principal) * 100) : 0;
    const isSettled = data.remaining <= 0 && data.principal > 0;

    const childLabel = (catId: string): string => {
      switch (catId) {
        case LOAN_CATEGORY_IDS.lent:
          return 'Cho vay';
        case LOAN_CATEGORY_IDS.borrowed:
          return 'Đi vay';
        case LOAN_CATEGORY_IDS.repayReceived:
          return 'Thu';
        case LOAN_CATEGORY_IDS.repayPaid:
          return 'Trả';
        default:
          return 'Giao dịch';
      }
    };

    const openDetail = () => {
      if (data.debtId) {
        navigation.navigate('DebtDetail', { debtId: data.debtId });
      }
    };

    const debtForSwipe = data.debtId ? debtById.get(data.debtId) : undefined;

    return (
      <SwipeableRow
        onDelete={
          debtForSwipe ? () => openDeleteDebtModal(debtForSwipe) : undefined
        }
        deleteText="Xóa"
        borderRadius={14}
        buttonWidth={70}
      >
      <TouchableOpacity
        style={styles.loanGroupCard}
        onPress={openDetail}
        activeOpacity={0.8}
        disabled={!data.debtId}
      >
        <View style={styles.loanGroupHeader}>
          <View style={[styles.loanGroupIcon, { backgroundColor: accentColor + '18' }]}>
            <WalletIcon width={22} height={22} color={accentColor} />
          </View>
          <View style={styles.loanGroupHeaderInfo}>
            <View style={styles.loanGroupTitleRow}>
              <Text style={styles.loanGroupTitle} numberOfLines={1}>
                {data.counterparty}
              </Text>
              <View
                style={[
                  styles.loanGroupDirectionBadge,
                  {
                    backgroundColor: isLent
                      ? colors.success + '20'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.loanGroupDirectionText,
                    { color: isLent ? colors.success : '#B91C1C' },
                  ]}
                >
                  {isLent ? 'Cho vay' : 'Đi vay'}
                </Text>
              </View>
              {isSettled && (
                <View style={styles.loanGroupSettledBadge}>
                  <CheckIcon width={12} height={12} color={colors.success} />
                  <Text style={styles.loanGroupSettledText}>Đã tất toán</Text>
                </View>
              )}
            </View>
            <View style={styles.loanGroupAmountRow}>
              <Text style={styles.loanGroupAmountLabel}>Còn lại</Text>
              <Text style={[styles.loanGroupRemain, { color: accentColor }]}>
                {data.remaining.toLocaleString('vi-VN')}đ
              </Text>
              <Text style={styles.loanGroupAmountSep}>•</Text>
              <Text style={styles.loanGroupAmountLabel}>Gốc</Text>
              <Text style={styles.loanGroupPrincipal}>
                {data.principal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>
        </View>

        {data.principal > 0 && (
          <View style={styles.loanGroupProgressTrack}>
            <View
              style={[
                styles.loanGroupProgressFill,
                { width: `${pct}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
        )}

        {data.children.length > 0 && (
          <View style={styles.loanGroupChildren}>
            {data.children.map((child) => {
              const label = childLabel(child.categoryId);
              const isIncomeChild = child.type === 'income';
              const sign = isIncomeChild ? '+' : '-';
              const amountColor = isIncomeChild ? colors.success : colors.error;
              const fundName =
                child.fundId && fundNameById.has(child.fundId)
                  ? (fundNameById.get(child.fundId) as string)
                  : null;
              return (
                <View key={child.id} style={styles.loanGroupChildRow}>
                  <View style={styles.loanGroupChildLeft}>
                    <View
                      style={[
                        styles.loanGroupChildDot,
                        { backgroundColor: amountColor },
                      ]}
                    />
                    <View style={styles.loanGroupChildInfo}>
                      <View style={styles.loanGroupChildTopRow}>
                        <Text style={styles.loanGroupChildLabel}>{label}</Text>
                        <Text style={styles.loanGroupChildDate}>
                          {child.dateLabel} • {child.timeLabel}
                        </Text>
                      </View>
                      {fundName && (
                        <Text style={styles.loanGroupChildFund} numberOfLines={1}>
                          Quỹ: {fundName}
                        </Text>
                      )}
                      {child.note ? (
                        <Text
                          style={styles.loanGroupChildNote}
                          numberOfLines={1}
                        >
                          {child.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.loanGroupChildAmount, { color: amountColor }]}>
                    {sign}
                    {child.amount.toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderTransactionItem = ({ item }: { item: TransactionViewItem }) => {
    // Card gộp khoản vay/nợ.
    if (item.isLoanGroup) {
      return renderLoanGroupItem(item);
    }
    // Giao dịch vay/nợ đơn lẻ (khi không có debtId): render dạng cũ có badge.
    if (item.isLoanMovement) {
      return renderLoanTransactionItem(item);
    }

    const category = getCategoryInfo(item.categoryId, item.type);
    if (!category) return null;

    const IconComponent = category.icon;

    const isSplitIncomeItem =
      item.type === 'income' &&
      item.isSplitIncome &&
      item.incomeSplits &&
      item.incomeSplits.length > 0;

    const splitFundLines =
      isSplitIncomeItem && item.incomeSplits
        ? (() => {
            const byFund = new Map<string, { name: string; amount: number; isDeleted: boolean }>();
            item.incomeSplits.forEach(split => {
              const key = split.fundId || '__missing';
              const hasFund = !!(split.fundId && fundNameById.has(split.fundId));
              const name =
                (split.fundId && fundNameById.get(split.fundId)) || 'Quỹ đã bị xóa';
              const amount = split.amount || 0;
              const prev = byFund.get(key);
              if (prev) {
                prev.amount += amount;
              } else {
                byFund.set(key, { name, amount, isDeleted: !hasFund });
              }
            });
            return Array.from(byFund.values());
          })()
        : [];

    const fundLabel = (() => {
      if (isSplitIncomeItem) {
        return 'Quỹ:'; // tiêu đề, các dòng chi tiết nằm dưới
      }

      if (item.fundId && fundNameById.has(item.fundId)) {
        const name = fundNameById.get(item.fundId) ?? 'Quỹ';
        return `Quỹ: ${name}`;
      }
      return 'Quỹ: Quỹ đã bị xóa';
    })();

    const handleEdit = () => {
      navigation.navigate('AddTransaction', {
        mode: 'edit',
        transactionId: item.id,
        initialData: {
          type: item.type,
          categoryId: item.categoryId,
          amount: item.amount,
          note: item.note,
          fundId: item.fundId ?? undefined,
          transactionDate: item.rawDate.toISOString(),
        },
      });
    };

    const handleDelete = async () => {
      if (item.type === 'income' && item.isSplitIncome && item.incomeSplits && item.incomeSplits.length > 0) {
        // Giao dịch thu đã chia quỹ: không cần chọn quỹ hoàn tiền, chỉ xác nhận.
        setDeleteItem(item);
        setDeleteRefundFundId(''); // không dùng
        setDeleteAffectFundsEnabled(true);
        setDeleteModalVisible(true);
        return;
      }

      const defaultFundId =
        fundsDefaultFirst.find(f => f.isDefault)?.id ?? fundsDefaultFirst[0]?.id ?? '';
      const initialRefundId =
        item.fundId && fundNameById.has(item.fundId)
          ? item.fundId
          : ''; // nếu quỹ gốc đã bị xóa, để trống để bắt user chọn quỹ hoàn tiền

      setDeleteItem(item);
      setDeleteRefundFundId(initialRefundId);
      setDeleteAffectFundsEnabled(true);
      setDeleteModalVisible(true);
    };

    return (
      <SwipeableRow
        // Tạm thời không cho sửa giao dịch
        onEdit={undefined}
        onDelete={handleDelete}
        borderRadius={14}
        
      >
        <TouchableOpacity style={styles.transactionItem} activeOpacity={0.7}>
          <View style={[styles.transactionIcon, { backgroundColor: category.color + '15' }]}>
            <IconComponent width={22} height={22} color={category.color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionCategory}>{category.name}</Text>
            {!!item.note && (
              <Text style={styles.transactionNote} numberOfLines={1}>
                {item.note}
              </Text>
            )}
            {isSplitIncomeItem ? (
              <View style={styles.transactionFundBlock}>
                <Text style={styles.transactionFundTitle}>Quỹ:</Text>
                {splitFundLines.map((entry, idx) => (
                  <Text
                    key={`${item.id}_fund_${idx}`}
                    style={
                      entry.isDeleted
                        ? styles.transactionFundDeleted
                        : styles.transactionFundLine
                    }
                    numberOfLines={1}
                  >
                    {`- ${entry.name}: +${entry.amount.toLocaleString('vi-VN')}đ`}
                  </Text>
                ))}
              </View>
            ) : (
              <Text
                style={[
                  styles.transactionFund,
                  fundLabel.includes('Quỹ đã bị xóa') && { color: colors.error + '90' },
                ]}
                numberOfLines={2}
              >
                {fundLabel}
              </Text>
            )}
          </View>
          <View style={styles.transactionRight}>
            <Text style={[
              styles.transactionAmount,
              { color: item.type === 'income' ? colors.success : colors.error }
            ]}>
              {formatAmount(item.amount, item.type)}
            </Text>
            <Text style={styles.transactionTime}>{item.timeLabel}</Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderDateGroup = ({ item }: { item: TransactionGroup }) => (
    <View style={styles.dateGroup}>
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{item.date}</Text>
        <Text style={[styles.dateTotal, { color: item.total >= 0 ? colors.success : colors.error }]}>
          {item.total >= 0 ? '+' : '-'}{Math.abs(item.total).toLocaleString('vi-VN')}đ
        </Text>
      </View>
      {item.transactions.map(transaction => (
        <View key={transaction.id} style={styles.swipeableWrapper}>
          {renderTransactionItem({ item: transaction })}
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Giao dịch</Text>
        <View style={styles.headerActions}>
          <Animated.View
            pointerEvents={showFilterToggle ? 'auto' : 'none'}
            style={{
              opacity: filterScrollY.interpolate({
                inputRange: [FILTER_EXPAND_THRESHOLD, FILTER_TOGGLE_SHOW_OFFSET, 76],
                outputRange: [0, 0.2, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: filterScrollY.interpolate({
                    inputRange: [FILTER_EXPAND_THRESHOLD, 76],
                    outputRange: [-8, 0],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: filterScrollY.interpolate({
                    inputRange: [FILTER_EXPAND_THRESHOLD, 76],
                    outputRange: [0.9, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          >
            <TouchableOpacity
              style={[
                styles.appbarFilterToggleButton,
                !isFilterCollapsed && styles.appbarFilterToggleButtonExpanded,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (isFilterCollapsed) {
                  setFloatingFilterVisible(prev => !prev);
                } else {
                  listRef.current?.scrollToOffset({
                    offset: FILTER_FADE_SCROLL_END,
                    animated: true,
                  });
                }
              }}
            >
              <FunnelIcon
                width={16}
                height={16}
                color={isFilterCollapsed ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={[
              styles.filterIconButton,
              isDateFilterActive && styles.filterIconButtonActive,
            ]}
            activeOpacity={0.7}
            onPress={openFilterModeModal}
          >
            <CalendarIcon
              width={20}
              height={20}
              color={isDateFilterActive ? colors.white : colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab chính: Thu chi / Vay nợ */}
      <View style={styles.mainTabBar}>
        {MAIN_TABS.map((tab) => {
          const isActive = mainTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.mainTab, isActive && styles.mainTabActive]}
              onPress={() => setMainTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.mainTabText, isActive && styles.mainTabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modal chọn chế độ lọc ngày */}
      <Modal
        isVisible={filterModeModalVisible}
        onBackdropPress={closeFilterModeModal}
        onBackButtonPress={closeFilterModeModal}
        style={styles.filterModal}
      >
        <View style={styles.filterModalContent}>
          <Text style={styles.filterModalTitle}>Lọc theo</Text>

          <TouchableOpacity
            style={styles.filterOptionRow}
            activeOpacity={0.7}
            onPress={() => handleSelectFilterMode('single')}
          >
            <View style={styles.filterOptionRadioOuter}>
              {dateFilterMode === 'single' && <View style={styles.filterOptionRadioInner} />}
            </View>
            <View style={styles.filterOptionTextWrap}>
              <Text style={styles.filterOptionTitle}>Theo 1 ngày</Text>
              <Text style={styles.filterOptionSubtitle}>
                Chỉ hiển thị giao dịch trong đúng 1 ngày chọn
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterOptionRow}
            activeOpacity={0.7}
            onPress={() => handleSelectFilterMode('range')}
          >
            <View style={styles.filterOptionRadioOuter}>
              {dateFilterMode === 'range' && <View style={styles.filterOptionRadioInner} />}
            </View>
            <View style={styles.filterOptionTextWrap}>
              <Text style={styles.filterOptionTitle}>Theo khoảng thời gian</Text>
              <Text style={styles.filterOptionSubtitle}>
                Lọc giao dịch từ ngày này đến ngày kia
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterOptionRow}
            activeOpacity={0.7}
            onPress={() => {
              const now = new Date();
              setMonthPickerYear(now.getFullYear());
              setFilterModeModalVisible(false);
              setMonthPickerVisible(true);
            }}
          >
            <View style={styles.filterOptionRadioOuter}>
              {/* dùng cùng radio với range/single, không cần highlight riêng */}
            </View>
            <View style={styles.filterOptionTextWrap}>
              <Text style={styles.filterOptionTitle}>Theo tháng</Text>
              <Text style={styles.filterOptionSubtitle}>
                Chọn 1 tháng bất kỳ để lọc giao dịch
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterOptionRow}
            activeOpacity={0.7}
            onPress={() => handleSelectFilterMode('none')}
          >
            <View style={styles.filterOptionRadioOuter}>
              {dateFilterMode === 'none' && <View style={styles.filterOptionRadioInner} />}
            </View>
            <View style={styles.filterOptionTextWrap}>
              <Text style={styles.filterOptionTitle}>Không lọc theo ngày</Text>
              <Text style={styles.filterOptionSubtitle}>
                Quay lại lọc theo Ngày/Tuần/Tháng/Năm
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal chọn quỹ bù khi xóa giao dịch thu chia quỹ mà một số quỹ không đủ tiền */}
      <Modal
        isVisible={splitDeficitModalVisible && !!deleteItem}
        onBackdropPress={() => setSplitDeficitModalVisible(false)}
        onBackButtonPress={() => setSplitDeficitModalVisible(false)}
        style={styles.adjustModal}
        useNativeDriver
        hideModalContentWhileAnimating
        avoidKeyboard
      >
        <View style={styles.adjustCard}>
          <Text style={styles.adjustTitle}>Thiếu tiền trong quỹ</Text>
          {deleteItem && (
            <>
              <Text style={styles.adjustMessage}>
                Một số quỹ (hoặc quỹ đã bị xóa) không đủ tiền để xóa khoản thu này.
              </Text>

              <View style={styles.deleteSplitCard}>
                <Text style={styles.deleteSplitHeader}>Chi tiết thiếu</Text>
                <Text style={styles.deleteSplitTotal}>
                  Tổng cần bù thêm:{' '}
                  <Text style={styles.deleteModalHighlight}>
                    {splitDeficits.reduce((sum, d) => sum + d.deficit, 0).toLocaleString('vi-VN')}đ
                  </Text>
                </Text>
                <View style={styles.deleteSplitList}>
                  {splitDeficits.map(d => {
                    const hasFund = fundNameById.has(d.fundId);
                    const name = hasFund
                      ? fundNameById.get(d.fundId) ?? 'Quỹ'
                      : 'Quỹ đã bị xóa khỏi hệ thống';
                    const actionLabel = hasFund ? 'thiếu' : 'cần trừ từ quỹ khác';
                    const amt = d.deficit.toLocaleString('vi-VN');
                    return (
                      <View key={d.fundId} style={styles.deleteSplitRow}>
                        <Text
                          style={[
                            styles.deleteSplitFund,
                            !hasFund && { color: colors.error + '90' },
                          ]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <Text style={styles.deleteSplitAmount}>
                          {actionLabel} {amt}đ
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.deleteSplitNote}>
                  Chọn một quỹ bên dưới để trừ bù phần thiếu.
                </Text>
              </View>

              <Text style={styles.adjustLabel}>Chọn quỹ để trừ bù phần thiếu</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.adjustFundRow}
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  const totalDeficit = splitDeficits.reduce(
                    (sum, d) => sum + d.deficit,
                    0,
                  );
                  const incomeSplitsByFund = new Map<string, number>();
                  deleteItem?.incomeSplits?.forEach(split => {
                    incomeSplitsByFund.set(split.fundId, split.amount);
                  });

                  return fundsDefaultFirst
                    .map(fund => {
                      const fundColor = fund.color ?? colors.primary;
                      const currentBalance = fund.balance ?? 0;
                      const ownSplit = incomeSplitsByFund.get(fund.id) ?? 0;
                      const ownTruable = Math.min(currentBalance, ownSplit);
                      const balanceAfterRevert = currentBalance - ownTruable;
                      const canUse = balanceAfterRevert >= totalDeficit;
                      if (!canUse) return null;

                      const isSelected = splitRefundFundId === fund.id;
                      return (
                        <TouchableOpacity
                          key={fund.id}
                          activeOpacity={0.75}
                          onPress={() => {
                            if (deleteSaving) return;
                            setSplitRefundFundId(fund.id);
                          }}
                          disabled={deleteSaving}
                          style={[
                            styles.adjustFundItem,
                            isSelected && {
                              borderColor: fundColor,
                              backgroundColor: fundColor + '10',
                            },
                          ]}
                        >
                          <View style={[styles.adjustFundIcon, { backgroundColor: fundColor + '20' }]}>
                            {(() => {
                              const FundIcon = getFundIconComponent(fund.icon);
                              return <FundIcon width={18} height={18} color={fundColor} />;
                            })()}
                          </View>
                          <View style={styles.adjustFundTextCol}>
                            <Text
                              style={[
                                styles.adjustFundName,
                                isSelected && { color: fundColor, fontWeight: '800' },
                              ]}
                              numberOfLines={1}
                            >
                              {fund.name}
                            </Text>
                            <Text style={styles.adjustFundBalance}>
                              {currentBalance.toLocaleString('vi-VN')}đ
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                    .filter(Boolean);
                })()}
              </ScrollView>

              <View style={styles.adjustButtons}>
                <TouchableOpacity
                  style={styles.adjustCancelButton}
                  activeOpacity={0.85}
                  onPress={() => setSplitDeficitModalVisible(false)}
                  disabled={deleteSaving}
                >
                  <Text style={styles.adjustCancelText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.adjustConfirmButton,
                    (!splitRefundFundId && fundsDefaultFirst.length > 0) &&
                      styles.adjustConfirmButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={deleteSaving || (!splitRefundFundId && fundsDefaultFirst.length > 0)}
                  onPress={async () => {
                    if (!deleteItem || !splitRefundFundId) return;
                    setDeleteSaving(true);
                    try {
                      const res = await deleteTransaction(deleteItem.id, {
                        refundFundId: splitRefundFundId,
                      });
                      if (res.ok) {
                        markHomeDataChanged();
                        setSplitDeficitModalVisible(false);
                        setDeleteItem(null);
                      } else {
                        showErrorModal(
                          'Không thể xóa giao dịch',
                          res.message ?? 'Vui lòng thử lại',
                        );
                      }
                    } finally {
                      setDeleteSaving(false);
                    }
                  }}
                >
                  {deleteSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.adjustConfirmText}>Xóa</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal
        isVisible={monthPickerVisible}
        onBackdropPress={() => setMonthPickerVisible(false)}
        onBackButtonPress={() => setMonthPickerVisible(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.monthPickerCard}>
          <View style={styles.monthPickerHeader}>
            <TouchableOpacity
              onPress={() => setMonthPickerVisible(false)}
              activeOpacity={0.7}
            >
              <View style={styles.monthPickerBack}>
                <ChevronLeftIcon width={18} height={18} color={colors.text} />
              </View>
            </TouchableOpacity>
            <Text style={styles.monthPickerTitle}>Chọn tháng</Text>
            <TouchableOpacity
              onPress={() => setMonthPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.monthPickerClose}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <MonthPicker
            year={monthPickerYear}
            selectedMonth={(fromDate ?? new Date()).getMonth()}
            onChangeYear={setMonthPickerYear}
            onSelectMonth={monthIndex => {
              const start = new Date(monthPickerYear, monthIndex, 1, 0, 0, 0, 0);
              const end = new Date(monthPickerYear, monthIndex + 1, 0, 23, 59, 59, 999);
              setFromDate(start);
              setToDate(end);
              setDateFilterMode('range');
              setIsCustomDate(true);
              setMonthPickerVisible(false);
            }}
          />
        </View>
      </Modal>

      <ErrorPopup
        visible={errorModalVisible}
        title={errorModalTitle}
        message={errorModalMessage}
        onClose={() => setErrorModalVisible(false)}
      />

      {/* Modal xóa khoản nợ (trigger từ swipe trên loan group card) */}
      <Modal
        isVisible={!!deleteDebtTarget}
        onBackdropPress={closeDeleteDebtModal}
        onBackButtonPress={closeDeleteDebtModal}
        style={styles.debtDeleteModal}
        avoidKeyboard
      >
        <View style={styles.debtDeleteContent}>
          {deleteDebtTarget && (() => {
            const isLent = deleteDebtTarget.direction === 'lent';
            const rem = debtRemaining(deleteDebtTarget);
            const primaryFund = funds.find((f) => f.id === deleteDebtFundId);
            const primaryBalance = primaryFund?.balance ?? 0;
            const needsOffset = !isLent && rem > 0 && primaryBalance < rem;
            const deficit = needsOffset ? rem - primaryBalance : 0;

            return (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.debtDeleteBody}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.debtDeleteTitle}>Xóa khoản nợ</Text>
                <Text style={styles.debtDeleteSubtitle}>
                  {deleteDebtTarget.counterparty} •{' '}
                  {rem > 0 ? (
                    <>
                      Chưa thanh toán{' '}
                      <Text style={styles.debtDeleteRefundAmount}>
                        {rem.toLocaleString('vi-VN')}đ
                      </Text>
                    </>
                  ) : (
                    'Đã tất toán'
                  )}
                </Text>

                {rem > 0 && (
                  <>
                    <Text style={styles.debtDeleteHint}>
                      Các giao dịch đã trả/thu trước đó được giữ nguyên trong quỹ.
                      Chỉ phần chưa thanh toán sẽ được{' '}
                      {isLent ? 'cộng vào' : 'trừ khỏi'} quỹ bạn chọn.
                    </Text>

                    <Text style={styles.debtDeleteLabel}>
                      {isLent ? 'Quỹ nhận lại' : 'Quỹ trừ tiền'}
                    </Text>
                    <View style={styles.debtDeleteFundRow}>
                      {fundsDefaultFirst.map((f) => {
                        const isSelected = deleteDebtFundId === f.id;
                        const c = f.color ?? colors.primary;
                        return (
                          <TouchableOpacity
                            key={f.id}
                            style={[
                              styles.debtDeleteFundItem,
                              isSelected && { borderColor: c },
                            ]}
                            onPress={() => {
                              setDeleteDebtFundId(f.id);
                              setDeleteDebtOffsetId('');
                            }}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.debtDeleteFundIcon,
                                { backgroundColor: c + '20' },
                              ]}
                            >
                              {(() => {
                                const FundIcon = getFundIconComponent(f.icon);
                                return <FundIcon width={18} height={18} color={c} />;
                              })()}
                            </View>
                            <View style={styles.debtDeleteFundTextCol}>
                              <Text
                                style={[
                                  styles.debtDeleteFundText,
                                  isSelected && { color: c },
                                ]}
                                numberOfLines={1}
                              >
                                {f.name}
                              </Text>
                              <Text style={styles.debtDeleteFundBalance}>
                                {(f.balance ?? 0).toLocaleString('vi-VN')}đ
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {needsOffset && (
                      <>
                        <View style={styles.debtDeleteDeficit}>
                          <Text style={styles.debtDeleteDeficitTitle}>
                            "{primaryFund?.name ?? 'Quỹ'}" không đủ
                          </Text>
                          <Text style={styles.debtDeleteDeficitText}>
                            Thiếu {deficit.toLocaleString('vi-VN')}đ. Chọn quỹ khác
                            để cấn trừ phần còn thiếu.
                          </Text>
                        </View>
                        <Text style={styles.debtDeleteLabel}>Cấn trừ từ</Text>
                        {(() => {
                          const candidates = fundsDefaultFirst.filter(
                            (f) =>
                              f.id !== deleteDebtFundId && (f.balance ?? 0) >= deficit,
                          );
                          if (!candidates.length) {
                            return (
                              <Text style={styles.debtDeleteNoCandidate}>
                                Không có quỹ nào đủ số dư để cấn trừ.
                              </Text>
                            );
                          }
                          return (
                            <View style={styles.debtDeleteFundRow}>
                              {candidates.map((f) => {
                                const isSelected = deleteDebtOffsetId === f.id;
                                const c = f.color ?? colors.primary;
                                return (
                                  <TouchableOpacity
                                    key={f.id}
                                    style={[
                                      styles.debtDeleteFundItem,
                                      isSelected && { borderColor: c },
                                    ]}
                                    onPress={() => setDeleteDebtOffsetId(f.id)}
                                    activeOpacity={0.75}
                                  >
                                    <View
                                      style={[
                                        styles.debtDeleteFundIcon,
                                        { backgroundColor: c + '20' },
                                      ]}
                                    >
                                      {(() => {
                                        const FundIcon = getFundIconComponent(f.icon);
                                        return <FundIcon width={18} height={18} color={c} />;
                                      })()}
                                    </View>
                                    <View style={styles.debtDeleteFundTextCol}>
                                      <Text
                                        style={[
                                          styles.debtDeleteFundText,
                                          isSelected && { color: c },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {f.name}
                                      </Text>
                                      <Text style={styles.debtDeleteFundBalance}>
                                        {(f.balance ?? 0).toLocaleString('vi-VN')}đ
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </>
                    )}
                  </>
                )}

                {rem === 0 && (
                  <Text style={styles.debtDeleteHint}>
                    Xóa khoản nợ này khỏi danh sách. Các giao dịch liên kết cũng bị xóa.
                  </Text>
                )}
              </ScrollView>
            );
          })()}

          <View style={styles.debtDeleteButtons}>
            <TouchableOpacity
              style={styles.debtDeleteCancel}
              onPress={closeDeleteDebtModal}
              disabled={isDeletingDebt}
              activeOpacity={0.85}
            >
              <Text style={styles.debtDeleteCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.debtDeleteConfirm,
                (() => {
                  if (!deleteDebtTarget) return { opacity: 0.5 };
                  const isLent = deleteDebtTarget.direction === 'lent';
                  const rem = debtRemaining(deleteDebtTarget);
                  if (rem > 0 && !deleteDebtFundId) return { opacity: 0.5 };
                  if (rem > 0 && !isLent) {
                    const primary = funds.find((f) => f.id === deleteDebtFundId);
                    const needsOff = (primary?.balance ?? 0) < rem;
                    if (needsOff && !deleteDebtOffsetId) return { opacity: 0.5 };
                  }
                  return null;
                })(),
              ]}
              onPress={handleConfirmDeleteDebt}
              disabled={(() => {
                if (isDeletingDebt) return true;
                if (!deleteDebtTarget) return true;
                const isLent = deleteDebtTarget.direction === 'lent';
                const rem = debtRemaining(deleteDebtTarget);
                if (rem > 0 && !deleteDebtFundId) return true;
                if (rem > 0 && !isLent) {
                  const primary = funds.find((f) => f.id === deleteDebtFundId);
                  const needsOff = (primary?.balance ?? 0) < rem;
                  if (needsOff && !deleteDebtOffsetId) return true;
                }
                return false;
              })()}
              activeOpacity={0.85}
            >
              {isDeletingDebt ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.debtDeleteConfirmText}>Xóa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal bù tiền để xóa khoản thu khi quỹ không đủ */}
      <Modal
        isVisible={adjustModalVisible}
        onBackdropPress={closeAdjustModal}
        onBackButtonPress={closeAdjustModal}
        style={styles.adjustModal}
        useNativeDriver
        hideModalContentWhileAnimating
        avoidKeyboard
      >
        <View style={styles.adjustCard}>
          <Text style={styles.adjustTitle}>Số dư không đủ</Text>
          <Text style={styles.adjustMessage}>
            Bạn cần thêm{' '}
            <Text style={styles.adjustAmountStrong}>
              {adjustDeficit.toLocaleString('vi-VN')}đ
            </Text>{' '}
            vào &quot;{fundNameById.get(adjustTargetFundId) ?? 'Quỹ'}&quot; để có thể xóa giao dịch thu này.
            {'\n\n'}
            Bạn có muốn chuyển số tiền này từ quỹ bên dưới qua không?
          </Text>

          <Text style={styles.adjustLabel}>Chọn quỹ để trừ</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.adjustFundRow}
            keyboardShouldPersistTaps="handled"
          >
            {fundsDefaultFirst
              .filter(f => f.id !== adjustTargetFundId)
              .map(fund => {
                const isSelected = adjustSourceFundId === fund.id;
                const canUse = (fund.balance ?? 0) >= adjustDeficit && adjustDeficit > 0;
                const fundColor = fund.color ?? colors.primary;
                return (
                  <TouchableOpacity
                    key={fund.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (!canUse) return;
                      setAdjustSourceFundId(fund.id);
                    }}
                    disabled={!canUse || adjustSaving}
                    style={[
                      styles.adjustFundItem,
                      isSelected && { borderColor: fundColor, backgroundColor: fundColor + '10' },
                      (!canUse || adjustDeficit <= 0) && styles.adjustFundItemDisabled,
                    ]}
                  >
                    <View style={[styles.adjustFundIcon, { backgroundColor: fundColor + '20' }]}>
                      {(() => {
                        const FundIcon = getFundIconComponent(fund.icon);
                        return <FundIcon width={18} height={18} color={fundColor} />;
                      })()}
                    </View>
                    <View style={styles.adjustFundTextCol}>
                      <Text
                        style={[
                          styles.adjustFundName,
                          isSelected && { color: fundColor, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {fund.name}
                      </Text>
                      <Text style={styles.adjustFundBalance}>
                        {(fund.balance ?? 0).toLocaleString('vi-VN')}đ
                      </Text>
                      {!canUse && (
                        <Text style={styles.adjustFundHint}>Không đủ số dư</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          <View style={styles.adjustButtons}>
            <TouchableOpacity
              style={styles.adjustCancelButton}
              activeOpacity={0.85}
              onPress={closeAdjustModal}
              disabled={adjustSaving}
            >
              <Text style={styles.adjustCancelText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.adjustConfirmButton,
                (!adjustSourceFundId || adjustDeficit <= 0) && styles.adjustConfirmButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={async () => {
                if (!adjustTxId || !adjustTargetFundId) return;
                if (!adjustSourceFundId) {
                  showErrorModal('Thiếu thông tin', 'Vui lòng chọn quỹ để trừ tiền.');
                  return;
                }
                if (adjustDeficit <= 0) {
                  closeAdjustModal();
                  return;
                }

                setAdjustSaving(true);
                try {
                  const okTransfer = await transferToFund(
                    adjustTargetFundId,
                    adjustDeficit,
                    adjustSourceFundId,
                  );
                  if (!okTransfer) return;

                // Chuyển tiền xong thì xóa luôn giao dịch (case khoản thu đơn lẻ).
                const res = await deleteTransaction(adjustTxId, {
                  refundFundId: adjustTargetFundId,
                });
                if (res.ok) {
                  markHomeDataChanged();
                  closeAdjustModal();
                } else {
                  showErrorModal(
                    'Không thể xóa giao dịch',
                    res.message ?? 'Vui lòng thử lại',
                  );
                  }
                } finally {
                  setAdjustSaving(false);
                }
              }}
              disabled={!adjustSourceFundId || adjustDeficit <= 0 || adjustSaving}
            >
              {adjustSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.adjustConfirmText}>Chuyển &amp; xóa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal chọn quỹ hoàn tiền khi xóa giao dịch */}
      <Modal
        isVisible={deleteModalVisible && !!deleteItem}
        onBackdropPress={closeDeleteModal}
        onBackButtonPress={closeDeleteModal}
        style={styles.adjustModal}
        useNativeDriver
        hideModalContentWhileAnimating
        avoidKeyboard
      >
        <View style={styles.adjustCard}>
          <Text style={styles.adjustTitle}>Xác nhận xóa</Text>
          {deleteItem && (
            <>
              <View style={styles.sourceToggleRow}>
                <Text style={styles.inputLabel}>
                  {deleteItem.type === 'expense'
                    ? 'Hoàn tiền về quỹ'
                    : 'Trừ tiền vào quỹ'}
                </Text>
                <Switch
                  value={deleteAffectFundsEnabled}
                  onValueChange={setDeleteAffectFundsEnabled}
                  thumbColor={deleteAffectFundsEnabled ? colors.white : colors.white}
                  trackColor={{
                    false: colors.backgroundSecondary,
                    true: colors.primary,
                  }}
                />
              </View>

              <Text style={styles.adjustMessage}>
                Bạn có chắc muốn xóa giao dịch này?
                {'\n\n'}
                {(() => {
                  const amountLabel = `${deleteItem.amount.toLocaleString('vi-VN')}đ`;
                  if (
                    deleteItem.type === 'income' &&
                    deleteItem.isSplitIncome &&
                    deleteItem.incomeSplits &&
                    deleteItem.incomeSplits.length > 0
                  ) {
                    if (!deleteAffectFundsEnabled) {
                      return (
                        `Đây là khoản thu đã được chia vào nhiều quỹ (tổng ${amountLabel}).\n` +
                        'Khi xóa, giao dịch này sẽ bị xóa nhưng không thay đổi số dư của các quỹ.'
                      );
                    }

                    return 'Đây là khoản thu đã được chia vào nhiều quỹ.';
                  }

                  const originalFundMissing =
                    !!deleteItem.fundId && !fundNameById.has(deleteItem.fundId);
                  const fundName = deleteRefundFundId
                    ? (fundNameById.get(deleteRefundFundId) ?? 'Quỹ')
                    : originalFundMissing
                    ? '— (chọn quỹ bên dưới)'
                    : 'Quỹ';
                  if (!deleteAffectFundsEnabled) {
                    return `Khi xóa, giao dịch này sẽ bị xóa nhưng không thay đổi số dư quỹ.`;
                  }
                  return deleteItem.type === 'expense'
                    ? `Khi xóa, ${amountLabel} sẽ được cộng lại vào "${fundName}".`
                    : `Khi xóa, ${amountLabel} sẽ bị trừ khỏi "${fundName}".`;
                })()}
              </Text>

              {deleteAffectFundsEnabled &&
                deleteItem.type === 'income' &&
                deleteItem.isSplitIncome &&
                deleteItem.incomeSplits &&
                deleteItem.incomeSplits.length > 0 && (
                  <View style={styles.deleteSplitCard}>
                    <Text style={styles.deleteSplitHeader}>Khoản thu chia nhiều quỹ</Text>
                    <Text style={styles.deleteSplitTotal}>
                      Tổng:{' '}
                      <Text style={styles.deleteModalHighlight}>
                        {deleteItem.amount.toLocaleString('vi-VN')}đ
                      </Text>
                    </Text>
                    <View style={styles.deleteSplitList}>
                      {deleteItem.incomeSplits.map(split => {
                        const hasFund = fundNameById.has(split.fundId);
                        const fundName = hasFund
                          ? fundNameById.get(split.fundId) ?? 'Quỹ'
                          : 'Quỹ đã bị xóa';
                        const amt = split.amount.toLocaleString('vi-VN');
                        return (
                          <View key={split.fundId} style={styles.deleteSplitRow}>
                            <Text
                              style={[
                                styles.deleteSplitFund,
                                !hasFund && { color: colors.error + '90' },
                              ]}
                              numberOfLines={1}
                            >
                              {fundName}
                            </Text>
                            <Text style={styles.deleteSplitAmount}>
                              -{amt}đ
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.deleteSplitNote}>
                      Khi xóa, số tiền sẽ được trừ khỏi các quỹ như trên.
                    </Text>
                  </View>
                )}

              {deleteAffectFundsEnabled && !(
                deleteItem.type === 'income' &&
                deleteItem.isSplitIncome &&
                deleteItem.incomeSplits &&
                deleteItem.incomeSplits.length > 0
              ) && (
                <>
                  <Text style={styles.adjustLabel}>Chọn quỹ để hoàn tiền</Text>
                  <ScrollView
                    ref={deleteFundScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.adjustFundRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {fundsDefaultFirst.map(fund => {
                      const isSelected = deleteRefundFundId === fund.id;
                      const fundColor = fund.color ?? colors.primary;
                      return (
                        <TouchableOpacity
                          key={fund.id}
                          activeOpacity={0.75}
                          onPress={() => setDeleteRefundFundId(fund.id)}
                          disabled={deleteSaving}
                          style={[
                            styles.adjustFundItem,
                            isSelected && { borderColor: fundColor, backgroundColor: fundColor + '10' },
                          ]}
                        >
                          <View style={[styles.adjustFundIcon, { backgroundColor: fundColor + '20' }]}>
                            {(() => {
                              const FundIcon = getFundIconComponent(fund.icon);
                              return <FundIcon width={18} height={18} color={fundColor} />;
                            })()}
                          </View>
                          <View style={styles.adjustFundTextCol}>
                            <Text
                              style={[
                                styles.adjustFundName,
                                isSelected && { color: fundColor, fontWeight: '800' },
                              ]}
                              numberOfLines={1}
                            >
                              {fund.name}
                            </Text>
                            <Text style={styles.adjustFundBalance}>
                              {(fund.balance ?? 0).toLocaleString('vi-VN')}đ
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <View style={styles.adjustButtons}>
                <TouchableOpacity
                  style={styles.adjustCancelButton}
                  activeOpacity={0.85}
                  onPress={closeDeleteModal}
                  disabled={deleteSaving}
                >
                  <Text style={styles.adjustCancelText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.adjustConfirmButton,
                    deleteAffectFundsEnabled &&
                      !deleteItem?.isSplitIncome &&
                      !deleteRefundFundId &&
                      fundsDefaultFirst.length > 0 &&
                      styles.adjustConfirmButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={
                    deleteSaving ||
                    (deleteAffectFundsEnabled &&
                      !deleteItem?.isSplitIncome &&
                      !deleteRefundFundId &&
                      fundsDefaultFirst.length > 0)
                  }
                  onPress={async () => {
                    if (!deleteItem) return;

                    const isSplitIncomeDelete =
                      deleteItem.type === 'income' &&
                      deleteItem.isSplitIncome &&
                      deleteItem.incomeSplits &&
                      deleteItem.incomeSplits.length > 0;

                    const targetFundId = isSplitIncomeDelete
                      ? (fundsDefaultFirst.find(f => f.isDefault)?.id ??
                        fundsDefaultFirst[0]?.id ??
                        null)
                      : deleteRefundFundId || (fundsDefaultFirst[0]?.id ?? '');

                    const skipFundChange = !deleteAffectFundsEnabled;

                    if (
                      !skipFundChange &&
                      isSplitIncomeDelete &&
                      deleteItem.type === 'income' &&
                      deleteItem.incomeSplits
                    ) {
                      // Giao dịch thu chia quỹ: tìm quỹ nào thiếu tiền, hiện modal chọn quỹ bù.
                      const deficits = deleteItem.incomeSplits
                        .map(split => {
                          const current = fundBalanceById.get(split.fundId) ?? 0;
                          const deficit = split.amount - current;
                          return deficit > 0
                            ? { fundId: split.fundId, deficit }
                            : null;
                        })
                        .filter(Boolean) as { fundId: string; deficit: number }[];

                      if (deficits.length > 0) {
                        const bufferFundId =
                          fundsDefaultFirst.find(f => f.isDefault)?.id ??
                          fundsDefaultFirst[0]?.id ??
                          '';
                        setSplitDeficits(deficits);
                        setSplitRefundFundId(bufferFundId);
                        setSplitDeficitModalVisible(true);
                        setDeleteModalVisible(false);
                        return;
                      }
                    }

                    if (
                      !skipFundChange &&
                      !isSplitIncomeDelete &&
                      deleteItem.type === 'income' &&
                      targetFundId
                    ) {
                      // Nếu là khoản THU đơn lẻ và quỹ chọn không đủ để hoàn tác (trừ tiền), mở modal đề nghị chuyển tiền bù thiếu.
                      const current = fundBalanceById.get(targetFundId) ?? 0;
                      if (current < deleteItem.amount) {
                        const deficit = Math.max(0, deleteItem.amount - current);
                        const sourceCandidates = fundsDefaultFirst.filter(
                          f => f.id !== targetFundId,
                        );
                        const preferredSourceId =
                          sourceCandidates.find(f => f.isDefault)?.id ??
                          sourceCandidates[0]?.id ??
                          '';

                        setAdjustTxId(deleteItem.id);
                        setAdjustTargetFundId(targetFundId);
                        setAdjustDeficit(deficit);
                        setAdjustSourceFundId(preferredSourceId);
                        setAdjustModalVisible(true);
                        closeDeleteModal();
                        return;
                      }
                    }

                    setDeleteSaving(true);
                    try {
                      const res = await deleteTransaction(deleteItem.id, {
                        refundFundId: skipFundChange ? null : targetFundId || null,
                        skipFundChange,
                      });
                      if (res.ok) {
                        markHomeDataChanged();
                        closeDeleteModal();
                      } else {
                        showErrorModal('Không thể xóa giao dịch', res.message ?? 'Vui lòng thử lại');
                      }
                    } finally {
                      setDeleteSaving(false);
                    }
                  }}
                >
                  {deleteSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.adjustConfirmText}>Xóa</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Animated.View style={[styles.filterClipOuter, filterClipLayoutStyle]}>
        <Animated.View
          style={[
            styles.filterAnimatedContainer,
            filterInnerAnimatedStyle,
            filterInnerScrollLiftStyle,
          ]}
          pointerEvents={isFilterCollapsed ? 'none' : 'auto'}
          renderToHardwareTextureAndroid
        >
        <View onLayout={onFilterPanelLayout}>
        <TransactionFilterPanel
          timeFilters={TIME_FILTERS}
          typeFilters={mainTab === 'debts' ? [] : TYPE_FILTERS}
          activeFilter={activeFilter}
          typeFilter={typeFilter}
          dateFilterMode={dateFilterMode}
          fromDate={fromDate}
          toDate={toDate}
          onChangeTimeFilter={handleSelectTimeFilter}
          onChangeTypeFilter={setTypeFilter}
          onSingleDateChange={(date: Date) => {
            setFromDate(date);
            setDateFilterMode('single');
            setIsCustomDate(true);
          }}
          onFromDateChange={handleFromDateChange}
          onToDateChange={handleToDateChange}
          onResetFilters={handleResetFilters}
          loanToggleVisible={mainTab === 'transactions'}
          showLoan={showLoanInList}
          onShowLoanChange={setShowLoanInListPersisted}
        />
        </View>
        </Animated.View>
      </Animated.View>

      {floatingFilterVisible && (
        <View style={styles.floatingFilterWrap} pointerEvents="box-none">
          <Pressable
            style={styles.floatingFilterBackdrop}
            onPress={() => setFloatingFilterVisible(false)}
          />
          <View style={[styles.floatingFilterCard, { marginTop: insets.top + 58 }]}>
            <TransactionFilterPanel
              timeFilters={TIME_FILTERS}
              typeFilters={mainTab === 'debts' ? [] : TYPE_FILTERS}
              activeFilter={activeFilter}
              typeFilter={typeFilter}
              dateFilterMode={dateFilterMode}
              fromDate={fromDate}
              toDate={toDate}
              onChangeTimeFilter={handleSelectTimeFilter}
              onChangeTypeFilter={setTypeFilter}
              onSingleDateChange={(date: Date) => {
                setFromDate(date);
                setDateFilterMode('single');
                setIsCustomDate(true);
              }}
              onFromDateChange={handleFromDateChange}
              onToDateChange={handleToDateChange}
              onResetFilters={handleResetFilters}
              loanToggleVisible={mainTab === 'transactions'}
              showLoan={showLoanInList}
              onShowLoanChange={setShowLoanInListPersisted}
            />
          </View>
        </View>
      )}

      <Animated.View style={[styles.belowFilterSection, belowFilterScrollLiftStyle]}>
        {/* Chip filter hướng vay (chỉ tab Vay nợ) */}
        {mainTab === 'debts' && (
          <View style={styles.loanDirectionRow}>
            {([
              { key: 'all', label: 'Tất cả' },
              { key: 'lent', label: 'Cho vay' },
              { key: 'borrowed', label: 'Đi vay' },
            ] as { key: LoanDirectionFilter; label: string }[]).map((opt) => {
              const isActive = loanDirectionFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.loanDirectionChip,
                    isActive && styles.loanDirectionChipActive,
                  ]}
                  onPress={() => setLoanDirectionFilter(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.loanDirectionChipText,
                      isActive && styles.loanDirectionChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Summary Card */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryItem, styles.summaryItemExpense]}>
              <View style={styles.summaryTitleRow}>
                <View
                  style={[styles.summaryIconCircle, { borderColor: colors.error }]}
                >
                  <Text style={[styles.summaryIconText, { color: colors.error }]}>
                    -
                  </Text>
                </View>
                <Text style={styles.summaryLabel}>
                  {mainTab === 'debts' ? 'Cho vay / Trả nợ' : 'Khoản chi'}
                </Text>
              </View>
              <Text style={[styles.summaryAmount, { color: colors.error }]}>
                {totalExpense.toLocaleString('vi-VN')}đ
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={[styles.summaryItem, styles.summaryItemIncome]}>
              <View style={styles.summaryTitleRow}>
                <View
                  style={[styles.summaryIconCircle, { borderColor: colors.success }]}
                >
                  <Text style={[styles.summaryIconText, { color: colors.success }]}>
                    +
                  </Text>
                </View>
                <Text style={styles.summaryLabel}>
                  {mainTab === 'debts' ? 'Đi vay / Thu nợ' : 'Khoản thu'}
                </Text>
              </View>
              <Text style={[styles.summaryAmount, { color: colors.success }]}>
                {totalIncome.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={styles.netInlineDivider} />
            <View style={styles.netInlineRow}>
              <Text style={styles.netLabel}>NET</Text>
              <Text
                style={[
                  styles.netAmount,
                  netAmount >= 0 ? { color: colors.success } : { color: colors.error },
                ]}
              >
                {netAmount >= 0 ? '+' : '-'}
                {Math.abs(netAmount).toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>
        </View>

        {/* Transaction List / Skeleton */}
        {((!isInitialized && transactions.length === 0) ||
          (isRefreshing && transactions.length === 0)) ? (
          <View style={styles.listContainer}>
            {/* Skeleton groups */}
            {Array.from({ length: 3 }).map((_, idx) => (
              <View key={idx} style={styles.skeletonDateGroup}>
                <View style={styles.skeletonDateHeader}>
                  <Skeleton width="40%" height={14} />
                  <Skeleton width={80} height={14} />
                </View>
                {Array.from({ length: 3 }).map((__, jdx) => (
                  <View key={jdx} style={styles.skeletonItemRow}>
                    <Skeleton width={46} height={46} radius={14} />
                    <View style={styles.skeletonItemText}>
                      <Skeleton width="60%" height={14} />
                      <View style={{ height: 6 }} />
                      <Skeleton width="40%" height={12} />
                    </View>
                    <View style={styles.skeletonItemAmount}>
                      <Skeleton width={70} height={14} />
                      <View style={{ height: 6 }} />
                      <Skeleton width={40} height={12} />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <AnimatedFlatList
            ref={listRef}
            style={styles.listFlex}
            data={groupedByDate}
            renderItem={renderDateGroup}
            keyExtractor={item => item.date}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: filterScrollY } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
              </View>
            }
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /** Summary + list: flex để list chiếm phần còn lại; translateY theo scroll không dùng layout */
  belowFilterSection: {
    flex: 1,
    minHeight: 0,
  },
  listFlex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  filterIconButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterIconButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterClipOuter: {
    width: '100%',
  },
  filterAnimatedContainer: {
    overflow: 'hidden',
  },
  floatingFilterWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  floatingFilterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black + '20',
  },
  floatingFilterCard: {
    marginTop: 88,
    marginHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.black + '20',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  typeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  mainTabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  mainTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mainTabTextActive: {
    color: colors.text,
    fontWeight: '800',
  },
  loanDirectionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  loanDirectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  loanDirectionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  loanDirectionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  loanDirectionChipTextActive: {
    color: colors.white,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.white,
  },
  typeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  typeFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeFilterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  typeFilterChipTextActive: {
    color: colors.white,
  },
  summaryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 20,
  },
  netInlineDivider: {
    marginTop: 12,
    marginBottom: 10,
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
  },
  netInlineRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  netAmount: {
    fontSize: 16,
    fontWeight: '900',
  },
  appbarFilterToggleButton: {
    borderRadius: 999,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '12',
  },
  appbarFilterToggleButtonExpanded: {
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  summaryItemExpense: {
    backgroundColor: colors.error + '0F',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  summaryItemIncome: {
    backgroundColor: colors.success + '0F',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  dateFilterLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dateFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dateFilterButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  datePickerHalf: {
    flex: 1,
  },
  resetFilterButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 25,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterIcon: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  filterModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  filterModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  filterOptionRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  filterOptionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  filterOptionTextWrap: {
    flex: 1,
  },
  filterOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  filterOptionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  monthPickerCard: {
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  monthPickerBack: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  monthPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  monthPickerClose: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  adjustModal: {
    justifyContent: 'center',
    margin: 0,
  },
  adjustCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    marginHorizontal: 16,
    shadowColor: colors.black + '15',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  adjustTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  adjustMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  deleteModalHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  deleteSplitCard: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  deleteSplitHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  deleteSplitTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  deleteSplitList: {
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  deleteSplitFund: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  deleteSplitAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  deleteSplitNote: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  adjustAmountStrong: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  adjustLabel: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  adjustFundRow: {
    paddingRight: 10,
    gap: 10,
  },
  adjustFundItem: {
    width: 160,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  adjustFundItemDisabled: {
    opacity: 0.5,
  },
  adjustFundIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  adjustFundTextCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  adjustFundName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  adjustFundBalance: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  adjustFundHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  adjustCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  adjustCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  adjustConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  adjustConfirmButtonDisabled: {
    opacity: 0.6,
  },
  adjustConfirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  skeletonDateGroup: {
    marginBottom: 20,
  },
  skeletonDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skeletonItemText: {
    flex: 1,
    marginHorizontal: 12,
  },
  skeletonItemAmount: {
    alignItems: 'flex-end',
    width: 80,
  },
  dateGroup: {
    marginBottom: 40,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  swipeableWrapper: {
    marginBottom: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  transactionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    // marginBottom: 1,
  },
  loanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loanBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  loanBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  loanGroupCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  loanGroupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  loanGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loanGroupHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  loanGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  loanGroupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  loanGroupDirectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  loanGroupDirectionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loanGroupSettledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.success + '20',
    marginLeft: 'auto',
  },
  loanGroupSettledText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  loanGroupAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  loanGroupAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  loanGroupAmountSep: {
    fontSize: 12,
    color: colors.textLight,
    marginHorizontal: 2,
  },
  loanGroupRemain: {
    fontSize: 14,
    fontWeight: '900',
  },
  loanGroupPrincipal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  loanGroupProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
    marginTop: 10,
  },
  loanGroupProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  loanGroupChildren: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    gap: 8,
  },
  loanGroupChildRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  loanGroupChildLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
  },
  loanGroupChildDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  loanGroupChildInfo: {
    flex: 1,
    gap: 2,
  },
  loanGroupChildTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  loanGroupChildLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  loanGroupChildDate: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  loanGroupChildFund: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  loanGroupChildNote: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  loanGroupChildAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  // Delete debt modal styles
  debtDeleteModal: {
    justifyContent: 'center',
    margin: 20,
  },
  debtDeleteContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  debtDeleteBody: {
    paddingBottom: 10,
    gap: 10,
  },
  debtDeleteTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  debtDeleteSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  debtDeleteRefundAmount: {
    fontWeight: '900',
    color: colors.text,
  },
  debtDeleteHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    fontStyle: 'italic',
    marginTop: 2,
  },
  debtDeleteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  debtDeleteFundRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  debtDeleteFundItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.white,
  },
  debtDeleteFundIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtDeleteFundTextCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  debtDeleteFundText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  debtDeleteFundBalance: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  debtDeleteDeficit: {
    marginTop: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.error + '12',
  },
  debtDeleteDeficitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.error,
  },
  debtDeleteDeficitText: {
    marginTop: 2,
    fontSize: 12,
    color: colors.error,
  },
  debtDeleteNoCandidate: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  debtDeleteButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  debtDeleteCancel: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  debtDeleteCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  debtDeleteConfirm: {
    flex: 1.4,
    backgroundColor: colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  debtDeleteConfirmText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.white,
  },
  transactionNote: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  transactionFund: {
    marginTop: 0,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
  },
  transactionFundBlock: {
    marginTop: 0,
  },
  transactionFundTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
  },
  transactionFundLine: {
    fontSize: 12,
    color: colors.textLight,
  },
  transactionFundDeleted: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error + '90',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  transactionTime: {
    fontSize: 12,
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  sourceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});

export default TransactionScreen;
