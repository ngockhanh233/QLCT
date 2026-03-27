import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors } from '../../../../utils/color';
import type { BottomTabParamList } from '../../BottomTabNavigator';
import { getStoredUser, type AuthStoredUser } from '../../../../services';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import { HeaderSection, SpendingDistributionSection } from './components';
import { Skeleton } from '../../../../components';
import { useFunds } from '../FundManagement/hooks/useFunds';
import { useMonthTransactions } from './hooks';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList, 'Home'>>();
  const [user, setUser] = useState<AuthStoredUser | null>(null);
  const [userResolved, setUserResolved] = useState(false);
  const [hasSeenLoadingCycle, setHasSeenLoadingCycle] = useState(false);
  const { getAndClearNeedsRefresh } = useHomeDataChanged();

  const { funds, refresh: refreshFunds, isLoading: fundsLoading } = useFunds();
  const {
    totalIncome,
    totalExpense,
    expenseByCategory,
    isLoading: monthLoading,
    refresh: refreshMonth,
  } = useMonthTransactions();

  const totalFundBalance = useMemo(() => {
    return funds.reduce((sum, f) => sum + (f.balance ?? 0), 0);
  }, [funds]);

  useEffect(() => {
    let cancelled = false;
    getStoredUser()
      .then((stored) => {
        if (!cancelled) setUser(stored ?? null);
      })
      .finally(() => {
        if (!cancelled) setUserResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fundsLoading || monthLoading) {
      setHasSeenLoadingCycle(true);
    }
  }, [fundsLoading, monthLoading]);

  const onQuickAdd = useCallback(() => {
    (navigation.getParent() as { navigate: (name: 'AddTransaction') => void } | undefined)?.navigate('AddTransaction');
  }, [navigation]);

  const onManageFund = useCallback(() => {
    navigation.navigate('Budget');
  }, [navigation]);

  const onViewDetailStats = useCallback(() => {
    (navigation.getParent() as { navigate: (name: 'FinanceReport') => void } | undefined)?.navigate('FinanceReport');
  }, [navigation]);

  const onCategoryDetail = useCallback(
    (categoryId: string) => {
      (navigation.getParent() as
        | { navigate: (name: 'SpendingCategoryDetail', params: { categoryId: string }) => void }
        | undefined)?.navigate('SpendingCategoryDetail', { categoryId });
    },
    [navigation],
  );

  const onRefresh = useCallback(() => {
    refreshMonth();
    refreshFunds();
  }, [refreshMonth, refreshFunds]);

  useFocusEffect(
    useCallback(() => {
      if (!getAndClearNeedsRefresh()) return;
      refreshMonth();
      refreshFunds();
    }, [getAndClearNeedsRefresh, refreshMonth, refreshFunds]),
  );

  const isRefreshing = monthLoading || fundsLoading;
  const showInitialSkeleton =
    // Chỉ show skeleton ở lần load đầu tiên.
    // Khi refresh dữ liệu (sau khi add/sửa/xóa), không muốn UI "reload cả trang"
    // bằng cách che toàn bộ bằng skeleton nữa.
    !userResolved || !hasSeenLoadingCycle;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {showInitialSkeleton ? (
          <>
            <View style={[styles.skeletonHeaderWrap, { paddingTop: insets.top + 16 }]}>
              <View style={styles.skeletonTopRow}>
                <View style={styles.skeletonUserLeft}>
                  <Skeleton width={48} height={48} radius={24} />
                  <View style={styles.skeletonUserText}>
                    <Skeleton width={86} height={12} />
                    <Skeleton width={130} height={16} />
                  </View>
                </View>
                <Skeleton width={40} height={40} radius={20} />
              </View>

              <View style={styles.skeletonBalanceCard}>
                <Skeleton width={100} height={12} />
                <Skeleton width="58%" height={34} radius={10} style={{ marginTop: 8 }} />
                <View style={styles.skeletonStatsRow}>
                  <View style={styles.skeletonStatCol}>
                    <Skeleton width={90} height={11} />
                    <Skeleton width={86} height={18} style={{ marginTop: 8 }} />
                  </View>
                  <View style={styles.skeletonStatCol}>
                    <Skeleton width={90} height={11} />
                    <Skeleton width={86} height={18} style={{ marginTop: 8 }} />
                  </View>
                </View>
              </View>

              <View style={styles.skeletonActionsRow}>
                <Skeleton width={82} height={66} radius={14} />
                <Skeleton width={82} height={66} radius={14} />
                <Skeleton width={82} height={66} radius={14} />
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <View style={{ padding: 16 }}>
                <View style={styles.skeletonSectionHeader}>
                  <View>
                    <Skeleton width={130} height={16} />
                    <Skeleton width={70} height={12} style={{ marginTop: 8 }} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Skeleton width={90} height={12} />
                    <Skeleton width={70} height={16} style={{ marginTop: 8 }} />
                  </View>
                </View>
                <Skeleton width="100%" height={160} radius={14} style={{ marginTop: 14 }} />
              </View>
            </View>
          </>
        ) : (
          <>
            <HeaderSection
              paddingTop={insets.top + 16}
              displayName={user?.displayName}
              photoURL={user?.photoURL}
              balance={totalFundBalance}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              onQuickAdd={onQuickAdd}
              onViewDetailStats={onViewDetailStats}
              onManageFund={onManageFund}
            />
            <View style={styles.sectionBlock}>
              <SpendingDistributionSection
                expenseByCategory={expenseByCategory}
                totalExpense={totalExpense}
                onPressDetail={onViewDetailStats}
                onPressCategory={onCategoryDetail}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionBlock: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  skeletonHeaderWrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  skeletonUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  skeletonUserText: {
    gap: 10,
  },
  skeletonBalanceCard: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: colors.white,
    minHeight: 180,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 20,
  },
  skeletonStatCol: {
    flex: 1,
  },
  skeletonActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});

export default HomeScreen;
