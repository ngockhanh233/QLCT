import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../../../utils/color';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import { getStoredUser } from '../../../../services';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { type IncomePreset } from '../../../../services/incomePresets';
import type { RootStackParamList } from '../../MainScreen';
import { showSnackbar } from '../../../../utils/snackbar';
import { confirm } from '../../../../utils/confirm';
import { CurrencyInput, SwipeableRow, CategoryPicker } from '../../../../components';
import { useIncomePresets } from '../../../../contexts/IncomePresetsContext';
import { getFundIconComponent } from '../../../../constants/FundIconConstants';
import { INCOME_CATEGORIES } from '../../../../constants/IncomeCategoryConstants';

type DraftAllocation = { id: string; fundId: string; amount: number };

const IncomeSourcesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { funds, isLoading: isLoadingFunds } = useFunds();
  const { presets, isLoading: isLoadingPresets, savePresets } = useIncomePresets();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState<string>('');
  const [draftAllocations, setDraftAllocations] = useState<DraftAllocation[]>([]);
  const [activeDraftAllocationId, setActiveDraftAllocationId] = useState<string>('');
  const [categoryInitialExpanded, setCategoryInitialExpanded] = useState(false);

  const fundsDefaultFirst = useMemo(() => {
    return [...funds].sort((a, b) => {
      const aDefault = a.isDefault ? 1 : 0;
      const bDefault = b.isDefault ? 1 : 0;
      if (aDefault !== bDefault) return bDefault - aDefault;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }, [funds]);

  const openCreate = () => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setEditingPresetId(null);
    setDraftName('');
    setDraftCategoryId('');
    setDraftAllocations([{ id, fundId: '', amount: 0 }]);
    setActiveDraftAllocationId(id);
    setCategoryInitialExpanded(false);
    setModalVisible(true);
  };

  const openEdit = (preset: IncomePreset) => {
    const next = (preset.allocations ?? []).map((a) => ({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      fundId: a.fundId,
      amount: (a as any).amount ?? 0,
    }));
    const firstId = next[0]?.id ?? '';
    setEditingPresetId(preset.id);
    setDraftName(preset.name ?? '');
    setDraftCategoryId(preset.categoryId ?? '');
    setDraftAllocations(next.length ? next : [{ id: firstId, fundId: '', amount: 0 }]);
    setActiveDraftAllocationId(firstId);
    // Nếu category đã chọn nằm ngoài 5 mục đầu → mở sẵn CategoryPicker để user thấy.
    const needsExpanded =
      !!preset.categoryId &&
      !INCOME_CATEGORIES.slice(0, 5).some((c) => c.id === preset.categoryId);
    setCategoryInitialExpanded(needsExpanded);
    setModalVisible(true);
  };

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingPresetId(null);
    setDraftName('');
    setDraftCategoryId('');
    setDraftAllocations([]);
    setActiveDraftAllocationId('');
    setCategoryInitialExpanded(false);
  }, []);

  const exitApp = useCallback(() => {
    const maybeExit = (BackHandler as any)?.exitApp;
    if (typeof maybeExit === 'function') maybeExit();
  }, []);

  useEffect(() => {
    const onHardwareBackPress = () => {
      if (modalVisible) {
        closeModal();
        return true;
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }

      exitApp();
      return true;
    };

    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress,
    );

    return () => sub.remove();
  }, [navigation, modalVisible, exitApp, closeModal]);

  const allocationTotal = useMemo(() => {
    return draftAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  }, [draftAllocations]);

  const handleSave = async () => {
    const stored = await getStoredUser();
    const userId = stored?.uid ?? '';
    if (!userId) {
      showSnackbar({ type: 'error', message: 'Không xác định được người dùng' });
      return;
    }

    const name = draftName.trim();
    if (!name) {
      showSnackbar({ type: 'error', message: 'Vui lòng nhập tên nguồn thu' });
      return;
    }

    if (!draftAllocations.length) {
      showSnackbar({ type: 'error', message: 'Vui lòng thêm ít nhất một quỹ' });
      return;
    }

    if (
      !draftAllocations.every(
        (a) => !!a.fundId && Number.isFinite(a.amount) && a.amount > 0,
      )
    ) {
      showSnackbar({ type: 'error', message: 'Vui lòng chọn quỹ và nhập số tiền hợp lệ' });
      return;
    }

    const fundIds = draftAllocations.map((a) => a.fundId);
    if (new Set(fundIds).size !== fundIds.length) {
      showSnackbar({ type: 'error', message: 'Mỗi quỹ chỉ nên xuất hiện 1 lần' });
      return;
    }

    const presetId =
      editingPresetId ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const nextPreset: IncomePreset = {
      id: presetId,
      name,
      ...(draftCategoryId ? { categoryId: draftCategoryId } : {}),
      allocations: draftAllocations.map((a) => ({
        fundId: a.fundId,
        amount: Math.round(a.amount),
      })),
    };

    const next =
      editingPresetId
        ? presets.map((p) => (p.id === presetId ? nextPreset : p))
        : [nextPreset, ...presets];

    await savePresets(next);
    closeModal();
    showSnackbar({ type: 'success', message: 'Đã lưu nguồn thu' });
  };

  const handleDelete = async (presetId: string) => {
    const stored = await getStoredUser();
    const userId = stored?.uid ?? '';
    if (!userId) return;

    const presetName = presets.find((p) => p.id === presetId)?.name ?? 'nguồn thu';
    const ok = await confirm({
      title: 'Xóa cấu hình nguồn thu?',
      message: `Bạn có chắc muốn xóa cấu hình nguồn thu "${presetName}" không? khi xóa cấu hình nguồn thu, tất cả các giao dịch đã phân bổ theo cấu hình này sẽ không được phân bổ lại.`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
    });
    if (!ok) return;

    const next = presets.filter((p) => p.id !== presetId);
    await savePresets(next);
    showSnackbar({ type: 'success', message: 'Đã xóa nguồn thu' });
  };

  const renderPreset = (p: IncomePreset) => {
    const category = p.categoryId
      ? INCOME_CATEGORIES.find((c) => c.id === p.categoryId)
      : undefined;
    return (
      <View key={p.id} style={styles.swipeableWrapper}>
        <SwipeableRow
          onEdit={() => openEdit(p)}
          onDelete={() => handleDelete(p.id)}
          borderRadius={16}
          buttonWidth={80}
          editText="Sửa"
          deleteText="Xóa"
        >
          <View style={styles.presetCard}>
          <View style={styles.presetHeader}>
            <View style={styles.presetTitleRow}>
              <Text style={styles.presetTitle}>{p.name}</Text>
              {category && (
                <View
                  style={[
                    styles.presetCategoryBadge,
                    { backgroundColor: category.color + '20' },
                  ]}
                >
                  {(() => {
                    const CatIcon = category.icon;
                    return <CatIcon width={12} height={12} color={category.color} />;
                  })()}
                  <Text style={[styles.presetCategoryText, { color: category.color }]} numberOfLines={1}>
                    {category.name}
                  </Text>
                </View>
              )}
            </View>
          </View>

            <View style={styles.allocations}>
              {(p.allocations ?? []).map((a) => {
                const fund = funds.find((f) => f.id === a.fundId);
                const fundName = fund?.name ?? 'Quỹ';
                return (
                  <View key={`${p.id}_${a.fundId}`} style={styles.allocationRow}>
                    <View style={styles.allocationLeft}>
                      <View
                        style={[
                          styles.allocationIconWrap,
                          { backgroundColor: (fund?.color ?? colors.primary) + '20' },
                        ]}
                      >
                        {(() => {
                          const IconComp = getFundIconComponent(fund?.icon);
                          const c = fund?.color ?? colors.primary;
                          return <IconComp width={14} height={14} color={c} />;
                        })()}
                      </View>
                      <Text style={styles.allocationFund} numberOfLines={1}>
                        {fundName}
                      </Text>
                    </View>
                    <Text style={styles.allocationPercent}>
                      {(((a as any).amount ?? 0) as number).toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </SwipeableRow>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else exitApp();
          }}
          activeOpacity={0.8}
        >
          <ChevronLeftIcon width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thiết lập nguồn thu</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoadingFunds || isLoadingPresets ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom + 24) }}
        >
          <Text style={styles.hint}>
            Tạo “nguồn thu” để tự động phân bổ thu nhập vào nhiều quỹ
          </Text>

          {presets.length === 0 ? (
            <View style={styles.emptyBox}>
              <WalletIcon width={42} height={42} color={colors.textLight} />
              <Text style={styles.emptyTitle}>Chưa có nguồn thu</Text>
              <Text style={styles.emptySubtitle}>
                Nhấn “Tạo nguồn thu” để thiết lập phân bổ theo quỹ.
              </Text>
            </View>
          ) : (
            <View style={styles.presetList}>
              {presets.map(renderPreset)}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate} activeOpacity={0.85}>
          <Text style={styles.createBtnText}>Tạo nguồn thu</Text>
        </TouchableOpacity>
      </View>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={closeModal}
        onBackButtonPress={closeModal}
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
              {editingPresetId ? 'Sửa nguồn thu' : 'Tạo nguồn thu'}
            </Text>

            <Text style={styles.inputLabel}>Tên nguồn thu</Text>
            <TextInput
              style={styles.textInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="VD: Lương"
              placeholderTextColor={colors.textLight}
            />

            <View style={styles.modalSectionHeader}>
              <Text style={styles.inputLabel}>Phân bổ theo quỹ (đ)</Text>
              <Text
                style={[
                  styles.percentTotal,
                  allocationTotal > 0 ? styles.percentOk : styles.percentBad,
                ]}
              >
                {allocationTotal.toLocaleString('vi-VN')}đ
              </Text>
            </View>

            {draftAllocations.map((a) => {
              const isActive = a.id === activeDraftAllocationId;
              const selectedFund = funds.find((f) => f.id === a.fundId);
              const fundName = selectedFund?.name ?? 'Chọn quỹ';
              const selectedColor = selectedFund?.color ?? colors.primary;
              return (
                <View key={a.id} style={styles.draftRow}>
                  <View style={styles.draftHeaderRow}>
                    <TouchableOpacity
                      style={[styles.draftFund, isActive && styles.draftFundActive]}
                      onPress={() =>
                        setActiveDraftAllocationId((prev) => (prev === a.id ? '' : a.id))
                      }
                      activeOpacity={0.85}
                    >
                      <View style={styles.draftFundContent}>
                        {selectedFund ? (
                          <View style={[styles.draftFundIconWrap, { backgroundColor: selectedColor + '20' }]}>
                            {(() => {
                              const IconComp = getFundIconComponent(selectedFund.icon);
                              return <IconComp width={16} height={16} color={selectedColor} />;
                            })()}
                          </View>
                        ) : null}
                        <Text
                          style={[styles.draftFundText, isActive && styles.draftFundTextActive]}
                          numberOfLines={1}
                        >
                          {fundName}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {draftAllocations.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => {
                          setDraftAllocations((prev) => {
                            const next = prev.filter((p) => p.id !== a.id);
                            if (activeDraftAllocationId === a.id) {
                              setActiveDraftAllocationId(next[0]?.id ?? '');
                            }
                            return next;
                          });
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {isActive && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.inlineFundPickRow}
                      keyboardShouldPersistTaps="handled"
                    >
                      {fundsDefaultFirst.map((f) => {
                        const usedByOther = draftAllocations.some(
                          (x) => x.fundId === f.id && x.id !== a.id,
                        );
                        const disabled = usedByOther;
                        const isSelected = (a.fundId ?? '') === f.id;
                        const c = f.color ?? colors.primary;
                        return (
                          <TouchableOpacity
                            key={`${a.id}_${f.id}`}
                            style={[
                              styles.fundPickItem,
                              isSelected && { borderColor: c },
                              disabled && { opacity: 0.5 },
                            ]}
                            onPress={() => {
                              if (disabled) return;
                              setDraftAllocations((prev) =>
                                prev.map((p) => (p.id === a.id ? { ...p, fundId: f.id } : p)),
                              );
                              // Chọn xong thì đóng list quỹ
                              setActiveDraftAllocationId('');
                            }}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.fundPickIcon, { backgroundColor: c + '20' }]}>
                              {(() => {
                                const IconComp = getFundIconComponent(f.icon);
                                return <IconComp width={18} height={18} color={c} />;
                              })()}
                            </View>
                            <Text
                              style={[styles.fundPickText, isSelected && { color: c }]}
                              numberOfLines={1}
                            >
                              {f.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                  <View style={styles.draftPercentWrap}>
                    <CurrencyInput
                      value={a.amount}
                      onChange={(v) => {
                        setDraftAllocations((prev) =>
                          prev.map((p) => (p.id === a.id ? { ...p, amount: v } : p)),
                        );
                      }}
                      placeholder="0"
                      inputWrapperStyle={styles.amountInput}
                      inputStyle={styles.amountText}
                      suffixStyle={styles.amountSuffix}
                    />
                  </View>
                </View>
              );
            })}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.addAllocationBtn}
                onPress={() => {
                  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                  setDraftAllocations((prev) => [...prev, { id, fundId: '', amount: 0 }]);
                  setActiveDraftAllocationId(id);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.addAllocationText}>+ Thêm quỹ</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Danh mục thu nhập</Text>
            <CategoryPicker
              categories={INCOME_CATEGORIES}
              value={draftCategoryId}
              onChange={setDraftCategoryId}
              allowDeselect
              initialShowAll={categoryInitialExpanded}
            />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={closeModal} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.modalSaveText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  hint: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: colors.text },
  emptySubtitle: { marginTop: 6, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  presetList: {
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
  presetCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
  },
  presetHeader: { gap: 10 },
  presetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  presetTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  presetCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 140,
  },
  presetCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  presetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  actionBtnSecondary: { backgroundColor: colors.backgroundSecondary },
  actionBtnDanger: { backgroundColor: colors.error },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  actionBtnTextPrimary: { color: colors.white },
  allocations: { marginTop: 12, gap: 8 },
  allocationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  allocationLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 10 },
  allocationIconWrap: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  allocationFund: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  allocationPercent: { fontSize: 13, fontWeight: '900', color: colors.text },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.background },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  modal: { justifyContent: 'flex-end', margin: 0 },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '88%',
  },
  modalBody: { flexGrow: 0 },
  modalBodyContent: {
    paddingBottom: 10,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 4 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  modalSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  percentTotal: { fontSize: 13, fontWeight: '900' },
  percentOk: { color: colors.success },
  percentBad: { color: colors.error },
  draftRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  draftHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftFund: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  draftFundContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftFundIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftFundActive: { borderWidth: 2, borderColor: colors.primary },
  draftFundText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  draftFundTextActive: { color: colors.primary },
  draftPercentWrap: {
    width: '100%',
    marginTop: 2,
  },
  amountInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountText: { fontSize: 15, fontWeight: '800', color: colors.text },
  amountSuffix: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { fontSize: 16, fontWeight: '900', color: colors.textSecondary },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  addAllocationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  addAllocationText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  fundPickRow: { gap: 10, paddingVertical: 8 },
  inlineFundPickRow: { gap: 10, paddingVertical: 8 },
  fundPickItem: {
    minWidth: 92,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  fundPickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  fundPickText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
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
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 14, fontWeight: '900', color: colors.white },
});

export default IncomeSourcesScreen;

