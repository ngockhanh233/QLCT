import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { colors } from '../../../../utils/color';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import AddIcon from '../../../../assets/icons/AddIcon';
import { useFunds } from './hooks/useFunds';
import { CurrencyInput, SwipeableRow, ErrorPopup } from '../../../../components';
import { confirm } from '../../../../utils/confirm';
import { useIncomePresets } from '../../../../contexts/IncomePresetsContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../MainScreen';
import type { FundRecord } from '../../../../types/fund';

const FUND_COLORS = [
  '#FF6B35',
  '#4A90D9',
  '#22C55E',
  '#E91E63',
  '#9C27B0',
  '#00BCD4',
  '#FFC107',
  '#795548',
];

const FundManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    funds,
    defaultFund,
    isLoading,
    refresh,
    createFund,
    updateFund,
    transferToFund,
    topUpFund,
    deductFromFund,
    setFundBalance: setFundBalanceRemote,
    deleteFund,
    setDefaultFund,
  } = useFunds();
  const { presets: incomePresets, savePresets } = useIncomePresets();

  // Khi chuyển qua tab Quỹ, luôn refresh để cập nhật số dư mới nhất
  // (ví dụ vừa xóa giao dịch ở tab Giao dịch).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingFund, setEditingFund] = useState<FundRecord | null>(null);
  const [fundName, setFundName] = useState('');
  const [fundBalance, setFundBalance] = useState(0);
  const [fundColor, setFundColor] = useState(FUND_COLORS[0]);
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpFundItem, setTopUpFundItem] = useState<FundRecord | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [topUpSourceFundId, setTopUpSourceFundId] = useState<string>('');
  const [useSourceFundForTopUp, setUseSourceFundForTopUp] = useState(true);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawFundItem, setWithdrawFundItem] = useState<FundRecord | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawTargetFundId, setWithdrawTargetFundId] = useState<string>('');
  const [useTargetFundForWithdraw, setUseTargetFundForWithdraw] = useState(true);
  const [newFundSourceId, setNewFundSourceId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [balanceModalVisible, setBalanceModalVisible] = useState(false);
  const [balanceEditingFund, setBalanceEditingFund] = useState<FundRecord | null>(null);
  const [balanceValue, setBalanceValue] = useState(0);
  const [useSourceFundForInitial, setUseSourceFundForInitial] = useState(true);
  const [fundActionModalVisible, setFundActionModalVisible] = useState(false);
  const [selectedFundForAction, setSelectedFundForAction] = useState<FundRecord | null>(null);
  const [errorPopupVisible, setErrorPopupVisible] = useState(false);
  const [errorPopupTitle, setErrorPopupTitle] = useState('Lỗi');
  const [errorPopupMessage, setErrorPopupMessage] = useState('');
  const [deleteFundModalVisible, setDeleteFundModalVisible] = useState(false);
  const [deletingFund, setDeletingFund] = useState<FundRecord | null>(null);
  const [deleteTargetFundId, setDeleteTargetFundId] = useState<string>('');
  const [deleteTransferEnabled, setDeleteTransferEnabled] = useState(true);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const showError = useCallback((title: string, message: string) => {
    setErrorPopupTitle(title);
    setErrorPopupMessage(message);
    setErrorPopupVisible(true);
  }, []);

  const openAddModal = () => {
    setEditingFund(null);
    setFundName('');
    setFundBalance(0);
    setNewFundSourceId(defaultFund?.id ?? '');
    setFundColor(FUND_COLORS[0]);
    setUseSourceFundForInitial(true);
    setModalVisible(true);
  };

  const openEditModal = (fund: FundRecord) => {
    setEditingFund(fund);
    setFundName(fund.name);
    setFundBalance(fund.balance);
    setFundColor(fund.color ?? FUND_COLORS[0]);
    setModalVisible(true);
  };

  const openTopUpModal = (fund: FundRecord) => {
    setTopUpFundItem(fund);
    setTopUpAmount(0);
    const sourceId = defaultFund?.id ?? funds.find((f) => f.id !== fund.id)?.id ?? '';
    setTopUpSourceFundId(sourceId);
    setUseSourceFundForTopUp(true);
    setTopUpModalVisible(true);
  };

  const openWithdrawModal = (fund: FundRecord) => {
    setWithdrawFundItem(fund);
    setWithdrawAmount(0);
    setUseTargetFundForWithdraw(true);
    const targetId =
      defaultFund && defaultFund.id !== fund.id ? defaultFund.id : '';
    setWithdrawTargetFundId(targetId);
    setWithdrawModalVisible(true);
  };

  const openBalanceModal = (fund: FundRecord) => {
    setBalanceEditingFund(fund);
    setBalanceValue(fund.balance ?? 0);
    setBalanceModalVisible(true);
  };

  useEffect(() => {
    if (topUpModalVisible && topUpFundItem && !topUpSourceFundId && defaultFund && defaultFund.id !== topUpFundItem.id) {
      setTopUpSourceFundId(defaultFund.id);
    }
  }, [topUpModalVisible, topUpFundItem, topUpSourceFundId, defaultFund]);

  const handleSaveFund = async () => {
    const name = fundName.trim();
    if (!name) {
      showError('Lỗi', 'Vui lòng nhập tên quỹ');
      return;
    }

    if (!editingFund && fundBalance > 0 && useSourceFundForInitial) {
      if (!newFundSourceId) {
        showError('Lỗi', 'Vui lòng chọn nguồn tiền để trừ');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingFund) {
        await updateFund(editingFund.id, { name, color: fundColor });
        setModalVisible(false);
      } else {
        const initialBalance = useSourceFundForInitial ? 0 : fundBalance;
        const newId = await createFund(name, initialBalance, fundColor);
        if (newId) {
          if (useSourceFundForInitial && fundBalance > 0 && newFundSourceId) {
            const ok = await transferToFund(newId, fundBalance, newFundSourceId);
            if (ok) setModalVisible(false);
          } else {
            setModalVisible(false);
          }
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTopUp = async () => {
    if (!topUpFundItem || topUpAmount <= 0) {
      showError('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (useSourceFundForTopUp) {
      if (!topUpSourceFundId) {
        showError('Lỗi', 'Vui lòng chọn nguồn tiền');
        return;
      }
      if (topUpSourceFundId === topUpFundItem.id) {
        showError('Lỗi', 'Nguồn tiền và quỹ đích phải khác nhau');
        return;
      }
    }

    setIsSaving(true);
    try {
      const ok = useSourceFundForTopUp
        ? await transferToFund(topUpFundItem.id, topUpAmount, topUpSourceFundId)
        : await topUpFund(topUpFundItem.id, topUpAmount);
      if (ok) {
        setTopUpModalVisible(false);
        setTopUpFundItem(null);
        setTopUpAmount(0);
        setTopUpSourceFundId('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawFundItem || withdrawAmount <= 0) {
      showError('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }
    const currentBalance = withdrawFundItem.balance ?? 0;
    if (withdrawAmount > currentBalance) {
      showError(
        'Lỗi',
        `Số tiền rút vượt quá số dư quỹ hiện tại (${currentBalance.toLocaleString('vi-VN')}đ)`,
      );
      return;
    }

    if (useTargetFundForWithdraw) {
      if (!withdrawTargetFundId) {
        showError('Lỗi', 'Vui lòng chọn quỹ nhận tiền');
        return;
      }
      if (withdrawTargetFundId === withdrawFundItem.id) {
        showError('Lỗi', 'Quỹ rút và quỹ nhận phải khác nhau');
        return;
      }
    }

    setIsSaving(true);
    try {
      let ok = false;
      if (useTargetFundForWithdraw && withdrawTargetFundId) {
        ok = await transferToFund(
          withdrawTargetFundId,
          withdrawAmount,
          withdrawFundItem.id,
        );
      } else {
        ok = await deductFromFund(withdrawFundItem.id, withdrawAmount);
      }
      if (ok) {
        setWithdrawModalVisible(false);
        setWithdrawFundItem(null);
        setWithdrawAmount(0);
        setWithdrawTargetFundId('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBalance = async () => {
    if (!balanceEditingFund) return;
    if (!Number.isFinite(balanceValue) || balanceValue < 0) {
      showError('Lỗi', 'Số dư phải là số không âm');
      return;
    }

    setIsSaving(true);
    try {
      const ok = await setFundBalanceRemote(balanceEditingFund.id, balanceValue);
      if (ok) {
        setBalanceModalVisible(false);
        setBalanceEditingFund(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFund = async (fund: FundRecord) => {
    const otherFunds = funds.filter((f) => f.id !== fund.id);
    const initialTargetId =
      otherFunds.find((f) => f.isDefault)?.id ?? otherFunds[0]?.id ?? '';

    setDeletingFund(fund);
    setDeleteTargetFundId(initialTargetId);
    setDeleteTransferEnabled(fund.balance > 0 && otherFunds.length > 0);
    setDeleteFundModalVisible(true);
  };

  const fundsDefaultFirst = [...funds].sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0;
    const bDefault = b.isDefault ? 1 : 0;
    if (aDefault !== bDefault) return bDefault - aDefault;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const displayFunds = [...funds].sort((a, b) => {
    const aDefault = a.isDefault ? 1 : 0;
    const bDefault = b.isDefault ? 1 : 0;
    if (aDefault !== bDefault) return bDefault - aDefault; // default fund first

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;

    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeftIcon width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý quỹ</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
        <Text style={styles.sectionDesc}>
          Tạo và quản lý các quỹ chi tiêu. Tất cả khoản chi sẽ được trừ từ quỹ
          bạn chọn.
        </Text>

        {isLoading && funds.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : funds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <WalletIcon width={64} height={64} color={colors.textLight} />
            <Text style={styles.emptyText}>Chưa có quỹ nào</Text>
            <Text style={styles.emptySubtext}>
              Tạo quỹ đầu tiên để bắt đầu quản lý chi tiêu
            </Text>
          </View>
        ) : (
          <View style={styles.fundList}>
            {displayFunds.map((fund) => (
              <View
                key={fund.id}
                style={[
                  styles.swipeableWrapper,
                  fund.isDefault && styles.defaultSwipeableWrapper,
                ]}
              >
                <SwipeableRow
                  onEdit={() => openTopUpModal(fund)}
                  onSecondary={() => openWithdrawModal(fund)}
                  onDelete={fund.isDefault ? undefined : () => handleDeleteFund(fund)}
                  editText="Nạp tiền"
                  secondaryText="Rút tiền"
                  deleteText="Xóa"
                  deleteButtonColor={colors.error}
                  borderRadius={16}
                  buttonWidth={80}
                >
                  <TouchableOpacity
                    style={[
                      styles.fundCard,
                      fund.isDefault && styles.defaultFundCard,
                    ]}
                    // onPress={() => openEditModal(fund)}
                    onLongPress={() => {
                      if (fund.isDefault) {
                        openEditModal(fund);
                      } else {
                        setSelectedFundForAction(fund);
                        setFundActionModalVisible(true);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.fundIcon,
                        { backgroundColor: (fund.color ?? colors.primary) + '20' },
                      ]}
                    >
                      <WalletIcon
                        width={24}
                        height={24}
                        color={fund.color ?? colors.primary}
                      />
                    </View>
                    <View style={styles.fundInfo}>
                      <View style={styles.fundNameRow}>
                        <Text style={styles.fundName}>{fund.name}</Text>
                        {fund.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Mặc định</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.fundBalance}>
                        {fund.balance.toLocaleString('vi-VN')}đ
                      </Text>
                      {fund.isDefault && (
                        <Text style={styles.defaultHint}>
                          Quỹ chính (dùng khi bạn không chọn quỹ)
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </SwipeableRow>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + 96 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={openAddModal}
        activeOpacity={0.85}
      >
        <AddIcon width={26} height={26} color={colors.white} />
      </TouchableOpacity>

      {/* Fund actions (long press) */}
      <Modal
        isVisible={fundActionModalVisible && !!selectedFundForAction}
        onBackdropPress={() => setFundActionModalVisible(false)}
        onBackButtonPress={() => setFundActionModalVisible(false)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Tùy chọn quỹ</Text>
          {selectedFundForAction && (
            <Text style={styles.modalSubtitle}>{selectedFundForAction.name}</Text>
          )}

          <View style={styles.optionGroup}>
            <TouchableOpacity
              style={styles.actionPrimaryButton}
              activeOpacity={0.85}
              onPress={async () => {
                if (!selectedFundForAction) return;
                const ok = await setDefaultFund(selectedFundForAction.id);
                if (ok) {
                  setFundActionModalVisible(false);
                  setSelectedFundForAction(null);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionPrimaryText}>Chuyển thành quỹ mặc định</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSecondaryButton}
              activeOpacity={0.85}
              onPress={() => {
                if (!selectedFundForAction) {
                  setFundActionModalVisible(false);
                  return;
                }
                const fund = selectedFundForAction;
                setFundActionModalVisible(false);
                setSelectedFundForAction(null);
                openEditModal(fund);
              }}
              disabled={isSaving}
            >
              <Text style={styles.actionSecondaryText}>Chỉnh sửa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Fund Modal (centered) */}
      <Modal
        isVisible={deleteFundModalVisible && !!deletingFund}
        onBackdropPress={() => {
          if (deleteSaving) return;
          setDeleteFundModalVisible(false);
          setDeletingFund(null);
          setDeleteTargetFundId('');
          setDeleteTransferEnabled(true);
        }}
        onBackButtonPress={() => {
          if (deleteSaving) return;
          setDeleteFundModalVisible(false);
          setDeletingFund(null);
          setDeleteTargetFundId('');
          setDeleteTransferEnabled(true);
        }}
        style={styles.centerModal}
        avoidKeyboard
      >
        <View style={styles.centerModalContent}>
          <Text style={styles.modalTitle}>Xóa quỹ</Text>
          {deletingFund && (
            <Text style={styles.modalSubtitle}>
              {`Quỹ: ${deletingFund.name}\nSố dư hiện tại: ${deletingFund.balance.toLocaleString('vi-VN')}đ`}
            </Text>
          )}

          {deletingFund && (() => {
            const affectedPresets =
              incomePresets.filter((p) =>
                (p.allocations ?? []).some((a) => a.fundId === deletingFund.id),
              ) ?? [];
            if (affectedPresets.length === 0) return null;
            const names = affectedPresets.map((p) => `- ${p.name}`).join('\n');
            return (
              <Text style={styles.sheetHint}>
                {`Quỹ này đang được dùng trong các nguồn thu:\n${names}\nKhi xóa, quỹ sẽ được gỡ khỏi các nguồn thu đó.`}
              </Text>
            );
          })()}

          {deletingFund && deletingFund.balance > 0 && (
            <>
              <View style={[styles.sourceToggleRow, { marginTop: 16 }]}>
                <Text style={styles.inputLabel}>Chuyển số dư sang quỹ khác</Text>
                <Switch
                  value={deleteTransferEnabled}
                  onValueChange={(value) => setDeleteTransferEnabled(value)}
                  thumbColor={deleteTransferEnabled ? colors.white : colors.white}
                  trackColor={{
                    false: colors.backgroundSecondary,
                    true: colors.primary,
                  }}
                  disabled={
                    funds.filter((f) => f.id !== deletingFund.id).length === 0
                  }
                />
              </View>

              {deleteTransferEnabled &&
                funds.filter((f) => f.id !== deletingFund.id).length > 0 && (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.sourceFundScroll}
                      contentContainerStyle={styles.sourceFundContainer}
                    >
                      {fundsDefaultFirst
                        .filter((f) => f.id !== deletingFund.id)
                        .map((fund) => {
                          const isSelected = deleteTargetFundId === fund.id;
                          const fColor = fund.color ?? colors.primary;
                          return (
                            <TouchableOpacity
                              key={fund.id}
                              style={[
                                styles.sourceFundItem,
                                isSelected && styles.sourceFundItemActive,
                                isSelected && { borderColor: fColor },
                              ]}
                              onPress={() => setDeleteTargetFundId(fund.id)}
                              activeOpacity={0.75}
                              disabled={deleteSaving}
                            >
                              <View
                                style={[
                                  styles.sourceFundIcon,
                                  { backgroundColor: fColor + '20' },
                                ]}
                              >
                                <WalletIcon width={18} height={18} color={fColor} />
                              </View>
                              <Text
                                style={[
                                  styles.sourceFundText,
                                  isSelected && { color: fColor, fontWeight: '700' },
                                ]}
                                numberOfLines={1}
                              >
                                {fund.name}
                              </Text>
                              <Text style={styles.sourceFundBalance}>
                                {fund.balance.toLocaleString('vi-VN')}đ
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                    <Text style={styles.sheetHint}>
                      Số dư sẽ được chuyển sang quỹ bạn chọn trước khi xóa.
                    </Text>
                  </>
                )}

              {!deleteTransferEnabled && (
                <Text style={styles.sheetHint}>
                  Số dư hiện tại sẽ không còn được theo dõi trong ứng dụng sau khi xóa quỹ này.
                </Text>
              )}
            </>
          )}

          <View style={[styles.modalButtons, { marginTop: 24 }]}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.85}
              onPress={() => {
                if (deleteSaving) return;
                setDeleteFundModalVisible(false);
                setDeletingFund(null);
                setDeleteTargetFundId('');
                setDeleteTransferEnabled(true);
              }}
              disabled={deleteSaving}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              activeOpacity={0.85}
              onPress={async () => {
                if (!deletingFund || deleteSaving) return;

                const otherFunds = funds.filter((f) => f.id !== deletingFund.id);
                const hasTargetFund = otherFunds.length > 0;

                if (
                  deleteTransferEnabled &&
                  deletingFund.balance > 0 &&
                  hasTargetFund &&
                  !deleteTargetFundId
                ) {
                  showError('Lỗi', 'Vui lòng chọn quỹ nhận số dư');
                  return;
                }

                let presetWarning = '';
                const affectedPresets =
                  incomePresets.filter((p) =>
                    (p.allocations ?? []).some((a) => a.fundId === deletingFund.id),
                  ) ?? [];
                if (affectedPresets.length > 0) {
                  const names = affectedPresets.map((p) => `- ${p.name}`).join('\n');
                  presetWarning = `\n\nQuỹ này đang được dùng trong các nguồn thu sau:\n${names}\nKhi xóa, quỹ sẽ được gỡ khỏi các nguồn thu đó.`;
                }

                const baseMessage = `Bạn có chắc muốn xóa quỹ "${deletingFund.name}"?${presetWarning}`;
                const balanceLabel = deletingFund.balance.toLocaleString('vi-VN');
                const message =
                  deletingFund.balance > 0
                    ? deleteTransferEnabled && hasTargetFund
                      ? `${baseMessage}\n\nSố dư ${balanceLabel}đ sẽ được chuyển sang quỹ khác.`
                      : `${baseMessage}\n\nSố dư ${balanceLabel}đ sẽ không còn được theo dõi trong ứng dụng.`
                    : baseMessage;

                const ok = await confirm({
                  title: 'Xóa quỹ',
                  message,
                  confirmText: 'Xóa',
                  cancelText: 'Hủy',
                });
                if (!ok) return;

                setDeleteSaving(true);
                try {
                  try {
                    const nextPresets =
                      incomePresets
                        .map((p) => ({
                          ...p,
                          allocations: (p.allocations ?? []).filter(
                            (a) => a.fundId !== deletingFund.id,
                          ),
                        }))
                        .filter((p) => (p.allocations ?? []).length > 0) ?? [];

                    await savePresets(nextPresets);
                  } catch {
                    // ignore preset cleanup errors
                  }

                  const skipTransfer =
                    !deleteTransferEnabled ||
                    deletingFund.balance <= 0 ||
                    !hasTargetFund ||
                    !deleteTargetFundId;

                  await deleteFund(deletingFund.id, {
                    skipTransfer,
                    targetFundId: skipTransfer ? null : deleteTargetFundId,
                  });

                  setDeleteFundModalVisible(false);
                  setDeletingFund(null);
                  setDeleteTargetFundId('');
                  setDeleteTransferEnabled(true);
                } finally {
                  setDeleteSaving(false);
                }
              }}
              disabled={
                deleteSaving ||
                (deleteTransferEnabled &&
                  !!deletingFund &&
                  deletingFund.balance > 0 &&
                  funds.filter((f) => f.id !== deletingFund.id).length > 0 &&
                  !deleteTargetFundId)
              }
            >
              {deleteSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.modalSaveText}>Xóa quỹ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        isVisible={balanceModalVisible}
        onBackdropPress={() => setBalanceModalVisible(false)}
        onBackButtonPress={() => setBalanceModalVisible(false)}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Sửa số dư</Text>
          <Text style={styles.modalSubtitle}>
            {balanceEditingFund?.name ? `Quỹ: ${balanceEditingFund.name}` : 'Nhập số dư mới cho quỹ'}
          </Text>

          <Text style={styles.inputLabel}>Số dư (đ)</Text>
          <CurrencyInput
            value={balanceValue}
            onChange={setBalanceValue}
            placeholder="0"
            containerStyle={styles.currencyContainer}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.85}
              onPress={() => setBalanceModalVisible(false)}
              disabled={isSaving}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              activeOpacity={0.85}
              onPress={handleSaveBalance}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Fund Modal */}
      <Modal
        isVisible={modalVisible}
        onBackdropPress={() => setModalVisible(false)}
        onBackButtonPress={() => setModalVisible(false)}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.fundSheet}>
          <View style={styles.sheetIndicator} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {editingFund ? 'Chỉnh sửa quỹ' : 'Thêm quỹ mới'}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.sheetClose}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetScrollContent}
          >
            {!editingFund && (
              <View style={styles.amountSection}>
                <Text style={styles.inputLabel}>Số dư ban đầu (đ)</Text>
                <CurrencyInput
                  value={fundBalance}
                  onChange={setFundBalance}
                  placeholder="0"
                  inputWrapperStyle={styles.fundAmountInput}
                  inputStyle={styles.fundAmountText}
                  suffixStyle={styles.fundAmountSuffix}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tên quỹ</Text>
              <TextInput
                style={styles.textInput}
                value={fundName}
                onChangeText={setFundName}
                placeholder="VD: Quỹ sinh hoạt, Quỹ tiết kiệm..."
                placeholderTextColor={colors.textLight}
              />
            </View>

            {!editingFund && (
              <View style={styles.inputGroup}>
                <View style={styles.sourceToggleRow}>
                  <Text style={styles.inputLabel}>Rút từ quỹ khác</Text>
                  <Switch
                    value={useSourceFundForInitial}
                    onValueChange={setUseSourceFundForInitial}
                    thumbColor={useSourceFundForInitial ? colors.white : colors.white}
                    trackColor={{
                      false: colors.backgroundSecondary,
                      true: colors.primary,
                    }}
                  />
                </View>
                {fundBalance > 0 && funds.length > 0 && useSourceFundForInitial && (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sheetFundGrid}
                    >
                      {fundsDefaultFirst.map((fund) => {
                        const isSelected = newFundSourceId === fund.id;
                        const fColor = fund.color ?? colors.primary;
                        return (
                          <TouchableOpacity
                            key={fund.id}
                            style={[
                              styles.sheetFundItem,
                              isSelected && styles.sheetFundItemActive,
                              isSelected && { borderColor: fColor },
                            ]}
                            onPress={() => setNewFundSourceId(fund.id)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.sheetFundIcon,
                                { backgroundColor: fColor + '20' },
                              ]}
                            >
                              <WalletIcon width={20} height={20} color={fColor} />
                            </View>
                            <Text
                              style={[
                                styles.sheetFundText,
                                isSelected && { color: fColor, fontWeight: '700' },
                              ]}
                              numberOfLines={1}
                            >
                              {fund.name}
                            </Text>
                            <Text style={styles.sheetFundBalance}>
                              {fund.balance.toLocaleString('vi-VN')}đ
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.sheetHint}>
                      Quỹ bị trừ tiền để tạo số dư ban đầu cho quỹ mới.
                    </Text>
                  </>
                )}
                {!useSourceFundForInitial && fundBalance > 0 && (
                  <Text style={styles.sheetHint}>
                    Số dư ban đầu sẽ được cộng thẳng vào quỹ mới, không trừ từ quỹ khác.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Màu sắc</Text>
              <View style={styles.colorPicker}>
                {FUND_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      fundColor === c && styles.colorOptionSelected,
                    ]}
                    onPress={() => setFundColor(c)}
                    activeOpacity={0.8}
                  />
                ))}
              </View>
            </View>

            <View style={{ height: insets.bottom + 24 }} />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.sheetCancelButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              <Text style={styles.sheetCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetSaveButton}
              onPress={handleSaveFund}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.sheetSaveText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Top Up Modal */}
      <Modal
        isVisible={topUpModalVisible}
        onBackdropPress={() => setTopUpModalVisible(false)}
        onBackButtonPress={() => setTopUpModalVisible(false)}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Nạp tiền vào quỹ</Text>
          {topUpFundItem && (
            <Text style={styles.modalSubtitle}>
              {topUpFundItem.name} • Hiện tại:{' '}
              {topUpFundItem.balance.toLocaleString('vi-VN')}đ
            </Text>
          )}

          <View style={styles.amountSection}>
            <Text style={styles.inputLabel}>Số tiền nạp (đ)</Text>
            <CurrencyInput
              value={topUpAmount}
              onChange={setTopUpAmount}
              placeholder="0"
              inputWrapperStyle={styles.fundAmountInput}
              inputStyle={styles.fundAmountText}
              suffixStyle={styles.fundAmountSuffix}
            />
          </View>

          <View style={styles.sourceToggleRow}>
            <Text style={styles.inputLabel}>Rút từ quỹ khác</Text>
            <Switch
              value={useSourceFundForTopUp}
              onValueChange={setUseSourceFundForTopUp}
              thumbColor={useSourceFundForTopUp ? colors.white : colors.white}
              trackColor={{
                false: colors.backgroundSecondary,
                true: colors.primary,
              }}
            />
          </View>

          {useSourceFundForTopUp && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sourceFundScroll}
              contentContainerStyle={styles.sourceFundContainer}
            >
              {fundsDefaultFirst
                .filter((f) => f.id !== topUpFundItem?.id)
                .map((fund) => {
                  const isSelected = topUpSourceFundId === fund.id;
                  const fundColor = fund.color ?? colors.primary;
                  return (
                    <TouchableOpacity
                      key={fund.id}
                      style={[
                        styles.sourceFundItem,
                        isSelected && styles.sourceFundItemActive,
                        isSelected && { borderColor: fundColor },
                      ]}
                      onPress={() => setTopUpSourceFundId(fund.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.sourceFundIcon, { backgroundColor: fundColor + '20' }]}>
                        <WalletIcon width={18} height={18} color={fundColor} />
                      </View>
                      <Text
                        style={[styles.sourceFundText, isSelected && { color: fundColor }]}
                        numberOfLines={1}
                      >
                        {fund.name}
                      </Text>
                      <Text style={styles.sourceFundBalance}>
                        {fund.balance.toLocaleString('vi-VN')}đ
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          )}
          {!useSourceFundForTopUp && (
            <Text style={styles.sheetHint}>
              Số tiền sẽ được cộng thẳng vào quỹ này, không trừ từ quỹ khác.
            </Text>
          )}

          <View style={[styles.modalButtons, { marginTop: 24 }]}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setTopUpModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleTopUp}
              disabled={isSaving || topUpAmount <= 0}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.modalSaveText}>Nạp tiền</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        isVisible={withdrawModalVisible}
        onBackdropPress={() => setWithdrawModalVisible(false)}
        onBackButtonPress={() => setWithdrawModalVisible(false)}
        style={styles.modal}
        avoidKeyboard
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Rút tiền khỏi quỹ</Text>
          {withdrawFundItem && (
            <Text style={styles.modalSubtitle}>
              {withdrawFundItem.name} • Hiện tại:{' '}
              {withdrawFundItem.balance.toLocaleString('vi-VN')}đ
            </Text>
          )}

          <View style={styles.amountSection}>
            <Text style={styles.inputLabel}>Số tiền rút (đ)</Text>
            <CurrencyInput
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              placeholder="0"
              inputWrapperStyle={styles.fundAmountInput}
              inputStyle={styles.fundAmountText}
              suffixStyle={styles.fundAmountSuffix}
            />
          </View>

          <View style={styles.sourceToggleRow}>
            <Text style={styles.inputLabel}>Chuyển sang quỹ khác</Text>
            <Switch
              value={useTargetFundForWithdraw}
              onValueChange={setUseTargetFundForWithdraw}
              thumbColor={useTargetFundForWithdraw ? colors.white : colors.white}
              trackColor={{
                false: colors.backgroundSecondary,
                true: colors.primary,
              }}
            />
          </View>

          {useTargetFundForWithdraw && withdrawFundItem && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sourceFundScroll}
            >
              {fundsDefaultFirst
                .filter((f) => f.id !== withdrawFundItem.id)
                .map((fund) => {
                  const isSelected = withdrawTargetFundId === fund.id;
                  const fundColor = fund.color ?? colors.primary;
                  return (
                    <TouchableOpacity
                      key={fund.id}
                      style={[
                        styles.sourceFundItem,
                        isSelected && styles.sourceFundItemActive,
                        isSelected && { borderColor: fundColor },
                      ]}
                      onPress={() => setWithdrawTargetFundId(fund.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.sourceFundIcon, { backgroundColor: fundColor + '20' }]}>
                        <WalletIcon width={18} height={18} color={fundColor} />
                      </View>
                      <Text
                        style={[styles.sourceFundText, isSelected && { color: fundColor }]}
                        numberOfLines={1}
                      >
                        {fund.name}
                      </Text>
                      <Text style={styles.sourceFundBalance}>
                        {fund.balance.toLocaleString('vi-VN')}đ
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          )}
          {!useTargetFundForWithdraw && (
            <Text style={styles.sheetHint}>
              Số tiền sẽ được rút khỏi quỹ này mà không chuyển sang quỹ khác.
            </Text>
          )}

          <View style={[styles.modalButtons, { marginTop: 24 }]}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setWithdrawModalVisible(false)}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleWithdraw}
              activeOpacity={0.85}
              disabled={isSaving || withdrawAmount <= 0}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.modalSaveText}>Rút tiền</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ErrorPopup
        visible={errorPopupVisible}
        title={errorPopupTitle}
        message={errorPopupMessage}
        onClose={() => setErrorPopupVisible(false)}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 20,
    lineHeight: 20,
  },
  amountSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  inputGroup: {
    marginTop: 10,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  fundList: {
    gap: 12,
  },
  swipeableWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  defaultSwipeableWrapper: {
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  fundCard: {
    backgroundColor: colors.white,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultFundCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.primary + '35',
    paddingVertical: 18,
  },
  fundIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  fundInfo: {
    flex: 1,
  },
  fundNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fundName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  fundBalance: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  defaultHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sourceFundScroll: {
    maxHeight: 100,
    marginBottom: 8,
  },
  sourceFundContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  sourceFundItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 90,
    marginRight: 10,
  },
  sourceFundItemActive: {
    borderWidth: 2,
  },
  sourceFundIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceFundText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sourceFundBalance: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  centerModal: {
    justifyContent: 'center',
    margin: 0,
  },
  fundSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textLight,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
    opacity: 0.6,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  sheetClose: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
  },
  sheetCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sheetSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sheetSaveText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  fundAmountInput: {
    backgroundColor: colors.white,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 0,
  },
  fundAmountText: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 10,
  },
  fundAmountSuffix: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
  },
  sheetFundGrid: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  sourceToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetFundItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.inputBackground,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 108,
    maxWidth: 130,
    marginRight: 10,
  },
  sheetFundItemActive: {
    backgroundColor: colors.white,
  },
  sheetFundIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetFundText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sheetFundBalance: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textLight,
  },
  sheetHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
  },
  centerModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 34,
    marginHorizontal: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  currencyContainer: {
    marginTop: 0,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.text,
    borderWidth: 3,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  optionGroup: {
    marginTop: 24,
    gap: 12,
  },
  actionPrimaryButton: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  actionSecondaryButton: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '2A',
  },
  actionSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
});

export default FundManagementScreen;
