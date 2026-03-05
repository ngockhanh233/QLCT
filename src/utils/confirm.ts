import { Alert } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;

let handler: ConfirmHandler | null = null;

export const registerConfirmHandler = (impl: ConfirmHandler) => {
  handler = impl;
};

export const confirm = async (options: ConfirmOptions): Promise<boolean> => {
  if (handler) {
    return handler(options);
  }

  // Fallback: nếu ConfirmProvider chưa đăng ký handler,
  // dùng Alert gốc của React Native để vẫn có popup xác nhận.
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        {
          text: options.cancelText ?? 'Hủy',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirmText ?? 'Đồng ý',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true },
    );
  });
};

