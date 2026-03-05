import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../../utils/color';
import { SnackbarOptions, SnackbarType, registerSnackbarHandler } from '../../utils/snackbar';

type InternalState = {
  visible: boolean;
  message: string;
  type: SnackbarType;
};

const DEFAULT_STATE: InternalState = {
  visible: false,
  message: '',
  type: 'info',
};

const TYPE_COLORS: Record<SnackbarType, { background: string; text: string }> = {
  success: { background: colors.success, text: colors.white },
  error: { background: colors.error, text: colors.white },
  info: { background: colors.text, text: colors.white },
};

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<InternalState>(DEFAULT_STATE);
  const translateY = useState(new Animated.Value(80))[0];
  const opacity = useState(new Animated.Value(0))[0];

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 80,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setState(prev => ({ ...prev, visible: false }));
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (options: SnackbarOptions) => {
      const type: SnackbarType = options.type ?? 'info';
      const duration = options.durationMs ?? 2500;

      setState({
        visible: true,
        message: options.message,
        type,
      });

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide
      setTimeout(hide, duration);
    },
    [hide, opacity, translateY],
  );

  useEffect(() => {
    registerSnackbarHandler(show);
  }, [show]);

  const theme = TYPE_COLORS[state.type];

  return (
    <>
      {children}
      {state.visible && (
        <Animated.View
          style={[
            styles.wrapper,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.snackbar,
              { backgroundColor: theme.background },
            ]}
          >
            <Text
              style={[
                styles.message,
                { color: theme.text },
              ]}
              numberOfLines={2}
            >
              {state.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snackbar: {
    maxWidth: '90%',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SnackbarProvider;

