import React from 'react';
import {
  BonusIcon,
  AllowanceIcon,
  FreelanceIcon,
  InvestmentIcon,
  InterestIcon,
  DividendIcon,
  RentalIcon,
  SellIcon,
  RefundIcon,
  OtherIncomeIcon,
} from '../assets/icons/categories';

export interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export type IconComponent = React.FC<IconProps>;

export interface IncomeCategory {
  id: string;
  name: string;
  icon: IconComponent;
  color: string;
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
  // Thưởng & Phúc lợi
  {
    id: 'bonus',
    name: 'Thưởng',
    icon: BonusIcon,
    color: '#FF9800',
  },
  {
    id: 'allowance',
    name: 'Phụ cấp',
    icon: AllowanceIcon,
    color: '#2196F3',
  },

  // Kinh doanh & Bán hàng
  {
    id: 'sell',
    name: 'Bán hàng',
    icon: SellIcon,
    color: '#E91E63',
  },
  {
    id: 'freelance',
    name: 'Làm thêm',
    icon: FreelanceIcon,
    color: '#9C27B0',
  },

  // Thanh lý & Hoàn tiền
  {
    id: 'liquidation',
    name: 'Thanh lý',
    icon: SellIcon,
    color: '#795548',
  },
  {
    id: 'refund',
    name: 'Hoàn tiền',
    icon: RefundIcon,
    color: '#607D8B',
  },

  // Đầu tư & Lãi
  {
    id: 'investment',
    name: 'Đầu tư',
    icon: InvestmentIcon,
    color: '#00BCD4',
  },
  {
    id: 'interest',
    name: 'Lãi suất',
    icon: InterestIcon,
    color: '#3F51B5',
  },
  {
    id: 'dividend',
    name: 'Cổ tức',
    icon: DividendIcon,
    color: '#009688',
  },

  // Quà tặng & Khác
  {
    id: 'gift',
    name: 'Quà tặng',
    icon: BonusIcon,
    color: '#F44336',
  },
  {
    id: 'rental',
    name: 'Cho thuê',
    icon: RentalIcon,
    color: '#4CAF50',
  },
  {
    id: 'debt_collection',
    name: 'Thu nợ',
    icon: RefundIcon,
    color: '#FF9800',
  },
  {
    id: 'other_income',
    name: 'Khác',
    icon: OtherIncomeIcon,
    color: '#9E9E9E',
  },
];

export const getIncomeCategoryById = (id: string): IncomeCategory | undefined => {
  return INCOME_CATEGORIES.find(category => category.id === id);
};

export const getIncomeCategoriesByGroup = () => {
  return {
    bonus: INCOME_CATEGORIES.filter(c => ['bonus', 'allowance'].includes(c.id)),
    business: INCOME_CATEGORIES.filter(c => ['sell', 'freelance'].includes(c.id)),
    liquidation: INCOME_CATEGORIES.filter(c => ['liquidation', 'refund'].includes(c.id)),
    investment: INCOME_CATEGORIES.filter(c => ['investment', 'interest', 'dividend'].includes(c.id)),
    other: INCOME_CATEGORIES.filter(c =>
      ['gift', 'rental', 'debt_collection', 'other_income'].includes(c.id),
    ),
  };
};
