import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Modal from 'react-native-modal';
import { colors } from '../../../../utils/color';
import ChevronLeftIcon from '../../../../assets/icons/ChevronLeftIcon';
import { getStoredUser } from '../../../../services';
import {
  subscribeBalanceNotifications,
  markBalanceNotificationsRead,
  markBalanceNotificationsReadByIds,
  deleteBalanceNotification,
  type BalanceNotificationRecord,
} from '../../../../services/balanceNotifications';
import type { RootStackParamList } from '../../MainScreen';
import { SwipeableRow } from '../../../../components';

const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();

  const [userId, setUserId] = useState<string>('');
  const [items, setItems] = useState<BalanceNotificationRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [stickyUnreadIds, setStickyUnreadIds] = useState<Set<string>>(new Set());
  const capturedUnreadRef = useRef(false);
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledMarkRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) setUserId(stored?.uid ?? '');
      } catch {
        if (!cancelled) setUserId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeBalanceNotifications(userId, (list) => {
      setItems(list);
      setIsLoading(false);
      setIsRefreshing(false);

      // Capture "unread at open" once per focus cycle, to keep UI stable even after backend marks as read.
      if (!capturedUnreadRef.current) {
        capturedUnreadRef.current = true;
        const ids = new Set(list.filter((it) => !it.isRead).map((it) => it.id));
        setStickyUnreadIds(ids);
      } else {
        // If a new unread notification arrives while viewing, still highlight it.
        const newUnread = list.filter((it) => !it.isRead).map((it) => it.id);
        if (newUnread.length) {
          setStickyUnreadIds((prev) => {
            const next = new Set(prev);
            newUnread.forEach((id) => next.add(id));
            return next;
          });
        }
      }
    });

    return () => {
      unsub();
    };
  }, [userId]);

  // Reset per focus cycle.
  useEffect(() => {
    if (!isFocused) return;
    capturedUnreadRef.current = false;
    scheduledMarkRef.current = false;
    setStickyUnreadIds(new Set());
    if (markTimerRef.current) {
      clearTimeout(markTimerRef.current);
      markTimerRef.current = null;
    }
  }, [isFocused]);

  // Show unread highlight first, then after ~1s mark as read in backend (do not change UI).
  useEffect(() => {
    if (!isFocused) return;
    if (!userId) return;
    if (!items.length) return;
    if (scheduledMarkRef.current) return;

    scheduledMarkRef.current = true;

    const unreadIds = items.filter((it) => !it.isRead).map((it) => it.id);
    const latest = items[0]?.createdAtMs ?? Date.now();

    markTimerRef.current = setTimeout(() => {
      // Fire-and-forget, UI stays as-is.
      void (async () => {
        try {
          if (unreadIds.length) {
            await markBalanceNotificationsReadByIds(userId, unreadIds);
          }
          await markBalanceNotificationsRead(userId, latest);
        } catch {
          // ignore
        }
      })();
    }, 1000);

    return () => {
      if (markTimerRef.current) {
        clearTimeout(markTimerRef.current);
        markTimerRef.current = null;
      }
    };
  }, [isFocused, userId, items]);

  const handleRefresh = useCallback(() => {
    // Realtime via onSnapshot; just show spinner briefly.
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 450);
  }, []);

  const renderTime = useCallback((ms: number) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString('vi-VN')} • ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  const getKindColor = useCallback((kind: BalanceNotificationRecord['kind']) => {
    if (kind === 'transaction_added') return colors.success;
    if (kind === 'transaction_deleted') return colors.error;
    if (kind === 'fund_transfer') return colors.primary;
    if (kind === 'fund_topup') return colors.secondary;
    if (kind === 'fund_balance_set') return colors.tertiary;
    return colors.textLight;
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!userId) return;
    try {
      await deleteBalanceNotification(userId, id);
    } catch {
      setErrorModalVisible(true);
    }
  }, [userId]);

  const empty = useMemo(() => !isLoading && items.length === 0, [isLoading, items.length]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeftIcon width={24} height={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo số dư</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Đang tải thông báo...</Text>
            </View>
          ) : empty ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptySubtitle}>
                Biến động số dư (chuyển quỹ, thêm/xóa giao dịch...) sẽ được lưu tại đây.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.swipeableWrap}>
            <SwipeableRow
              onDelete={() => handleDelete(item.id)}
              deleteText="Xóa"
              deleteButtonColor={colors.error}
              borderRadius={16}
              buttonWidth={80}
            >
              <View style={[styles.card, stickyUnreadIds.has(item.id) && styles.cardUnread]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.kindDot, { backgroundColor: getKindColor(item.kind) }]} />
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardTime}>{renderTime(item.createdAtMs)}</Text>
                </View>
                <Text style={styles.cardMessage}>{item.message}</Text>
              </View>
            </SwipeableRow>
          </View>
        )}
      />

      <Modal
        isVisible={errorModalVisible}
        onBackdropPress={() => setErrorModalVisible(false)}
        onBackButtonPress={() => setErrorModalVisible(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Có lỗi xảy ra</Text>
          <Text style={styles.errorMessage}>Không thể tải thông báo. Vui lòng thử lại.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            activeOpacity={0.85}
            onPress={() => setErrorModalVisible(false)}
          >
            <Text style={styles.errorButtonText}>Đóng</Text>
          </TouchableOpacity>
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 12,
  },
  swipeableWrap: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyWrap: {
    paddingTop: 44,
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    backgroundColor: '#FFF8F3',
    borderColor: colors.primary + '22',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  kindDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textLight,
  },
  cardMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});

export default NotificationsScreen;

