import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Text,
  ViewStyle,
} from 'react-native';
import { colors } from '../../utils/color';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit?: () => void;
  /** Nút hành động thứ hai (ví dụ: Rút tiền) nằm giữa Edit và Delete. */
  onSecondary?: () => void;
  onDelete?: () => void;
  editText?: string;
  /** Nhãn cho nút thứ hai (mặc định: 'Khác') */
  secondaryText?: string;
  deleteText?: string;
  /** Màu nền cho nút thứ hai (mặc định dùng secondary color). */
  secondaryButtonColor?: string;
  /** Optional background color for the right-most action button (default uses error color). */
  deleteButtonColor?: string;
  borderRadius?: number;
  /** Chiều rộng mỗi nút (mặc định 70, dùng 85 cho "Nạp tiền") */
  buttonWidth?: number;
}

const DEFAULT_BUTTON_WIDTH = 70;

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onEdit,
  onSecondary,
  onDelete,
  editText = 'Sửa',
  secondaryText = 'Khác',
  deleteText = 'Xóa',
  secondaryButtonColor = colors.secondary,
  deleteButtonColor = colors.error,
  borderRadius = 16,
  buttonWidth = DEFAULT_BUTTON_WIDTH,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const buttonCount =
    (onEdit ? 1 : 0) + (onSecondary ? 1 : 0) + (onDelete ? 1 : 0);
  const maxSwipe = buttonWidth * buttonCount;
  const maxSwipeRef = useRef(maxSwipe);
  maxSwipeRef.current = maxSwipe;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderGrant: () => {
        translateX.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        const limit = maxSwipeRef.current;
        const newValue = Math.min(0, Math.max(-limit, gestureState.dx));
        translateX.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        
        if (gestureState.dx < -buttonWidth) {
          Animated.spring(translateX, {
            toValue: -maxSwipeRef.current,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const handleEdit = () => {
    closeSwipe();
    onEdit?.();
  };

  const handleSecondary = () => {
    closeSwipe();
    onSecondary?.();
  };

  const handleDelete = () => {
    closeSwipe();
    onDelete?.();
  };

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
  };

  const deleteButtonStyle: ViewStyle = {
    borderTopRightRadius: borderRadius,
    borderBottomRightRadius: borderRadius,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.actionsContainer}>
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton, { width: buttonWidth }]}
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{editText}</Text>
          </TouchableOpacity>
        )}
        {onSecondary && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              { width: buttonWidth, backgroundColor: secondaryButtonColor },
            ]}
            onPress={handleSecondary}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{secondaryText}</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.deleteButton,
              deleteButtonStyle,
              { width: buttonWidth, backgroundColor: deleteButtonColor },
            ]}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{deleteText}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Animated.View
        style={[
          styles.rowContent,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: colors.error,
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  actionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  rowContent: {
    backgroundColor: colors.white,
  },
});

export default SwipeableRow;
