import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../../../../utils/color';
import { CurrencyInput } from '../../../../components';
import { getStoredUser, setStoredUser } from '../../../../services';
import { createDefaultFundWithInitialBalance } from '../FundManagement/hooks/useFunds';
import { useFunds } from '../FundManagement/hooks/useFunds';

type DefaultFundSetupScreenProps = {
  onCompleted: () => void;
};

const DefaultFundSetupScreen: React.FC<DefaultFundSetupScreenProps> = ({ onCompleted }) => {
  const insets = useSafeAreaInsets();
  const { refresh } = useFunds();

  const [userId, setUserId] = useState<string>('');
  const [amount, setAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredUser();
        if (!cancelled) setUserId(stored?.uid ?? '');
      } catch {
        if (!cancelled) setUserId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canContinue = useMemo(() => !!userId && !isSaving, [userId, isSaving]);

  const handleContinue = async () => {
    if (!userId) return;
    if (!Number.isFinite(amount) || amount < 0) return;

    setIsSaving(true);
    try {
      await createDefaultFundWithInitialBalance(userId, amount);
      await refresh();
      const stored = await getStoredUser();
      if (stored?.uid === userId) {
        await setStoredUser({ ...stored, hasCompletedFundSetup: true });
      }
      onCompleted();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(16, insets.bottom) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thiết lập quỹ mặc định</Text>
        <Text style={styles.headerSubtitle}>
          Lần đầu sử dụng, bạn nhập số dư ban đầu để bắt đầu theo dõi biến động số dư.
        </Text>
      </View>

      <LinearGradient
        colors={['#FFF5EC', '#FFE2C7', '#FFD3AA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.cardLabel}>Số dư ban đầu (Quỹ mặc định)</Text>
        <CurrencyInput
          value={amount}
          onChange={setAmount}
          placeholder="0"
          inputWrapperStyle={styles.amountInput}
          inputStyle={styles.amountText}
          suffixStyle={styles.amountSuffix}
        />
        <Text style={styles.cardHint}>
          Bạn có thể chỉnh số dư lại sau trong mục Quản lý quỹ.
        </Text>
      </LinearGradient>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Vào trang chủ</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    minHeight: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  amountInput: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#FFD4A8',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  amountText: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },
  amountSuffix: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  cardHint: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    marginTop: 18,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default DefaultFundSetupScreen;

