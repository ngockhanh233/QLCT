export interface FundRecord {
  id: string;
  userId: string;
  name: string;
  balance: number;
  color?: string;
  icon?: string | null;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
