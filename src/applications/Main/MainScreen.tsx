import React from 'react';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeDataChangedProvider } from '../../contexts/HomeDataChangedContext';
import { FixedItemsProvider } from './screens/Budget/hooks/useFixedItems';
import BottomTabNavigator from './BottomTabNavigator';
import { AddTransactionScreen, FinanceReportScreen } from './screens';
import SpendingCategoryDetailScreen from './screens/SpendingCategoryDetail/SpendingCategoryDetailScreen';

export type RootStackParamList = {
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
        };
      };
  FinanceReport: undefined;
  SpendingCategoryDetail:
    | {
        categoryId: string;
      }
    | undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['qlct://'],
  config: {
    screens: {
      MainTabs: 'tabs',
      AddTransaction: 'add-transaction',
      FinanceReport: 'finance-report',
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type MainScreenProps = {
  onLogout: () => void;
};

const MainScreen: React.FC<MainScreenProps> = ({ onLogout }) => {
  return (
    <HomeDataChangedProvider>
      <FixedItemsProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
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
          </Stack.Navigator>
        </NavigationContainer>
      </FixedItemsProvider>
    </HomeDataChangedProvider>
  );
};

export default MainScreen;
