import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Modal from 'react-native-modal';
import { colors } from '../../utils/color';
import { ConfirmOptions, registerConfirmHandler } from '../../utils/confirm';

type Resolver = (value: boolean) => void;

interface ConfirmState extends ConfirmOptions {
  visible: boolean;
}

const defaultState: ConfirmState = {
  visible: false,
  title: '',
  message: '',
  confirmText: 'Đồng ý',
  cancelText: 'Hủy',
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmState>(defaultState);
  const resolverRef = useRef<Resolver | null>(null);

  useEffect(() => {
    registerConfirmHandler(async (options) => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setState({
          visible: true,
          title: options.title,
          message: options.message,
          confirmText: options.confirmText ?? 'Đồng ý',
          cancelText: options.cancelText ?? 'Hủy',
        });
      });
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleResult = useCallback(
    (value: boolean) => {
      if (resolverRef.current) {
        resolverRef.current(value);
        resolverRef.current = null;
      }
      close();
    },
    [close],
  );

  return (
    <>
      {children}
      <Modal
        isVisible={state.visible}
        onBackdropPress={() => handleResult(false)}
        onBackButtonPress={() => handleResult(false)}
        useNativeDriver
        hideModalContentWhileAnimating
      >
        <View style={styles.container}>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              activeOpacity={0.8}
              onPress={() => handleResult(false)}
            >
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                {state.cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              activeOpacity={0.8}
              onPress={() => handleResult(true)}
            >
              <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                {state.confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonSecondary: {
    backgroundColor: colors.backgroundSecondary,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: colors.text,
  },
  buttonTextPrimary: {
    color: colors.white,
  },
});

export default ConfirmProvider;

