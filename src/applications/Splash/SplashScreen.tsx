import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { getStoredUser, maybeResetUserTransactionsYearly } from '../../services';

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
          // Thử reset dữ liệu cũ nếu cần (hàng năm, giữ lại tháng 12 năm trước).
          try {
            await maybeResetUserTransactionsYearly(stored.uid);
          } catch (resetError) {
            // Không chặn luồng đăng nhập nếu reset lỗi, chỉ log lại.
            console.warn('Error running yearly reset:', resetError);
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
