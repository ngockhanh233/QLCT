import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { colors } from '../../../../utils/color';
import { DatePicker, CurrencyInput } from '../../../../components';
import { EXPENDITURE_CATEGORIES } from '../../../../constants/ExpenditureCategoryConstants';
import { INCOME_CATEGORIES } from '../../../../constants/IncomeCategoryConstants';
import { getStoredUser } from '../../../../services';
import { showSnackbar } from '../../../../utils/snackbar';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import type { RootStackParamList } from '../../MainScreen';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

type TransactionType = 'expense' | 'income';

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, 'transactions');

const AddTransactionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddTransaction'>>();
  const params = route.params;
  const { markHomeDataChanged, markTransactionListNeedsRefresh } = useHomeDataChanged();

  const isEditMode = useMemo(
    () => params?.mode === 'edit' && !!params.transactionId && !!params.initialData,
    [params],
  );

  const initialData = params?.initialData;

  const [transactionType, setTransactionType] = useState<TransactionType>(
    (initialData?.type as TransactionType) ?? 'expense',
  );
  const [amount, setAmount] = useState(initialData?.amount ?? 0);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialData?.categoryId ?? '',
  );
  const [date, setDate] = useState(
    initialData ? new Date(initialData.transactionDate) : new Date(),
  );
  const [note, setNote] = useState(initialData?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const categories = transactionType === 'expense' ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES;

  const handleSave = async () => {
    if (amount <= 0) {
      showSnackbar({
        message: 'Vui lòng nhập số tiền hợp lệ',
        type: 'error',
      });
      return;
    }

    if (!selectedCategory) {
      showSnackbar({
        message: 'Vui lòng chọn danh mục',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);

    try {
      const stored = await getStoredUser();
      const userId = stored?.uid;

      if (!userId) {
        showSnackbar({
          message: 'Không xác định được người dùng. Vui lòng đăng nhập lại.',
          type: 'error',
        });
        return;
      }

      if (isEditMode && params?.transactionId) {
        const ref = doc(firestoreInstance, 'transactions', params.transactionId);

        const updates: Record<string, any> = {
          type: transactionType,
          categoryId: selectedCategory,
          amount,
          note: note || null,
          transactionDate: date,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(ref, updates);

        showSnackbar({
          message: 'Đã cập nhật giao dịch',
          type: 'success',
        });
        markHomeDataChanged();
        markTransactionListNeedsRefresh();
      } else {
        const payload: Record<string, any> = {
          userId,
          type: transactionType,
          categoryId: selectedCategory,
          amount,
          note: note || null,
          transactionDate: date,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(transactionsCollection, payload);

        showSnackbar({
          message: 'Đã lưu giao dịch thành công',
          type: 'success',
        });
        markHomeDataChanged();
        markTransactionListNeedsRefresh();

        // Reset form về trạng thái mặc định sau khi thêm mới
        setTransactionType('expense');
        setAmount(0);
        setSelectedCategory('');
        setDate(new Date());
        setNote('');
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      showSnackbar({
        message: 'Không thể lưu giao dịch. Vui lòng thử lại',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Transaction Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              transactionType === 'expense' && styles.typeButtonActiveExpense,
            ]}
            onPress={() => {
              setTransactionType('expense');
              setSelectedCategory('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.typeButtonText,
              transactionType === 'expense' && styles.typeButtonTextActive,
            ]}>
              Chi tiêu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              transactionType === 'income' && styles.typeButtonActiveIncome,
            ]}
            onPress={() => {
              setTransactionType('income');
              setSelectedCategory('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.typeButtonText,
              transactionType === 'income' && styles.typeButtonTextActive,
            ]}>
              Thu nhập
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={styles.amountSection}>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
            inputWrapperStyle={styles.amountInput}
            inputStyle={styles.amountText}
            suffixStyle={styles.amountSuffix}
          />
        </View>

        {/* Date Picker */}
        <View style={styles.inputGroup}>
          <DatePicker
            label="Ngày"
            value={date}
            onChange={setDate}
            placeholder="Chọn ngày"
          />
        </View>

        {/* Category Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Danh mục</Text>
          <View style={styles.categoryGrid}>
            {categories.map(cat => {
              const IconComponent = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemActive,
                    isSelected && { borderColor: cat.color }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color + '15' }]}>
                    <IconComponent width={22} height={22} color={cat.color} />
                  </View>
                  <Text style={[
                    styles.categoryText,
                    isSelected && { color: cat.color }
                  ]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Note Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ghi chú</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Nhập ghi chú..."
            placeholderTextColor={colors.textLight}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </View>

      </ScrollView>

      {/* Fixed Save Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            transactionType === 'income' ? styles.saveButtonIncome : styles.saveButtonExpense,
          ]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Đang lưu...' : 'Lưu giao dịch'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  headerLeft: {
    width: 36,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerRight: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeButtonActiveExpense: {
    backgroundColor: '#EF4444',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#22C55E',
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  amountSection: {
    marginTop: 24,
  },
  amountInput: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  amountSuffix: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  inputGroup: {
    marginTop: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '22%',
  },
  categoryItemActive: {
    borderWidth: 2,
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
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  noteInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonExpense: {
    backgroundColor: '#EF4444',
  },
  saveButtonIncome: {
    backgroundColor: '#22C55E',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
});

export default AddTransactionScreen;
