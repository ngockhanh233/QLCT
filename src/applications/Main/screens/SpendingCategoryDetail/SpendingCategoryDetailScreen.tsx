import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { colors } from '../../../../utils/color';
import { getStoredUser } from '../../../../services';
import { getExpenseCategory } from '../../../../utils/categoryUtils';
import type { RootStackParamList } from '../../MainScreen';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Skeleton } from '../../../../components';

type Route = {
  key: string;
  name: 'SpendingCategoryDetail';
  params?: {
    categoryId: string;
  };
};

interface TransactionRecord {
  id: string;
  amount: number;
  note?: string | null;
  transactionDate: Date;
}

const firestoreInstance = getFirestore(getApp());
const transactionsCollection = collection(firestoreInstance, 'transactions');

const SpendingCategoryDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();

  const categoryId = route.params?.categoryId;
  const category = categoryId ? getExpenseCategory(categoryId) : undefined;

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTransactions = useCallback(
    async (refreshing: boolean) => {
      if (!categoryId) return;

      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const stored = await getStoredUser();
        if (!stored?.uid) {
          setTransactions([]);
          return;
        }

        const now = new Date();
        const start = new Date(now);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);

        const baseQuery = query(
          transactionsCollection,
          where('userId', '==', stored.uid),
          orderBy('transactionDate', 'desc'),
        );

        const snapshot = await getDocs(baseQuery);

        const items: TransactionRecord[] = snapshot.docs
          .map((docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>) => {
            const data = docSnap.data() as FirebaseFirestoreTypes.DocumentData;
            const ts = data.transactionDate as
              | FirebaseFirestoreTypes.Timestamp
              | Date
              | undefined;
            const date =
              ts instanceof Date
                ? ts
                : ts &&
                  typeof (ts as FirebaseFirestoreTypes.Timestamp).toDate ===
                    'function'
                ? (ts as FirebaseFirestoreTypes.Timestamp).toDate()
                : new Date();

            const type = data.type as 'income' | 'expense' | undefined;
            const catId = data.categoryId as string | undefined;

            return {
              id: docSnap.id,
              amount: (data.amount as number) ?? 0,
              note: (data.note as string) ?? null,
              transactionDate: date,
              // dùng thêm trường phụ để lọc client-side
              // (không export ra ngoài interface TransactionRecord)
              // @ts-ignore
              _type: type,
              // @ts-ignore
              _categoryId: catId,
            } as any;
          })
          .filter((t: any) => {
            return (
              t.transactionDate >= start &&
              t.transactionDate <= end &&
              t._type === 'expense' &&
              t._categoryId === categoryId
            );
          })
          .map((t: any) => {
            const { _type, _categoryId, ...rest } = t;
            return rest as TransactionRecord;
          });

        setTransactions(items);
      } finally {
        refreshing ? setIsRefreshing(false) : setIsLoading(false);
      }
    },
    [categoryId],
  );

  useEffect(() => {
    loadTransactions(false);
  }, [loadTransactions]);

  const totalAmount = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const formatDateTime = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const onRefresh = () => {
    loadTransactions(true);
  };

  const IconComponent = category?.icon;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {IconComponent && (
            <IconComponent
              width={22}
              height={22}
              color={category?.color || colors.primary}
            />
          )}
          <Text style={styles.headerTitle}>
            {category?.name ?? 'Chi tiết chi tiêu'}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

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
        {/* Summary */}
        <View style={styles.summaryCard}>
          {IconComponent && (
            <View
              style={[
                styles.summaryIcon,
                { backgroundColor: (category?.color || colors.primary) + '20' },
              ]}
            >
              <IconComponent
                width={28}
                height={28}
                color={category?.color || colors.primary}
              />
            </View>
          )}
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryLabel}>
              Chi tiêu {category?.name ?? ''} tháng này
            </Text>
            <Text style={styles.summaryAmount}>
              -{totalAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, idx) => (
                <View key={idx} style={styles.skeletonItemRow}>
                  <Skeleton width={40} height={40} radius={12} />
                  <View style={styles.skeletonItemText}>
                    <Skeleton width="60%" height={14} />
                    <View style={{ height: 6 }} />
                    <Skeleton width="40%" height={12} />
                  </View>
                  <Skeleton width={80} height={14} />
                </View>
              ))}
            </>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Chưa có giao dịch nào cho danh mục này trong tháng hiện tại
              </Text>
            </View>
          ) : (
            transactions.map((t) => (
              <View key={t.id} style={styles.txItem}>
                <View style={styles.txInfo}>
                  <Text style={styles.txNote} numberOfLines={2}>
                    {t.note || 'Không có ghi chú'}
                  </Text>
                  <Text style={styles.txDate}>{formatDateTime(t.transactionDate)}</Text>
                </View>
                <Text style={styles.txAmount}>
                  -{t.amount.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.error,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  skeletonItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonItemText: {
    flex: 1,
    marginHorizontal: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txInfo: {
    flex: 1,
    marginRight: 12,
  },
  txNote: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
});

export default SpendingCategoryDetailScreen;

