import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../utils/color';
import { HomeDataChangedProvider } from '../../contexts/HomeDataChangedContext';
import { IncomePresetsProvider } from '../../contexts/IncomePresetsContext';
import { FundsProvider } from './screens/FundManagement/hooks/useFunds';
import BottomTabNavigator from './BottomTabNavigator';
import { AddTransactionScreen, DefaultFundSetupScreen, FinanceReportScreen, FundManagementScreen, IncomeSourcesScreen, NotificationsScreen } from './screens';
import SpendingCategoryDetailScreen from './screens/SpendingCategoryDetail/SpendingCategoryDetailScreen';
import { getStoredUser, setStoredUser } from '../../services';
import { getDefaultFundIfExists } from './screens/FundManagement/hooks/useFunds';

export type RootStackParamList = {
  DefaultFundSetup: undefined;
  MainTabs: undefined;
  AddTransaction:
    | undefined
    | {
        mode?: 'create' | 'edit';
        transactionId?: string;
        initialData?: {
          type: 'income' | 'expense';
          categoryId: string;
          amount: number;
          note?: string;
          transactionDate: string;
          fundId?: string;
        };
      };
  FinanceReport: undefined;
  Notifications: undefined;
  SpendingCategoryDetail:
    | {
        categoryId: string;
      }
    | undefined;
  FundManagement: undefined;
  IncomeSources: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['qlct://'],
  config: {
    screens: {
      DefaultFundSetup: 'default-fund-setup',
      MainTabs: 'tabs',
      AddTransaction: 'add-transaction',
      FinanceReport: 'finance-report',
      Notifications: 'notifications',
      FundManagement: 'fund-management',
      IncomeSources: 'income-sources',
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainScreenProps = {
  onLogout: () => void;
};

const MainScreen: React.FC<MainScreenProps> = ({ onLogout }) => {
  const [needsDefaultFundSetup, setNeedsDefaultFundSetup] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        const uid = stored?.uid ?? '';
        if (!uid) {
          if (!cancelled) setNeedsDefaultFundSetup(false);
          return;
        }
        // Có cache cờ "đã hoàn thành setup quỹ" → vào thẳng app, không check Firestore.
        if (stored?.hasCompletedFundSetup === true) {
          if (!cancelled) setNeedsDefaultFundSetup(false);
          return;
        }

        // Chưa có cache → check Firestore (chỉ query funds).
        const existing = await getDefaultFundIfExists(uid);
        if (!cancelled) {
          if (!existing) {
            setNeedsDefaultFundSetup(true);
          } else {
            setNeedsDefaultFundSetup(false);
            if (stored) {
              await setStoredUser({ ...stored, hasCompletedFundSetup: true });
            }
          }
        }
      } catch {
        if (!cancelled) setNeedsDefaultFundSetup(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navKey = useMemo(() => (needsDefaultFundSetup ? 'setup' : 'main'), [needsDefaultFundSetup]);

  if (needsDefaultFundSetup === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <HomeDataChangedProvider>
      <FundsProvider>
        <IncomePresetsProvider>
          <NavigationContainer linking={linking} key={navKey}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {needsDefaultFundSetup ? (
              <Stack.Screen name="DefaultFundSetup">
                {() => (
                  <DefaultFundSetupScreen
                    onCompleted={() => setNeedsDefaultFundSetup(false)}
                  />
                )}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="MainTabs">
                  {() => <BottomTabNavigator onLogout={onLogout} />}
                </Stack.Screen>
                <Stack.Screen
                  name="AddTransaction"
                  component={AddTransactionScreen}
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="FinanceReport"
                  component={FinanceReportScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="SpendingCategoryDetail"
                  component={SpendingCategoryDetailScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="FundManagement"
                  component={FundManagementScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="Notifications"
                  component={NotificationsScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="IncomeSources"
                  component={IncomeSourcesScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                  }}
                />
              </>
            )}
          </Stack.Navigator>
          </NavigationContainer>
        </IncomePresetsProvider>
      </FundsProvider>
    </HomeDataChangedProvider>
  );
};

export default MainScreen;
