import React, { useEffect, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { colors } from '../../../../../utils/color';
import { DatePicker, TimePicker, CurrencyInput } from '../../../../../components';
import { showSnackbar } from '../../../../../utils/snackbar';

interface EditNoteDateModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  hint?: string;
  initialNote: string;
  initialDate: Date;
  /** Khi truyền, modal hiển thị thêm field "Số tiền" và truyền vào onSave. */
  initialAmount?: number;
  amountLabel?: string;
  onSave: (
    note: string | null,
    date: Date,
    amount?: number,
  ) => Promise<void>;
  successMessage?: string;
}

const EditNoteDateModal: React.FC<EditNoteDateModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  hint,
  initialNote,
  initialDate,
  initialAmount,
  amountLabel = 'Số tiền',
  onSave,
  successMessage = 'Đã cập nhật',
}) => {
  const [note, setNote] = useState(initialNote);
  const [date, setDate] = useState<Date>(initialDate);
  const [amount, setAmount] = useState<number>(initialAmount ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const showAmount = initialAmount !== undefined;

  useEffect(() => {
    if (visible) {
      setNote(initialNote);
      setDate(initialDate);
      setAmount(initialAmount ?? 0);
    }
  }, [visible, initialNote, initialDate, initialAmount]);

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (showAmount && amount <= 0) {
      showSnackbar({ message: 'Vui lòng nhập số tiền', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        note.trim() ? note.trim() : null,
        date,
        showAmount ? amount : undefined,
      );
      showSnackbar({ message: successMessage, type: 'success' });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật';
      showSnackbar({ message: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.modal}
      avoidKeyboard
    >
      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          {showAmount && (
            <>
              <Text style={styles.label}>{amountLabel}</Text>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                placeholder="0"
                inputWrapperStyle={styles.amountWrap}
                inputStyle={styles.amountText}
                suffixStyle={styles.amountSuffix}
              />
            </>
          )}

          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Nhập ghi chú..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Ngày giờ</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <DatePicker
                label="Ngày"
                value={date}
                onChange={(picked) => {
                  const next = new Date(picked);
                  next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  setDate(next);
                }}
                placeholder="Chọn ngày"
              />
            </View>
            <View style={styles.timeCol}>
              <TimePicker label="Giờ" value={date} onChange={setDate} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleClose}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, isSaving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.confirmText}>Lưu</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    margin: 20,
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  body: {
    paddingBottom: 10,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    fontStyle: 'italic',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  noteInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  amountWrap: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountText: { fontSize: 18, fontWeight: '800', color: colors.text },
  amountSuffix: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1.4,
  },
  timeCol: {
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1.4,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.white,
  },
});

export default EditNoteDateModal;
