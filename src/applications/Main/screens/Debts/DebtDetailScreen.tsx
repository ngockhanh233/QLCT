import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors } from '../../../../utils/color';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import CheckIcon from '../../../../assets/icons/CheckIcon';
import { showSnackbar } from '../../../../utils/snackbar';
import { CurrencyInput, DatePicker, SwipeableRow, FundPicker, ErrorPopup } from '../../../../components';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { useDebts } from '../../../../contexts/DebtsContext';
import { debtRemaining, type DebtRepayment } from '../../../../services/debts';
import EditNoteDateModal from './components/EditNoteDateModal';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
import CalendarIcon from '../../../../assets/icons/CalendarIcon';
import ClockIcon from '../../../../assets/icons/ClockIcon';
import type { RootStackParamList } from '../../MainScreen';

const DebtDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DebtDetail'>>();
  const debtId = route.params?.debtId;

  const { funds, defaultFund } = useFunds();
  const {
    debts,
    addRepayment,
    deleteDebt,
    deleteRepayment,
    updateRepaymentNoteAndDate,
  } = useDebts();

  const debt = useMemo(() => debts.find((d) => d.id === debtId), [debts, debtId]);

  const fundsDefaultFirst = useMemo(() => {
    return [...funds].sort((a, b) => {
      const aDefault = a.isDefault ? 1 : 0;
      const bDefault = b.isDefault ? 1 : 0;
      if (aDefault !== bDefault) return bDefault - aDefault;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [funds]);

  const [repayVisible, setRepayVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState(0);
  const [repayFundId, setRepayFundId] = useState<string>('');
  const [repayDate, setRepayDate] = useState<Date>(new Date());
  const [repayNote, setRepayNote] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);
  const [errorPopup, setErrorPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: 'Lỗi', message: '' });

  // Edit repayment modal state
  const [editRepayTarget, setEditRepayTarget] = useState<DebtRepayment | null>(null);

  // Delete repayment modal state
  const [deleteRepayVisible, setDeleteRepayVisible] = useState(false);
  const [deleteRepayTarget, setDeleteRepayTarget] = useState<{
    id: string;
    amount: number;
    fundId: string;
  } | null>(null);
  const [deleteRepayFundId, setDeleteRepayFundId] = useState<string>('');
  const [deleteRepayOffsetId, setDeleteRepayOffsetId] = useState<string>('');
  const [isDeletingRepay, setIsDeletingRepay] = useState(false);

  // Delete debt modal state
  const [deleteDebtVisible, setDeleteDebtVisible] = useState(false);
  const [deleteDebtFundId, setDeleteDebtFundId] = useState<string>('');
  const [deleteDebtOffsetId, setDeleteDebtOffsetId] = useState<string>('');
  const [isDeletingDebt, setIsDeletingDebt] = useState(false);

  const openRepay = useCallback(() => {
    if (!debt) return;
    setRepayAmount(debtRemaining(debt));
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
  }, [debt, funds, defaultFund, fundsDefaultFirst]);

  const closeRepay = useCallback(() => {
    if (isRepaying) return;
    setRepayVisible(false);
  }, [isRepaying]);

  const handleRepay = async () => {
    if (!debt) return;
    if (repayAmount <= 0) {
      showSnackbar({ type: 'error', message: 'Vui lòng nhập số tiền' });
      return;
    }
    if (!repayFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    const remaining = debtRemaining(debt);
    if (repayAmount > remaining) {
      const isLent = debt.direction === 'lent';
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
      await addRepayment(debt.id, {
        amount: repayAmount,
        fundId: repayFundId,
        date: repayDate,
        note: repayNote.trim() || null,
      });
      setRepayVisible(false);
      showSnackbar({ type: 'success', message: 'Đã ghi nhận' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể ghi nhận';
      setErrorPopup({ visible: true, title: 'Lỗi', message: msg });
    } finally {
      setIsRepaying(false);
    }
  };

  const openDeleteDebt = () => {
    if (!debt) return;
    // Fallback nếu quỹ gốc đã bị xóa.
    const originalExists =
      !!debt.fundId && funds.some((f) => f.id === debt.fundId);
    setDeleteDebtFundId(
      originalExists
        ? debt.fundId!
        : defaultFund?.id || fundsDefaultFirst[0]?.id || '',
    );
    setDeleteDebtOffsetId('');
    setDeleteDebtVisible(true);
  };

  const closeDeleteDebt = useCallback(() => {
    if (isDeletingDebt) return;
    setDeleteDebtVisible(false);
    setDeleteDebtFundId('');
    setDeleteDebtOffsetId('');
  }, [isDeletingDebt]);

  const handleConfirmDeleteDebt = async () => {
    if (!debt) return;
    const remaining = debtRemaining(debt);
    // Nếu remaining=0 thì không cần fund. Ngược lại bắt buộc phải chọn.
    if (remaining > 0 && !deleteDebtFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    setIsDeletingDebt(true);
    try {
      await deleteDebt(
        debt.id,
        remaining > 0
          ? {
              refundFundId: deleteDebtFundId,
              offsetSourceFundId: deleteDebtOffsetId || undefined,
            }
          : undefined,
      );
      setDeleteDebtVisible(false);
      showSnackbar({ type: 'success', message: 'Đã xóa khoản nợ' });
      if (navigation.canGoBack()) navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa';
      showSnackbar({ type: 'error', message: msg });
    } finally {
      setIsDeletingDebt(false);
    }
  };

  const openDeleteRepay = (repaymentId: string, amount: number, fundId: string) => {
    setDeleteRepayTarget({ id: repaymentId, amount, fundId });
    setDeleteRepayFundId(fundId);
    setDeleteRepayOffsetId('');
    setDeleteRepayVisible(true);
  };

  const closeDeleteRepay = useCallback(() => {
    if (isDeletingRepay) return;
    setDeleteRepayVisible(false);
    setDeleteRepayTarget(null);
    setDeleteRepayFundId('');
    setDeleteRepayOffsetId('');
  }, [isDeletingRepay]);

  const handleConfirmDeleteRepay = async () => {
    if (!debt || !deleteRepayTarget) return;
    if (!deleteRepayFundId) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ' });
      return;
    }
    setIsDeletingRepay(true);
    try {
      await deleteRepayment(debt.id, deleteRepayTarget.id, {
        refundFundId: deleteRepayFundId,
        offsetSourceFundId: deleteRepayOffsetId || undefined,
      });
      closeDeleteRepay();
      showSnackbar({ type: 'success', message: 'Đã xóa' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa';
      showSnackbar({ type: 'error', message: msg });
    } finally {
      setIsDeletingRepay(false);
    }
  };

  if (!debt) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            activeOpacity={0.8}
          >
            <ChevronLeftIcon width={22} height={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết khoản nợ</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Không tìm thấy khoản nợ</Text>
          <Text style={styles.emptySubtitle}>
            Có thể khoản nợ đã bị xóa. Hãy quay lại danh sách.
          </Text>
        </View>
      </View>
    );
  }

  const remaining = debtRemaining(debt);
  const totalPaid = debt.principal - remaining;
  const pct = debt.principal > 0 ? Math.min(100, (totalPaid / debt.principal) * 100) : 0;
  const isSettled = debt.status === 'settled';
  const isLent = debt.direction === 'lent';
  const accentColor = isLent ? colors.success : colors.error;
  const fund = funds.find((f) => f.id === debt.fundId);

  const repayments = [...debt.repayments].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          activeOpacity={0.8}
        >
          <ChevronLeftIcon width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {debt.counterparty}
        </Text>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={openDeleteDebt}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteBtnText}>Xóa</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(120, insets.bottom + 120) }}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          {/* Header section with tinted accent background */}
          <View style={[styles.heroHeader, { backgroundColor: accentColor + '12' }]}>
            <View style={styles.heroHeaderTop}>
              <View
                style={[styles.heroIconWrap, { backgroundColor: accentColor }]}
              >
                <WalletIcon width={22} height={22} color={colors.white} />
              </View>
              <View style={styles.heroBadges}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: accentColor + '22' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: accentColor }]}>
                    {isLent ? 'Cho vay' : 'Đi vay'}
                  </Text>
                </View>
                {isSettled && (
                  <View style={[styles.badge, styles.badgeSettled]}>
                    <CheckIcon width={13} height={13} color={colors.success} />
                    <Text style={styles.badgeSettledText}>Đã tất toán</Text>
                  </View>
                )}
              </View>
            </View>

            {isSettled ? (
              <View style={styles.heroSettledWrap}>
                <View style={styles.heroSettledIconCircle}>
                  <CheckIcon width={36} height={36} color={colors.white} />
                </View>
                <Text style={styles.heroSettledLabel}>Đã tất toán</Text>
              </View>
            ) : (
              <>
                <View style={styles.heroAmountWrap}>
                  <Text style={styles.heroAmountLabel}>
                    {isLent ? 'Còn phải thu' : 'Còn phải trả'}
                  </Text>
                  <Text style={[styles.heroAmountValue, { color: accentColor }]}>
                    {remaining.toLocaleString('vi-VN')}đ
                  </Text>
                </View>

                {debt.principal > 0 && (
                  <View style={styles.heroProgressWrap}>
                    <View style={styles.heroProgressTrack}>
                      <View
                        style={[
                          styles.heroProgressFill,
                          { width: `${pct}%`, backgroundColor: accentColor },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.heroProgressLabel, { color: accentColor }]}
                    >
                      {Math.round(pct)}%
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBlock}>
              <Text style={styles.heroStatLabel}>Gốc</Text>
              <Text style={styles.heroStatValue}>
                {debt.principal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatBlock}>
              <Text style={styles.heroStatLabel}>{isLent ? 'Đã thu' : 'Đã trả'}</Text>
              <Text style={[styles.heroStatValue, { color: colors.primary }]}>
                {totalPaid.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>

          {/* Meta chips */}
          <View style={styles.heroMetaRow}>
            {fund ? (
              <View style={styles.metaChip}>
                {(() => {
                  const FundIcon = getFundIconComponent(fund.icon);
                  const c = fund.color ?? colors.textSecondary;
                  return <FundIcon width={13} height={13} color={c} />;
                })()}
                <Text style={styles.metaChipText} numberOfLines={1}>
                  {fund.name}
                </Text>
              </View>
            ) : debt.fundId ? (
              <View style={[styles.metaChip, styles.metaChipDeleted]}>
                <Text style={styles.metaChipDeletedText} numberOfLines={1}>
                  Quỹ đã bị xóa
                </Text>
              </View>
            ) : null}
            <View style={styles.metaChip}>
              <CalendarIcon width={13} height={13} color={colors.textSecondary} />
              <Text style={styles.metaChipText}>
                {debt.startDate.toLocaleDateString('vi-VN')}
              </Text>
            </View>
            {debt.dueDate && (
              <View style={[styles.metaChip, styles.metaChipDue]}>
                <ClockIcon width={13} height={13} color={colors.error} />
                <Text style={styles.metaChipDueText}>
                  Hạn: {debt.dueDate.toLocaleDateString('vi-VN')}
                </Text>
              </View>
            )}
          </View>

          {debt.note && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>GHI CHÚ</Text>
              <Text style={styles.notesText}>{debt.note}</Text>
            </View>
          )}
        </View>

        {/* Repayments history */}
        <View style={styles.historySection}>
          <View style={styles.sectionTitleRow}>
            <View
              style={[styles.sectionAccentBar, { backgroundColor: accentColor }]}
            />
            <Text style={styles.sectionTitle}>
              Lịch sử {isLent ? 'thu' : 'trả'}
            </Text>
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountBadgeText}>{repayments.length}</Text>
            </View>
          </View>

          {repayments.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Text style={styles.historyEmptyText}>
                Chưa có lần {isLent ? 'thu' : 'trả'} nào
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {repayments.map((r, idx) => {
                const repFund = funds.find((f) => f.id === r.fundId);
                return (
                  <View key={r.id} style={styles.historyItemWrapper}>
                    <SwipeableRow
                      onEdit={() => setEditRepayTarget(r)}
                      onDelete={() => openDeleteRepay(r.id, r.amount, r.fundId)}
                      deleteText="Xóa"
                      borderRadius={14}
                      buttonWidth={70}
                    >
                      <View style={styles.historyItem}>
                        <View
                          style={[
                            styles.historyAccentBar,
                            { backgroundColor: accentColor },
                          ]}
                        />
                        <View style={styles.historyContent}>
                          <View style={styles.historyTopRow}>
                            <View
                              style={[
                                styles.historyIndex,
                                { backgroundColor: accentColor + '15' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.historyIndexText,
                                  { color: accentColor },
                                ]}
                              >
                                #{repayments.length - idx}
                              </Text>
                            </View>
                            <Text
                              style={[styles.historyAmount, { color: accentColor }]}
                            >
                              {isLent ? '+' : '−'}
                              {r.amount.toLocaleString('vi-VN')}đ
                            </Text>
                          </View>
                          <View style={styles.historyMetaRow}>
                            <View style={styles.historyMetaChip}>
                              <CalendarIcon
                                width={12}
                                height={12}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.historyMetaText}>
                                {r.date.toLocaleDateString('vi-VN')}
                              </Text>
                            </View>
                            {repFund ? (
                              <View style={styles.historyMetaChip}>
                                {(() => {
                                  const FundIcon = getFundIconComponent(
                                    repFund.icon,
                                  );
                                  const c =
                                    repFund.color ?? colors.textSecondary;
                                  return (
                                    <FundIcon width={12} height={12} color={c} />
                                  );
                                })()}
                                <Text
                                  style={styles.historyMetaText}
                                  numberOfLines={1}
                                >
                                  {repFund.name}
                                </Text>
                              </View>
                            ) : r.fundId ? (
                              <View
                                style={[
                                  styles.historyMetaChip,
                                  styles.historyMetaChipDeleted,
                                ]}
                              >
                                <Text
                                  style={styles.historyMetaTextDeleted}
                                  numberOfLines={1}
                                >
                                  Quỹ đã bị xóa
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {r.note && (
                            <Text style={styles.historyNote} numberOfLines={2}>
                              {r.note}
                            </Text>
                          )}
                        </View>
                      </View>
                    </SwipeableRow>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {!isSettled && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[
              styles.repayBtn,
              {
                backgroundColor: accentColor,
                shadowColor: accentColor,
              },
            ]}
            onPress={openRepay}
            activeOpacity={0.85}
          >
            <View style={styles.repayBtnIcon}>
              <Text style={styles.repayBtnIconText}>+</Text>
            </View>
            <Text style={styles.repayBtnText}>
              {isLent ? 'Ghi nhận thu tiền' : 'Ghi nhận trả nợ'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Repay modal */}
      <Modal
        isVisible={repayVisible}
        onBackdropPress={closeRepay}
        onBackButtonPress={closeRepay}
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
            <Text style={styles.modalTitle}>
              {isLent ? 'Ghi nhận thu tiền' : 'Ghi nhận trả nợ'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {debt.counterparty} • Còn lại {remaining.toLocaleString('vi-VN')}đ
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
              {isLent ? 'Quỹ nhận tiền' : 'Quỹ trừ tiền'}
            </Text>
            <FundPicker
              funds={fundsDefaultFirst}
              selectedFundId={repayFundId}
              onSelect={setRepayFundId}
              isDisabled={(f) => !isLent && (f.balance ?? 0) < repayAmount}
              disabledReason={() => 'Không đủ'}
            />

            <Text style={styles.inputLabel}>Ngày</Text>
            <DatePicker value={repayDate} onChange={setRepayDate} />

            <Text style={styles.inputLabel}>Ghi chú</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMulti]}
              value={repayNote}
              onChangeText={setRepayNote}
              placeholder="..."
              placeholderTextColor={colors.textLight}
              multiline
            />
          </ScrollView>

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

      {/* Delete repayment modal */}
      <Modal
        isVisible={deleteRepayVisible}
        onBackdropPress={closeDeleteRepay}
        onBackButtonPress={closeDeleteRepay}
        style={styles.modalCenter}
        avoidKeyboard
      >
        <View style={styles.modalContentCenter}>
          {debt && deleteRepayTarget && (() => {
            const isLent = debt.direction === 'lent';
            const amt = deleteRepayTarget.amount;
            const primaryFund = funds.find((f) => f.id === deleteRepayFundId);
            const primaryBalance = primaryFund?.balance ?? 0;
            const needsOffset = isLent && primaryBalance < amt;
            const deficit = needsOffset ? amt - primaryBalance : 0;
            return (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.modalTitle}>
                  {isLent ? 'Xóa lần thu' : 'Xóa lần trả'} {amt.toLocaleString('vi-VN')}đ
                </Text>
                <Text style={styles.modalSubtitle}>
                  Số dư quỹ sẽ được hoàn tác tương ứng.
                </Text>

                <Text style={styles.inputLabel}>
                  {isLent ? 'Quỹ trừ tiền' : 'Quỹ nhận lại'}
                </Text>
                <FundPicker
                  funds={fundsDefaultFirst}
                  selectedFundId={deleteRepayFundId}
                  onSelect={(id) => {
                    setDeleteRepayFundId(id);
                    setDeleteRepayOffsetId('');
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
                          f.id !== deleteRepayFundId &&
                          (f.balance ?? 0) >= deficit,
                      )}
                      selectedFundId={deleteRepayOffsetId}
                      onSelect={setDeleteRepayOffsetId}
                      emptyText="Không có quỹ nào đủ số dư để cấn trừ."
                    />
                  </>
                )}
              </ScrollView>
            );
          })()}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeDeleteRepay}
              disabled={isDeletingRepay}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalDelete,
                (() => {
                  if (!debt || !deleteRepayTarget) return { opacity: 0.5 };
                  const isLent = debt.direction === 'lent';
                  const primaryFund = funds.find((f) => f.id === deleteRepayFundId);
                  const primaryBalance = primaryFund?.balance ?? 0;
                  const needsOffset = isLent && primaryBalance < deleteRepayTarget.amount;
                  if (!deleteRepayFundId) return { opacity: 0.5 };
                  if (needsOffset && !deleteRepayOffsetId) return { opacity: 0.5 };
                  return null;
                })(),
              ]}
              onPress={handleConfirmDeleteRepay}
              disabled={(() => {
                if (isDeletingRepay) return true;
                if (!debt || !deleteRepayTarget) return true;
                const isLent = debt.direction === 'lent';
                const primaryFund = funds.find((f) => f.id === deleteRepayFundId);
                const primaryBalance = primaryFund?.balance ?? 0;
                const needsOffset = isLent && primaryBalance < deleteRepayTarget.amount;
                if (!deleteRepayFundId) return true;
                if (needsOffset && !deleteRepayOffsetId) return true;
                return false;
              })()}
              activeOpacity={0.85}
            >
              {isDeletingRepay ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Xóa</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete debt modal */}
      <Modal
        isVisible={deleteDebtVisible}
        onBackdropPress={closeDeleteDebt}
        onBackButtonPress={closeDeleteDebt}
        style={styles.modalCenter}
        avoidKeyboard
      >
        <View style={styles.modalContentCenter}>
          {debt && (() => {
            const isLent = debt.direction === 'lent';
            const rem = debtRemaining(debt);
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
                  {debt.counterparty} •{' '}
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
                  if (!debt) return { opacity: 0.5 };
                  const isLent = debt.direction === 'lent';
                  const rem = debtRemaining(debt);
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
                if (!debt) return true;
                const isLent = debt.direction === 'lent';
                const rem = debtRemaining(debt);
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
        visible={!!editRepayTarget}
        onClose={() => setEditRepayTarget(null)}
        title={
          debt?.direction === 'lent'
            ? 'Chỉnh sửa khoản thu'
            : 'Chỉnh sửa khoản trả'
        }
        subtitle={
          editRepayTarget
            ? `${editRepayTarget.amount.toLocaleString('vi-VN')}đ${
                editRepayTarget.fundId
                  ? ` • ${
                      funds.find((f) => f.id === editRepayTarget.fundId)?.name ??
                      'Quỹ đã bị xóa'
                    }`
                  : ''
              }`
            : undefined
        }
        hint="Chỉ có thể sửa ghi chú và ngày giờ. Số tiền và quỹ sẽ giữ nguyên."
        initialNote={editRepayTarget?.note ?? ''}
        initialDate={editRepayTarget?.date ?? new Date()}
        onSave={async (note, date) => {
          if (!debtId || !editRepayTarget) return;
          await updateRepaymentNoteAndDate(debtId, editRepayTarget.id, {
            note,
            date,
          });
        }}
        successMessage="Đã cập nhật giao dịch"
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
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBackground,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  deleteBtn: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.error + '18',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },
  content: { flex: 1 },
  emptyBox: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  heroHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeSettled: { backgroundColor: colors.success + '22' },
  badgeSettledText: { fontSize: 12, fontWeight: '800', color: colors.success },
  heroAmountWrap: {
    alignItems: 'center',
    gap: 4,
  },
  heroSettledWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  heroSettledIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroSettledLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.success,
    letterSpacing: 0.3,
  },
  heroAmountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmountValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  heroProgressFill: { height: '100%', borderRadius: 4 },
  heroProgressLabel: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  heroStatBlock: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.inputBackground,
  },
  heroStatLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
  },
  metaChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  metaChipDue: { backgroundColor: colors.error + '15' },
  metaChipDueText: { fontSize: 12, fontWeight: '800', color: colors.error },
  metaChipDeleted: { backgroundColor: colors.error + '15' },
  metaChipDeletedText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.error,
    fontStyle: 'italic',
  },
  notesBox: {
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    gap: 4,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  notesText: { fontSize: 13, color: colors.text, lineHeight: 19 },

  historySection: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionAccentBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  sectionCountBadge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  historyEmpty: {
    padding: 28,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  historyEmptyText: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  historyList: { gap: 8 },
  historyItemWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  historyItem: {
    backgroundColor: colors.white,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  historyAccentBar: {
    width: 4,
  },
  historyContent: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyIndex: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyIndexText: { fontSize: 11, fontWeight: '800' },
  historyAmount: { fontSize: 16, fontWeight: '900' },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
  },
  historyMetaText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  historyMetaChipDeleted: { backgroundColor: colors.error + '15' },
  historyMetaTextDeleted: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.error,
    fontStyle: 'italic',
  },
  historyNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
  },
  repayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  repayBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repayBtnIconText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: -1,
  },
  repayBtnText: { color: colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },

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
  modalBody: { flexGrow: 0 },
  modalBodyContent: { paddingBottom: 10, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary },
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
  fundPickBalance: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
  fundPickInsuff: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: {
    flex: 1,
    backgroundColor: colors.inputBackground,
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
    backgroundColor: colors.inputBackground,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DebtDetailScreen;
