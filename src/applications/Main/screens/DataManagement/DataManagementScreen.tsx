import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../../../utils/color';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import TrashIcon from '../../../../assets/icons/TrashIcon';
import WarningIcon from '../../../../assets/icons/WarningIcon';
import CalendarIcon from '../../../../assets/icons/CalendarIcon';
import {
  getStoredUser,
  fetchTransactionYearStats,
  deleteTransactionsUpToYear,
  type YearTransactionStats,
} from '../../../../services';
import { showSnackbar } from '../../../../utils/snackbar';
import type { RootStackParamList } from '../../MainScreen';

const DataManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [userId, setUserId] = useState<string>('');
  const [stats, setStats] = useState<YearTransactionStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStats = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const items = await fetchTransactionYearStats(uid);
      setStats(items);
      // Mặc định chọn năm hiện tại nếu có dữ liệu, không thì chọn năm mới nhất
      const now = new Date().getFullYear();
      if (items.some((s) => s.year === now)) {
        setSelectedYear(now);
      } else if (items.length > 0) {
        setSelectedYear(items[0].year);
      } else {
        setSelectedYear(null);
      }
    } catch (e) {
      console.error('Error loading year stats:', e);
      showSnackbar({
        type: 'error',
        message: 'Không thể tải thống kê dữ liệu',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        const uid = stored?.uid ?? '';
        if (!cancelled) setUserId(uid);
        if (uid) await loadStats(uid);
        else setIsLoading(false);
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  /** Tổng hợp các năm <= selectedYear (sẽ bị xóa). */
  const cutoffSummary = useMemo(() => {
    if (selectedYear === null) {
      return { count: 0, loanCount: 0, totalIncome: 0, totalExpense: 0 };
    }
    const filtered = stats.filter((s) => s.year <= selectedYear);
    return filtered.reduce(
      (acc, s) => ({
        count: acc.count + (s.totalCount - s.loanCount),
        loanCount: acc.loanCount + s.loanCount,
        totalIncome: acc.totalIncome + s.totalIncome,
        totalExpense: acc.totalExpense + s.totalExpense,
      }),
      { count: 0, loanCount: 0, totalIncome: 0, totalExpense: 0 },
    );
  }, [stats, selectedYear]);

  const handleDelete = useCallback(async () => {
    if (!userId || selectedYear === null) return;
    setIsDeleting(true);
    try {
      const deleted = await deleteTransactionsUpToYear(userId, selectedYear);
      setConfirmVisible(false);
      showSnackbar({
        type: 'success',
        message:
          deleted > 0
            ? `Đã xóa ${deleted.toLocaleString('vi-VN')} giao dịch`
            : 'Không có giao dịch nào được xóa',
      });
      await loadStats(userId);
    } catch (e) {
      console.error('Error deleting transactions:', e);
      showSnackbar({
        type: 'error',
        message: 'Không thể xóa giao dịch. Vui lòng thử lại',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [userId, selectedYear, loadStats]);

  const yearList = useMemo(() => stats.map((s) => s.year), [stats]);
  const canDelete = selectedYear !== null && cutoffSummary.count > 0 && !isDeleting;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeftIcon width={22} height={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý dữ liệu</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.headerSubtitle}>
          Dọn dẹp dữ liệu cũ để giữ ứng dụng gọn nhẹ và tải nhanh hơn.
        </Text>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Card 1: Xóa giao dịch theo năm */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <TrashIcon width={18} height={18} color={colors.error} />
                <Text style={styles.sectionTitle}>Xóa giao dịch theo năm</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Chọn một mốc năm — toàn bộ giao dịch thu/chi từ năm đó trở về trước sẽ bị xóa khỏi cơ sở dữ liệu. Số dư các quỹ hiện tại{' '}
                <Text style={styles.sectionDescStrong}>không thay đổi</Text>.
              </Text>

              <View style={styles.yearPickerRow}>
                <View style={styles.yearLabelWrap}>
                  <CalendarIcon width={14} height={14} color={colors.textSecondary} />
                  <Text style={styles.yearLabel}>Xóa giao dịch từ năm</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.yearPickerBtn,
                    yearList.length === 0 && styles.yearPickerBtnDisabled,
                  ]}
                  activeOpacity={0.8}
                  disabled={yearList.length === 0}
                  onPress={() => setYearPickerVisible(true)}
                >
                  <Text style={styles.yearPickerText}>
                    {selectedYear !== null ? `Năm ${selectedYear}` : 'Chọn năm'}
                  </Text>
                  <Text style={styles.yearPickerCaret}>▾</Text>
                </TouchableOpacity>
                <Text style={styles.yearHint}>...và toàn bộ năm trước đó</Text>
              </View>

              <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, styles.kpiCardDanger]}>
                  <Text style={styles.kpiLabel}>Sẽ bị xóa</Text>
                  <Text style={styles.kpiValueRow}>
                    <Text style={[styles.kpiValueBig, { color: colors.error }]}>
                      {cutoffSummary.count.toLocaleString('vi-VN')}
                    </Text>
                    <Text style={styles.kpiValueUnit}> giao dịch</Text>
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Tổng thu</Text>
                  <Text style={[styles.kpiValueBig, { color: colors.success }]}>
                    {cutoffSummary.totalIncome.toLocaleString('vi-VN')}đ
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Tổng chi</Text>
                  <Text style={[styles.kpiValueBig, { color: colors.error }]}>
                    {cutoffSummary.totalExpense.toLocaleString('vi-VN')}đ
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Vay/nợ (giữ lại)</Text>
                  <Text style={styles.kpiValueRow}>
                    <Text style={styles.kpiValueBig}>
                      {cutoffSummary.loanCount.toLocaleString('vi-VN')}
                    </Text>
                    <Text style={styles.kpiValueUnit}> giao dịch</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.warningBox}>
                <View style={styles.warningTitleRow}>
                  <WarningIcon width={16} height={16} color="#D97706" />
                  <Text style={styles.warningTitle}>
                    Hành động này không thể hoàn tác
                  </Text>
                </View>
                <Text style={styles.warningDesc}>
                  Các giao dịch đã xóa sẽ bị xóa vĩnh viễn khỏi Firestore. Số dư các quỹ hiện tại sẽ được giữ nguyên — phù hợp khi bạn muốn dọn dẹp lịch sử cũ mà không ảnh hưởng đến trạng thái hiện tại.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
                activeOpacity={0.85}
                disabled={!canDelete}
                onPress={() => setConfirmVisible(true)}
              >
                <TrashIcon width={16} height={16} color={colors.white} />
                <Text style={styles.deleteBtnText}>
                  Xóa {cutoffSummary.count.toLocaleString('vi-VN')} giao dịch
                </Text>
              </TouchableOpacity>
            </View>

            {/* Card 2: Phân bố giao dịch theo năm */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Phân bố giao dịch theo năm</Text>
              <Text style={styles.sectionDesc}>
                Tham khảo số lượng giao dịch theo từng năm để chọn mốc xóa phù hợp.
              </Text>

              {stats.length === 0 ? (
                <Text style={styles.emptyHint}>Chưa có dữ liệu giao dịch.</Text>
              ) : (
                <View style={styles.yearListWrap}>
                  {stats.map((s) => {
                    const willDelete =
                      selectedYear !== null && s.year <= selectedYear;
                    return (
                      <View
                        key={s.year}
                        style={[
                          styles.yearItem,
                          willDelete && styles.yearItemWillDelete,
                        ]}
                      >
                        <View style={styles.yearItemLeft}>
                          <CalendarIcon width={14} height={14} color={colors.text} />
                          <Text style={styles.yearItemTitle}>Năm {s.year}</Text>
                          {willDelete && (
                            <View style={styles.willDeleteBadge}>
                              <Text style={styles.willDeleteBadgeText}>Sẽ xóa</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.yearItemRight}>
                          <Text style={styles.yearItemCount}>
                            {s.totalCount - s.loanCount} giao dịch
                          </Text>
                          <Text style={[styles.yearItemAmount, { color: colors.success }]}>
                            +{s.totalIncome.toLocaleString('vi-VN')}đ
                          </Text>
                          <Text style={[styles.yearItemAmount, { color: colors.error }]}>
                            −{s.totalExpense.toLocaleString('vi-VN')}đ
                          </Text>
                          {s.loanCount > 0 && (
                            <Text style={styles.yearItemLoan}>
                              {s.loanCount} vay/nợ
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: Math.max(20, insets.bottom + 20) }} />
      </ScrollView>

      {/* Year picker modal */}
      <Modal
        isVisible={yearPickerVisible}
        onBackdropPress={() => setYearPickerVisible(false)}
        onBackButtonPress={() => setYearPickerVisible(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Chọn năm</Text>
          <ScrollView style={styles.pickerScroll}>
            {yearList.map((y) => {
              const active = y === selectedYear;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerItem, active && styles.pickerItemActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedYear(y);
                    setYearPickerVisible(false);
                  }}
                >
                  <Text
                    style={[styles.pickerItemText, active && styles.pickerItemTextActive]}
                  >
                    Năm {y}
                  </Text>
                  {active && <Text style={styles.pickerItemCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={styles.pickerCloseBtn}
            activeOpacity={0.8}
            onPress={() => setYearPickerVisible(false)}
          >
            <Text style={styles.pickerCloseText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        isVisible={confirmVisible}
        onBackdropPress={() => !isDeleting && setConfirmVisible(false)}
        onBackButtonPress={() => !isDeleting && setConfirmVisible(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.confirmCard}>
          <View style={styles.confirmTitleRow}>
            <View style={styles.confirmIconCircle}>
              <Text style={styles.confirmIconText}>!</Text>
            </View>
            <Text style={styles.confirmTitle}>Xác nhận xóa giao dịch</Text>
          </View>
          <Text style={styles.confirmDesc}>
            Bạn sắp xóa{' '}
            <Text style={styles.confirmStrong}>
              {cutoffSummary.count.toLocaleString('vi-VN')} giao dịch
            </Text>{' '}
            từ năm{' '}
            <Text style={styles.confirmStrong}>{selectedYear ?? ''}</Text> trở về trước. Hành động này{' '}
            <Text style={styles.confirmStrong}>không thể hoàn tác</Text>.
          </Text>

          <View style={styles.confirmBullets}>
            <Text style={styles.confirmBullet}>• Số dư các quỹ hiện tại sẽ được giữ nguyên.</Text>
            <Text style={styles.confirmBullet}>• Các giao dịch liên quan đến vay/nợ sẽ được giữ lại.</Text>
            <Text style={styles.confirmBullet}>• Các báo cáo, biểu đồ trong khoảng đó sẽ trống.</Text>
          </View>

          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmCancel]}
              activeOpacity={0.85}
              disabled={isDeleting}
              onPress={() => setConfirmVisible(false)}
            >
              <Text style={styles.confirmCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, styles.confirmDelete, isDeleting && styles.deleteBtnDisabled]}
              activeOpacity={0.85}
              disabled={isDeleting}
              onPress={handleDelete}
            >
              {isDeleting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmDeleteText}>
                  Xóa {cutoffSummary.count.toLocaleString('vi-VN')} giao dịch
                </Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  sectionDesc: {
    marginTop: 6,
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sectionDescStrong: {
    fontWeight: '800',
    color: colors.text,
  },
  yearPickerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yearLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yearPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 110,
    justifyContent: 'space-between',
  },
  yearPickerBtnDisabled: {
    opacity: 0.5,
  },
  yearPickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  yearPickerCaret: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  yearHint: {
    fontSize: 11.5,
    color: colors.textLight,
    marginLeft: 2,
  },
  kpiGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  kpiCardDanger: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  kpiValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  kpiValueBig: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  kpiValueUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  warningBox: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    flex: 1,
  },
  warningDesc: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  deleteBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.error,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  emptyHint: {
    marginTop: 14,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  yearListWrap: {
    marginTop: 12,
    gap: 8,
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    gap: 8,
  },
  yearItemWillDelete: {
    backgroundColor: colors.error + '12',
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  yearItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  yearItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  willDeleteBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.error + '25',
  },
  willDeleteBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  yearItemRight: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  yearItemCount: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  yearItemAmount: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  yearItemLoan: {
    fontSize: 11,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  pickerCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerItemActive: {
    backgroundColor: colors.primary + '15',
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pickerItemTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  pickerItemCheck: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  pickerCloseBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  pickerCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  confirmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  confirmIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIconText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  confirmDesc: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  confirmStrong: {
    fontWeight: '800',
  },
  confirmBullets: {
    marginTop: 10,
    gap: 4,
  },
  confirmBullet: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  confirmActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    minWidth: 90,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancel: {
    backgroundColor: colors.backgroundSecondary,
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmDelete: {
    backgroundColor: colors.error,
  },
  confirmDeleteText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
});

export default DataManagementScreen;
