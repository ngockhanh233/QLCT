import {
  EXPENDITURE_CATEGORIES,
  ExpenditureCategory,
  getCategoryById as getExpenseCategoryById,
} from '../constants/ExpenditureCategoryConstants';
import {
  INCOME_CATEGORIES,
  IncomeCategory,
  getIncomeCategoryById,
} from '../constants/IncomeCategoryConstants';
import {
  FIXED_INCOME_CATEGORIES,
  FIXED_EXPENSE_CATEGORIES,
  FixedCategory,
  getFixedIncomeCategoryById,
  getFixedExpenseCategoryById,
} from '../constants/FixedCategoryConstants';
import { OtherIcon, OtherIncomeIcon } from '../assets/icons/categories';

export type CategoryType = 'income' | 'expense' | 'fixed_income' | 'fixed_expense';

export interface CategoryInfo {
  id: string;
  name: string;
  icon: React.FC<{ width?: number; height?: number; color?: string }>;
  color: string;
}

const DEFAULT_EXPENSE_CATEGORY: CategoryInfo = {
  id: 'other',
  name: 'Khác',
  icon: OtherIcon,
  color: '#9E9E9E',
};

const DEFAULT_INCOME_CATEGORY: CategoryInfo = {
  id: 'other',
  name: 'Khác',
  icon: OtherIncomeIcon,
  color: '#9E9E9E',
};

export const getCategoryInfo = (categoryId: string, type: CategoryType): CategoryInfo => {
  let category: ExpenditureCategory | IncomeCategory | FixedCategory | undefined;

  switch (type) {
    case 'income':
      category = getIncomeCategoryById(categoryId);
      return category || DEFAULT_INCOME_CATEGORY;

    case 'expense':
      category = getExpenseCategoryById(categoryId);
      return category || DEFAULT_EXPENSE_CATEGORY;

    case 'fixed_income':
      category = getFixedIncomeCategoryById(categoryId);
      return category || DEFAULT_INCOME_CATEGORY;

    case 'fixed_expense':
      category = getFixedExpenseCategoryById(categoryId);
      return category || DEFAULT_EXPENSE_CATEGORY;

    default:
      return DEFAULT_EXPENSE_CATEGORY;
  }
};

export const getAllCategories = (type: CategoryType): CategoryInfo[] => {
  switch (type) {
    case 'income':
      return INCOME_CATEGORIES;
    case 'expense':
      return EXPENDITURE_CATEGORIES;
    case 'fixed_income':
      return FIXED_INCOME_CATEGORIES;
    case 'fixed_expense':
      return FIXED_EXPENSE_CATEGORIES;
    default:
      return [];
  }
};

export const getIncomeCategory = (categoryId: string): CategoryInfo => {
  return getCategoryInfo(categoryId, 'income');
};

export const getExpenseCategory = (categoryId: string): CategoryInfo => {
  return getCategoryInfo(categoryId, 'expense');
};

export const getFixedIncomeCategory = (categoryId: string): CategoryInfo => {
  return getCategoryInfo(categoryId, 'fixed_income');
};

export const getFixedExpenseCategory = (categoryId: string): CategoryInfo => {
  return getCategoryInfo(categoryId, 'fixed_expense');
};
