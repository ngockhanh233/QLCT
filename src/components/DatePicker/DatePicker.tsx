import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { colors } from '../../utils/color';
import CalendarIcon from '../../assets/icons/CalendarIcon';

LocaleConfig.locales['vi'] = {
  monthNames: [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ],
  monthNamesShort: ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'],
  dayNames: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'],
  dayNamesShort: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  today: 'Hôm nay'
};
LocaleConfig.defaultLocale = 'vi';

const MONTHS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
}

type ViewMode = 'calendar' | 'month' | 'year';

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  label,
  minDate,
  maxDate,
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - 25 + i);

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForCalendar = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const onDayPress = (day: any) => {
    const [year, month, dayNum] = day.dateString.split('-').map(Number);
    onChange(new Date(year, month - 1, dayNum));
    setShowCalendar(false);
  };

  const getMinDateString = () => {
    return minDate ? formatDateForCalendar(minDate) : undefined;
  };

  const getMaxDateString = () => {
    return maxDate ? formatDateForCalendar(maxDate) : undefined;
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentMonth.getFullYear(), monthIndex, 1);
    setCurrentMonth(newDate);
    setViewMode('calendar');
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(newDate);
    setViewMode('month');
  };

  const renderMonthSelector = () => (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorHeader}>
        <TouchableOpacity onPress={() => setViewMode('year')}>
          <Text style={styles.selectorTitle}>{currentMonth.getFullYear()} ▼</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.monthGrid}>
        {MONTHS.map((month, index) => {
          const isSelected = currentMonth.getMonth() === index;
          const isCurrentMonth = new Date().getMonth() === index && 
                                  new Date().getFullYear() === currentMonth.getFullYear();
          return (
            <TouchableOpacity
              key={month}
              style={[
                styles.monthItem,
                isSelected && styles.monthItemSelected,
                isCurrentMonth && !isSelected && styles.monthItemCurrent,
              ]}
              onPress={() => handleMonthSelect(index)}
            >
              <Text style={[
                styles.monthText,
                isSelected && styles.monthTextSelected,
                isCurrentMonth && !isSelected && styles.monthTextCurrent,
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderYearSelector = () => (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorTitle}>Chọn năm</Text>
      </View>
      <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.yearGrid}>
          {years.map((year) => {
            const isSelected = currentMonth.getFullYear() === year;
            const isCurrentYear = new Date().getFullYear() === year;
            return (
              <TouchableOpacity
                key={year}
                style={[
                  styles.yearItem,
                  isSelected && styles.yearItemSelected,
                  isCurrentYear && !isSelected && styles.yearItemCurrent,
                ]}
                onPress={() => handleYearSelect(year)}
              >
                <Text style={[
                  styles.yearText,
                  isSelected && styles.yearTextSelected,
                  isCurrentYear && !isSelected && styles.yearTextCurrent,
                ]}>
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderCalendar = () => (
    <>
      <Calendar
        key={formatDateForCalendar(currentMonth)}
        current={formatDateForCalendar(currentMonth)}
        onDayPress={onDayPress}
        onMonthChange={(month: any) => {
          setCurrentMonth(new Date(month.year, month.month - 1, 1));
        }}
        minDate={getMinDateString()}
        maxDate={getMaxDateString()}
        markedDates={{
          [formatDateForCalendar(value)]: {
            selected: true,
            selectedColor: colors.primary,
          },
        }}
        enableSwipeMonths={true}
        renderHeader={(date: any) => {
          const dateObj = new Date(date);
          return (
            <TouchableOpacity 
              style={styles.customHeader}
              onPress={() => setViewMode('month')}
            >
              <Text style={styles.customHeaderText}>
                Tháng {dateObj.getMonth() + 1}, {dateObj.getFullYear()}
              </Text>
              <Text style={styles.customHeaderIcon}>▼</Text>
            </TouchableOpacity>
          );
        }}
        theme={{
          backgroundColor: colors.white,
          calendarBackground: colors.white,
          textSectionTitleColor: colors.textSecondary,
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: colors.white,
          todayTextColor: colors.primary,
          todayBackgroundColor: colors.primary + '15',
          dayTextColor: colors.text,
          textDisabledColor: colors.textLight,
          dotColor: colors.primary,
          selectedDotColor: colors.white,
          arrowColor: colors.primary,
          monthTextColor: colors.text,
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 15,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 13,
        }}
        style={styles.calendar}
      />
    </>
  );

  const handleClose = () => {
    setShowCalendar(false);
    setViewMode('calendar');
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => setShowCalendar(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <CalendarIcon width={20} height={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {viewMode !== 'calendar' && (
                  <TouchableOpacity 
                    onPress={() => setViewMode(viewMode === 'year' ? 'month' : 'calendar')}
                    style={styles.backButton}
                  >
                    <Text style={styles.backButtonText}>←</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.modalTitle}>
                  {viewMode === 'calendar' ? 'Chọn ngày' : 
                   viewMode === 'month' ? 'Chọn tháng' : 'Chọn năm'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.closeButton}>Đóng</Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'calendar' && renderCalendar()}
            {viewMode === 'month' && renderMonthSelector()}
            {viewMode === 'year' && renderYearSelector()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  calendar: {
    borderRadius: 12,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  customHeaderText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
  },
  customHeaderIcon: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 6,
  },
  selectorContainer: {
    minHeight: 280,
  },
  selectorHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthItem: {
    width: '30%',
    paddingVertical: 14,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  monthItemSelected: {
    backgroundColor: colors.primary,
  },
  monthItemCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  monthTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  monthTextCurrent: {
    color: colors.primary,
    fontWeight: '600',
  },
  yearScroll: {
    maxHeight: 280,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  yearItem: {
    width: '23%',
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  yearItemSelected: {
    backgroundColor: colors.primary,
  },
  yearItemCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  yearTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  yearTextCurrent: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default DatePicker;
