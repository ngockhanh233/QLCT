import React from 'react';
import {
  FundWalletIcon,
  FundPiggyBankIcon,
  FundBudgetIcon,
  FundMoneyIcon,
  FundHomeIcon,
  FundProfileIcon,
  FundCalendarIcon,
  FundBellIcon,
  FundPlaneIcon,
  FundHeartIcon,
  FundShieldIcon,
  FundChartIcon,
  FundGiftIcon,
  FundGraduationIcon,
  FundHealthIcon,
  FundMotorbikeIcon,
} from '../assets/icons/funds/index';
import { FuelIcon, TransportIcon } from '../assets/icons/categories';

export interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export type IconComponent = React.FC<IconProps>;

export interface FundIconDef {
  id: string;
  name: string;
  icon: IconComponent;
}

export const FUND_ICON_OPTIONS: FundIconDef[] = [
  { id: 'piggy', name: 'Heo tiết kiệm', icon: FundPiggyBankIcon },
  { id: 'wallet', name: 'Ví', icon: FundWalletIcon },
  { id: 'money', name: 'Tiền', icon: FundMoneyIcon },
  { id: 'budget', name: 'Ngân sách', icon: FundBudgetIcon },
  { id: 'home', name: 'Nhà', icon: FundHomeIcon },
  // { id: 'transport', name: 'Xe', icon: TransportIcon },
  // { id: 'fuel', name: 'Xăng', icon: FuelIcon },
  { id: 'motorbike', name: 'Xe máy', icon: FundMotorbikeIcon },
  { id: 'plane', name: 'Du lịch', icon: FundPlaneIcon },
  { id: 'graduation', name: 'Học hành', icon: FundGraduationIcon },
  { id: 'heart', name: 'Cưới hỏi', icon: FundHeartIcon },
  { id: 'health', name: 'Y tế', icon: FundHealthIcon },
  { id: 'shield', name: 'Khẩn cấp', icon: FundShieldIcon },
  { id: 'chart', name: 'Đầu tư', icon: FundChartIcon },
  { id: 'gift', name: 'Quà tặng', icon: FundGiftIcon },
  { id: 'profile', name: 'Hồ sơ', icon: FundProfileIcon },
  { id: 'calendar', name: 'Lịch', icon: FundCalendarIcon },
  // { id: 'bell', name: 'Chuông', icon: FundBellIcon },
];

export const DEFAULT_FUND_ICON_ID = 'piggy';

export function getFundIconComponent(iconId?: string | null): IconComponent {
  const found = FUND_ICON_OPTIONS.find((x) => x.id === iconId);
  return found?.icon ?? getFundIconComponent(DEFAULT_FUND_ICON_ID);
}

