import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import { colors } from '../../../../utils/color';
import AddIcon from '../../../../assets/icons/AddIcon';
import { CurrencyInput, SwipeableRow, Skeleton } from '../../../../components';
import {
  getFixedIncomeCategory,
  getFixedExpenseCategory,
  getAllCategories,
} from '../../../../utils/categoryUtils';
import { useFixedItems, FixedItem } from './hooks';
import { TRANSACTION_TYPES, TransactionType } from '../../../../constants';
import { showSnackbar } from '../../../../utils/snackbar';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';

const BudgetScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { markHomeDataChanged } = useHomeDataChanged();
  const [activeTab, setActiveTab] = useState<TransactionType>(TRANSACTION_TYPES.INCOME);
  const [modalVisible, setModalVisible] = useState(false);
  const [newItemAmount, setNewItemAmount] = useState(0);
  const [newItemNote, setNewItemNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingItem, setEditingItem] = useState<FixedItem | null>(null);
  const [formError, setFormError] = useState<{
    field: 'amount' | 'category' | '';
    message: string;
  }>({ field: '', message: '' });

  const {
    fixedIncomeList,
    fixedExpenseList,
    fixedIncomeData,
    fixedExpenseData,
    isLoading,
    isSaving,
    addFixedItem,
    updateFixedItem,
    deleteFixedItem,
    refresh,
  } = useFixedItems();

  const fixedIncomeCategories = getAllCategories('fixed_income');
  const fixedExpenseCategories = getAllCategories('fixed_expense');

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString('vi-VN')}đ`;
  };

  const getCategoryInfo = (categoryId: string, type: TransactionType) => {
    return type === TRANSACTION_TYPES.INCOME 
      ? getFixedIncomeCategory(categoryId)
      : getFixedExpenseCategory(categoryId);
  };

  const handleEdit = (item: FixedItem) => {
    setEditingItem(item);
    setSelectedCategory(item.categoryId);
    setNewItemAmount(item.amount);
    setNewItemNote(item.note || '');
    setModalVisible(true);
  };

  const handleDelete = async (item: FixedItem) => {
    const ok = await deleteFixedItem(item);
    if (ok) markHomeDataChanged();
  };

  const renderFixedItem = (item: FixedItem, type: TransactionType) => {
    const category = getCategoryInfo(item.categoryId, type);
    const IconComponent = category.icon;
    const isIncome = type === TRANSACTION_TYPES.INCOME;

    return (
      <View key={item.id} style={styles.swipeableContainer}>
        <SwipeableRow
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
          borderRadius={16}
        >
          <View style={styles.fixedItem}>
            <View style={styles.itemLeft}>
              <View style={[styles.itemIcon, { backgroundColor: category.color + '15' }]}>
                <IconComponent width={22} height={22} color={category.color} />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{category.name}</Text>
                {item.note && (
                  <Text style={styles.itemCategory}>{item.note}</Text>
                )}
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={[
                styles.itemAmount,
                { color: isIncome ? colors.success : colors.error }
              ]}>
                {isIncome ? '+' : '-'}{formatAmount(item.amount)}
              </Text>
              <Text style={styles.itemFrequency}>Hàng tháng</Text>
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  };

  const openAddModal = () => {
    setEditingItem(null);
    setSelectedCategory(activeTab === TRANSACTION_TYPES.INCOME ? 'salary' : 'housing');
    setNewItemAmount(0);
    setNewItemNote('');
    setFormError({ field: '', message: '' });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingItem(null);
    setFormError({ field: '', message: '' });
  };

  const handleSave = async () => {
    if (newItemAmount <= 0) {
      setFormError({ field: 'amount', message: 'Vui lòng nhập số tiền hợp lệ' });
      return;
    }

    if (!selectedCategory) {
      setFormError({ field: 'category', message: 'Vui lòng chọn danh mục' });
      return;
    }

    let success = false;

    if (editingItem) {
      success = await updateFixedItem(editingItem.id!, {
        // Không cho đổi danh mục khi sửa
        categoryId: editingItem.categoryId,
        amount: newItemAmount,
        note: newItemNote || undefined,
      });
    } else {
      success = await addFixedItem({
        categoryId: selectedCategory,
        amount: newItemAmount,
        type: activeTab,
        note: newItemNote || undefined,
      });
    }

    if (success) {
      markHomeDataChanged();
      closeModal();
    }
  };

  const isIncomeTab = activeTab === TRANSACTION_TYPES.INCOME;
  const currentCategories = isIncomeTab ? fixedIncomeCategories : fixedExpenseCategories;

  // Dữ liệu hiển thị & tổng trên màn Budget:
  // - Chỉ dùng các item đang "có hiệu lực" cho tháng hiện tại (fixedIncomeData/fixedExpenseData)
  // - Tổng đúng bằng tổng các item đang hiển thị trong list.
  const totalIncomeFromList = fixedIncomeData.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const totalExpenseFromList = fixedExpenseData.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Khoản cố định</Text>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Thu cố định</Text>
            <Text style={[styles.summaryAmount, { color: colors.success }]}>
              +{formatAmount(totalIncomeFromList)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Chi cố định</Text>
            <Text style={[styles.summaryAmount, { color: colors.error }]}>
              -{formatAmount(totalExpenseFromList)}
            </Text>
          </View>
        </View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Còn lại hàng tháng</Text>
          <Text style={[
            styles.balanceAmount,
            { color: totalIncomeFromList - totalExpenseFromList >= 0 ? colors.success : colors.error }
          ]}>
            {formatAmount(totalIncomeFromList - totalExpenseFromList)}
          </Text>
        </View>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, isIncomeTab && styles.tabActiveIncome]}
          onPress={() => setActiveTab(TRANSACTION_TYPES.INCOME)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, isIncomeTab && styles.tabTextActive]}>
            Thu cố định
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isIncomeTab && styles.tabActiveExpense]}
          onPress={() => setActiveTab(TRANSACTION_TYPES.EXPENSE)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, !isIncomeTab && styles.tabTextActive]}>
            Chi cố định
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              isLoading &&
              (fixedIncomeData.length > 0 || fixedExpenseData.length > 0)
            }
            onRefresh={refresh}
          />
        }
      >
        <View style={styles.listContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <View style={styles.skeletonSummaryRow}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="30%" height={16} />
              </View>

              <View style={{ marginTop: 16 }}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <View key={idx} style={styles.skeletonItemRow}>
                    <Skeleton width={48} height={48} radius={16} />
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
            </View>
          ) : isIncomeTab ? (
            fixedIncomeData.length > 0 ? (
              <>
                {fixedIncomeData.map(item =>
                  renderFixedItem(item, TRANSACTION_TYPES.INCOME),
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có khoản thu cố định nào</Text>
              </View>
            )
          ) : (
            fixedExpenseData.length > 0 ? (
              <>
                {fixedExpenseData.map(item =>
                  renderFixedItem(item, TRANSACTION_TYPES.EXPENSE),
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có khoản chi cố định nào</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={[
            styles.floatingButton,
            { backgroundColor: isIncomeTab ? colors.success : colors.error }
          ]}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <AddIcon width={28} height={28} color={colors.white} />
        </TouchableOpacity>
        {/* <Text style={[
          styles.floatingButtonText,
          { color: isIncomeTab ? colors.success : colors.error }
        ]}>
          Thêm {isIncomeTab ? 'thu' : 'chi'} cố định
        </Text> */}
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        isVisible={modalVisible}
        onBackdropPress={closeModal}
        onSwipeComplete={closeModal}
        swipeDirection={['down']}
        style={styles.modal}
        propagateSwipe
        backdropOpacity={0.5}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalIndicator} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Sửa' : 'Thêm'} {isIncomeTab ? 'thu' : 'chi'} cố định
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalClose}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <CurrencyInput
              value={newItemAmount}
              onChange={(v) => {
                setNewItemAmount(v);
                if (formError.field) setFormError({ field: '', message: '' });
              }}
              placeholder="0"
              containerStyle={styles.amountContainer}
              inputWrapperStyle={StyleSheet.flatten([
                styles.amountInputWrapper,
                formError.field === 'amount' && styles.amountInputWrapperError,
              ])}
              inputStyle={styles.amountInput}
              suffixStyle={styles.amountSuffix}
            />
            {formError.field === 'amount' && !!formError.message && (
              <Text style={styles.formErrorInline}>{formError.message}</Text>
            )}

            <View style={styles.inputGroup}>
              <View style={styles.categoryHeaderRow}>
                <Text style={styles.inputLabel}>Danh mục</Text>
                {!!editingItem && (
                  <Text style={styles.categoryLockedHint}>Không thể đổi khi sửa</Text>
                )}
              </View>
              {formError.field === 'category' && !!formError.message && (
                <Text style={styles.formErrorInline}>{formError.message}</Text>
              )}
              <View style={styles.categoryGrid}>
                {currentCategories.map(cat => {
                  const isSelected = selectedCategory === cat.id;
                  const IconComponent = cat.icon;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryItem,
                        isSelected && styles.categoryItemActive,
                        !!editingItem && styles.categoryItemDisabled,
                      ]}
                      onPress={() => {
                        if (editingItem) return;
                        setSelectedCategory(cat.id);
                        if (formError.field) setFormError({ field: '', message: '' });
                      }}
                      activeOpacity={editingItem ? 1 : 0.8}
                      disabled={!!editingItem}
                    >
                      <View style={[
                        styles.categoryIcon, 
                        { backgroundColor: isSelected ? colors.primary : cat.color + '15' }
                      ]}>
                        <IconComponent width={20} height={20} color={isSelected ? colors.white : cat.color} />
                      </View>
                      <Text style={[
                        styles.categoryText,
                        isSelected && { color: colors.primary, fontWeight: '600' }
                      ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ghi chú</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Mô tả chi tiết..."
                placeholderTextColor={colors.textLight}
                value={newItemNote}
                onChangeText={setNewItemNote}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.backgroundSecondary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActiveIncome: {
    backgroundColor: colors.success,
  },
  tabActiveExpense: {
    backgroundColor: colors.error,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  listContainer: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  swipeableContainer: {
    marginBottom: 12,
    borderRadius: 16,
  },
  fixedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemFrequency: {
    fontSize: 11,
    color: colors.textLight,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  loadingContainer: {
    paddingVertical: 16,
  },
  skeletonSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skeletonItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonItemText: {
    flex: 1,
    marginHorizontal: 12,
  },
  skeletonItemAmount: {
    alignItems: 'flex-end',
    width: 80,
  },
  loadMoreButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '100%',
  },
  modalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: colors.textLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalClose: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  amountContainer: {
    marginBottom: 24,
  },
  amountInputWrapper: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 0,
  },
  amountInputWrapperError: {
    borderBottomColor: colors.error,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 16,
  },
  amountSuffix: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  formErrorInline: {
    marginTop: -14,
    marginBottom: 16,
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  categoryHeaderRow: {
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
  categoryLockedHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '30%',
  },
  categoryItemActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  categoryItemDisabled: {
    opacity: 0.6,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: colors.textLight,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});

export default BudgetScreen;
