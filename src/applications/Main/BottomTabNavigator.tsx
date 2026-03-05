import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  HomeScreen,
  TransactionScreen,
  AddScreen,
  BudgetScreen,
  ProfileScreen,
} from './screens';
import HomeIcon from '../../assets/icons/WalletIcon';
import TransactionIcon from '../../assets/icons/TransactionIcon';
import AddIcon from '../../assets/icons/AddIcon';
import MoneyIcon from '../../assets/icons/BudgetIcon';
import ProfileIcon from '../../assets/icons/UserIcon';
import { colors } from '../../utils/color';
import { RootStackParamList } from './MainScreen';

export type BottomTabParamList = {
  Home: undefined;
  Transaction: undefined;
  Add: undefined;
  Budget: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

type BottomTabNavigatorProps = {
  onLogout: () => void;
};

const BottomTabNavigator: React.FC<BottomTabNavigatorProps> = ({ onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Trang chủ',
          tabBarIcon: ({ color }) => (
            <HomeIcon width={22} height={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Transaction"
        component={TransactionScreen}
        options={{
          tabBarLabel: 'Giao dịch',
          tabBarIcon: ({ color }) => (
            <TransactionIcon width={22} height={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <View style={styles.addButton}>
              <AddIcon width={28} height={28} color={colors.white} />
            </View>
          ),
          tabBarButton: (props) => {
            const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
            return (
              <TouchableOpacity
                style={props.style}
                onPress={() => navigation.navigate('AddTransaction')}
                activeOpacity={0.8}
              >
                {props.children}
              </TouchableOpacity>
            );
          },
        }}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          tabBarLabel: 'Cố định',
          tabBarIcon: ({ color }) => (
            <MoneyIcon width={22} height={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Cá nhân',
          tabBarIcon: ({ color }) => (
            <ProfileIcon width={22} height={22} color={color} />
          ),
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default BottomTabNavigator;
