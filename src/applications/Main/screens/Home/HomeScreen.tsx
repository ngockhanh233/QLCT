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
import { useFunds } from '../FundManagement/hooks/useFunds';
import { useMonthTransactions } from './hooks';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList, 'Home'>>();
  const [user, setUser] = useState<AuthStoredUser | null>(null);
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
    getStoredUser().then((stored) => {
      if (!cancelled) setUser(stored ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
});

export default HomeScreen;
