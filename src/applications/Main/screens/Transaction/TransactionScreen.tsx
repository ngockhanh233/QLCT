import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
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
import { Skeleton, SwipeableRow } from '../../../../components';
import { confirm } from '../../../../utils/confirm';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import type { RootStackParamList } from '../../MainScreen';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface TransactionViewItem {
  id: string;
  categoryId: string;
  amount: number;
  type: 'income' | 'expense';
  note: string;
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

  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(
    () => new Date().getFullYear(),
  );

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
    }, [getAndClearTransactionListNeedsRefresh, refresh]),
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

    const handleEdit = () => {
      navigation.navigate('AddTransaction', {
        mode: 'edit',
        transactionId: item.id,
        initialData: {
          type: item.type,
          categoryId: item.categoryId,
          amount: item.amount,
          note: item.note,
          transactionDate: item.rawDate.toISOString(),
        },
      });
    };

    const handleDelete = async () => {
      const ok = await confirm({
        title: 'Xác nhận xóa',
        message: 'Bạn có chắc muốn xóa giao dịch này?',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      });
      if (!ok) return;
      const deleted = await deleteTransaction(item.id);
      if (deleted) markHomeDataChanged();
    };

    return (
      <SwipeableRow
        onEdit={handleEdit}
        onDelete={handleDelete}
        borderRadius={14}
        
      >
        <TouchableOpacity style={styles.transactionItem} activeOpacity={0.7}>
          <View style={[styles.transactionIcon, { backgroundColor: category.color + '15' }]}>
            <IconComponent width={22} height={22} color={category.color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionCategory}>{category.name}</Text>
            <Text style={styles.transactionNote} numberOfLines={1}>{item.note}</Text>
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
              <Text style={styles.monthPickerBack}>{'←'}</Text>
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
    fontSize: 18,
    color: colors.text,
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
    marginBottom: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: 3,
  },
  transactionNote: {
    fontSize: 13,
    color: colors.textSecondary,
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
});

export default TransactionScreen;
