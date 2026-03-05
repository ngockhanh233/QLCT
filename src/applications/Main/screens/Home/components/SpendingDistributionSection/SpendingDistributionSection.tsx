import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../../../../utils/color';
import { EXPENDITURE_CATEGORIES } from '../../../../../../constants/ExpenditureCategoryConstants';
import ChevronDownIcon from '../../../../../../assets/icons/ChevronDownIcon';
import type { ExpenseByCategory } from '../../hooks';

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

interface SpendingDistributionSectionProps {
  expenseByCategory: ExpenseByCategory[];
  /**
   * Tổng chi tiêu (không bao gồm khoản cố định), dùng để hiển thị ở header.
   */
  totalExpense?: number;
  /**
   * Có hiển thị nút "Thống kê chi tiết" hay không.
   * Mặc định: true (dùng cho trang Home).
   */
  showDetailButton?: boolean;
  /**
   * Callback khi bấm nút "Thống kê chi tiết".
   */
  onPressDetail?: () => void;
  /**
   * Callback khi bấm vào một danh mục trong danh sách.
   * Nhận vào categoryId của khoản chi.
   */
  onPressCategory?: (categoryId: string) => void;
}

const SpendingDistributionSection = ({
  expenseByCategory,
  totalExpense = 0,
  showDetailButton = true,
  onPressDetail,
  onPressCategory,
}: SpendingDistributionSectionProps) => {
  const getCategoryInfo = (categoryId: string) => {
    return EXPENDITURE_CATEGORIES.find(c => c.id === categoryId);
  };

  const hasData = expenseByCategory.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Phân bố chi tiêu</Text>
          <Text style={styles.subtitle}>(tháng này)</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalLabel}>Tổng chi tiêu</Text>
          <Text style={styles.totalAmount}>{formatAmount(totalExpense)}</Text>
        </View>
      </View>

      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chưa có chi tiêu trong tháng này</Text>
        </View>
      ) : (
        <>
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            {expenseByCategory.map((item, index) => {
              const category = getCategoryInfo(item.categoryId);
              const pct = Math.max(1, item.percentage);
              return (
                <View
                  key={item.categoryId}
                  style={[
                    styles.progressSegment,
                    {
                      width: `${pct}%`,
                      backgroundColor: category?.color || colors.textLight,
                      borderTopLeftRadius: index === 0 ? 8 : 0,
                      borderBottomLeftRadius: index === 0 ? 8 : 0,
                      borderTopRightRadius: index === expenseByCategory.length - 1 ? 8 : 0,
                      borderBottomRightRadius: index === expenseByCategory.length - 1 ? 8 : 0,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Category List */}
          <View style={styles.categoryList}>
            {expenseByCategory.map(item => {
              const category = getCategoryInfo(item.categoryId);
              if (!category) return null;

              const IconComponent = category.icon;

              return (
                <TouchableOpacity
                  key={item.categoryId}
                  style={styles.categoryItem}
                  activeOpacity={0.8}
                  onPress={() => onPressCategory?.(item.categoryId)}
                >
                  <View style={styles.categoryLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
                      <IconComponent width={20} height={20} color={category.color} />
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryPercentage}>{item.percentage}%</Text>
                    </View>
                  </View>
                  <Text style={styles.categoryAmount}>{formatAmount(item.amount)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Detail Button */}
      {showDetailButton && (
        <TouchableOpacity
          style={styles.detailButton}
          activeOpacity={0.8}
          onPress={onPressDetail}
        >
          <Text style={styles.detailButtonText}>Thống kê chi tiết</Text>
          <View style={styles.detailButtonIcon}>
            <ChevronDownIcon width={16} height={16} color={colors.white} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressSegment: {
    height: '100%',
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  detailButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    marginRight: 8,
  },
  detailButtonIcon: {
    transform: [{ rotate: '-90deg' }],
  },
});

export default SpendingDistributionSection;
