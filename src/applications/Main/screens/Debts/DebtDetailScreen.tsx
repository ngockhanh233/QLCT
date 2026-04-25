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
import { CurrencyInput, DatePicker, SwipeableRow, FundPicker } from '../../../../components';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { useDebts } from '../../../../contexts/DebtsContext';
import { debtRemaining, type DebtRepayment } from '../../../../services/debts';
import EditNoteDateModal from './components/EditNoteDateModal';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
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
    setRepayFundId(debt.fundId || defaultFund?.id || fundsDefaultFirst[0]?.id || '');
    setRepayDate(new Date());
    setRepayNote('');
    setRepayVisible(true);
  }, [debt, defaultFund, fundsDefaultFirst]);

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
      showSnackbar({ type: 'error', message: msg });
    } finally {
      setIsRepaying(false);
    }
  };

  const openDeleteDebt = () => {
    if (!debt) return;
    setDeleteDebtFundId(debt.fundId || defaultFund?.id || fundsDefaultFirst[0]?.id || '');
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
        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={[styles.summaryIconWrap, { backgroundColor: accentColor + '15' }]}>
              <WalletIcon width={24} height={24} color={accentColor} />
            </View>
            <View style={styles.summaryBadges}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isLent
                      ? colors.success + '20'
                      : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isLent ? colors.success : '#B91C1C' },
                  ]}
                >
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

          <View style={styles.summaryAmounts}>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Còn lại</Text>
              <Text style={[styles.summaryRemain, { color: accentColor }]}>
                {remaining.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Gốc</Text>
              <Text style={styles.summaryPrincipal}>
                {debt.principal.toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>{isLent ? 'Đã thu' : 'Đã trả'}</Text>
              <Text style={styles.summaryPaid}>
                {totalPaid.toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>

          {debt.principal > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accentColor }]}
              />
            </View>
          )}

          <View style={styles.summaryMeta}>
            {fund && (
              <View style={styles.metaItem}>
                {(() => {
                  const FundIcon = getFundIconComponent(fund.icon);
                  const c = fund.color ?? colors.textSecondary;
                  return <FundIcon width={14} height={14} color={c} />;
                })()}
                <Text style={styles.metaText} numberOfLines={1}>
                  {fund.name}
                </Text>
              </View>
            )}
            <Text style={styles.metaText}>
              Ngày: {debt.startDate.toLocaleDateString('vi-VN')}
            </Text>
            {debt.dueDate && (
              <Text style={styles.metaTextDue}>
                Hạn: {debt.dueDate.toLocaleDateString('vi-VN')}
              </Text>
            )}
          </View>

          {debt.note && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Ghi chú</Text>
              <Text style={styles.notesText}>{debt.note}</Text>
            </View>
          )}
        </View>

        {/* Repayments history */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>
            Lịch sử {isLent ? 'thu' : 'trả'}{' '}
            <Text style={styles.sectionCount}>({repayments.length})</Text>
          </Text>

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
                        <View style={styles.historyLeft}>
                          <View
                            style={[
                              styles.historyIndex,
                              { backgroundColor: accentColor + '18' },
                            ]}
                          >
                            <Text style={[styles.historyIndexText, { color: accentColor }]}>
                              {repayments.length - idx}
                            </Text>
                          </View>
                          <View style={styles.historyInfo}>
                            <Text style={styles.historyAmount}>
                              {r.amount.toLocaleString('vi-VN')}đ
                            </Text>
                            <View style={styles.historyMeta}>
                              <Text style={styles.historyDate}>
                                {r.date.toLocaleDateString('vi-VN')}
                              </Text>
                              {repFund && (
                                <>
                                  <Text style={styles.historyDot}>•</Text>
                                  <Text style={styles.historyFund} numberOfLines={1}>
                                    {repFund.name}
                                  </Text>
                                </>
                              )}
                            </View>
                            {r.note && (
                              <Text style={styles.historyNote} numberOfLines={2}>
                                {r.note}
                              </Text>
                            )}
                          </View>
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
            style={[styles.repayBtn, { backgroundColor: accentColor }]}
            onPress={openRepay}
            activeOpacity={0.85}
          >
            <Text style={styles.repayBtnText}>
              {isLent ? '+ Ghi nhận thu tiền' : '+ Ghi nhận trả nợ'}
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

  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBadges: {
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
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeSettled: { backgroundColor: colors.success + '20' },
  badgeSettledText: { fontSize: 12, fontWeight: '700', color: colors.success },
  summaryAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryBlock: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.backgroundSecondary,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  summaryRemain: { fontSize: 18, fontWeight: '900' },
  summaryPrincipal: { fontSize: 14, fontWeight: '700', color: colors.text },
  summaryPaid: { fontSize: 14, fontWeight: '700', color: colors.primary },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  metaTextDue: { fontSize: 12, fontWeight: '700', color: colors.error },
  notesBox: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    gap: 4,
  },
  notesLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  notesText: { fontSize: 13, color: colors.text, lineHeight: 19 },

  historySection: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  sectionCount: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  historyEmpty: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  historyEmptyText: { fontSize: 13, color: colors.textSecondary },
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
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  historyIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIndexText: { fontSize: 12, fontWeight: '800' },
  historyInfo: { flex: 1, gap: 2 },
  historyAmount: { fontSize: 15, fontWeight: '800', color: colors.text },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  historyDot: { fontSize: 12, color: colors.textLight },
  historyFund: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  historyNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  repayBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  repayBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },

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

export default DebtDetailScreen;
