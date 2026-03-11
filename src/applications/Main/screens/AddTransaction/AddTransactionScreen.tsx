import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
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
  runTransaction,
  increment,
} from '@react-native-firebase/firestore';
import { colors } from '../../../../utils/color';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import ChevronDownIcon from '../../../../assets/icons/ChevronDownIcon';
import { DatePicker, CurrencyInput } from '../../../../components';
import { EXPENDITURE_CATEGORIES } from '../../../../constants/ExpenditureCategoryConstants';
import { INCOME_CATEGORIES } from '../../../../constants/IncomeCategoryConstants';
import { getStoredUser, pushBalanceNotification } from '../../../../services';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { showSnackbar } from '../../../../utils/snackbar';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import { type IncomePreset } from '../../../../services/incomePresets';
import { useIncomePresets } from '../../../../contexts/IncomePresetsContext';
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
  const { funds, defaultFund } = useFunds();

  const isEditMode = useMemo(
    () => params?.mode === 'edit' && !!params.transactionId && !!params.initialData,
    [params],
  );

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

  const initialData = params?.initialData;

  const [transactionType, setTransactionType] = useState<TransactionType>(
    (initialData?.type as TransactionType) ?? 'expense',
  );
  const [amount, setAmount] = useState(initialData?.amount ?? 0);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialData?.categoryId ?? '',
  );
  const [selectedFundId, setSelectedFundId] = useState<string>(
    initialData?.fundId ?? '',
  );
  const [date, setDate] = useState(
    initialData ? new Date(initialData.transactionDate) : new Date(),
  );
  const [note, setNote] = useState(initialData?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [splitIncomeEnabled, setSplitIncomeEnabled] = useState(false);
  const [incomeSplits, setIncomeSplits] = useState<
    Array<{ id: string; fundId: string; amount: number }>
  >([]);
  const [activeSplitId, setActiveSplitId] = useState<string>('');
  const { presets: incomePresets } = useIncomePresets();
  const [selectedIncomePresetId, setSelectedIncomePresetId] = useState<string>('');

  const categories = transactionType === 'expense' ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES;
  const splitTotal = useMemo(
    () => incomeSplits.reduce((sum, s) => sum + (s.amount || 0), 0),
    [incomeSplits],
  );
  const activeSplit = useMemo(() => {
    return incomeSplits.find((s) => s.id === activeSplitId) ?? incomeSplits[0];
  }, [incomeSplits, activeSplitId]);

  const selectedIncomePreset = useMemo(() => {
    if (!selectedIncomePresetId) return undefined;
    return incomePresets.find((p) => p.id === selectedIncomePresetId);
  }, [incomePresets, selectedIncomePresetId]);

  const applyIncomePreset = useCallback(
    (preset: IncomePreset, baseAmount: number) => {
      const allocations = preset.allocations ?? [];
      if (!allocations.length) return;

      const nextIds = allocations.map(
        () => `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      );

      const hasAmount = allocations.some(
        (a) => typeof (a as any).amount === 'number' && (a as any).amount > 0,
      );
      const hasPercent = !hasAmount &&
        allocations.some(
          (a) => typeof (a as any).percent === 'number' && (a as any).percent > 0,
        );

      const totalBase = hasAmount ? 0 : baseAmount;
      let sum = 0;

      const next = allocations.map((a, idx) => {
        let lineAmount = 0;
        if (hasAmount) {
          const fixedAmount = ((a as any).amount ?? 0) as number;
          lineAmount = Math.max(0, fixedAmount);
        } else if (hasPercent && totalBase > 0) {
          const pct = ((a as any).percent ?? 0) as number;
          const raw = Math.floor((totalBase * pct) / 100);
          if (idx === allocations.length - 1) {
            lineAmount = Math.max(0, totalBase - sum);
          } else {
            lineAmount = Math.max(0, raw);
            sum += lineAmount;
          }
        }

        return {
          id: nextIds[idx],
          fundId: a.fundId,
          amount: lineAmount,
        };
      });

      const total = next.reduce((acc, s) => acc + (s.amount || 0), 0);
      setIncomeSplits(next);
      setActiveSplitId(next[0]?.id ?? '');
      if (total > 0) {
        setAmount(total);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isEditMode && defaultFund && !selectedFundId && funds.length > 0) {
      setSelectedFundId(defaultFund.id);
    }
  }, [isEditMode, defaultFund, funds.length, selectedFundId]);

  useEffect(() => {
    setShowAllCategories(false);
  }, [transactionType]);

  useEffect(() => {
    if (transactionType !== 'income' || isEditMode) {
      setSplitIncomeEnabled(false);
      setIncomeSplits([]);
      setActiveSplitId('');
      setSelectedIncomePresetId('');
    }
  }, [transactionType, isEditMode]);

  useEffect(() => {
    if (!splitIncomeEnabled) return;
    if (incomeSplits.length !== 1) return;
    setIncomeSplits((prev) => {
      if (prev.length !== 1) return prev;
      if (prev[0].amount === amount) return prev;
      return [{ ...prev[0], amount }];
    });
  }, [amount, incomeSplits.length, splitIncomeEnabled]);

  useEffect(() => {
    if (!splitIncomeEnabled) return;
    if (!selectedIncomePreset) return;
    applyIncomePreset(selectedIncomePreset, amount);
  }, [amount, applyIncomePreset, selectedIncomePreset, splitIncomeEnabled]);

  const visibleCategories = useMemo(() => {
    if (showAllCategories) return categories;
    if (categories.length <= 6) return categories;
    // Show 5 popular categories + "Xem thêm" tile to avoid orphan items like "Khác"
    return categories.slice(0, 5);
  }, [categories, showAllCategories]);

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

    const isSplitIncome = !isEditMode && transactionType === 'income' && splitIncomeEnabled;
    if (!isSplitIncome && !selectedFundId) {
      showSnackbar({
        message: transactionType === 'expense'
          ? 'Vui lòng chọn quỹ chi tiêu'
          : 'Vui lòng chọn quỹ nhận tiền',
        type: 'error',
      });
      return;
    }

    if (funds.length === 0) {
      showSnackbar({
        message: 'Bạn cần tạo ít nhất một quỹ. Vào Cá nhân > Quản lý quỹ để tạo.',
        type: 'error',
      });
      return;
    }

    if (isSplitIncome) {
      if (incomeSplits.length < 1) {
        showSnackbar({
          message: 'Vui lòng thêm ít nhất một quỹ nhận tiền',
          type: 'error',
        });
        return;
      }
      if (!incomeSplits.every((s) => !!s.fundId && Number.isFinite(s.amount) && s.amount > 0)) {
        showSnackbar({
          message: 'Vui lòng chọn quỹ và nhập số tiền hợp lệ cho từng dòng',
          type: 'error',
        });
        return;
      }
      if (splitTotal !== amount) {
        showSnackbar({
          message: `Tổng phân bổ (${splitTotal.toLocaleString('vi-VN')}đ) phải bằng tổng thu nhập (${amount.toLocaleString('vi-VN')}đ)`,
          type: 'error',
        });
        return;
      }
      const fundIds = incomeSplits.map((s) => s.fundId);
      const uniqueFundIds = new Set(fundIds);
      if (uniqueFundIds.size !== fundIds.length) {
        showSnackbar({
          message: 'Mỗi quỹ chỉ nên xuất hiện 1 lần trong phân bổ',
          type: 'error',
        });
        return;
      }
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
        const txRef = doc(firestoreInstance, 'transactions', params.transactionId);
        const oldData = initialData;
        const wasExpense = oldData?.type === 'expense';
        const isExpense = transactionType === 'expense';
        const oldFundId = oldData?.fundId;
        const oldAmount = oldData?.amount ?? 0;

        const wasIncome = oldData?.type === 'income';
        const oldCategoryId = oldData?.categoryId ?? '';
        let newBalanceOldFund: number | undefined;
        let newBalanceNewFund: number | undefined;

        await runTransaction(firestoreInstance, async (transaction) => {
          // Hoàn lại: khoản chi cũ → cộng lại quỹ cũ; khoản thu cũ → trừ lại quỹ cũ
          if (oldFundId && oldAmount > 0) {
            const oldFundRef = doc(firestoreInstance, 'funds', oldFundId);
            const oldFundSnap = await transaction.get(oldFundRef);
            if (oldFundSnap && oldFundSnap.exists()) {
              const oldBal = (oldFundSnap.data()?.balance as number) ?? 0;
              const deltaBack = wasExpense ? oldAmount : -oldAmount;
              newBalanceOldFund = oldBal + deltaBack;
              transaction.update(oldFundRef, {
                balance: increment(deltaBack),
                updatedAt: serverTimestamp(),
              });
            }
          }

          // Áp dụng mới: khoản chi → trừ quỹ; khoản thu → cộng quỹ
          if (selectedFundId && amount > 0) {
            const newFundRef = doc(firestoreInstance, 'funds', selectedFundId);
            const newFundSnap = await transaction.get(newFundRef);
            const newBal = newFundSnap.exists() ? (((newFundSnap.data()?.balance as number) ?? 0)) : 0;
            const deltaApply = isExpense ? -amount : amount;
            newBalanceNewFund = newBal + deltaApply;
            transaction.update(newFundRef, {
              balance: increment(deltaApply),
              updatedAt: serverTimestamp(),
            });
          }

          const updates: Record<string, any> = {
            type: transactionType,
            categoryId: selectedCategory,
            amount,
            note: note || null,
            transactionDate: date,
            fundId: selectedFundId,
            updatedAt: serverTimestamp(),
          };
          transaction.update(txRef, updates);
        });

        showSnackbar({
          message: 'Đã cập nhật giao dịch',
          type: 'success',
        });
        // Đánh dấu cần reload dữ liệu & đóng màn hình ngay, không chờ thông báo nền.
        markHomeDataChanged();
        markTransactionListNeedsRefresh();
        if (navigation.canGoBack()) {
          navigation.goBack();
        }

        try {
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const oldDelta = wasExpense ? -oldAmount : oldAmount;
          const newDelta = isExpense ? -amount : amount;
          const totalAfter = totalBefore + (newDelta - oldDelta);
          const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;

          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const oldAmountLabel = `${oldAmount.toLocaleString('vi-VN')}đ`;
          const oldFundName = oldFundId ? (funds.find(f => f.id === oldFundId)?.name ?? 'Quỹ') : 'Quỹ';
          const newFundName = funds.find(f => f.id === selectedFundId)?.name ?? 'Quỹ';
          const oldCats = wasExpense ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES;
          const newCats = isExpense ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES;
          const newCategoryName = newCats.find(c => c.id === selectedCategory)?.name ?? 'Danh mục';
          const oldCategoryName = oldCategoryId ? (oldCats.find(c => c.id === oldCategoryId)?.name ?? 'Danh mục') : 'Danh mục';
          const reverseMsg = oldFundId
            ? `Hoàn lại ${oldAmountLabel} (${oldCategoryName}) ${wasExpense ? 'vào' : 'khỏi'} "${oldFundName}".`
            : '';
          const applyMsg = `Áp dụng ${amountLabel} (${newCategoryName}) ${isExpense ? 'khỏi' : 'vào'} "${newFundName}".`;
          const balanceMsgParts: string[] = [];
          if (oldFundId && typeof newBalanceOldFund === 'number') {
            balanceMsgParts.push(`"${oldFundName}": ${newBalanceOldFund.toLocaleString('vi-VN')}đ`);
          }
          if (selectedFundId && typeof newBalanceNewFund === 'number') {
            balanceMsgParts.push(`"${newFundName}": ${newBalanceNewFund.toLocaleString('vi-VN')}đ`);
          }
          const balanceMsg = balanceMsgParts.length
            ? `\nSố dư quỹ:\n${balanceMsgParts.join('\n')}\nTổng số dư: ${totalLabel}`
            : `\nTổng số dư: ${totalLabel}`;
          void pushBalanceNotification(userId, {
            kind: 'transaction_updated',
            title: 'Cập nhật giao dịch',
            message: `${reverseMsg}${reverseMsg ? '\n' : ''}${applyMsg}${balanceMsg}`,
          });
        } catch {
          // ignore notification errors
        }
      } else {
        let newFundBalanceAfter: number | undefined;
        const newFundBalancesAfter = new Map<string, number>();
        const isSplitIncome = transactionType === 'income' && splitIncomeEnabled;
        const splitGroupId = isSplitIncome
          ? `${Date.now()}_${Math.random().toString(16).slice(2)}`
          : undefined;

        await runTransaction(firestoreInstance, async (transaction) => {
          const basePayload = {
            userId,
            type: transactionType,
            categoryId: selectedCategory,
            note: note || null,
            transactionDate: date,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          if (isSplitIncome) {
            // Tạo 1 giao dịch duy nhất với tổng tiền,
            // nhưng vẫn lưu chi tiết phân bổ để tham khảo/report sau này.
            const totalAmount = incomeSplits.reduce(
              (sum, s) => sum + (s.amount || 0),
              0,
            );
            const newTxRef = doc(collection(firestoreInstance, 'transactions'));
            transaction.set(newTxRef, {
              ...basePayload,
              amount: totalAmount,
              // fundId để null vì tiền được chia vào nhiều quỹ.
              fundId: null,
              splitGroupId,
              incomeSplits: incomeSplits.map((s) => ({
                fundId: s.fundId,
                amount: s.amount,
              })),
              isSplitIncome: true,
            });

            for (const s of incomeSplits) {
              const fundRef = doc(firestoreInstance, 'funds', s.fundId);
              const fundSnap = await transaction.get(fundRef);
              const current = fundSnap.exists()
                ? (((fundSnap.data()?.balance as number) ?? 0))
                : 0;
              const newBalance = current + s.amount;
              newFundBalancesAfter.set(s.fundId, newBalance);
              transaction.update(fundRef, {
                balance: increment(s.amount),
                updatedAt: serverTimestamp(),
              });
            }
          } else {
            const payload = {
              ...basePayload,
              amount,
              fundId: selectedFundId,
            };
            const newTxRef = doc(collection(firestoreInstance, 'transactions'));
            transaction.set(newTxRef, payload);

            const fundRef = doc(firestoreInstance, 'funds', selectedFundId);
            const fundSnap = await transaction.get(fundRef);
            const current = fundSnap.exists()
              ? (((fundSnap.data()?.balance as number) ?? 0))
              : 0;
            const delta = transactionType === 'expense' ? -amount : amount;
            newFundBalanceAfter = current + delta;
            transaction.update(fundRef, {
              balance: increment(delta),
              updatedAt: serverTimestamp(),
            });
          }
        });

        showSnackbar({
          message: 'Đã lưu giao dịch thành công',
          type: 'success',
        });
        // Đánh dấu cần reload dữ liệu & đóng màn hình ngay, không chờ thông báo nền.
        markHomeDataChanged();
        markTransactionListNeedsRefresh();

        if (navigation.canGoBack()) {
          navigation.goBack();
        }

        try {
          const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
          const delta = transactionType === 'expense' ? -amount : amount;
          const totalAfter = totalBefore + delta;
          const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;

          const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
          const categoryName = categories.find(c => c.id === selectedCategory)?.name ?? 'Danh mục';
          const fundName = funds.find(f => f.id === selectedFundId)?.name ?? 'Quỹ';
          const fundBalanceLabel =
            typeof newFundBalanceAfter === 'number'
              ? `${newFundBalanceAfter.toLocaleString('vi-VN')}đ`
              : '';

          const isSplitIncome = transactionType === 'income' && splitIncomeEnabled;
          const splitMsgParts: string[] = [];
          if (isSplitIncome) {
            for (const s of incomeSplits) {
              const name = funds.find(f => f.id === s.fundId)?.name ?? 'Quỹ';
              const bal = newFundBalancesAfter.get(s.fundId);
              const balLabel = typeof bal === 'number' ? `${bal.toLocaleString('vi-VN')}đ` : '';
              splitMsgParts.push(`- "${name}": +${s.amount.toLocaleString('vi-VN')}đ (Số dư: ${balLabel})`);
            }
          }
          void pushBalanceNotification(userId, {
            kind: 'transaction_added',
            title: 'Giao dịch mới',
            message: transactionType === 'expense'
              ? `Đã ghi nhận khoản chi ${amountLabel} (${categoryName}) từ "${fundName}".\nSố dư quỹ: ${fundBalanceLabel}\nTổng số dư: ${totalLabel}`
              : isSplitIncome
                ? `Đã ghi nhận khoản thu ${amountLabel} (${categoryName}) và phân bổ vào các quỹ:\n${splitMsgParts.join('\n')}\nTổng số dư: ${totalLabel}`
                : `Đã ghi nhận khoản thu ${amountLabel} (${categoryName}) vào "${fundName}".\nSố dư quỹ: ${fundBalanceLabel}\nTổng số dư: ${totalLabel}`,
          });
        } catch {
          // ignore notification errors
        }
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
              setSelectedFundId(defaultFund?.id ?? '');
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
              setSelectedFundId(defaultFund?.id ?? '');
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
            editable={
              !(!isEditMode && transactionType === 'income' && splitIncomeEnabled)
            }
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

        {/* Fund Selection - Cả thu và chi đều chọn quỹ */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            {transactionType === 'expense' ? 'Quỹ chi tiêu *' : 'Quỹ nhận tiền *'}
          </Text>
        {!isEditMode && transactionType === 'income' && funds.length > 1 && (
          <View style={styles.splitToggleRow}>
            <Text style={styles.splitToggleText}>Chia thu nhập theo quỹ</Text>
            <Switch
              value={splitIncomeEnabled}
              onValueChange={(value) => {
                setSplitIncomeEnabled(value);
                if (value) {
                  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                  const initialFundId =
                    selectedFundId ||
                    defaultFund?.id ||
                    fundsDefaultFirst[0]?.id ||
                    '';
                  setIncomeSplits([{ id, fundId: initialFundId, amount }]);
                  setActiveSplitId(id);
                  setSelectedIncomePresetId('');
                } else {
                  const firstFundId = incomeSplits[0]?.fundId;
                  if (firstFundId) setSelectedFundId(firstFundId);
                  setIncomeSplits([]);
                  setActiveSplitId('');
                  setSelectedIncomePresetId('');
                }
              }}
              thumbColor={splitIncomeEnabled ? colors.white : colors.white}
              trackColor={{
                false: colors.backgroundSecondary,
                true: colors.primary,
              }}
            />
          </View>
        )}
            {funds.length === 0 ? (
              <TouchableOpacity
                style={styles.fundEmptyHint}
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  (navigation.getParent() as { navigate: (name: 'FundManagement') => void } | undefined)
                    ?.navigate('FundManagement');
                }}
              >
                <Text style={styles.fundEmptyText}>
                  Chưa có quỹ nào. Nhấn để tạo quỹ
                </Text>
              </TouchableOpacity>
            ) : (
              splitIncomeEnabled && !isEditMode && transactionType === 'income' ? (
                <View style={styles.splitContainer}>
                  {incomePresets.length > 0 && (
                    <View style={styles.presetRow}>
                      <Text style={styles.presetLabel}>Nguồn thu</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.presetChips}
                      >
                        {incomePresets.map((p) => {
                          const isSelected = selectedIncomePresetId === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[
                                styles.presetChip,
                                isSelected && styles.presetChipActive,
                              ]}
                              onPress={() => {
                                setSelectedIncomePresetId(p.id);
                                applyIncomePreset(p, amount);
                              }}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.presetChipText,
                                  isSelected && styles.presetChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          style={[styles.presetChip, styles.presetChipManage]}
                          onPress={() =>
                            (navigation.getParent() as { navigate: (name: 'IncomeSources') => void } | undefined)
                              ?.navigate('IncomeSources')
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.presetChipText, styles.presetChipTextManage]}>
                            Thiết lập
                          </Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  )}
                  {incomeSplits.map((s, idx) => {
                    const fundName =
                      funds.find((f) => f.id === s.fundId)?.name ?? 'Chọn quỹ';
                    const isActive = s.id === activeSplitId;
                    return (
                      <View key={s.id} style={styles.splitRow}>
                        <View style={styles.splitHeaderRow}>
                          <TouchableOpacity
                            style={[
                              styles.splitFundSelect,
                              isActive && styles.splitFundSelectActive,
                            ]}
                            onPress={() => setActiveSplitId(s.id)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.splitFundSelectText,
                                isActive && styles.splitFundSelectTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {fundName}
                            </Text>
                          </TouchableOpacity>

                          {incomeSplits.length > 1 && (
                            <TouchableOpacity
                              style={styles.splitRemoveBtn}
                              onPress={() => {
                                setIncomeSplits((prev) => {
                                  const next = prev.filter((p) => p.id !== s.id);
                                  if (isActive) setActiveSplitId(next[0]?.id ?? '');
                                  const total = next.reduce(
                                    (sum, item) => sum + (item.amount || 0),
                                    0,
                                  );
                                  setAmount(total);
                                  return next;
                                });
                                setSelectedIncomePresetId('');
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.splitRemoveText}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.splitAmountWrap}>
                          <CurrencyInput
                            value={s.amount}
                            onChange={(v) => {
                              setIncomeSplits((prev) => {
                                const next = prev.map((p) =>
                                  p.id === s.id ? { ...p, amount: v } : p,
                                );
                                const total = next.reduce(
                                  (sum, item) => sum + (item.amount || 0),
                                  0,
                                );
                                setAmount(total);
                                return next;
                              });
                              setSelectedIncomePresetId('');
                            }}
                            placeholder="0"
                            inputWrapperStyle={styles.splitAmountInput}
                            inputStyle={styles.splitAmountText}
                            suffixStyle={styles.splitAmountSuffix}
                          />
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.splitActionsRow}>
                    {!selectedIncomePresetId && (
                      <TouchableOpacity
                        style={styles.splitAddBtn}
                        onPress={() => {
                          const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                          setIncomeSplits((prev) => [...prev, { id, fundId: '', amount: 0 }]);
                          setActiveSplitId(id);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.splitAddText}>+ Thêm quỹ</Text>
                      </TouchableOpacity>
                    )}
                    {!!selectedIncomePresetId && (
                      <TouchableOpacity
                        style={styles.splitAddBtn}
                        onPress={() => setSelectedIncomePresetId('')}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.splitAddText}>Chỉnh tay</Text>
                      </TouchableOpacity>
                    )}

                    <Text
                      style={[
                        styles.splitSummary,
                        splitTotal === amount ? styles.splitSummaryOk : styles.splitSummaryBad,
                      ]}
                    >
                      {`Đã phân bổ: ${splitTotal.toLocaleString('vi-VN')}đ / Tổng: ${amount.toLocaleString('vi-VN')}đ`}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.fundGrid}
                  >
                    {fundsDefaultFirst.map((fund) => {
                      const target = activeSplit ?? incomeSplits[0];
                      const isSelected = (target?.fundId ?? '') === fund.id;
                      const usedByOther = incomeSplits.some(
                        (s) => s.fundId === fund.id && s.id !== (target?.id ?? ''),
                      );
                      const disabled = usedByOther;
                      const fundColor = fund.color ?? colors.primary;

                      
                      return (
                        <TouchableOpacity
                          key={fund.id}
                          style={[
                            styles.fundItem,
                            isSelected && styles.fundItemActive,
                            isSelected && { borderColor: fundColor },
                            disabled && { opacity: 0.5 },
                          ]}
                          onPress={() => {
                            if (disabled) return;
                            const targetId = (target?.id ?? '');
                            if (!targetId) return;
                            setIncomeSplits((prev) =>
                              prev.map((p) => (p.id === targetId ? { ...p, fundId: fund.id } : p)),
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.fundItemIcon, { backgroundColor: fundColor + '20' }]}>
                            <WalletIcon width={20} height={20} color={fundColor} />
                          </View>
                          <Text
                            style={[
                              styles.fundItemText,
                              isSelected && { color: fundColor },
                            ]}
                            numberOfLines={1}
                          >
                            {fund.name}
                          </Text>
                          <Text style={styles.fundItemBalance}>
                            {fund.balance.toLocaleString('vi-VN')}đ
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fundGrid}
              >
                {fundsDefaultFirst.map((fund) => {
                  const isSelected = selectedFundId === fund.id;
                  const fundColor = fund.color ?? colors.primary;
                  
                  return (
                    <TouchableOpacity
                      key={fund.id}
                      style={[
                        styles.fundItem,
                        isSelected && styles.fundItemActive,
                        isSelected && { borderColor: fundColor },
                      ]}
                      onPress={() => setSelectedFundId(fund.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.fundItemIcon, { backgroundColor: fundColor + '20' }]}>
                        <WalletIcon width={20} height={20} color={fundColor} />
                      </View>
                      <Text
                        style={[
                          styles.fundItemText,
                          isSelected && { color: fundColor },
                        ]}
                        numberOfLines={1}
                      >
                        {fund.name}
                      </Text>
                      <Text style={styles.fundItemBalance}>
                        {fund.balance.toLocaleString('vi-VN')}đ
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              )
            )}
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

        {/* Category Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Danh mục</Text>
          <View style={styles.categoryGrid}>
            {visibleCategories.map((cat) => {
              const IconComponent = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemActive,
                    isSelected && { borderColor: cat.color },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.color + '15' },
                    ]}
                  >
                    <IconComponent width={22} height={22} color={cat.color} />
                  </View>
                  <Text
                    style={[
                      styles.categoryText,
                      isSelected && { color: cat.color },
                    ]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {!showAllCategories && categories.length > 6 && (
              <TouchableOpacity
                style={[styles.categoryItem, styles.moreCategoryItem]}
                onPress={() => setShowAllCategories(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIcon, styles.moreCategoryIcon]}>
                  <ChevronDownIcon width={20} height={20} color={colors.primary} />
                </View>
                <Text style={[styles.categoryText, styles.moreCategoryText]} numberOfLines={2}>
                  Xem thêm
                </Text>
              </TouchableOpacity>
            )}

            {showAllCategories && categories.length > 6 && (
              <TouchableOpacity
                style={[styles.categoryItem, styles.moreCategoryItem]}
                onPress={() => setShowAllCategories(false)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIcon, styles.moreCategoryIcon, { transform: [{ rotate: '180deg' }] }]}>
                  <ChevronDownIcon width={20} height={20} color={colors.primary} />
                </View>
                <Text style={[styles.categoryText, styles.moreCategoryText]} numberOfLines={2}>
                  Thu gọn
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  categoryItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '31%',
    marginBottom: 12,
    minHeight: 92,
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  moreCategoryItem: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.primary + '25',
    borderStyle: 'dashed',
  },
  moreCategoryIcon: {
    backgroundColor: colors.primary + '14',
  },
  moreCategoryText: {
    color: colors.primary,
    fontWeight: '800',
  },
  fundEmptyHint: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  fundEmptyText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  splitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  splitToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  splitContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: colors.black + '05',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  splitRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 10,
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitFundSelect: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitFundSelectActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  splitFundSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  splitFundSelectTextActive: {
    color: colors.primary,
  },
  splitAmountWrap: {
    width: '100%',
    marginTop: 2,
  },
  splitAmountInput: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  splitAmountSuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  splitRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: 6,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitRemoveText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  splitActionsRow: {
    marginTop: 2,
    marginBottom: 10,
  },
  splitAddBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  splitAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  splitSummary: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  splitSummaryOk: {
    color: colors.success,
  },
  splitSummaryBad: {
    color: colors.error,
  },
  presetRow: {
    marginBottom: 10,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  presetChips: {
    gap: 8,
    paddingBottom: 2,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 180,
  },
  presetChipActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary + '35',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    color: colors.primary,
  },
  presetChipManage: {
    borderStyle: 'dashed',
    borderColor: colors.primary + '45',
  },
  presetChipTextManage: {
    color: colors.primary,
    fontWeight: '900',
  },
  fundGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  fundItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 90,
  },
  fundItemActive: {
    borderWidth: 2,
  },
  fundItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  fundItemText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fundItemBalance: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
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
