import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import {
  getStoredUser,
  ensureUserProfile,
  maybeResetUserTransactionsYearly,
} from '../../services';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: (isLoggedIn: boolean) => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const stored = await getStoredUser();

        if (stored?.uid) {
          try {
            await ensureUserProfile(stored);
            // maybeResetUserTransactionsYearly: năm đã dọn ưu tiên AsyncStorage, không có mới đọc Firestore
            await maybeResetUserTransactionsYearly(stored.uid);
          } catch (resetError) {
            console.warn('Error ensure profile / yearly reset:', resetError);
          }
        }

        onFinish(!!stored);
      } catch (error) {
        console.error('Error checking auth:', error);
        onFinish(false);
      }
    };

    checkAuth();
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/img/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
  },
});

export default SplashScreen;
