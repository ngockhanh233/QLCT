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
} from 'react-native';
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
}

const TIME_FILTERS: { key: TransactionTimeFilter; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year', label: 'Năm' },
];

type TransactionKindFilter = 'all' | 'income' | 'expense';

const TYPE_FILTERS: { key: TransactionKindFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'expense', label: 'Khoản chi' },
  { key: 'income', label: 'Khoản thu' },
];

const TransactionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { markHomeDataChanged, getAndClearTransactionListNeedsRefresh } = useHomeDataChanged();
  const [activeFilter, setActiveFilter] = useState<TransactionTimeFilter>('month');
  const [typeFilter, setTypeFilter] = useState<TransactionKindFilter>('all');
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
    const byType =
      typeFilter === 'all'
        ? byTime
        : byTime.filter(t => t.type === typeFilter);

    return byType.map(t => ({
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
    }));
  }, [transactions, activeFilter, typeFilter]);

  const totalIncome = useMemo(
    () =>
      transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const groupedByDate = useMemo(() => {
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
      total: items.reduce(
        (sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount),
        0,
      ),
    }));
  }, [viewItems]);


  const renderTransactionItem = ({ item }: { item: TransactionViewItem }) => {
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
              { color: item.type === 'income' ? colors.success : colors.text }
            ]}>
              {formatAmount(item.amount, item.type)}
            </Text>
            <Text style={styles.transactionTime}>{item.timeLabel}</Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  const renderDateGroup = ({ item }: { item: { date: string; transactions: TransactionViewItem[]; total: number } }) => (
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

      {/* Time Filter Tabs (chỉ hiện khi không lọc theo ngày tùy chọn) */}
      {dateFilterMode === 'none' && (
        <View style={styles.filterContainer}>
          {TIME_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive,
              ]}
              onPress={() => handleChangeFilter(filter.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === filter.key && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bộ lọc loại giao dịch: tất cả / chi tiêu / thu nhập */}
      <View style={styles.typeFilterRow}>
        {TYPE_FILTERS.map(filter => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.typeFilterChip,
              typeFilter === filter.key && styles.typeFilterChipActive,
            ]}
            onPress={() => setTypeFilter(filter.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeFilterChipText,
                typeFilter === filter.key && styles.typeFilterChipTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bộ lọc ngày: theo 1 ngày hoặc khoảng thời gian */}
      {dateFilterMode === 'single' && fromDate && (
        <View style={styles.dateFilterRow}>
          <View style={styles.datePickerHalf}>
            <DatePicker
              value={fromDate}
              onChange={(date: Date) => {
                setFromDate(date);
                setDateFilterMode('single');
                setIsCustomDate(true);
              }}
              label="Ngày"
              maxDate={new Date()}
            />
          </View>
          <TouchableOpacity
            style={styles.resetFilterButton}
            activeOpacity={0.7}
            onPress={handleResetFilters}
          >
            <Text style={styles.resetFilterIcon}>↺</Text>
          </TouchableOpacity>
        </View>
      )}

      {dateFilterMode === 'range' && (
        <View style={styles.dateFilterRow}>
          <View style={styles.datePickerHalf}>
            <DatePicker
              value={fromDate ?? new Date()}
              onChange={handleFromDateChange}
              label="Từ ngày"
              maxDate={toDate ?? new Date()}
            />
          </View>
          <View style={styles.datePickerHalf}>
            <DatePicker
              value={toDate ?? fromDate ?? new Date()}
              onChange={handleToDateChange}
              label="Đến ngày"
              minDate={fromDate ?? undefined}
              maxDate={new Date()}
            />
          </View>
          <TouchableOpacity
            style={styles.resetFilterButton}
            activeOpacity={0.7}
            onPress={handleResetFilters}
          >
            <Text style={styles.resetFilterIcon}>↺</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        {(typeFilter === 'all' || typeFilter === 'expense') && (
          <View style={styles.summaryItem}>
            <View style={styles.summaryTitleRow}>
              <View
                style={[styles.summaryIconCircle, { borderColor: colors.error }]}
              >
                <Text
                  style={[styles.summaryIconText, { color: colors.error }]}
                >
                  -
                </Text>
              </View>
              <Text style={styles.summaryLabel}>Khoản chi</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.error }]}>
              {totalExpense.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        )}

        {typeFilter === 'all' && <View style={styles.summaryDivider} />}

        {(typeFilter === 'all' || typeFilter === 'income') && (
          <View style={styles.summaryItem}>
            <View style={styles.summaryTitleRow}>
              <View
                style={[styles.summaryIconCircle, { borderColor: colors.success }]}
              >
                <Text
                  style={[styles.summaryIconText, { color: colors.success }]}
                >
                  +
                </Text>
              </View>
              <Text style={styles.summaryLabel}>Khoản thu</Text>
            </View>
            <Text style={[styles.summaryAmount, { color: colors.success }]}>
              {totalIncome.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        )}
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
        <FlatList
          data={groupedByDate}
          renderItem={renderDateGroup}
          keyExtractor={item => item.date}
          showsVerticalScrollIndicator={false}
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
  typeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
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
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
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
  },
  adjustFundItemDisabled: {
    opacity: 0.5,
  },
  adjustFundName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
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
