import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Modal from 'react-native-modal';
import { colors } from '../../../../utils/color';
import type { BottomTabParamList } from '../../BottomTabNavigator';
import { getStoredUser } from '../../../../services';
import type { AuthStoredUser } from '../../../../services';
import { useHomeDataChanged } from '../../../../contexts/HomeDataChangedContext';
import { HeaderSection, SummarySection, SpendingDistributionSection } from './components';
import { useMonthTransactions } from './hooks';
import { useFixedItems } from '../Budget/hooks';
import { Skeleton } from '../../../../components';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList, 'Home'>>();
  const [user, setUser] = useState<AuthStoredUser | null>(null);
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  const [fundModalVisible, setFundModalVisible] = useState(false);
  const { getAndClearNeedsRefresh } = useHomeDataChanged();

  const {
    totalIncome,
    totalExpense,
    expenseByCategory,
    isLoading: monthLoading,
    refresh: refreshMonth,
  } = useMonthTransactions();

  const { getTotalFixedIncome, getTotalFixedExpense, refresh: refreshFixed } = useFixedItems();
  const fixedIncomeTotal = getTotalFixedIncome();
  const fixedExpenseTotal = getTotalFixedExpense();
  const totalIncomeWithFixed = totalIncome + fixedIncomeTotal;
  const totalExpenseWithFixed = totalExpense + fixedExpenseTotal;
  const balanceDisplay = totalIncomeWithFixed - totalExpenseWithFixed;

  useEffect(() => {
    let cancelled = false;
    getStoredUser().then((stored) => {
      if (!cancelled) setUser(stored ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const onQuickAdd = useCallback(() => {
    (navigation.getParent() as { navigate: (name: 'AddTransaction') => void } | undefined)?.navigate('AddTransaction');
  }, [navigation]);

  const onViewAllFixed = useCallback(() => {
    navigation.navigate('Budget');
  }, [navigation]);

  const onManageFund = useCallback(() => {
    setFundModalVisible(true);
  }, []);

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
    refreshFixed();
  }, [refreshMonth, refreshFixed]);

  useFocusEffect(
    useCallback(() => {
      if (!getAndClearNeedsRefresh()) return;
      refreshMonth();
      refreshFixed();
    }, [getAndClearNeedsRefresh, refreshMonth, refreshFixed]),
  );

  // Đánh dấu lần load đầu tiên đã hoàn thành (để chỉ hiển thị skeleton khi mới vào app)
  useEffect(() => {
    if (!monthLoading) {
      setHasInitialLoaded(true);
    }
  }, [monthLoading]);

  const isInitialLoading = !hasInitialLoaded;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={monthLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isInitialLoading ? (
          <>
            <View style={styles.headerSkeleton}>
              <Skeleton width="40%" height={20} />
              <View style={styles.headerSkeletonRow}>
                <Skeleton width="30%" height={16} />
                <Skeleton width="30%" height={16} />
              </View>
              <Skeleton width="50%" height={36} radius={18} />
            </View>

            <View style={styles.sectionBlock}>
              <View style={styles.sectionSkeletonHeader}>
                <Skeleton width="40%" height={18} />
                <Skeleton width={70} height={14} />
              </View>
              <Skeleton width="100%" height={12} radius={6} />
              <View style={{ height: 16 }} />
              {Array.from({ length: 3 }).map((_, idx) => (
                <View key={idx} style={styles.sectionSkeletonRow}>
                  <Skeleton width={40} height={40} radius={12} />
                  <View style={styles.sectionSkeletonText}>
                    <Skeleton width="60%" height={14} />
                    <View style={{ height: 6 }} />
                    <Skeleton width="40%" height={12} />
                  </View>
                  <Skeleton width={70} height={14} />
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <HeaderSection
              paddingTop={insets.top + 16}
              displayName={user?.displayName}
              photoURL={user?.photoURL}
              balance={balanceDisplay}
              totalIncome={totalIncomeWithFixed}
              totalExpense={totalExpenseWithFixed}
              onQuickAdd={onQuickAdd}
              onViewDetailStats={onViewDetailStats}
              onManageFund={onManageFund}
            />
            {/* <View style={styles.sectionBlock}>
              <SummarySection
                fixedIncomeTotal={fixedIncomeTotal}
                fixedExpenseTotal={fixedExpenseTotal}
                onViewAll={onViewAllFixed}
              />
            </View> */}
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

      <Modal
        isVisible={fundModalVisible}
        onBackdropPress={() => setFundModalVisible(false)}
        onBackButtonPress={() => setFundModalVisible(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.devModalCard}>
          <Text style={styles.devModalTitle}>Đang phát triển</Text>
          <Text style={styles.devModalMessage}>
            Tính năng Quản lý Quỹ đang được phát triển. Bạn vui lòng quay lại sau nhé.
          </Text>
          <TouchableOpacity
            style={styles.devModalButton}
            activeOpacity={0.85}
            onPress={() => setFundModalVisible(false)}
          >
            <Text style={styles.devModalButtonText}>Đóng</Text>
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
  headerSkeleton: {
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  headerSkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  sectionSkeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionSkeletonText: {
    flex: 1,
    marginHorizontal: 12,
  },
  devModalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  devModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  devModalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  devModalButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});

export default HomeScreen;
