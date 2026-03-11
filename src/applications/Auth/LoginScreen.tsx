import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { colors } from '../../utils/color';
import { setStoredUser, type AuthStoredUser } from '../../services';
import { ErrorPopup } from '../../components';

const { width } = Dimensions.get('window');

const firebaseAuth = getAuth(getApp());

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '694988244061-eal0hgrkrbuk6fi66gtto2cb96ul59h3.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      
      if (!response.data?.idToken) {
        throw new Error('Không lấy được idToken từ Google');
      }

      const googleCredential = GoogleAuthProvider.credential(response.data.idToken);
      const userCredential = await signInWithCredential(firebaseAuth, googleCredential);

      const baseUser: AuthStoredUser = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
      };

      await setStoredUser(baseUser);

      onLoginSuccess();
    } catch (error: any) {
      let message = 'Đã xảy ra lỗi. Vui lòng thử lại';

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        message = 'Đăng nhập bị hủy';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        message = 'Đang xử lý đăng nhập...';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        message = 'Google Play Services không khả dụng';
      }

      setErrorMessage(message);
      setErrorVisible(true);
      console.error('Google Sign-In Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/img/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>QLCT</Text>
          <Text style={styles.heroTitle}>Quản lý chi tiêu{"\n"}thông minh mỗi ngày</Text>
          <Text style={styles.heroSubtitle}>
            Kết nối tài khoản Google của bạn để đồng bộ dữ liệu và theo dõi tài chính dễ dàng.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập tài khoản</Text>
          <Text style={styles.cardSubtitle}>
            Chỉ mất vài giây với Google, không cần tạo mật khẩu.
          </Text>

          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <View style={styles.googleButtonContent}>
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.helperText}>
            Bằng việc tiếp tục, bạn đồng ý với{" "}
            <Text style={styles.helperLink}>Điều khoản sử dụng</Text> và{" "}
            <Text style={styles.helperLink}>Chính sách bảo mật</Text> của chúng tôi.
          </Text>
        </View>
      </ScrollView>

      <ErrorPopup
        visible={errorVisible}
        title="Lỗi"
        message={errorMessage}
        onClose={() => setErrorVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  hero: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 80,
    marginBottom: -56,
    overflow: 'hidden',
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 4,
  },
  logoWrapper: {
    width: width * 0.22,
    height: width * 0.22,
    borderRadius: (width * 0.22) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: '70%',
    height: '70%',
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    marginTop: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 16,
    lineHeight: 18,
  },
  helperLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
