import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../utils/color';

export interface AppSwitchProps {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  /** Tint khi bật (mặc định primary). */
  activeColor?: string;
  /** Tint khi tắt (mặc định grey nhạt). */
  inactiveColor?: string;
  /** Màu cục thumb (mặc định trắng). */
  thumbColor?: string;
  disabled?: boolean;
  /** Kích cỡ tổng thể: 'sm' (44×24) | 'md' (52×30) — mặc định 'md'. */
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const SIZES = {
  sm: { width: 32, height: 18, thumb: 12, padding: 3 },
  md: { width: 40, height: 22, thumb: 16, padding: 3 },
} as const;

const AppSwitch: React.FC<AppSwitchProps> = ({
  value,
  onValueChange,
  activeColor = colors.primary,
  inactiveColor = colors.inputBackground,
  thumbColor = colors.white,
  disabled = false,
  size = 'md',
  style,
}) => {
  const dims = SIZES[size];
  const travel = dims.width - dims.thumb - dims.padding * 2;
  // Tách 2 driver: thumb dùng native (smooth, không phụ thuộc JS thread),
  // backgroundColor phải dùng JS driver (RN hạn chế).
  const animNative = useRef(new Animated.Value(value ? 1 : 0)).current;
  const animJs = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animNative, {
        toValue: value ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(animJs, {
        toValue: value ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [value, animNative, animJs]);

  const trackColor = animJs.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  const translateX = animNative.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travel],
  });

  const handlePress = () => {
    if (disabled) return;
    onValueChange?.(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.pressable, disabled && { opacity: 0.5 }, style]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: dims.width,
            height: dims.height,
            borderRadius: dims.height / 2,
            padding: dims.padding,
            backgroundColor: trackColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: dims.thumb,
              height: dims.thumb,
              borderRadius: dims.thumb / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  track: {
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default AppSwitch;
