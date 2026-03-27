export type SnackbarType = 'success' | 'error' | 'info';

export type SnackbarOptions = {
  message: string;
  type?: SnackbarType;
  durationMs?: number;
};

type SnackbarHandler = (options: SnackbarOptions) => void;

let handler: SnackbarHandler | null = null;

export const registerSnackbarHandler = (impl: SnackbarHandler) => {
  handler = impl;
};

export const showSnackbar = (options: SnackbarOptions) => {
  if (!handler) {
    // Nếu provider chưa mount thì bỏ qua, tránh crash
    return;
  }
  // Defer sang tick sau để tránh giật animation khi đang đóng modal.
  const impl = handler;
  setTimeout(() => {
    impl(options);
  }, 0);
};

