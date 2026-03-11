export interface FundRecord {
  id: string;
  userId: string;
  name: string;
  balance: number;
  color?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
