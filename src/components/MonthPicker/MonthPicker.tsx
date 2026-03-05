import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../utils/color';

type MonthPickerProps = {
  year: number;
  selectedMonth: number; // 0-11
  onChangeYear?: (year: number) => void;
  onSelectMonth: (monthIndex: number) => void;
};

const MONTH_LABELS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const MonthPicker: React.FC<MonthPickerProps> = ({
  year,
  selectedMonth,
  onChangeYear,
  onSelectMonth,
}) => {
  const handlePrevYear = () => {
    onChangeYear?.(year - 1);
  };

  const handleNextYear = () => {
    onChangeYear?.(year + 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.yearCenter}>
          <View style={styles.yearInnerRow}>
            <TouchableOpacity
              style={styles.navButton}
              activeOpacity={0.7}
              onPress={handlePrevYear}
            >
              <Text style={styles.navText}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.yearText}>{year}</Text>
            <TouchableOpacity
              style={styles.navButton}
              activeOpacity={0.7}
              onPress={handleNextYear}
            >
              <Text style={styles.navText}>{'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        {MONTH_LABELS.map((label, index) => {
          const isActive = index === selectedMonth;
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.monthCell,
                isActive && styles.monthCellActive,
              ]}
              activeOpacity={0.8}
              onPress={() => onSelectMonth(index)}
            >
              <Text
                style={[
                  styles.monthLabel,
                  isActive && styles.monthLabelActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  yearInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  navText: {
    fontSize: 18,
    color: colors.primary,
  },
  yearCenter: {
    flex: 1,
    alignItems: 'center',
  },
  yearText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  monthCell: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellActive: {
    backgroundColor: colors.primary,
  },
  monthLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  monthLabelActive: {
    color: colors.white,
    fontWeight: '700',
  },
});

export default MonthPicker;

