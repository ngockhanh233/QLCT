import React, { useCallback, useMemo, useState } from 'react';
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
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../../../utils/color';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import CheckIcon from '../../../../assets/icons/CheckIcon';
import ClockIcon from '../../../../assets/icons/ClockIcon';
import { showSnackbar } from '../../../../utils/snackbar';
import { CurrencyInput, SwipeableRow, DatePicker, FundPicker, ErrorPopup, AppSwitch } from '../../../../components';
import EditNoteDateModal from './components/EditNoteDateModal';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { useDebts } from '../../../../contexts/DebtsContext';
import {
  debtRemaining,
  type DebtDirection,
  type DebtRecord,
} from '../../../../services/debts';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
import type { RootStackParamList } from '../../MainScreen';

type TabKey = 'lent' | 'borrowed';

const DebtsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { funds, defaultFund, refresh: refreshFunds } = useFunds();
  const {
    debts,
    isLoading,
    totalsByDirection,
    createDebt,
    addRepayment,
    deleteDebt,
    reload: reloadDebts,
    updateDebtNoteAndDate,
  } = useDebts();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([reloadDebts(), refreshFunds()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [reloadDebts, refreshFunds]);

  const [tab, setTab] = useState<TabKey>('lent');
  const [searchQuery, setSearchQuery] = useState('');

  // Create debt modal
  const [createVisible, setCreateVisible] = useState(false);
  const [formDirection, setFormDirection] = useState<DebtDirection>('lent');
  const [formCounterparty, setFormCounterparty] = useState('');
  const [formPrincipal, setFormPrincipal] = useState(0);
  const [formFundId, setFormFundId] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<Date>(new Date());
  const [formDueEnabled, setFormDueEnabled] = useState(false);
  const [formDueDate, setFormDueDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [formNote, setFormNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Repay modal
  const [repayVisible, setRepayVisible] = useState(false);
  const [repayDebt, setRepayDebt] = useState<DebtRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState(0);
  const [repayFundId, setRepayFundId] = useState<string>('');
  const [repayDate, setRepayDate] = useState<Date>(new Date());
  const [repayNote, setRepayNote] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  // Delete debt modal
  const [deleteDebtTarget, setDeleteDebtTarget] = useState<DebtRecord | null>(null);
  const [deleteDebtFundId, setDeleteDebtFundId] = useState<string>('');
  const [deleteDebtOffsetId, setDeleteDebtOffsetId] = useState<string>('');
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);

  // Edit debt modal
  const [editDebtTarget, setEditDebtTarget] = useState<DebtRecord | null>(null);

  // Error popup
  const [errorPopup, setErrorPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: 'Lỗi', message: '' });

  const fundsDefaultFirst = useMemo(() => {
    return [...funds].sort((a, b) => {
      const aDefault = a.isDefault ? 1 : 0;
      const bDefault = b.isDefault ? 1 : 0;
      if (aDefault !== bDefault) return bDefault - aDefault;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [funds]);

  const filteredDebts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return debts.filter((d) => {
      if (d.direction !== tab) return false;
      if (!q) return true;
      return (d.counterparty ?? '').toLowerCase().includes(q);
    });
  }, [debts, tab, searchQuery]);

  const openCreate = () => {
    setFormDirection(tab);
    setFormCounterparty('');
    setFormPrincipal(0);
    setFormFundId(defaultFund?.id ?? fundsDefaultFirst[0]?.id ?? '');
    setFormStartDate(new Date());
    setFormDueEnabled(false);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormDueDate(d);
    setFormNote('');
    setCreateVisible(true);
  };

  const closeCreate = useCallback(() => {
    if (isSaving) return;
    setCreateVisible(false);
  }, [isSaving]);

  const handleCreate = async () => {
    const name = formCounterparty.trim();
    if (!name) {
      showSnackbar({ type: 'error', message: 'Vui lòng nhập tên người vay/cho vay' });
      return;
    }
    if (formPrincipal <= 0) {
      showSnackbar({ type: 'error', message: 'Vui lòng nhập số tiền' });
      return;
    }
    if (!formFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    setIsSaving(true);
    try {
      await createDebt({
        direction: formDirection,
        counterparty: name,
        principal: formPrincipal,
        fundId: formFundId,
        startDate: formStartDate,
        dueDate: formDueEnabled ? formDueDate : null,
        note: formNote.trim() || null,
      });
      setCreateVisible(false);
      showSnackbar({
        type: 'success',
        message:
          formDirection === 'lent' ? 'Đã ghi nhận khoản cho vay' : 'Đã ghi nhận khoản vay',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể lưu khoản nợ';
      showSnackbar({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const openRepay = (debt: DebtRecord) => {
    const remaining = debtRemaining(debt);
    setRepayDebt(debt);
    setRepayAmount(remaining);
    const originalExists =
      !!debt.fundId && funds.some((f) => f.id === debt.fundId);
    setRepayFundId(
      originalExists
        ? debt.fundId!
        : defaultFund?.id || fundsDefaultFirst[0]?.id || '',
    );
    setRepayDate(new Date());
    setRepayNote('');
    setRepayVisible(true);
  };

  const closeRepay = useCallback(() => {
    if (isRepaying) return;
    setRepayVisible(false);
    setRepayDebt(null);
  }, [isRepaying]);

  const handleRepay = async () => {
    if (!repayDebt) return;
    if (repayAmount <= 0) {
      showSnackbar({ type: 'error', message: 'Vui lòng nhập số tiền' });
      return;
    }
    if (!repayFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    const remaining = debtRemaining(repayDebt);
    if (repayAmount > remaining) {
      const isLent = repayDebt.direction === 'lent';
      setErrorPopup({
        visible: true,
        title: isLent ? 'Số tiền thu vượt quá' : 'Số tiền trả vượt quá',
        message: `Số tiền nhập (${repayAmount.toLocaleString(
          'vi-VN',
        )}đ) vượt quá số ${isLent ? 'còn phải thu' : 'còn phải trả'} (${remaining.toLocaleString(
          'vi-VN',
        )}đ).`,
      });
      return;
    }
    setIsRepaying(true);
    try {
      await addRepayment(repayDebt.id, {
        amount: repayAmount,
        fundId: repayFundId,
        date: repayDate,
        note: repayNote.trim() || null,
      });
      setRepayVisible(false);
      setRepayDebt(null);
      showSnackbar({ type: 'success', message: 'Đã ghi nhận' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể ghi nhận';
      setErrorPopup({ visible: true, title: 'Lỗi', message: msg });
    } finally {
      setIsRepaying(false);
    }
  };

  const openDeleteDebt = (debt: DebtRecord) => {
    setDeleteDebtTarget(debt);
    // Fallback nếu quỹ gốc đã bị xóa.
    const originalExists =
      !!debt.fundId && funds.some((f) => f.id === debt.fundId);
    setDeleteDebtFundId(
      originalExists
        ? debt.fundId!
        : defaultFund?.id || fundsDefaultFirst[0]?.id || '',
    );
    setDeleteDebtOffsetId('');
  };

  const closeDeleteDebt = useCallback(() => {
    if (isDeletingDebt) return;
    setDeleteDebtTarget(null);
    setDeleteDebtFundId('');
    setDeleteDebtOffsetId('');
  }, [isDeletingDebt]);

  const handleConfirmDeleteDebt = async () => {
    if (!deleteDebtTarget) return;
    const rem = debtRemaining(deleteDebtTarget);
    if (rem > 0 && !deleteDebtFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    setIsDeletingDebt(true);
    try {
      await deleteDebt(
        deleteDebtTarget.id,
        rem > 0
          ? {
              refundFundId: deleteDebtFundId,
              offsetSourceFundId: deleteDebtOffsetId || undefined,
            }
          : undefined,
      );
      setDeleteDebtTarget(null);
      showSnackbar({ type: 'success', message: 'Đã xóa khoản nợ' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa';
      showSnackbar({ type: 'error', message: msg });
    } finally {
      setIsDeletingDebt(false);
    }
  };

  const renderCard = (debt: DebtRecord) => {
    const remaining = debtRemaining(debt);
    const totalPaid = debt.principal - remaining;
    const pct = debt.principal > 0 ? Math.min(100, (totalPaid / debt.principal) * 100) : 0;
    const fund = funds.find((f) => f.id === debt.fundId);
    const isSettled = debt.status === 'settled';
    const isLent = debt.direction === 'lent';
    const accentColor = isLent ? colors.success : colors.error;

    // Trạng thái hạn trả: chỉ tính khi chưa tất toán và có dueDate.
    let dueStatus: 'today' | 'overdue' | null = null;
    if (debt.dueDate && !isSettled) {
      const dayNum = (d: Date) =>
        d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      const dueN = dayNum(debt.dueDate);
      const todayN = dayNum(new Date());
      if (dueN === todayN) dueStatus = 'today';
      else if (dueN < todayN) dueStatus = 'overdue';
    }

    return (
      <View key={debt.id} style={styles.cardWrapper}>
        <SwipeableRow
          onEdit={() => setEditDebtTarget(debt)}
          onSecondary={!isSettled ? () => openRepay(debt) : undefined}
          secondaryText={isLent ? 'Thu' : 'Trả'}
          secondaryButtonColor={accentColor}
          onDelete={() => openDeleteDebt(debt)}
          deleteText="Xóa"
          borderRadius={16}
          buttonWidth={70}
        >
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DebtDetail', { debtId: debt.id })}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {debt.counterparty}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isLent
                      ? colors.success + '20'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusOpenText,
                    { color: isLent ? colors.success : '#B91C1C' },
                  ]}
                >
                  {isLent ? 'Cho vay' : 'Đi vay'}
                </Text>
              </View>
              {isSettled && (
                <View
                  style={[
                    styles.statusBadge,
                    styles.statusSettled,
                    styles.statusSettledRight,
                  ]}
                >
                  <CheckIcon width={12} height={12} color={colors.success} />
                  <Text style={styles.statusSettledText}>Đã tất toán</Text>
                </View>
              )}
            </View>

            <View style={styles.amountRow}>
              <View style={styles.amountBlock}>
                <Text style={styles.amountLabel}>Còn lại</Text>
                <Text style={[styles.amountRemain, { color: accentColor }]}>
                  {remaining.toLocaleString('vi-VN')}đ
                </Text>
              </View>
              <View style={styles.amountBlock}>
                <Text style={styles.amountLabel}>Gốc</Text>
                <Text style={styles.amountPrincipal}>
                  {debt.principal.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>

            {debt.principal > 0 && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${pct}%`, backgroundColor: accentColor },
                  ]}
                />
              </View>
            )}

            <View style={styles.metaRow}>
              {fund ? (
                <View style={styles.metaItem}>
                  {(() => {
                    const FundIcon = getFundIconComponent(fund.icon);
                    const c = fund.color ?? colors.textSecondary;
                    return <FundIcon width={12} height={12} color={c} />;
                  })()}
                  <Text style={styles.metaText} numberOfLines={1}>
                    {fund.name}
                  </Text>
                </View>
              ) : debt.fundId ? (
                <Text style={styles.metaTextDeleted} numberOfLines={1}>
                  Quỹ đã bị xóa
                </Text>
              ) : null}
              <Text style={styles.metaText}>
                {debt.startDate.toLocaleDateString('vi-VN')}
              </Text>
              {debt.dueDate && (
                <Text style={styles.metaTextDue}>
                  Hạn: {debt.dueDate.toLocaleDateString('vi-VN')}
                </Text>
              )}
            </View>

            {!!debt.repayments.length && (
              <Text style={styles.repayCount}>
                {debt.repayments.length} lần {isLent ? 'thu' : 'trả'} •{' '}
                {totalPaid.toLocaleString('vi-VN')}đ
              </Text>
            )}

            {debt.note && <Text style={styles.cardNote}>{debt.note}</Text>}

            {dueStatus && (
              <View style={styles.dueStatusRow}>
                <View
                  style={[
                    styles.dueStatusBadge,
                    dueStatus === 'today'
                      ? styles.dueStatusToday
                      : styles.dueStatusOverdue,
                  ]}
                >
                  <ClockIcon
                    width={12}
                    height={12}
                    color={dueStatus === 'today' ? '#B45309' : '#B91C1C'}
                  />
                  <Text
                    style={[
                      styles.dueStatusText,
                      {
                        color: dueStatus === 'today' ? '#B45309' : '#B91C1C',
                      },
                    ]}
                  >
                    {dueStatus === 'today' ? 'Đã đến ngày hạn' : 'Trễ hạn'}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </SwipeableRow>
      </View>
    );
  };

  const total =
    tab === 'lent' ? totalsByDirection.lent : totalsByDirection.borrowed;
  const tabAccent = tab === 'lent' ? colors.success : colors.error;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          activeOpacity={0.8}
        >
          <ChevronLeftIcon width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm theo tên người..."
            placeholderTextColor={colors.textLight}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            tab === 'lent' && styles.tabItemActiveLent,
          ]}
          onPress={() => setTab('lent')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabText, tab === 'lent' && styles.tabTextActive]}
          >
            Phải thu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabItem,
            tab === 'borrowed' && styles.tabItemActiveBorrowed,
          ]}
          onPress={() => setTab('borrowed')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.tabText, tab === 'borrowed' && styles.tabTextActive]}
          >
            Phải trả
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.totalBox, { backgroundColor: tabAccent + '12' }]}>
        <Text style={styles.totalLabel}>
          {tab === 'lent' ? 'Tổng phải thu' : 'Tổng phải trả'}
        </Text>
        <Text style={[styles.totalAmount, { color: tabAccent }]}>
          {total.toLocaleString('vi-VN')}đ
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(120, insets.bottom + 120) }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handlePullRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {filteredDebts.length === 0 ? (
            <View style={styles.emptyBox}>
              <WalletIcon width={42} height={42} color={colors.textLight} />
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'Không tìm thấy'
                  : tab === 'lent'
                  ? 'Chưa có khoản cho vay'
                  : 'Chưa có khoản vay'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `Không có khoản nào khớp "${searchQuery}".`
                  : `Bấm nút bên dưới để tạo mới. Vuốt card sang trái để ghi nhận ${
                      tab === 'lent' ? 'thu' : 'trả'
                    } hoặc xóa.`}
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>{filteredDebts.map(renderCard)}</View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate} activeOpacity={0.85}>
          <Text style={styles.createBtnText}>
            {tab === 'lent' ? '+ Ghi nhận cho vay' : '+ Ghi nhận đi vay'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create modal */}
      <Modal
        isVisible={createVisible}
        onBackdropPress={closeCreate}
        onBackButtonPress={closeCreate}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.modalContent}>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>Ghi nhận khoản vay/nợ</Text>

            <View style={styles.directionToggle}>
              <TouchableOpacity
                style={[
                  styles.directionItem,
                  formDirection === 'lent' && styles.directionItemActiveLent,
                ]}
                onPress={() => setFormDirection('lent')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.directionText,
                    formDirection === 'lent' && styles.directionTextActive,
                  ]}
                >
                  Cho vay
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.directionItem,
                  formDirection === 'borrowed' && styles.directionItemActiveBorrowed,
                ]}
                onPress={() => setFormDirection('borrowed')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.directionText,
                    formDirection === 'borrowed' && styles.directionTextActive,
                  ]}
                >
                  Đi vay
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              {formDirection === 'lent' ? 'Người vay' : 'Người cho vay'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={formCounterparty}
              onChangeText={setFormCounterparty}
              placeholder="VD: Anh iu Khánh"
              placeholderTextColor={colors.textLight}
            />

            <Text style={styles.inputLabel}>Số tiền</Text>
            <CurrencyInput
              value={formPrincipal}
              onChange={setFormPrincipal}
              placeholder="0"
              inputWrapperStyle={styles.amountInputWrap}
              inputStyle={styles.amountInputText}
              suffixStyle={styles.amountInputSuffix}
            />

            <Text style={styles.inputLabel}>
              {formDirection === 'lent' ? 'Quỹ trừ tiền' : 'Quỹ nhận tiền'}
            </Text>
            <FundPicker
              funds={fundsDefaultFirst}
              selectedFundId={formFundId}
              onSelect={setFormFundId}
              isDisabled={(f) =>
                formDirection === 'lent' && (f.balance ?? 0) < formPrincipal
              }
              disabledReason={() => 'Không đủ'}
            />

            <Text style={styles.inputLabel}>Ngày ghi nhận</Text>
            <DatePicker value={formStartDate} onChange={setFormStartDate} />

            <View style={styles.dueRow}>
              <Text style={styles.inputLabel}>Hạn trả</Text>
              <AppSwitch
                value={formDueEnabled}
                onValueChange={setFormDueEnabled}
              />
            </View>
            {formDueEnabled && (
              <DatePicker
                value={formDueDate}
                onChange={setFormDueDate}
                minDate={formStartDate}
              />
            )}

            <Text style={styles.inputLabel}>Ghi chú</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMulti]}
              value={formNote}
              onChangeText={setFormNote}
              placeholder="Nhập ghi chú"
              placeholderTextColor={colors.textLight}
              multiline
            />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeCreate}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSave}
              onPress={handleCreate}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Repay modal */}
      <Modal
        isVisible={repayVisible}
        onBackdropPress={closeRepay}
        onBackButtonPress={closeRepay}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.modalContent}>
          {repayDebt && (
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                {repayDebt.direction === 'lent' ? 'Ghi nhận thu tiền' : 'Ghi nhận trả nợ'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {repayDebt.counterparty} • Còn lại{' '}
                {debtRemaining(repayDebt).toLocaleString('vi-VN')}đ
              </Text>

              <Text style={styles.inputLabel}>Số tiền</Text>
              <CurrencyInput
                value={repayAmount}
                onChange={setRepayAmount}
                placeholder="0"
                inputWrapperStyle={styles.amountInputWrap}
                inputStyle={styles.amountInputText}
                suffixStyle={styles.amountInputSuffix}
              />

              <Text style={styles.inputLabel}>
                {repayDebt.direction === 'lent' ? 'Quỹ nhận tiền' : 'Quỹ trừ tiền'}
              </Text>
              <FundPicker
                funds={fundsDefaultFirst}
                selectedFundId={repayFundId}
                onSelect={setRepayFundId}
                isDisabled={(f) =>
                  repayDebt.direction === 'borrowed' &&
                  (f.balance ?? 0) < repayAmount
                }
                disabledReason={() => 'Không đủ'}
              />

              <Text style={styles.inputLabel}>Ngày</Text>
              <DatePicker value={repayDate} onChange={setRepayDate} />

              <Text style={styles.inputLabel}>Ghi chú</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMulti]}
                value={repayNote}
                onChangeText={setRepayNote}
                placeholder="Nhập ghi chú"
                placeholderTextColor={colors.textLight}
                multiline
              />
            </ScrollView>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeRepay}
              disabled={isRepaying}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSave}
              onPress={handleRepay}
              disabled={isRepaying}
              activeOpacity={0.85}
            >
              {isRepaying ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete debt modal */}
      <Modal
        isVisible={!!deleteDebtTarget}
        onBackdropPress={closeDeleteDebt}
        onBackButtonPress={closeDeleteDebt}
        style={styles.modalCenter}
        avoidKeyboard
      >
        <View style={styles.modalContentCenter}>
          {deleteDebtTarget && (() => {
            const isLent = deleteDebtTarget.direction === 'lent';
            const rem = debtRemaining(deleteDebtTarget);
            const primaryFund = funds.find((f) => f.id === deleteDebtFundId);
            const primaryBalance = primaryFund?.balance ?? 0;
            const needsOffset = !isLent && rem > 0 && primaryBalance < rem;
            const deficit = needsOffset ? rem - primaryBalance : 0;

            return (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.modalTitle}>Xóa khoản nợ</Text>
                <Text style={styles.modalSubtitle}>
                  {deleteDebtTarget.counterparty} •{' '}
                  {rem > 0 ? (
                    <>
                      Chưa thanh toán{' '}
                      <Text style={styles.modalRefundAmount}>
                        {rem.toLocaleString('vi-VN')}đ
                      </Text>
                    </>
                  ) : (
                    'Đã tất toán'
                  )}
                </Text>

                {rem > 0 && (
                  <>
                    <Text style={styles.modalHint}>
                      Các giao dịch đã trả/thu trước đó được giữ nguyên trong quỹ.
                      Chỉ phần chưa thanh toán sẽ được {isLent ? 'cộng vào' : 'trừ khỏi'} quỹ
                      bạn chọn.
                    </Text>

                    <Text style={styles.inputLabel}>
                      {isLent ? 'Quỹ nhận lại' : 'Quỹ trừ tiền'}
                    </Text>
                    <FundPicker
                      funds={fundsDefaultFirst}
                      selectedFundId={deleteDebtFundId}
                      onSelect={(id) => {
                        setDeleteDebtFundId(id);
                        setDeleteDebtOffsetId('');
                      }}
                    />

                    {needsOffset && (
                      <>
                        <View style={styles.deficitNotice}>
                          <Text style={styles.deficitNoticeTitle}>
                            "{primaryFund?.name ?? 'Quỹ'}" không đủ
                          </Text>
                          <Text style={styles.deficitNoticeText}>
                            Thiếu {deficit.toLocaleString('vi-VN')}đ. Chọn quỹ khác
                            để cấn trừ phần còn thiếu.
                          </Text>
                        </View>
                        <Text style={styles.inputLabel}>Cấn trừ từ</Text>
                        <FundPicker
                          funds={fundsDefaultFirst.filter(
                            (f) =>
                              f.id !== deleteDebtFundId &&
                              (f.balance ?? 0) >= deficit,
                          )}
                          selectedFundId={deleteDebtOffsetId}
                          onSelect={setDeleteDebtOffsetId}
                          emptyText="Không có quỹ nào đủ số dư để cấn trừ."
                        />
                      </>
                    )}
                  </>
                )}

                {rem === 0 && (
                  <Text style={styles.modalHint}>
                    Xóa khoản nợ này khỏi danh sách. Các giao dịch liên kết cũng bị xóa.
                  </Text>
                )}
              </ScrollView>
            );
          })()}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeDeleteDebt}
              disabled={isDeletingDebt}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalDelete,
                (() => {
                  if (!deleteDebtTarget) return { opacity: 0.5 };
                  const isLent = deleteDebtTarget.direction === 'lent';
                  const rem = debtRemaining(deleteDebtTarget);
                  if (rem > 0 && !deleteDebtFundId) return { opacity: 0.5 };
                  if (rem > 0 && !isLent) {
                    const primary = funds.find((f) => f.id === deleteDebtFundId);
                    const needsOff = (primary?.balance ?? 0) < rem;
                    if (needsOff && !deleteDebtOffsetId) return { opacity: 0.5 };
                  }
                  return null;
                })(),
              ]}
              onPress={handleConfirmDeleteDebt}
              disabled={(() => {
                if (isDeletingDebt) return true;
                if (!deleteDebtTarget) return true;
                const isLent = deleteDebtTarget.direction === 'lent';
                const rem = debtRemaining(deleteDebtTarget);
                if (rem > 0 && !deleteDebtFundId) return true;
                if (rem > 0 && !isLent) {
                  const primary = funds.find((f) => f.id === deleteDebtFundId);
                  const needsOff = (primary?.balance ?? 0) < rem;
                  if (needsOff && !deleteDebtOffsetId) return true;
                }
                return false;
              })()}
              activeOpacity={0.85}
            >
              {isDeletingDebt ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Xóa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <EditNoteDateModal
        visible={!!editDebtTarget}
        onClose={() => setEditDebtTarget(null)}
        title="Chỉnh sửa khoản nợ"
        subtitle={
          editDebtTarget
            ? `${editDebtTarget.counterparty} • ${
                editDebtTarget.direction === 'lent' ? 'Cho vay' : 'Đi vay'
              } • ${editDebtTarget.principal.toLocaleString('vi-VN')}đ`
            : undefined
        }
        hint="Chỉ có thể sửa ghi chú và ngày giờ. Số tiền, quỹ và các giao dịch trả/thu liên quan sẽ giữ nguyên."
        initialNote={editDebtTarget?.note ?? ''}
        initialDate={editDebtTarget?.startDate ?? new Date()}
        onSave={async (note, date) => {
          if (!editDebtTarget) return;
          await updateDebtNoteAndDate(editDebtTarget.id, {
            note,
            startDate: date,
          });
        }}
        successMessage="Đã cập nhật khoản nợ"
      />

      <ErrorPopup
        visible={errorPopup.visible}
        title={errorPopup.title}
        message={errorPopup.message}
        onClose={() => setErrorPopup((s) => ({ ...s, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  searchBox: {
    flex: 1,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 4,
  },
  searchClearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  searchClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 12,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabItemActiveLent: { backgroundColor: '#22C55E' },
  tabItemActiveBorrowed: { backgroundColor: '#EF4444' },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  totalBox: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  totalAmount: { fontSize: 18, fontWeight: '900' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  emptyBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: colors.text },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardList: { gap: 12 },
  cardWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 8 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusSettled: { backgroundColor: colors.success + '20' },
  statusSettledRight: { marginLeft: 'auto' },
  statusSettledText: { fontSize: 11, fontWeight: '700', color: colors.success },
  statusOpenText: { fontSize: 11, fontWeight: '700' },
  amountRow: { flexDirection: 'row', gap: 20 },
  amountBlock: { flex: 1 },
  amountLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  amountRemain: { marginTop: 2, fontSize: 18, fontWeight: '900' },
  amountPrincipal: { marginTop: 2, fontSize: 14, fontWeight: '700', color: colors.text },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  metaTextDue: { fontSize: 11, fontWeight: '700', color: colors.error },
  metaTextDeleted: { fontSize: 11, fontWeight: '700', color: colors.error, fontStyle: 'italic' },
  repayCount: { fontSize: 11, fontWeight: '600', color: colors.primary },
  cardNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  dueStatusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dueStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dueStatusToday: {
    backgroundColor: '#FEF3C7',
  },
  dueStatusOverdue: {
    backgroundColor: '#FEE2E2',
  },
  dueStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },

  // Modal
  modal: { justifyContent: 'flex-end', margin: 0 },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '92%',
  },
  modalBody: { flexGrow: 0 },
  modalBodyContent: { paddingBottom: 10, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary },
  directionToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  directionItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  directionItemActiveLent: { backgroundColor: '#22C55E' },
  directionItemActiveBorrowed: { backgroundColor: '#EF4444' },
  directionText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  directionTextActive: { color: colors.white },
  inputLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 4 },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textInputMulti: { minHeight: 60, textAlignVertical: 'top' },
  amountInputWrap: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountInputText: { fontSize: 18, fontWeight: '800', color: colors.text },
  amountInputSuffix: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  fundPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  fundPickItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.white,
  },
  fundPickIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fundPickTextCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  fundPickText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  fundPickBalance: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  fundPickInsuff: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  modalSave: {
    flex: 1.4,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 14, fontWeight: '900', color: colors.white },
  modalCenter: {
    justifyContent: 'center',
    margin: 20,
  },
  modalContentCenter: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  modalHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalRefundAmount: {
    fontWeight: '900',
    color: colors.text,
  },
  modalDelete: {
    flex: 1.4,
    backgroundColor: colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deficitNotice: {
    marginTop: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.error + '12',
  },
  deficitNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.error,
  },
  deficitNoticeText: {
    marginTop: 2,
    fontSize: 12,
    color: colors.error,
  },
  deficitNoCandidate: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DebtsScreen;
