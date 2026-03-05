import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../../../../../../utils/color';
import ChevronDownIcon from '../../../../../../assets/icons/ChevronDownIcon';
import AddIcon from '../../../../../../assets/icons/AddIcon';
import BudgetIcon from '../../../../../../assets/icons/BudgetIcon';
import WalletIcon from '../../../../../../assets/icons/WalletIcon';

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
}: HeaderSectionProps) => (
  <View style={[styles.container, { paddingTop }]}>
    {/* User Info */}
    <View style={styles.userInfo}>
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
        <Text style={styles.balanceLabel}>Tiền dư tháng này</Text>
        <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TỔNG THU</Text>
            <Text style={styles.statAmount}>{formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>TỔNG CHI</Text>
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
          <WalletIcon width={18} height={18} color={colors.white} />
        </View>
        <Text style={styles.actionLabel}>Quản lý Quỹ</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
