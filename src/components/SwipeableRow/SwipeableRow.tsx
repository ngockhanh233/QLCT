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
  onDelete?: () => void;
  editText?: string;
  deleteText?: string;
  borderRadius?: number;
}

const BUTTON_WIDTH = 70;
const SWIPE_THRESHOLD = BUTTON_WIDTH;

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onEdit,
  onDelete,
  editText = 'Sửa',
  deleteText = 'Xóa',
  borderRadius = 16,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const buttonCount = (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
  const maxSwipe = BUTTON_WIDTH * buttonCount;

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
        const newValue = Math.min(0, Math.max(-maxSwipe, gestureState.dx));
        translateX.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: -maxSwipe,
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
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{editText}</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, deleteButtonStyle]}
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
    width: BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
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
