export interface FundRecord {
  id: string;
  userId: string;
  name: string;
  balance: number;
  color?: string;
  icon?: string | null;
  isDefault?: boolean;
  /** Mục tiêu tiết kiệm (tùy chọn). */
  goalAmount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
