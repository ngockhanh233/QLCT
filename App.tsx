/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  LogBox,
  Text,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfirmProvider, SnackbarProvider } from './src/components';
import SplashScreen from './src/applications/Splash/SplashScreen';
import MainScreen from './src/applications/Main/MainScreen';
import LoginScreen from './src/applications/Auth/LoginScreen';

LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);

type AppScreen = 'splash' | 'login' | 'main';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');

  const handleSplashFinish = (isLoggedIn: boolean) => {
    setCurrentScreen(isLoggedIn ? 'main' : 'login');
  };

  const handleLoginSuccess = () => {
    setCurrentScreen('main');
  };

  const handleLogout = () => {
    setCurrentScreen('login');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onFinish={handleSplashFinish} />;
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case 'main':
        return <MainScreen onLogout={handleLogout} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SnackbarProvider>
        <ConfirmProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={styles.container}>
            {renderScreen()}
          </View>
        </ConfirmProvider>
      </SnackbarProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
