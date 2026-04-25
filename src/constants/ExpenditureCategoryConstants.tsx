import React from 'react';
import {
  FoodIcon,
  CoffeeIcon,
  TransportIcon,
  FuelIcon,
  ShoppingIcon,
  ClothesIcon,
  ElectricityIcon,
  WaterIcon,
  InternetIcon,
  PhoneIcon,
  RentIcon,
  SubscriptionIcon,
  EntertainmentIcon,
  MovieIcon,
  TravelIcon,
  HealthIcon,
  MedicineIcon,
  GymIcon,
  EducationIcon,
  BookIcon,
  FamilyIcon,
  PetIcon,
  InsuranceIcon,
  InvestmentIcon,
  GiftIcon,
  CharityIcon,
  OtherIcon,
  TaxIcon,
  RepairIcon,
  BeautyIcon,
  HieuHiIcon,
  LuckyMoneyOutIcon,
} from '../assets/icons/categories';

export interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export type IconComponent = React.FC<IconProps>;

export interface ExpenditureCategory {
  id: string;
  name: string;
  icon: IconComponent;
  color: string; // màu gợi ý, có thể override khi render
}

export const EXPENDITURE_CATEGORIES: ExpenditureCategory[] = [
  // Hay dùng
  {
    id: 'food',
    name: 'Ăn uống',
    icon: FoodIcon,
    color: '#FF6B35',
  },
  {
    id: 'rent',
    name: 'Tiền nhà',
    icon: RentIcon,
    color: '#795548',
  },
  {
    id: 'coffee',
    name: 'Cà phê',
    icon: CoffeeIcon,
    color: '#8B4513',
  },

  // Di chuyển
  {
    id: 'transport',
    name: 'Di chuyển',
    icon: TransportIcon,
    color: '#4A90D9',
  },
  {
    id: 'fuel',
    name: 'Xăng xe',
    icon: FuelIcon,
    color: '#2E7D32',
  },

  // Mua sắm
  {
    id: 'shopping',
    name: 'Mua sắm',
    icon: ShoppingIcon,
    color: '#E91E63',
  },
  {
    id: 'clothes',
    name: 'Quần áo',
    icon: ClothesIcon,
    color: '#9C27B0',
  },

  // Hóa đơn & Tiện ích
  {
    id: 'electricity',
    name: 'Tiền điện',
    icon: ElectricityIcon,
    color: '#FFC107',
  },
  {
    id: 'water',
    name: 'Tiền nước',
    icon: WaterIcon,
    color: '#03A9F4',
  },
  {
    id: 'internet',
    name: 'Internet',
    icon: InternetIcon,
    color: '#3F51B5',
  },
  {
    id: 'phone',
    name: 'Điện thoại',
    icon: PhoneIcon,
    color: '#00BCD4',
  },
  {
    id: 'subscription',
    name: 'Đăng ký',
    icon: SubscriptionIcon,
    color: '#FF9800',
  },

  // Giải trí
  {
    id: 'entertainment',
    name: 'Giải trí',
    icon: EntertainmentIcon,
    color: '#9C27B0',
  },
  {
    id: 'movie',
    name: 'Xem phim',
    icon: MovieIcon,
    color: '#673AB7',
  },
  {
    id: 'travel',
    name: 'Du lịch',
    icon: TravelIcon,
    color: '#00BCD4',
  },

  // Sức khỏe
  {
    id: 'health',
    name: 'Sức khỏe',
    icon: HealthIcon,
    color: '#F44336',
  },
  {
    id: 'medicine',
    name: 'Thuốc men',
    icon: MedicineIcon,
    color: '#4CAF50',
  },
  {
    id: 'gym',
    name: 'Gym/Thể thao',
    icon: GymIcon,
    color: '#FF5722',
  },

  // Giáo dục
  {
    id: 'education',
    name: 'Giáo dục',
    icon: EducationIcon,
    color: '#2196F3',
  },
  {
    id: 'books',
    name: 'Sách vở',
    icon: BookIcon,
    color: '#4CAF50',
  },

  // Gia đình
  {
    id: 'family',
    name: 'Gia đình',
    icon: FamilyIcon,
    color: '#E91E63',
  },
  {
    id: 'pet',
    name: 'Thú cưng',
    icon: PetIcon,
    color: '#8D6E63',
  },

  // Tài chính
  {
    id: 'insurance',
    name: 'Bảo hiểm',
    icon: InsuranceIcon,
    color: '#607D8B',
  },
  {
    id: 'investment',
    name: 'Đầu tư',
    icon: InvestmentIcon,
    color: '#4CAF50',
  },
  {
    id: 'tax',
    name: 'Thuế',
    icon: TaxIcon,
    color: '#455A64',
  },

  // Dịch vụ & Sửa chữa
  {
    id: 'repair',
    name: 'Sửa chữa',
    icon: RepairIcon,
    color: '#6D4C41',
  },
  {
    id: 'beauty',
    name: 'Làm đẹp',
    icon: BeautyIcon,
    color: '#EC407A',
  },

  // Xã giao
  {
    id: 'hieu_hi',
    name: 'Hiếu hỉ',
    icon: HieuHiIcon,
    color: '#AD1457',
  },
  {
    id: 'lucky_money_out',
    name: 'Lì xì',
    icon: LuckyMoneyOutIcon,
    color: '#D81B60',
  },

  // Khác
  {
    id: 'gift',
    name: 'Quà tặng',
    icon: GiftIcon,
    color: '#E91E63',
  },
  {
    id: 'charity',
    name: 'Từ thiện',
    icon: CharityIcon,
    color: '#FF5722',
  },
  {
    id: 'other',
    name: 'Khác',
    icon: OtherIcon,
    color: '#9E9E9E',
  },
];

export const getCategoryById = (id: string): ExpenditureCategory | undefined => {
  return EXPENDITURE_CATEGORIES.find(category => category.id === id);
};

export const getCategoriesByGroup = () => {
  return {
    food: EXPENDITURE_CATEGORIES.filter(c => ['food', 'coffee'].includes(c.id)),
    transport: EXPENDITURE_CATEGORIES.filter(c => ['transport', 'fuel'].includes(c.id)),
    shopping: EXPENDITURE_CATEGORIES.filter(c => ['shopping', 'clothes'].includes(c.id)),
    bills: EXPENDITURE_CATEGORIES.filter(c => ['electricity', 'water', 'internet', 'phone', 'rent'].includes(c.id)),
    entertainment: EXPENDITURE_CATEGORIES.filter(c => ['entertainment', 'movie', 'travel'].includes(c.id)),
    health: EXPENDITURE_CATEGORIES.filter(c => ['health', 'medicine', 'gym'].includes(c.id)),
    education: EXPENDITURE_CATEGORIES.filter(c => ['education', 'books'].includes(c.id)),
    family: EXPENDITURE_CATEGORIES.filter(c => ['family', 'pet'].includes(c.id)),
    finance: EXPENDITURE_CATEGORIES.filter(c =>
      ['insurance', 'investment', 'tax'].includes(c.id),
    ),
    services: EXPENDITURE_CATEGORIES.filter(c => ['repair', 'beauty'].includes(c.id)),
    social: EXPENDITURE_CATEGORIES.filter(c =>
      ['hieu_hi', 'lucky_money_out'].includes(c.id),
    ),
    other: EXPENDITURE_CATEGORIES.filter(c => ['gift', 'charity', 'other'].includes(c.id)),
  };
};
