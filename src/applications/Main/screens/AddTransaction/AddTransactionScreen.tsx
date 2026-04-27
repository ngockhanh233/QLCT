import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
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
import { DatePicker, TimePicker, CurrencyInput, CategoryPicker, FundPicker, AppSwitch } from '../../../../components';
import { EXPENDITURE_CATEGORIES } from '../../../../constants/ExpenditureCategoryConstants';
import { INCOME_CATEGORIES } from '../../../../constants/IncomeCategoryConstants';
import { getStoredUser, pushBalanceNotification } from '../../../../services';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { showSnackbar } from '../../../../utils/snackbar';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import { useBalanceVisibility } from '../../../../contexts/BalanceVisibilityContext';
import { type IncomePreset } from '../../../../services/incomePresets';
import { useIncomePresets } from '../../../../contexts/IncomePresetsContext';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
import Modal from 'react-native-modal';
import type { RootStackParamList } from '../../MainScreen';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

type TransactionType = 'expense' | 'income';

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, 'transactions');

const AddTransactionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const contentScrollRef = useRef<ScrollView>(null);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddTransaction'>>();
  const params = route.params;
  const { markHomeDataChanged, markTransactionListNeedsRefresh } = useHomeDataChanged();
  const { funds, defaultFund, isLoading } = useFunds();
  const { maskAmount } = useBalanceVisibility();

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
  const [splitIncomeEnabled, setSplitIncomeEnabled] = useState(false);
  const [incomeSplits, setIncomeSplits] = useState<
    Array<{ id: string; fundId: string; amount: number }>
  >([]);
  const [activeSplitId, setActiveSplitId] = useState<string>('');
  const { presets: incomePresets } = useIncomePresets();
  const [selectedIncomePresetId, setSelectedIncomePresetId] = useState<string>('');

  const handleDateChange = useCallback((picked: Date) => {
    const now = new Date();
    const isToday =
      picked.getFullYear() === now.getFullYear() &&
      picked.getMonth() === now.getMonth() &&
      picked.getDate() === now.getDate();
    const next = new Date(picked);
    if (isToday) {
      next.setHours(now.getHours(), now.getMinutes(), 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
    }
    setDate(next);
  }, []);

  const [expenseDeficitModalVisible, setExpenseDeficitModalVisible] = useState(false);
  const [expenseTargetFundId, setExpenseTargetFundId] = useState<string>('');
  const [expenseSourceFundId, setExpenseSourceFundId] = useState<string>('');
  const [expenseDeficitAmount, setExpenseDeficitAmount] = useState<number>(0);
  const [expenseDeficitSaving, setExpenseDeficitSaving] = useState(false);

  const resetCreateForm = useCallback(() => {
    setAmount(0);
    setSelectedCategory('');
    setSelectedFundId(defaultFund?.id ?? '');
    setDate(new Date());
    setNote('');
    setSplitIncomeEnabled(false);
    setIncomeSplits([]);
    setActiveSplitId('');
    setSelectedIncomePresetId('');
    setExpenseDeficitModalVisible(false);
    setExpenseTargetFundId('');
    setExpenseSourceFundId('');
    setExpenseDeficitAmount(0);
    setExpenseDeficitSaving(false);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [defaultFund]);

  const goHome = useCallback(() => {
    // Ưu tiên navigate về tab `Home` để tránh unmount/remount cả trang.
    // Chỉ fallback bằng reset khi parent không điều hướng được (case deep link / state lạ).
    const parentNav = (navigation as any).getParent?.();
    if (parentNav?.navigate) {
      parentNav.navigate('Home');
      return;
    }

    // Fallback: reset về MainTabs và chọn tab Home.
    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'MainTabs', state: { index: 0, routes: [{ name: 'Home' }] } }],
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        // Ưu tiên đóng modal cấn trừ nếu đang mở.
        if (expenseDeficitModalVisible) {
          setExpenseDeficitModalVisible(false);
          return true;
        }

        if (navigation.canGoBack()) {
          navigation.goBack();
          return true;
        }

        goHome();
        return true;
      };

      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onHardwareBackPress,
      );

      return () => sub.remove();
    }, [navigation, expenseDeficitModalVisible, goHome]),
  );

  const categories = transactionType === 'expense' ? EXPENDITURE_CATEGORIES : INCOME_CATEGORIES;
  const splitTotal = useMemo(
    () => incomeSplits.reduce((sum, s) => sum + (s.amount || 0), 0),
    [incomeSplits],
  );

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
      setActiveSplitId('');
      if (total > 0) {
        setAmount(total);
      }
      if (preset.categoryId) {
        setSelectedCategory(preset.categoryId);
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
    // Edit mode không cho đổi quỹ — bỏ qua validate quỹ (kể cả split income vốn không có fundId).
    if (!isEditMode && !isSplitIncome && !selectedFundId) {
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

    // Chi thiếu quỹ (chỉ áp dụng cho thêm mới)
    if (!isEditMode && transactionType === 'expense' && selectedFundId) {
      const targetFund = funds.find((f) => f.id === selectedFundId);
      const currentBalance = targetFund?.balance ?? 0;
      if (currentBalance < amount) {
        const deficit = Math.max(0, amount - currentBalance);

        const defaultCandidateId =
          defaultFund?.id && defaultFund.id !== selectedFundId
            ? defaultFund.id
            : '';

        const sourceCandidate =
          (defaultCandidateId &&
            (funds.find((f) => f.id === defaultCandidateId)?.balance ?? 0) >=
              deficit
            ? defaultCandidateId
            : '') ||
          fundsDefaultFirst.find(
            (f) => f.id !== selectedFundId && (f.balance ?? 0) >= deficit,
          )?.id ||
          '';

        setExpenseTargetFundId(selectedFundId);
        setExpenseDeficitAmount(deficit);
        setExpenseSourceFundId(sourceCandidate);
        setExpenseDeficitModalVisible(true);
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
        // Edit mode chỉ cho phép cập nhật danh mục, ghi chú và ngày giờ.
        // Số tiền/loại/quỹ là bất biến nên không cần đụng số dư quỹ.
        const txRef = doc(firestoreInstance, 'transactions', params.transactionId);
        await updateDoc(txRef, {
          categoryId: selectedCategory,
          note: note || null,
          transactionDate: date,
          updatedAt: serverTimestamp(),
        });

        showSnackbar({
          message: 'Đã cập nhật giao dịch',
          type: 'success',
        });
        markHomeDataChanged();
        markTransactionListNeedsRefresh();
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          goHome();
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
        } else {
          resetCreateForm();
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
              splitMsgParts.push(
                `"${name}"\n+${s.amount.toLocaleString('vi-VN')}đ - Số dư: ${balLabel}`,
              );
            }
          }
          void pushBalanceNotification(userId, {
            kind: 'transaction_added',
            title: 'Giao dịch mới',
            message: transactionType === 'expense'
              ? (() => {
                const minus = '\u2212';
                const signedDeltaLabel = `${minus}${amountLabel}`;
                return `Đã ghi nhận khoản chi ${amountLabel} (${categoryName}) từ "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalanceLabel}\nTổng số dư: ${totalLabel}`;
              })()
              : isSplitIncome
                ? `Đã ghi nhận khoản thu ${amountLabel} (${categoryName}) và phân bổ vào các quỹ:\n\n${splitMsgParts.join('\n\n')}\n\nTổng số dư: ${totalLabel}`
                : (() => {
                  const signedDeltaLabel = `+${amountLabel}`;
                  return `Đã ghi nhận khoản thu ${amountLabel} (${categoryName}) vào "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalanceLabel}\nTổng số dư: ${totalLabel}`;
                })(),
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

  const handleConfirmExpenseDeficit = async () => {
    if (!expenseTargetFundId) return;
    if (!expenseSourceFundId) {
      showSnackbar({
        message: 'Không có quỹ đủ để cấn trừ',
        type: 'error',
      });
      return;
    }

    const stored = await getStoredUser();
    const userId = stored?.uid;
    if (!userId) {
      showSnackbar({
        message: 'Không xác định được người dùng. Vui lòng đăng nhập lại.',
        type: 'error',
      });
      return;
    }

    const sourceFund = funds.find((f) => f.id === expenseSourceFundId);
    const targetFund = funds.find((f) => f.id === expenseTargetFundId);
    const currentSourceBalance = sourceFund?.balance ?? 0;
    const currentTargetBalance = targetFund?.balance ?? 0;

    const requiredTransfer = Math.max(0, amount - currentTargetBalance);

    if (requiredTransfer <= 0) {
      // Thực tế không thiếu nữa thì coi như lưu bình thường.
      setExpenseDeficitModalVisible(false);
      setIsSaving(true);
      // Gọi lại handleSave để dùng luồng lưu sẵn có.
      // (Chỉ áp dụng thêm mới, nên an toàn.)
      await handleSave();
      return;
    }

    setIsSaving(true);
    setExpenseDeficitSaving(true);
    try {
      let newFundBalanceAfter: number | undefined;
      await runTransaction(firestoreInstance, async (transaction) => {
        const payload = {
          userId,
          type: 'expense',
          categoryId: selectedCategory,
          amount,
          note: note || null,
          transactionDate: date,
          fundId: expenseTargetFundId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const newTxRef = doc(collection(firestoreInstance, 'transactions'));
        transaction.set(newTxRef, payload);

        const sourceRef = doc(firestoreInstance, 'funds', expenseSourceFundId);
        const targetRef = doc(firestoreInstance, 'funds', expenseTargetFundId);

        // Đọc lại trong transaction để tránh lệch dữ liệu.
        const [sourceSnap, targetSnap] = await Promise.all([
          transaction.get(sourceRef),
          transaction.get(targetRef),
        ]);
        const freshSource = sourceSnap.exists()
          ? (((sourceSnap.data()?.balance as number) ?? 0))
          : 0;
        const freshTarget = targetSnap.exists()
          ? (((targetSnap.data()?.balance as number) ?? 0))
          : 0;

        const freshRequiredTransfer = Math.max(0, amount - freshTarget);
        if (freshSource < freshRequiredTransfer) {
          throw new Error('Số dư quỹ không đủ để cấn trừ');
        }

        // Cấn trừ: lấy phần thiếu từ source để target đủ tiền, rồi trừ khoản chi.
        const deltaTarget = freshRequiredTransfer - amount; // net delta to target
        transaction.update(sourceRef, {
          balance: increment(-freshRequiredTransfer),
          updatedAt: serverTimestamp(),
        });
        transaction.update(targetRef, {
          balance: increment(deltaTarget),
          updatedAt: serverTimestamp(),
        });

        newFundBalanceAfter = freshTarget + deltaTarget;
      });

      showSnackbar({
        message: 'Đã lưu giao dịch thành công',
        type: 'success',
      });

      try {
        const totalBefore = funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
        const delta = -amount; // expense
        const totalAfter = totalBefore + delta;
        const totalLabel = `${totalAfter.toLocaleString('vi-VN')}đ`;

        const amountLabel = `${amount.toLocaleString('vi-VN')}đ`;
        const categoryName = categories.find((c) => c.id === selectedCategory)?.name ?? 'Danh mục';
        const fundName = funds.find((f) => f.id === expenseTargetFundId)?.name ?? 'Quỹ';
        const fundBalanceLabel =
          typeof newFundBalanceAfter === 'number'
            ? `${newFundBalanceAfter.toLocaleString('vi-VN')}đ`
            : '';

        void pushBalanceNotification(userId, {
          kind: 'transaction_added',
          title: 'Giao dịch mới',
          message: (() => {
            const minus = '\u2212';
            const deltaToTarget =
              typeof newFundBalanceAfter === 'number' ? newFundBalanceAfter - currentTargetBalance : 0;
            const deltaAbs = Math.abs(deltaToTarget).toLocaleString('vi-VN');
            const signedDeltaLabel = deltaToTarget >= 0 ? `+${deltaAbs}đ` : `${minus}${deltaAbs}đ`;
            return `Đã ghi nhận khoản chi ${amountLabel} (${categoryName}) từ "${fundName}".\n"${fundName}"\n${signedDeltaLabel} - Số dư: ${fundBalanceLabel}\nTổng số dư: ${totalLabel}`;
          })(),
        });
      } catch {
        // ignore notification errors
      }

      markHomeDataChanged();
      markTransactionListNeedsRefresh();

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        resetCreateForm();
      }
    } catch (error) {
      console.error('Error saving expense with deficit:', error);
      showSnackbar({
        message: 'Không thể lưu giao dịch. Vui lòng thử lại',
        type: 'error',
      });
    } finally {
      setExpenseDeficitSaving(false);
      setExpenseDeficitModalVisible(false);
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
            } else {
              goHome();
            }
          }}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={contentScrollRef}
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
              if (isEditMode) return;
              setTransactionType('expense');
              setSelectedCategory('');
              setSelectedFundId(defaultFund?.id ?? '');
            }}
            activeOpacity={isEditMode ? 1 : 0.8}
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
              if (isEditMode) return;
              setTransactionType('income');
              setSelectedCategory('');
              setSelectedFundId(defaultFund?.id ?? '');
            }}
            activeOpacity={isEditMode ? 1 : 0.8}
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
              !isEditMode &&
              !(transactionType === 'income' && splitIncomeEnabled)
            }
          />
        </View>

        {/* Date & Time Picker */}
        <View style={styles.inputGroup}>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeDate}>
              <DatePicker
                label="Ngày"
                value={date}
                onChange={handleDateChange}
                placeholder="Chọn ngày"
              />
            </View>
            <View style={styles.dateTimeTime}>
              <TimePicker
                label="Giờ"
                value={date}
                onChange={setDate}
              />
            </View>
          </View>
        </View>

        {/* Fund Selection - Cả thu và chi đều chọn quỹ */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            {isEditMode && initialData?.isSplitIncome
              ? 'Quỹ phân bổ'
              : transactionType === 'expense'
              ? 'Quỹ chi tiêu *'
              : 'Quỹ nhận tiền *'}
          </Text>
        {!isEditMode && transactionType === 'income' && funds.length > 1 && (
          <View style={styles.splitToggleRow}>
            <Text style={styles.splitToggleText}>Chia thu nhập theo quỹ</Text>
            <AppSwitch
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
                  setActiveSplitId('');
                  setSelectedIncomePresetId('');
                } else {
                  const firstFundId = incomeSplits[0]?.fundId;
                  if (firstFundId) setSelectedFundId(firstFundId);
                  setIncomeSplits([]);
                  setActiveSplitId('');
                  setSelectedIncomePresetId('');
                }
              }}
            />
          </View>
        )}
            {isLoading && funds.length === 0 ? (
              <View style={styles.fundLoadingHint}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.fundLoadingText}>Đang tải danh sách quỹ...</Text>
              </View>
            ) : funds.length === 0 ? (
              <TouchableOpacity
                style={styles.fundEmptyHint}
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  (
                    navigation.getParent() as { navigate: (name: 'FundManagement') => void } | undefined
                  )?.navigate('FundManagement');
                }}
              >
                <Text style={styles.fundEmptyText}>Chưa có quỹ nào. Nhấn để tạo quỹ</Text>
              </TouchableOpacity>
            ) : isEditMode && initialData?.isSplitIncome ? (
              <View style={styles.splitReadonlyContainer}>
                {(initialData.incomeSplits ?? []).map((s, idx) => {
                  const fund = funds.find((f) => f.id === s.fundId);
                  const fundName = fund?.name ?? 'Quỹ đã bị xóa';
                  const fundColor = fund?.color ?? colors.primary;
                  const FundIcon = getFundIconComponent(fund?.icon);
                  return (
                    <View
                      key={`${s.fundId || 'missing'}_${idx}`}
                      style={styles.splitReadonlyRow}
                    >
                      <View
                        style={[
                          styles.splitReadonlyIcon,
                          { backgroundColor: fundColor + '20' },
                        ]}
                      >
                        <FundIcon width={18} height={18} color={fundColor} />
                      </View>
                      <Text style={styles.splitReadonlyName} numberOfLines={1}>
                        {fundName}
                      </Text>
                      <Text style={styles.splitReadonlyAmount}>
                        +{(s.amount || 0).toLocaleString('vi-VN')}đ
                      </Text>
                    </View>
                  );
                })}
              </View>
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
                    const selectedFund = funds.find((f) => f.id === s.fundId);
                    const fundName = selectedFund?.name ?? 'Chọn quỹ';
                    const selectedFundColor = selectedFund?.color ?? colors.primary;
                    const isActive = s.id === activeSplitId;
                    return (
                      <View key={s.id} style={styles.splitRow}>
                        <View style={styles.splitHeaderRow}>
                          <TouchableOpacity
                            style={[
                              styles.splitFundSelect,
                              isActive && styles.splitFundSelectActive,
                            ]}
                            onPress={() =>
                              setActiveSplitId((prev) => (prev === s.id ? '' : s.id))
                            }
                            activeOpacity={0.8}
                          >
                            <View style={styles.splitFundSelectContent}>
                              {selectedFund ? (
                                <View
                                  style={[
                                    styles.splitFundSelectIconWrap,
                                    { backgroundColor: selectedFundColor + '20' },
                                  ]}
                                >
                                  {(() => {
                                    const FundIcon = getFundIconComponent(selectedFund.icon);
                                    return (
                                      <FundIcon
                                        width={16}
                                        height={16}
                                        color={selectedFundColor}
                                      />
                                    );
                                  })()}
                                </View>
                              ) : null}
                              <Text
                                style={[
                                  styles.splitFundSelectText,
                                  isActive && styles.splitFundSelectTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {fundName}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {incomeSplits.length > 1 && (
                            <TouchableOpacity
                              style={styles.splitRemoveBtn}
                              onPress={() => {
                                setIncomeSplits((prev) => {
                                  const next = prev.filter((p) => p.id !== s.id);
                                  if (isActive) setActiveSplitId('');
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

                        {isActive && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.inlineSplitFundGrid}
                            keyboardShouldPersistTaps="handled"
                          >
                            {fundsDefaultFirst.map((fund) => {
                              const isSelected = (s.fundId ?? '') === fund.id;
                              const usedByOther = incomeSplits.some(
                                (x) => x.fundId === fund.id && x.id !== s.id,
                              );
                              const disabled = usedByOther;
                              const fundColor = fund.color ?? colors.primary;

                              return (
                                <TouchableOpacity
                                  key={`${s.id}_${fund.id}`}
                                  style={[
                                    styles.fundItem,
                                    isSelected && styles.fundItemActive,
                                    isSelected && { borderColor: fundColor },
                                    disabled && { opacity: 0.5 },
                                  ]}
                                  onPress={() => {
                                    if (disabled) return;
                                    setIncomeSplits((prev) =>
                                      prev.map((p) =>
                                        p.id === s.id ? { ...p, fundId: fund.id } : p,
                                      ),
                                    );
                                    // chọn xong thì đóng danh sách quỹ
                                    setActiveSplitId('');
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[styles.fundItemIcon, { backgroundColor: fundColor + '20' }]}
                                  >
                                    {(() => {
                                      const FundIcon = getFundIconComponent(fund.icon);
                                      return <FundIcon width={20} height={20} color={fundColor} />;
                                    })()}
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
                                    {maskAmount(fund.balance)}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}

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
                          // Thêm dòng mới nhưng vẫn giữ trạng thái đóng list quỹ.
                          setActiveSplitId('');
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

                    {/* <Text
                      style={[
                        styles.splitSummary,
                        splitTotal === amount ? styles.splitSummaryOk : styles.splitSummaryBad,
                      ]}
                    >
                      {`Đã phân bổ: ${splitTotal.toLocaleString('vi-VN')}đ / Tổng: ${amount.toLocaleString('vi-VN')}đ`}
                    </Text> */}
                  </View>
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
                        isEditMode && !isSelected && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        if (isEditMode) return;
                        setSelectedFundId(fund.id);
                      }}
                      activeOpacity={isEditMode ? 1 : 0.7}
                    >
                      <View
                        style={[styles.fundItemIcon, { backgroundColor: fundColor + '20' }]}
                      >
                        {(() => {
                          const FundIcon = getFundIconComponent(fund.icon);
                          return <FundIcon width={20} height={20} color={fundColor} />;
                        })()}
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
                        {maskAmount(fund.balance)}
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
          <CategoryPicker
            label="Danh mục"
            categories={categories}
            value={selectedCategory}
            onChange={setSelectedCategory}
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

      <Modal
        isVisible={expenseDeficitModalVisible}
        backdropOpacity={0.45}
        animationIn="zoomIn"
        animationOut="zoomOut"
        onBackdropPress={() => {
          if (expenseDeficitSaving) return;
          setExpenseDeficitModalVisible(false);
        }}
        onBackButtonPress={() => {
          if (expenseDeficitSaving) return;
          setExpenseDeficitModalVisible(false);
        }}
      >
        <View style={styles.deficitModal}>
          <Text style={styles.deficitTitle}>Quỹ chi tiêu không đủ</Text>

          <Text style={styles.deficitSubtitle}>
            {(() => {
              const targetName =
                funds.find((f) => f.id === expenseTargetFundId)?.name ?? 'Quỹ';
              return `Thiếu ${expenseDeficitAmount.toLocaleString('vi-VN')}đ tại "${targetName}"`;
            })()}
          </Text>

          <Text style={styles.deficitHint}>Chọn quỹ để trừ bù số tiền thiếu</Text>

          {isLoading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center' }}>
                Đang tải danh sách quỹ...
              </Text>
            </View>
          ) : (
            <FundPicker
              layout="horizontal"
              funds={fundsDefaultFirst.filter(
                (f) =>
                  f.id !== expenseTargetFundId &&
                  (f.balance ?? 0) >= expenseDeficitAmount,
              )}
              selectedFundId={expenseSourceFundId}
              onSelect={setExpenseSourceFundId}
              emptyText="Không có quỹ nào đủ số dư để cấn trừ"
              containerStyle={{ marginTop: 10 }}
            />
          )}

          <View style={styles.deficitActions}>
            <TouchableOpacity
              style={styles.deficitCancelBtn}
              onPress={() => setExpenseDeficitModalVisible(false)}
              disabled={expenseDeficitSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.deficitCancelText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deficitConfirmBtn,
                !expenseSourceFundId && { opacity: 0.6 },
              ]}
              onPress={handleConfirmExpenseDeficit}
              disabled={expenseDeficitSaving || !expenseSourceFundId}
              activeOpacity={0.8}
            >
              {expenseDeficitSaving ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.deficitConfirmText}>Cấn trừ & Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
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

  deficitModal: {
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginHorizontal: 22,
  },
  deficitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  deficitSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  deficitHint: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  deficitSourceRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  deficitSourceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deficitSourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deficitSourceTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  deficitSourceRowSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  deficitSourceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  deficitSourceBalance: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  deficitActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    justifyContent: 'space-between',
  },

  deficitSourcesScrollContainer: {
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deficitCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  deficitCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  deficitConfirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  deficitConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeDate: {
    flex: 1.4,
  },
  dateTimeTime: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
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
  fundLoadingHint: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
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
  splitReadonlyContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.backgroundSecondary,
    gap: 8,
  },
  splitReadonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  splitReadonlyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  splitReadonlyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  splitReadonlyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
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
  splitFundSelectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitFundSelectIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  inlineSplitFundGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
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
