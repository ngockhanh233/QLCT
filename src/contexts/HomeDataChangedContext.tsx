import React, { createContext, useCallback, useRef, useContext } from 'react';

type HomeDataChangedContextValue = {
  /** Gọi khi có thêm/sửa/xóa giao dịch hoặc khoản cố định → Home sẽ refresh khi vào tab */
  markHomeDataChanged: () => void;
  /** Home gọi khi focus: nếu có thay đổi thì trả true và xóa flag, sau đó Home refresh */
  getAndClearNeedsRefresh: () => boolean;
  /** Gọi khi thêm/sửa giao dịch → tab Giao dịch sẽ refresh khi vào lại */
  markTransactionListNeedsRefresh: () => void;
  /** Tab Giao dịch gọi khi focus: nếu true thì refresh list rồi xóa flag */
  getAndClearTransactionListNeedsRefresh: () => boolean;
};

const HomeDataChangedContext = createContext<HomeDataChangedContextValue | null>(null);

export const HomeDataChangedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const needsRefreshRef = useRef(false);
  const transactionListNeedsRefreshRef = useRef(false);

  const markHomeDataChanged = useCallback(() => {
    needsRefreshRef.current = true;
  }, []);

  const getAndClearNeedsRefresh = useCallback(() => {
    const v = needsRefreshRef.current;
    needsRefreshRef.current = false;
    return v;
  }, []);

  const markTransactionListNeedsRefresh = useCallback(() => {
    transactionListNeedsRefreshRef.current = true;
  }, []);

  const getAndClearTransactionListNeedsRefresh = useCallback(() => {
    const v = transactionListNeedsRefreshRef.current;
    transactionListNeedsRefreshRef.current = false;
    return v;
  }, []);

  const value: HomeDataChangedContextValue = {
    markHomeDataChanged,
    getAndClearNeedsRefresh,
    markTransactionListNeedsRefresh,
    getAndClearTransactionListNeedsRefresh,
  };

  return (
    <HomeDataChangedContext.Provider value={value}>
      {children}
    </HomeDataChangedContext.Provider>
  );
};

export function useHomeDataChanged(): HomeDataChangedContextValue {
  const ctx = useContext(HomeDataChangedContext);
  if (!ctx) {
    return {
      markHomeDataChanged: () => {},
      getAndClearNeedsRefresh: () => false,
      markTransactionListNeedsRefresh: () => {},
      getAndClearTransactionListNeedsRefresh: () => false,
    };
  }
  return ctx;
}
