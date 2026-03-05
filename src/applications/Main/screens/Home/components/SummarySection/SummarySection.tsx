import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../../../../utils/color';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

interface SummarySectionProps {
  fixedIncomeTotal: number;
  fixedExpenseTotal: number;
  onViewAll?: () => void;
}

const SummarySection = ({
  fixedIncomeTotal,
  fixedExpenseTotal,
  onViewAll,
}: SummarySectionProps) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>Tóm tắt định kỳ</Text>
      <TouchableOpacity onPress={onViewAll}>
        <Text style={styles.viewAll}>Xem tất cả</Text>
      </TouchableOpacity>
    </View>

    {/* Income Card */}
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, styles.incomeIcon]}>
          <Text style={styles.cardIconText}>💰</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Thu nhập cố định</Text>
          <Text style={styles.cardSubtitle}>Tiền lương & Thưởng</Text>
        </View>
        <Text style={styles.incomeAmount}>+ {formatMoney(fixedIncomeTotal)}</Text>
      </View>
    </View>

    {/* Expense Card */}
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, styles.expenseIcon]}>
          <Text style={styles.cardIconText}>🏠</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Chi phí cố định</Text>
          <Text style={styles.cardSubtitle}>Tiền nhà & Điện nước</Text>
        </View>
        <Text style={styles.expenseAmount}>- {formatMoney(fixedExpenseTotal)}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  viewAll: {
    fontSize: 14,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.05,
    // shadowRadius: 8,
    // elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomeIcon: {
    backgroundColor: '#E8F5E9',
  },
  expenseIcon: {
    backgroundColor: '#FFF3E0',
  },
  cardIconText: {
    fontSize: 20,
  },
  cardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
});

export default SummarySection;
