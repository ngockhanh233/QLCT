import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItem,
  Pressable,
} from 'react-native';
import { colors } from '../../utils/color';

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const CENTER_OFFSET = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => n.toString().padStart(2, '0');

const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Chọn giờ',
}) => {
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(value.getHours());
  const [minute, setMinute] = useState(value.getMinutes());
  const hourListRef = useRef<FlatList<number>>(null);
  const minuteListRef = useRef<FlatList<number>>(null);

  const open = () => {
    setHour(value.getHours());
    setMinute(value.getMinutes());
    setVisible(true);
  };

  // Khi modal mở, scroll wheel tới vị trí giờ/phút hiện tại.
  useEffect(() => {
    if (!visible) return;
    const h = value.getHours();
    const m = value.getMinutes();
    requestAnimationFrame(() => {
      hourListRef.current?.scrollToOffset({ offset: h * ITEM_HEIGHT, animated: false });
      minuteListRef.current?.scrollToOffset({ offset: m * ITEM_HEIGHT, animated: false });
    });
  }, [visible, value]);

  const handleConfirm = () => {
    const newDate = new Date(value);
    newDate.setHours(hour, minute, 0, 0);
    onChange(newDate);
    setVisible(false);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  const onHourScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setHour(Math.max(0, Math.min(23, idx)));
  };

  const onMinuteScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setMinute(Math.max(0, Math.min(59, idx)));
  };

  const renderHourItem = useCallback<ListRenderItem<number>>(
    ({ item }) => {
      const isSelected = item === hour;
      return (
        <View style={styles.item}>
          <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
            {pad(item)}
          </Text>
        </View>
      );
    },
    [hour],
  );

  const renderMinuteItem = useCallback<ListRenderItem<number>>(
    ({ item }) => {
      const isSelected = item === minute;
      return (
        <View style={styles.item}>
          <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
            {pad(item)}
          </Text>
        </View>
      );
    },
    [minute],
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={styles.input}
        onPress={open}
        activeOpacity={0.7}
      >
        <Text style={styles.inputText}>
          {value
            ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
            : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancel}
          />
          <View style={styles.modal}>
            <Text style={styles.title}>Chọn giờ</Text>

            <View style={styles.pickerRow}>
              <View
                pointerEvents="none"
                style={[styles.selectionIndicator, { pointerEvents: 'none' }]}
              />

              <View style={styles.wheel}>
                <FlatList
                  ref={hourListRef}
                  data={HOURS}
                  keyExtractor={(i) => `h-${i}`}
                  renderItem={renderHourItem}
                  extraData={hour}
                  getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                  })}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={onHourScrollEnd}
                  contentContainerStyle={styles.wheelContent}
                />
              </View>

              <Text style={styles.separator}>:</Text>

              <View style={styles.wheel}>
                <FlatList
                  ref={minuteListRef}
                  data={MINUTES}
                  keyExtractor={(i) => `m-${i}`}
                  renderItem={renderMinuteItem}
                  extraData={minute}
                  getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                  })}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  onMomentumScrollEnd={onMinuteScrollEnd}
                  contentContainerStyle={styles.wheelContent}
                />
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmText}>Chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: colors.text,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: CENTER_OFFSET,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  wheel: {
    flex: 1,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  wheelContent: {
    paddingVertical: CENTER_OFFSET,
  },
  separator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginHorizontal: 4,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  itemTextSelected: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  confirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default TimePicker;
