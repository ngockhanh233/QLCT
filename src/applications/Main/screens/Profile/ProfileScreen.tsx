import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { colors } from '../../../../utils/color';
import UserIcon from '../../../../assets/icons/UserIcon';
import BudgetIcon from '../../../../assets/icons/BudgetIcon';
import BellIcon from '../../../../assets/icons/BellIcon';
import WalletIcon from '../../../../assets/icons/WalletIcon';
import { AuthStoredUser, clearStoredUser, getStoredUser } from '../../../../services';
import { confirm } from '../../../../utils/confirm';
import type { RootStackParamList } from '../../MainScreen';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  rightElement,
}) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={styles.menuItemLeft}>
      <View style={styles.menuIconContainer}>
        {icon}
      </View>
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
      </View>
    </View>
    {rightElement ? rightElement : showArrow && <Text style={styles.menuArrow}>›</Text>}
  </TouchableOpacity>
);

type ProfileScreenProps = {
  onLogout: () => void;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout }) => {
  const insets = useSafeAreaInsets();
  const authInstance = getAuth(getApp());
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [user, setUser] = useState<AuthStoredUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) setUser(stored);
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenFinanceReport = () => {
    (navigation.getParent() as { navigate: (name: 'FinanceReport') => void } | undefined)
      ?.navigate('FinanceReport');
  };

  const handleOpenFundManagement = () => {
    (navigation.getParent() as { navigate: (name: 'FundManagement') => void } | undefined)
      ?.navigate('FundManagement');
  };

  const handleOpenIncomeSources = () => {
    (navigation.getParent() as { navigate: (name: 'IncomeSources') => void } | undefined)
      ?.navigate('IncomeSources');
  };

  const handleOpenBalanceNotifications = () => {
    (navigation.getParent() as { navigate: (name: 'Notifications') => void } | undefined)
      ?.navigate('Notifications');
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
    });

    if (!ok) return;

    setIsLoggingOut(true);
    try {
      await Promise.allSettled([
        signOut(authInstance),
        GoogleSignin.signOut(),
      ]);
      await clearStoredUser();
      onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cá nhân</Text>
          <Text style={styles.headerSubtitle}>Quản lý tài khoản & cài đặt</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCover} />
          <View style={styles.profileBody}>
            <View style={styles.avatar}>
              {user?.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  style={styles.avatarImage}
                />
              ) : (
                <UserIcon width={44} height={44} color={colors.white} />
              )}
            </View>
            {isLoadingUser ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.userName}>
                  {user?.displayName || 'Người dùng'}
                </Text>
                {!!user?.email && (
                  <Text style={styles.userEmail}>{user.email}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.section}>
          <View style={styles.menuGroup}>
            {/* <MenuItem
              icon={<UserIcon width={18} height={18} color={colors.text} />}
              title="Thông tin cá nhân"
              subtitle="Tên, email, số điện thoại"
            />
            <MenuItem
              icon={<WalletIcon width={18} height={18} color={colors.text} />}
              title="Quản lý quỹ"
              subtitle="Tạo và quản lý các quỹ chi tiêu"
              onPress={handleOpenFundManagement}
            /> */}
            <MenuItem
              icon={<WalletIcon width={18} height={18} color={colors.text} />}
              title="Thiết lập nguồn thu"
              subtitle="Tự động chia thu nhập theo quỹ"
              onPress={handleOpenIncomeSources}
            />
            <MenuItem
              icon={<BudgetIcon width={18} height={18} color={colors.text} />}
              title="Báo cáo tài chính"
              subtitle="Xem và xuất báo cáo chi tiêu"
              onPress={handleOpenFinanceReport}
            />
            {/* <MenuItem
              icon={
                <BellIcon
                  width={18}
                  height={18}
                  color={colors.textSecondary}
                />
              }
              title="Thông báo"
              showArrow={false}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: colors.backgroundSecondary, true: colors.primary + '50' }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.textLight}
                />
              }
            /> */}
            <MenuItem
              icon={
                <BellIcon
                  width={18}
                  height={18}
                  color={colors.text}
                />
              }
              title="Thông báo số dư"
              subtitle="Theo dõi biến động số dư trong các quỹ"
              onPress={handleOpenBalanceNotifications}
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={styles.logoutText.color} />
          ) : (
            <Text style={styles.logoutText}>Đăng xuất</Text>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>Phiên bản 1.0.0</Text>

        <View style={{ height: Math.max(24, insets.bottom + 24) }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  profileCard: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  profileCover: {
    height: 74,
    backgroundColor: colors.primary,
    opacity: 0.12,
  },
  profileBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    marginTop: -36,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.white,
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    color: colors.textLight,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 32,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: colors.white,
  },
  logoutButtonDisabled: {
    opacity: 0.7,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textLight,
    marginTop: 20,
  },
});

export default ProfileScreen;
