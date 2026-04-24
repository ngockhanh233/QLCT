import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { DatePicker } from '../../../../../components';
import { colors } from '../../../../../utils/color';
import type { TransactionTimeFilter } from '../hooks/useTransactions';

type TransactionKindFilter = 'all' | 'income' | 'expense';

type FilterOption<T extends string> = { key: T; label: string };

interface TransactionFilterPanelProps {
  timeFilters: FilterOption<TransactionTimeFilter>[];
  typeFilters: FilterOption<TransactionKindFilter>[];
  activeFilter: TransactionTimeFilter;
  typeFilter: TransactionKindFilter;
  dateFilterMode: 'none' | 'single' | 'range';
  fromDate: Date | null;
  toDate: Date | null;
  onChangeTimeFilter: (filter: TransactionTimeFilter) => void;
  onChangeTypeFilter: (filter: TransactionKindFilter) => void;
  onSingleDateChange: (date: Date) => void;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  onResetFilters: () => void;
  /** Toggle hiện/ẩn giao dịch vay nợ trong danh sách (chỉ dùng ở tab Thu chi). */
  loanToggleVisible?: boolean;
  showLoan?: boolean;
  onShowLoanChange?: (next: boolean) => void;
}

const TransactionFilterPanel: React.FC<TransactionFilterPanelProps> = ({
  timeFilters,
  typeFilters,
  activeFilter,
  typeFilter,
  dateFilterMode,
  fromDate,
  toDate,
  onChangeTimeFilter,
  onChangeTypeFilter,
  onSingleDateChange,
  onFromDateChange,
  onToDateChange,
  onResetFilters,
  loanToggleVisible = false,
  showLoan = false,
  onShowLoanChange,
}) => {
  return (
    <View>
      {dateFilterMode === 'none' && (
        <View style={styles.filterContainer}>
          {timeFilters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive,
              ]}
              onPress={() => onChangeTimeFilter(filter.key)}
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

      {(typeFilters.length > 0 || loanToggleVisible) && (
        <View style={styles.typeFilterRow}>
          <View style={styles.typeFilterChipsGroup}>
            {typeFilters.map(filter => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.typeFilterChip,
                  typeFilter === filter.key && styles.typeFilterChipActive,
                ]}
                onPress={() => onChangeTypeFilter(filter.key)}
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

          {loanToggleVisible && (
            <View style={styles.loanToggleWrap}>
              <Text style={styles.loanToggleLabel}>Vay nợ</Text>
              <Switch
                value={showLoan}
                onValueChange={onShowLoanChange}
                thumbColor={colors.white}
                trackColor={{
                  false: colors.backgroundSecondary,
                  true: colors.primary,
                }}
              />
            </View>
          )}
        </View>
      )}

      {dateFilterMode === 'single' && fromDate && (
        <View style={styles.dateFilterRow}>
          <View style={styles.datePickerHalf}>
            <DatePicker
              value={fromDate}
              onChange={onSingleDateChange}
              label="Ngày"
              maxDate={new Date()}
            />
          </View>
          <TouchableOpacity
            style={styles.resetFilterButton}
            activeOpacity={0.7}
            onPress={onResetFilters}
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
              onChange={onFromDateChange}
              label="Từ ngày"
              maxDate={toDate ?? new Date()}
            />
          </View>
          <View style={styles.datePickerHalf}>
            <DatePicker
              value={toDate ?? fromDate ?? new Date()}
              onChange={onToDateChange}
              label="Đến ngày"
              minDate={fromDate ?? undefined}
              maxDate={new Date()}
            />
          </View>
          <TouchableOpacity
            style={styles.resetFilterButton}
            activeOpacity={0.7}
            onPress={onResetFilters}
          >
            <Text style={styles.resetFilterIcon}>↺</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  typeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  typeFilterChipsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  loanToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loanToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
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
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
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
});

export default TransactionFilterPanel;
