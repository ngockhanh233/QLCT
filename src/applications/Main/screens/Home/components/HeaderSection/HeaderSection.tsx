import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../../../../../utils/color';
// import ChevronDownIcon from '../../../../../../assets/icons/ChevronDownIcon';
import AddIcon from '../../../../../../assets/icons/AddIcon';
import BudgetIcon from '../../../../../../assets/icons/BudgetIcon';
import WalletIcon from '../../../../../../assets/icons/WalletIcon';
import BellIcon from '../../../../../../assets/icons/BellIcon';
import { getStoredUser } from '../../../../../../services';
import {
  getBalanceNotificationsUnreadCount,
  subscribeBalanceNotifications,
  setBalanceNotificationsUnreadCount,
} from '../../../../../../services/balanceNotifications';
import React, { useEffect, useRef, useState } from 'react';
import PiggyBankIcon from '../../../../../../assets/icons/PiggyBankIcon';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

interface HeaderSectionProps {
  paddingTop: number;
  displayName?: string | null;
  photoURL?: string | null;
  balance: number;
  totalIncome: number;
  totalExpense: number;
  onQuickAdd?: () => void;
  onViewDetailStats?: () => void;
  onManageFund?: () => void;
}

const HeaderSection = ({
  paddingTop,
  displayName,
  photoURL,
  balance,
  totalIncome,
  totalExpense,
  onQuickAdd,
  onViewDetailStats,
  onManageFund,
}: HeaderSectionProps) => {
  const navigation = useNavigation<any>();
  const [unreadCount, setUnreadCount] = useState(0);
  const userIdRef = useRef<string>('');

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const stored = await getStoredUser();
        const uid = stored?.uid ?? '';
        userIdRef.current = uid;
        if (!uid) return;

        const cachedUnread = await getBalanceNotificationsUnreadCount(uid);
        if (!cancelled) setUnreadCount(cachedUnread);

        // Realtime update badge if có thông báo mới (kể cả từ nơi khác).
        unsub = subscribeBalanceNotifications(uid, async (items) => {
          const unread = items.filter((it) => !it.isRead).length;
          if (!cancelled) setUnreadCount(unread);
          try {
            await setBalanceNotificationsUnreadCount(uid, unread);
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const handleOpenNotifications = () => {
    (navigation.getParent() as { navigate: (name: 'Notifications') => void } | undefined)?.navigate('Notifications');
  };

  return (
    <View style={[styles.container, { paddingTop }]}>
      {/* User Info */}
      <View style={styles.userInfo}>
        <View style={styles.userLeft}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <Image
              source={require('../../../../../../assets/img/logo.png')}
              style={styles.avatar}
            />
          )}
          <View style={styles.userText}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{displayName || 'Bạn'}</Text>
              {/* <ChevronDownIcon width={16} height={16} color={colors.text} /> */}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notifyButton}
          activeOpacity={0.75}
          onPress={handleOpenNotifications}
        >
          <BellIcon width={20} height={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifyBadge}>
              <Text style={styles.notifyBadgeText}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

    {/* Balance Card - Visa Style */}
    <LinearGradient
      colors={['#FF8C42', '#FF6B35', '#E85D04']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.balanceCard}
    >
      <View style={styles.cardCircle1} />
      <View style={styles.cardCircle2} />
      <View style={styles.cardPattern} />

      <View style={styles.cardContent}>
        <Text style={styles.balanceLabel}>Số dư còn lại</Text>
        <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TỔNG THU THÁNG</Text>
            <Text style={styles.statAmount}>{formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TỔNG CHI THÁNG</Text>
            <Text style={styles.statAmountExpense}>{formatMoney(totalExpense)}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>

    {/* Quick actions (Momo-like) */}
    <View style={styles.actionsRow}>
      <TouchableOpacity
        style={styles.actionItem}
        activeOpacity={0.8}
        onPress={onViewDetailStats}
      >
        <View style={[styles.actionIconWrap, { backgroundColor: '#FF8C42' }]}>
          <BudgetIcon width={18} height={18} color={colors.white} />
        </View>
        <Text style={styles.actionLabel}>Thống kê</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionItem}
        activeOpacity={0.8}
        onPress={onQuickAdd}
      >
        <View style={[styles.actionIconWrap, { backgroundColor: colors.primary }]}>
          <AddIcon width={18} height={18} color={colors.white} />
        </View>
        <Text style={styles.actionLabel}>Thêm nhanh</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionItem}
        activeOpacity={0.8}
        onPress={onManageFund}
      >
        <View style={[styles.actionIconWrap, { backgroundColor: '#22C55E' }]}>
          {/* <WalletIcon width={18} height={18} color={colors.white} /> */}
          <PiggyBankIcon width={18} height={18} color={colors.white} />
        </View>
        <Text style={styles.actionLabel}>Quản lý Quỹ</Text>
      </TouchableOpacity>
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
  },
  userText: {
    marginLeft: 12,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 4,
  },
  notifyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  notifyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    minHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  cardCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardCircle2: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardPattern: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardContent: {
    zIndex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginVertical: 6,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  statAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  statAmountExpense: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});

export default HeaderSection;
