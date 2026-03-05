import React from 'react';
import {
  SalaryIcon,
  RentalIcon,
  InterestIcon,
  PensionIcon,
  AllowanceIcon,
  OtherIncomeIcon,
  HousingIcon,
  ElectricityIcon,
  WaterIcon,
  PhoneIcon,
  InternetIcon,
  InsuranceIcon,
  LoanIcon,
  SubscriptionIcon,
  OtherIcon,
} from '../assets/icons/categories';

export interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export type IconComponent = React.FC<IconProps>;

export interface FixedCategory {
  id: string;
  name: string;
  icon: IconComponent;
  color: string;
}

export const FIXED_INCOME_CATEGORIES: FixedCategory[] = [
  { id: 'salary', name: 'Lương', color: '#4CAF50', icon: SalaryIcon },
  { id: 'rental', name: 'Cho thuê', color: '#795548', icon: RentalIcon },
  { id: 'interest', name: 'Lãi tiết kiệm', color: '#2196F3', icon: InterestIcon },
  { id: 'pension', name: 'Lương hưu', color: '#FF5722', icon: PensionIcon },
  { id: 'allowance', name: 'Trợ cấp', color: '#9C27B0', icon: AllowanceIcon },
  { id: 'other', name: 'Khác', color: '#9E9E9E', icon: OtherIncomeIcon },
];

export const FIXED_EXPENSE_CATEGORIES: FixedCategory[] = [
  { id: 'housing', name: 'Tiền nhà', color: '#E91E63', icon: HousingIcon },
  { id: 'electricity', name: 'Tiền điện', color: '#FFC107', icon: ElectricityIcon },
  { id: 'water', name: 'Tiền nước', color: '#2196F3', icon: WaterIcon },
  { id: 'phone', name: 'Điện thoại', color: '#9C27B0', icon: PhoneIcon },
  { id: 'internet', name: 'Internet', color: '#00BCD4', icon: InternetIcon },
  { id: 'insurance', name: 'Bảo hiểm', color: '#4CAF50', icon: InsuranceIcon },
  { id: 'loan', name: 'Trả nợ/Vay', color: '#F44336', icon: LoanIcon },
  { id: 'subscription', name: 'Đăng ký', color: '#FF9800', icon: SubscriptionIcon },
  { id: 'other', name: 'Khác', color: '#9E9E9E', icon: OtherIcon },
];

export const getFixedIncomeCategoryById = (id: string): FixedCategory | undefined => {
  return FIXED_INCOME_CATEGORIES.find(category => category.id === id);
};

export const getFixedExpenseCategoryById = (id: string): FixedCategory | undefined => {
  return FIXED_EXPENSE_CATEGORIES.find(category => category.id === id);
};
